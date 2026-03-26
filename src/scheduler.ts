import { fetchAndParseDiaryMerged } from "./diary/parser";
import { upsertHomework, getNextWeekdayHomework, getNextWeekdayDate, tasksToLessons, GROUP1_SUFFIX } from "./db/homework";
import { sendTelegramNotification, sendTelegramAuthErrorNotification } from "./notifications/telegram";
import { sendMaxNotification, sendMaxAuthErrorNotification } from "./notifications/max";

async function sendToAllMessengers(
    date: string,
    lessons: ReturnType<typeof tasksToLessons>,
    isUpdate?: boolean,
) {
    const results = await Promise.allSettled([
        sendTelegramNotification(date, lessons, undefined, isUpdate),
        sendMaxNotification(date, lessons, undefined, isUpdate),
    ]);
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            const name = i === 0 ? "Telegram" : "MAX";
            console.error(`Ошибка отправки в ${name}:`, result.reason);
        }
    });
}

const DEBUG_SEND_EVERY_MINUTE = process.env.DEBUG_SEND_EVERY_MINUTE === 'true';

// Время ежедневного планового уведомления
const NOTIFICATION_HOUR = 19;
const NOTIFICATION_MINUTE = 20;

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

        setTimeout(async () => {
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
            setTimeout(async () => {
                try {
                    const { date, tasks } = await getNextWeekdayHomework();

                    if (!tasks || Object.keys(tasks).length === 0) {
                        console.log(
                            `Нет ДЗ на ${date} → уведомление не отправлено`,
                        );
                        return;
                    }

                    await sendToAllMessengers(date, tasksToLessons(tasks));
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

export function startScheduler() {
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
            const currentWeekDays = await fetchAndParseDiaryMerged(0);

            if (currentWeekDays.length === 0) {
                console.warn("Парсер вернул пустой массив для текущей недели.");
                await Promise.allSettled([
                    sendTelegramAuthErrorNotification(),
                    sendMaxAuthErrorNotification(),
                ]);
                return;
            }

            for (const day of currentWeekDays) {
                const tasks: Record<string, string> = {};
                day.lessons.forEach((lesson) => {
                    tasks[lesson.subject] = lesson.task;
                    if (lesson.task_group_1) {
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

                for (const day of nextWeekDays) {
                    const tasks: Record<string, string> = {};
                    day.lessons.forEach((lesson) => {
                        tasks[lesson.subject] = lesson.task;
                        if (lesson.task_group_1) {
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
