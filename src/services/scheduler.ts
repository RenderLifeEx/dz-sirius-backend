import { fetchAndParseDiary } from "./parser";
import { upsertHomework } from "../db/homework";

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

    // Каждые 5 минут
    setInterval(fetchAndSave, 5 * 60 * 1000);
}
