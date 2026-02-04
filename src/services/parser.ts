import axios from "axios";
import * as cheerio from "cheerio";

export interface Lesson {
    subject: string;
    task: string;
}

interface Day {
    date: string; // e.g., "26.01.2026"
    lessons: Lesson[];
}

// https://class.sirius-ft.ru/authorize?force_login=yes_please
export async function fetchAndParseDiary(
    weekOffset: number = 0,
): Promise<Day[]> {
    const url = `https://class.sirius-ft.ru/journal-app/u.22933/week.${weekOffset}`;

    const headers = {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        priority: "u=0, i",
        referer: "https://class.sirius-ft.ru/authorize?force_login=yes_please",
        "sec-ch-ua":
            '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    };

    const cookies =
        "ej_fp=44da03879e9bb1a630f5b583c9f63664; ej_id=ecb8a0f4-68a9-49f5-b766-cf1964fccb0f; ej_check=b7c9d16013e213a33263a72f0a585a46; _ym_uid=1769585314549787020; _ym_d=1769585314; ej_id=4c4247b5-51d5-4364-bd58-ce52590c62b9; ej_check=88ac932fbd892724edd2f9a66467945f; ej_id=ecb8a0f4-68a9-49f5-b766-cf1964fccb0f; _ym_isad=2; ej_fonts=9bf2d9ee388d305bcbcd6a87442a682f3609650a; ej_fp=44da03879e9bb1a630f5b583c9f63664; _ym_visorc=w; ej_check=b7c9d16013e213a33263a72f0a585a46; school_domain=sirs0001; jwt_v_2=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJlajpzaXJzOnNpcnMwMDAxIiwiYXVkIjoiZWo6c2Vzc24iLCJqdGkiOiIwOWIyNTliMGI1OGJhOGVlOWQ2Y2Q4NzdhODQ4ZDkwNSIsIm5iZiI6MTc3MDIyNDk2NiwiaWF0IjoxNzcwMjI0OTY2LCJleHAiOjE3NzAzMTg1NjYsImRvbWFpbiI6InNpcnMwMDAxIiwic2VnbWVudCI6InNpcnMiLCJ1aWQiOjIyOTM3LCJtcCI6ZmFsc2V9.aWWKZuH-G4iTv7mdPbAh_gAUppUuGGME4qy9cBdNV7YEQaqzXvw6se6pzkvvXiChD3NHky7rqQCEqYnjAVX6SvUvm3miJcGl31be5JqGtedQS19VTi-TObKV3ncZAdFter109jFnaB04Ix4X4WLqqjz_QbfNgQz-RUeqRKyTnGRs9V25pUBlz3frzsJ3lQZGDxKyXTi8ZnoHk_zGb5Ha8c2AtCMAdpcA5qA_p33r6QbxJQvntbAdOSt9h04AJ2mdIqPC2kjFGiGRfVfZn93mw3xDGDjEm-y6Vak1Mycft6Ejmq69Yn-3XfYKcMJJ6hk1yoxc_iazylrDJootg5iytw; schdomain=sirs0001";

    try {
        const response = await axios.get(url, {
            headers: { ...headers, Cookie: cookies },
            withCredentials: true,
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const days: Day[] = [];
        const currentYear = new Date().getFullYear().toString(); // лучше динамически

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

                    const taskElem = $(lessonElem).find(
                        ".dnevnik-lesson__task",
                    );
                    let task = taskElem.text().trim();

                    // Убираем иконку и лишние пробелы
                    task = task
                        .replace(/<[^>]*>/g, "")
                        .replace(/\s+/g, " ")
                        .trim();

                    if (
                        subject &&
                        task &&
                        !["без задания"].includes(
                            task.toLowerCase(),
                        )
                    ) {
                        lessons.push({ subject, task });
                    }
                });

            if (lessons.length > 0) {
                days.push({ date, lessons });
            }
        });

        return days;
    } catch (error) {
        console.error(`Ошибка при загрузке недели ${weekOffset}:`, error);
        return [];
    }
}
