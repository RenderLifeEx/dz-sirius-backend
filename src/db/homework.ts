import { db } from "./db";
import { homework } from "./schema";
import { sql } from "drizzle-orm";
import type { Lesson } from "../diary/parser";

export type Tasks = Record<string, string>; // { "Математика": "с. 72 (р.т.)", ... }

export const GROUP1_SUFFIX = "::group1";

/** Преобразует Tasks из БД в массив Lesson для Telegram-уведомления */
export function tasksToLessons(tasks: Tasks): Lesson[] {
    return Object.entries(tasks)
        .filter(([subject]) => !subject.endsWith(GROUP1_SUFFIX))
        .map(([subject, task]) => ({
            subject,
            task: String(task),
            task_group_1: tasks[`${subject}${GROUP1_SUFFIX}`],
        }));
}

/** Стабильная сериализация: ключи отсортированы, чтобы порядок не влиял на сравнение */
function sortedStringify(obj: Tasks): string {
    return JSON.stringify(
        Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
    );
}

/**
 * Сохраняет/обновляет ДЗ для даты.
 * Возвращает `{ changed: true }`, если задание отличается от того, что было в БД.
 */
export async function upsertHomework(
    date: string,
    tasks: Tasks,
): Promise<{ changed: boolean }> {
    const existing = await getHomeworkForDate(date);
    const changed = !existing || sortedStringify(existing) !== sortedStringify(tasks);

    await db
        .insert(homework)
        .values({ date, tasks })
        .onConflictDoUpdate({
            target: homework.date,
            set: {
                tasks,
                updatedAt: sql`NOW()`,
            },
        });

    return { changed };
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

/** Возвращает дату следующего будного дня в формате "дд.мм.гггг" */
export function getNextWeekdayDate(): string {
    const nextDate = new Date();

    do {
        nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6); // 0 = вс, 6 = сб

    const dd = String(nextDate.getDate()).padStart(2, "0");
    const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
    const yyyy = nextDate.getFullYear();

    return `${dd}.${mm}.${yyyy}`;
}

/**
 * Возвращает домашнее задание на следующий будний день
 * (пропускает субботу и воскресенье)
 */
export async function getNextWeekdayHomework(): Promise<{
    date: string;
    tasks: Tasks | null;
}> {
    const nextDateStr = getNextWeekdayDate();
    const tasks = await getHomeworkForDate(nextDateStr);

    return { date: nextDateStr, tasks };
}
