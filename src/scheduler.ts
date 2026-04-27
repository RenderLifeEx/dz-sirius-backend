import { fetchAndParseDiaryMerged, isVacationWeek } from "./diary/parser";
import { upsertHomework, getNextWeekdayHomework, getNextWeekdayDate, getHomeworkRecordForDate, markHomeworkNotified, getAllHomeworkFromToday, tasksToLessons, GROUP1_SUFFIX } from "./db/homework";
import { sendTelegramNotification, sendTelegramAuthErrorNotification } from "./notifications/telegram";
import { sendMaxNotification, sendMaxAuthErrorNotification } from "./notifications/max";

export async function sendToAllMessengers(
    date: string,
    lessons: ReturnType<typeof tasksToLessons>,
    isUpdate?: boolean,
    isAfterVacation?: boolean,
) {
    const results = await Promise.allSettled([
        sendTelegramNotification(date, lessons, undefined, isUpdate, isAfterVacation),
        sendMaxNotification(date, lessons, undefined, isUpdate, isAfterVacation),
    ]);
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            const name = i === 0 ? "Telegram" : "MAX";
            console.error(`Ошибка отправки в ${name}:`, result.reason);
        }
    });
}

const DEBUG_SEND_EVERY_MINUTE = process.env.DEBUG_SEND_EVERY_MINUTE === 'true';

let pendingNotificationTimeout: ReturnType<typeof setTimeout> | null = null;
let nextNotificationAt: Date | null = null;

/** Возвращает дату и время следующей запланированной отправки */
export function getNextNotificationTime(): Date | null {
    return nextNotificationAt;
}

/** Отменяет запланированное плановое уведомление и перепланирует следующее */
export function cancelPendingNotification(): boolean {
    if (pendingNotificationTimeout !== null) {
        clearTimeout(pendingNotificationTimeout);
        pendingNotificationTimeout = null;
        console.log("Плановое уведомление отменено вручную → перепланирование");
        scheduleNextNotification();
        return true;
    }
    return false;
}

// Время ежедневного планового уведомления
const NOTIFICATION_HOUR = 17;
const NOTIFICATION_MINUTE = 40;

/** true, если текущее время ≥ 17:40 (плановое уведомление уже ушло) */
function isAfterDailyNotification(): boolean {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return h > NOTIFICATION_HOUR || (h === NOTIFICATION_HOUR && m >= NOTIFICATION_MINUTE);
}

function scheduleNextNotification() {
    const now = new Date();

    // ──────────────────────────────
    // Режим отладки: каждую минуту
    // ──────────────────────────────
    if (DEBUG_SEND_EVERY_MINUTE) {
        const delayMs = 60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());

        console.log(
            `[DEBUG] Отправка каждую минуту включена → следующая через ~${Math.round(delayMs/1000)} сек`
        );

        const debugTarget = new Date(Date.now() + delayMs);
        nextNotificationAt = debugTarget;
        pendingNotificationTimeout = setTimeout(async () => {
            pendingNotificationTimeout = null;
            nextNotificationAt = null;
            try {
                const { date, tasks } = await getNextWeekdayHomework();

                if (tasks && Object.keys(tasks).length > 0) {
                    await sendToAllMessengers(date, tasksToLessons(tasks));
                } else {
                    console.log("[DEBUG] Нет ДЗ на следующий учебный день");
                }
            } catch (err) {
                console.error("[DEBUG] Ошибка при тестовой отправке:", err);
            }

            // сразу планируем следующую минуту
            scheduleNextNotification();
        }, delayMs);

        return; // выходим, чтобы не запускать обычный график
    }

    // ──────────────────────────────
    // Обычный режим (пн–пт в 17:40)
    // ──────────────────────────────
    const dayOfWeek = now.getDay(); // 0=вс, 1=пн, ..., 6=сб

    // Только пн-пт
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const target = new Date(now);
        target.setHours(NOTIFICATION_HOUR, NOTIFICATION_MINUTE, 0, 0);

        // Если уже прошло время сегодня → планируем на завтра
        if (now > target) {
            target.setDate(target.getDate() + 1);
            // Если завтра суббота → пропускаем до понедельника
            const tomorrowDay = target.getDay();
            if (tomorrowDay === 6) {
                target.setDate(target.getDate() + 2);
            } else if (tomorrowDay === 0) {
                target.setDate(target.getDate() + 1);
            }
        }

        const delayMs = target.getTime() - now.getTime();

        if (delayMs > 0) {
            console.log(
                `[${now.toISOString()}] Запланирована отправка ДЗ на ${target.toLocaleString("ru-RU")}`,
            );
            nextNotificationAt = target;
            pendingNotificationTimeout = setTimeout(async () => {
                pendingNotificationTimeout = null;
                nextNotificationAt = null;
                try {
                    const { date, tasks, notifiedAt } = await getNextWeekdayHomework();

                    if (!tasks || Object.keys(tasks).length === 0) {
                        // Нет ДЗ на следующий будний день — возможно каникулы.
                        // Ищем ближайший день с ДЗ в БД (он фиксирован все каникулы).
                        const upcoming = await getAllHomeworkFromToday();
                        const first = upcoming.find(r => Object.keys(r.tasks).length > 0);

                        if (!first) {
                            console.log(`Нет ДЗ на ${date} и нет ближайших ДЗ в базе → уведомление не отправлено`);
                        } else {
                            const record = await getHomeworkRecordForDate(first.date);
                            if (record?.notifiedAt) {
                                console.log(`Каникулы: ближайшее ДЗ (${first.date}) уже отправлялось → пропускаем`);
                            } else {
                                console.log(`Каникулы: нет ДЗ на ${date}, отправляем ближайшее ДЗ (${first.date})`);
                                await sendToAllMessengers(first.date, tasksToLessons(first.tasks), false, true);
                                await markHomeworkNotified(first.date);
                            }
                        }
                        scheduleNextNotification();
                        return;
                    }

                    if (notifiedAt) {
                        console.log(`ДЗ на ${date} уже отправлялось (${notifiedAt.toISOString()}) → пропускаем`);
                        scheduleNextNotification();
                        return;
                    }

                    await sendToAllMessengers(date, tasksToLessons(tasks));
                    await markHomeworkNotified(date);
                } catch (err) {
                    console.error(
                        "Ошибка при отправке планового уведомления:",
                        err,
                    );
                }

                // После выполнения планируем следующее
                scheduleNextNotification();
            }, delayMs);
        }
    }
}

export function startDiaryParsingScheduler() {
    const fetchAndSave = async () => {
        try {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота

            // Дата следующего учебного дня — именно на неё уходит плановое уведомление.
            // Если ДЗ на эту дату изменилось после 17:40, шлём уведомление об обновлении.
            const nextWeekdayDate = getNextWeekdayDate();
            const afterNotification = isAfterDailyNotification();

            // Всегда парсим текущую неделю (week.0)
            console.log(
                `[${now.toISOString()}] Парсинг текущей недели (week.0)`,
            );
            let currentWeekDays: Awaited<ReturnType<typeof fetchAndParseDiaryMerged>>;
            try {
                currentWeekDays = await fetchAndParseDiaryMerged(0);
            } catch (err: any) {
                console.error("Ошибка авторизации при парсинге дневника:", err.message ?? err);
                await Promise.allSettled([
                    sendTelegramAuthErrorNotification(),
                    sendMaxAuthErrorNotification(),
                ]);
                return;
            }

            if (currentWeekDays.length === 0) {
                console.log("Парсер вернул пустой массив для текущей недели — вероятно каникулы, уведомление не отправляется.");
                return;
            }

            for (const day of currentWeekDays) {
                const tasks: Record<string, string> = {};
                day.lessons.forEach((lesson) => {
                    tasks[lesson.subject] = lesson.task;
                    if (lesson.task_group_1 !== undefined) {
                        tasks[`${lesson.subject}${GROUP1_SUFFIX}`] = lesson.task_group_1;
                    }
                });

                if (Object.keys(tasks).length > 0) {
                    const { changed } = await upsertHomework(day.date, tasks);
                    console.log(`Сохранено/обновлено ДЗ для ${day.date}`);

                    if (changed && afterNotification && day.date === nextWeekdayDate) {
                        console.log(`ДЗ на ${day.date} изменилось после планового уведомления → отправляем обновление`);
                        await sendToAllMessengers(day.date, tasksToLessons(tasks), true);
                    }
                }
            }

            // Дополнительно парсим следующую неделю ТОЛЬКО по пятницам, субботам и воскресеньям
            // 5 = пятница, 6 = суббота, 0 = воскресенье
            if ([0, 5, 6].includes(dayOfWeek)) {
                console.log(
                    `[${now.toISOString()}] Парсинг СЛЕДУЮЩЕЙ недели (week.-1)`,
                );
                const nextWeekDays = await fetchAndParseDiaryMerged(-1);

                if (nextWeekDays.length === 0 && await isVacationWeek(-1)) {
                    // Следующая неделя — каникулы, парсим неделю через две (week.-2)
                    console.log(`[${now.toISOString()}] Следующая неделя — каникулы, парсим через две недели (week.-2)`);
                    const afterVacationDays = await fetchAndParseDiaryMerged(-2);

                    for (const day of afterVacationDays) {
                        const tasks: Record<string, string> = {};
                        day.lessons.forEach((lesson) => {
                            tasks[lesson.subject] = lesson.task;
                            if (lesson.task_group_1 !== undefined) {
                                tasks[`${lesson.subject}${GROUP1_SUFFIX}`] = lesson.task_group_1;
                            }
                        });

                        if (Object.keys(tasks).length > 0) {
                            await upsertHomework(day.date, tasks);
                            console.log(`Сохранено/обновлено ДЗ (после каникул) для ${day.date}`);
                        }
                    }
                } else {
                    for (const day of nextWeekDays) {
                        const tasks: Record<string, string> = {};
                        day.lessons.forEach((lesson) => {
                            tasks[lesson.subject] = lesson.task;
                            if (lesson.task_group_1 !== undefined) {
                                tasks[`${lesson.subject}${GROUP1_SUFFIX}`] = lesson.task_group_1;
                            }
                        });

                        if (Object.keys(tasks).length > 0) {
                            const { changed } = await upsertHomework(day.date, tasks);
                            console.log(
                                `Сохранено/обновлено ДЗ (след. неделя) для ${day.date}`,
                            );

                            if (changed && afterNotification && day.date === nextWeekdayDate) {
                                console.log(`ДЗ на ${day.date} изменилось после планового уведомления → отправляем обновление`);
                                await sendToAllMessengers(day.date, tasksToLessons(tasks), true);
                            }
                        }
                    }
                }
            }

            console.log("Парсинг завершён успешно");
        } catch (error) {
            console.error("Ошибка в scheduler:", error);
        }
    };

    // Первый запуск сразу
    fetchAndSave();

    // Каждые 10 минут
    setInterval(fetchAndSave, 10 * 60 * 1000);

    // Планирование отправки уведомлений
    console.log("Запуск планировщика уведомлений Telegram и MAX...");
    scheduleNextNotification();
}
