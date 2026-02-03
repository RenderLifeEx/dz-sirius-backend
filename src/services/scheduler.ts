import { fetchAndParseDiary } from "./parser";
import { upsertHomework, getNextWeekdayHomework } from "../db/homework";
import { sendTelegramNotification } from "./telegramService";

const DEBUG_SEND_EVERY_MINUTE = process.env.DEBUG_SEND_EVERY_MINUTE === 'true';

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
                    const homeworkArray = Object.entries(tasks).map(([subject, task]) => ({
                        subject,
                        task: String(task),
                    }));
                    await sendTelegramNotification(date, homeworkArray);
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
    // Обычный режим (пн–пт в 17:50/18:40)
    // ──────────────────────────────
    const dayOfWeek = now.getDay(); // 0=вс, 1=пн, ..., 6=сб

    // Определяем, в какое время сегодня нужно отправить (если ещё не отправляли)
    let targetHour = 18;
    let targetMinute = 40;

    // Чт и Пт — 17:50
    if (dayOfWeek === 4 || dayOfWeek === 5) {
        targetHour = 17;
        targetMinute = 50;
    }

    // Только пн-пт
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const target = new Date(now);
        target.setHours(targetHour, targetMinute, 0, 0);

        // Если уже прошло время сегодня → планируем на завтра
        if (now > target) {
            target.setDate(target.getDate() + 1);
            // Если завтра суббота → пропускаем до понедельника
            let tomorrowDay = target.getDay();
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

                    const homeworkArray = Object.entries(tasks).map(
                        ([subject, task]) => ({
                            subject,
                            task: String(task),
                        }),
                    );

                    await sendTelegramNotification(date, homeworkArray);
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

            // Всегда парсим текущую неделю (week.0)
            console.log(
                `[${now.toISOString()}] Парсинг текущей недели (week.0)`,
            );
            const currentWeekDays = await fetchAndParseDiary(0);

            for (const day of currentWeekDays) {
                const tasks: Record<string, string> = {};
                day.lessons.forEach((lesson) => {
                    tasks[lesson.subject] = lesson.task;
                });

                if (Object.keys(tasks).length > 0) {
                    await upsertHomework(day.date, tasks);
                    console.log(`Сохранено/обновлено ДЗ для ${day.date}`);
                }
            }

            // Дополнительно парсим следующую неделю ТОЛЬКО по пятницам, субботам и воскресеньям
            // 5 = пятница, 6 = суббота, 0 = воскресенье
            if ([0, 5, 6].includes(dayOfWeek)) {
                console.log(
                    `[${now.toISOString()}] Парсинг СЛЕДУЮЩЕЙ недели (week.-1)`,
                );
                const nextWeekDays = await fetchAndParseDiary(-1);

                for (const day of nextWeekDays) {
                    const tasks: Record<string, string> = {};
                    day.lessons.forEach((lesson) => {
                        tasks[lesson.subject] = lesson.task;
                    });

                    if (Object.keys(tasks).length > 0) {
                        await upsertHomework(day.date, tasks);
                        console.log(
                            `Сохранено/обновлено ДЗ (след. неделя) для ${day.date}`,
                        );
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

    // Каждые 30 минут
    setInterval(fetchAndSave, 30 * 60 * 1000);

    // Планирование отправки уведомлений
    console.log("Запуск планировщика уведомлений Telegram...");
    scheduleNextNotification();
}
