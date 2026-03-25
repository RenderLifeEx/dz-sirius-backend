import * as cheerio from "cheerio";
import { fetchDiaryPage } from "./auth";

export interface Lesson {
    subject: string;
    task: string;
    task_group_1?: string; // ДЗ для группы 1 (второй аккаунт), только для английского
}

export interface Day {
    date: string;
    lessons: Lesson[];
}

// Предмет, у которого две группы с разными учителями
const ENGLISH_SUBJECT = "Иностранный язык (английский)";

export async function fetchAndParseDiary(
    weekOffset: number = 0,
    credentials?: { username: string; password: string },
): Promise<Day[]> {
    let html: string;

    try {
        html = await fetchDiaryPage(weekOffset, credentials);
    } catch (err) {
        console.error(
            `Не удалось загрузить страницу для week.${weekOffset}:`,
            err,
        );
        return [];
    }

    const $ = cheerio.load(html);
    const days: Day[] = [];
    const currentYear = new Date().getFullYear().toString();

    $("#dnevnikDays .dnevnik-day").each((_, dayElem) => {
        const title = $(dayElem).find(".dnevnik-day__title").text().trim();
        const dateMatch = title.match(/, (\d{2}\.\d{2})/);
        if (!dateMatch) return;

        const date = `${dateMatch[1]}.${currentYear}`;

        const lessons: Lesson[] = [];

        $(dayElem)
            .find(".dnevnik-day__lessons .dnevnik-lesson")
            .each((_, lessonElem) => {
                const subject = $(lessonElem)
                    .find(
                        ".dnevnik-lesson__subject .js-rt_licey-dnevnik-subject",
                    )
                    .text()
                    .trim();

                const taskElem = $(lessonElem).find(".dnevnik-lesson__task");

                // Заменяем видимый текст каждой ссылки на её полный href,
                // чтобы усечённые подписи вида "https://..." не терялись
                taskElem.find("a[href]").each((_, a) => {
                    const href = $(a).attr("href");
                    if (href) $(a).text(href);
                });

                let task = taskElem.text().replace(/\s+/g, " ").trim();

                if (subject && task && task.toLowerCase() !== "без задания") {
                    lessons.push({ subject, task });
                }
            });

        if (lessons.length > 0) {
            days.push({ date, lessons });
        }
    });

    if (days.length === 0) {
        console.warn(
            "Получен пустой результат — возможно проблема с авторизацией",
        );
    }

    return days;
}

/**
 * Получает ДЗ от обоих аккаунтов и мержит:
 * если у второго аккаунта (группа 1) есть английский — добавляет task_group_1
 * к соответствующему уроку из первого аккаунта (группа 2).
 */
export async function fetchAndParseDiaryMerged(weekOffset: number = 0): Promise<Day[]> {
    const username2 = process.env.SIRIUS_USERNAME_2;
    const password2 = process.env.SIRIUS_PASSWORD_2;

    // Запускаем оба парсера параллельно
    const [mainDays, group1Days] = await Promise.all([
        fetchAndParseDiary(weekOffset),
        username2 && password2
            ? fetchAndParseDiary(weekOffset, { username: username2, password: password2 })
            : Promise.resolve([] as Day[]),
    ]);

    if (!username2 || !password2 || group1Days.length === 0) {
        return mainDays;
    }

    // Строим карту: date → subject → task для группы 1
    const group1Map = new Map<string, Map<string, string>>();
    for (const day of group1Days) {
        const subjectMap = new Map<string, string>();
        for (const lesson of day.lessons) {
            subjectMap.set(lesson.subject, lesson.task);
        }
        group1Map.set(day.date, subjectMap);
    }

    // Мержим: если английский есть у группы 1 → добавляем task_group_1
    return mainDays.map((day) => {
        const group1Subjects = group1Map.get(day.date);
        if (!group1Subjects) return day;

        const mergedLessons = day.lessons.map((lesson) => {
            if (lesson.subject === ENGLISH_SUBJECT) {
                const group1Task = group1Subjects.get(ENGLISH_SUBJECT);
                if (group1Task) {
                    return { ...lesson, task_group_1: group1Task };
                }
            }
            return lesson;
        });

        return { ...day, lessons: mergedLessons };
    });
}
