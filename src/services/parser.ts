import * as cheerio from "cheerio";
import { fetchDiaryPage } from "./authAndFetch";

export interface Lesson {
    subject: string;
    task: string;
}

export interface Day {
    date: string;
    lessons: Lesson[];
}

let cookies = "";

export function setCookies(newCookies: string) {
    cookies = newCookies;
}

export function getCookies(): string {
    return cookies;
}

export async function fetchAndParseDiary(
    weekOffset: number = 0,
): Promise<Day[]> {
    let html: string;

    try {
        html = await fetchDiaryPage(weekOffset);
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

                let task = $(lessonElem)
                    .find(".dnevnik-lesson__task")
                    .text()
                    .trim();

                // чистим
                task = task
                    .replace(/<[^>]*>/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

                if (subject && task && task.toLowerCase() !== "без задания") {
                    lessons.push({ subject, task });
                }
            });

        if (lessons.length > 0) {
            days.push({ date, lessons });
        }
    });

    // Если ничего не спарсилось — можно здесь же попробовать ещё раз с принудительным обновлением токена
    if (days.length === 0) {
        console.warn(
            "Получен пустой результат — возможно проблема с авторизацией",
        );
        // При желании можно здесь сбросить cachedJwt = null и попробовать ещё раз
    }

    return days;
}
