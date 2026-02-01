import { fetchAndParseDiary } from "./parser";
import { upsertHomework } from "../db/homework";

export function startScheduler() {
    const fetchAndSave = async () => {
        try {
            const days = await fetchAndParseDiary();
            for (const day of days) {
                const tasks: Record<string, string> = {};
                day.lessons.forEach((lesson) => {
                    tasks[lesson.subject] = lesson.task;
                });

                if (Object.keys(tasks).length > 0) {
                    await upsertHomework(day.date, tasks);
                    console.log(`Saved/updated homework for ${day.date}`);
                }
            }
            console.log("Diary parsed and saved to DB");
        } catch (error) {
            console.error("Error in scheduler:", error);
        }
    };

    fetchAndSave(); // Первый запуск
    setInterval(fetchAndSave, 5 * 60 * 1000); // Раз в 5 минут
}
