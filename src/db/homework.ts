import { db } from "./db";
import { homework } from "./schema";
import { sql } from "drizzle-orm";

export type Tasks = Record<string, string>; // { "Математика": "с. 72 (р.т.)", ... }

export async function upsertHomework(
    date: string,
    tasks: Tasks,
): Promise<void> {
    await db
        .insert(homework)
        .values({
            date,
            tasks,
        })
        .onConflictDoUpdate({
            target: homework.date,
            set: {
                tasks,
                updatedAt: sql`NOW()`,
            },
        });
}

export async function getHomeworkForDate(date: string): Promise<Tasks | null> {
    const result = await db.query.homework.findFirst({
        where: (h, { eq }) => eq(h.date, date),
        columns: { tasks: true },
    });

    return result?.tasks ?? null;
}

export async function getTodayHomework(): Promise<Tasks | null> {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();

    const dateStr = `${dd}.${mm}.${yyyy}`;

    return getHomeworkForDate(dateStr);
}

/**
 * Возвращает домашнее задание на следующий будний день
 * (пропускает субботу и воскресенье)
 */
export async function getNextWeekdayHomework(): Promise<{
    date: string;
    tasks: Tasks | null;
}> {
    let nextDate = new Date();

    // Добавляем дни, пока не получим будний день (понедельник–пятница)
    do {
        nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6); // 0 = воскресенье, 6 = суббота

    const dd = String(nextDate.getDate()).padStart(2, "0");
    const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
    const yyyy = nextDate.getFullYear();

    const nextDateStr = `${dd}.${mm}.${yyyy}`;

    const tasks = await getHomeworkForDate(nextDateStr);

    return {
        date: nextDateStr,
        tasks,
    };
}
