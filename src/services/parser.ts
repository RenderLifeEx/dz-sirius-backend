import axios from "axios";
import * as cheerio from "cheerio";

interface Lesson {
    subject: string;
    task: string;
}

interface Day {
    date: string; // e.g., "26.01.2026"
    lessons: Lesson[];
}

export async function fetchAndParseDiary(): Promise<Day[]> {
    const url = "https://class.sirius-ft.ru/journal-app/u.22933/week.0";
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
        "ej_fp=3b8c6d4e70044dbf570a757ec2e76861; _ym_uid=1769585314549787020; _ym_d=1769585314; schdomain=sirs0001; ej_fp=44da03879e9bb1a630f5b583c9f63664; ej_id=4c4247b5-51d5-4364-bd58-ce52590c62b9; ej_check=88ac932fbd892724edd2f9a66467945f; ej_id=ecb8a0f4-68a9-49f5-b766-cf1964fccb0f; ej_check=b7c9d16013e213a33263a72f0a585a46; _ym_isad=2; ej_fonts=a02045202de8813b9f919893174b41190924fa2f; school_domain=sirs0001; jwt_v_2=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJlajpzaXJzOnNpcnMwMDAxIiwiYXVkIjoiZWo6c2Vzc24iLCJqdGkiOiI2ODNlOTA5MzZjMTM5MmI1ODdiMTZiMzUwY2E5MGM2YyIsIm5iZiI6MTc2OTk2NDE4NywiaWF0IjoxNzY5OTY0MTg3LCJleHAiOjE3NzAwNTc3ODcsImRvbWFpbiI6InNpcnMwMDAxIiwic2VnbWVudCI6InNpcnMiLCJ1aWQiOjIyOTM3LCJtcCI6ZmFsc2V9.IVJqMk2M5WGe47jFJwZvuVvbBOr2AQogTzw-LZUyc1NSVlJWxZWol8dFiC_da0oZ9B32Q9D2a2lLkCLl-1hUJ4t5out1hEmEORWW0UqOhKrnL98XcNenk0fhEkZ_GzUieksENkRa9yV4YXzYa9Ej6M16SzQOi9ddC5tIEu9PLrBiYkbOvS3nPRgdZZ8d07KWj7oERYQPEWJtNOoIpmAQNvsGJJqfRE_w09SptwH-_xLTRCl8VW4dvXMzbhdseWlw09vRMFmrNFiBB5zeJm4hgWDhu6zKHPusFFR7LhhkK2WX3xwusMVdSWiK8oud2yOFZtGJ3_NTWCZQTvC7y6MMIg; _ym_visorc=w";

    const response = await axios.get(url, {
        //headers,
        withCredentials: true,
        // Axios не поддерживает -b напрямую, но можно установить Cookie header
        // Для простоты добавим в headers, если нужно
        headers: { ...headers, Cookie: cookies },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const days: Day[] = [];
    const currentYear = "2026"; // Из примера, можно динамически: new Date().getFullYear().toString()

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
                const task = taskElem
                    .text()
                    .trim()
                    .replace(/^.*?<\/i>/, "")
                    .trim(); // Убираем иконку

                if (
                    subject &&
                    task &&
                    task !== "без задания" &&
                    task !== "материал к уроку"
                ) {
                    // Фильтруем пустые/не-DZ
                    lessons.push({ subject, task });
                }
            });

        if (lessons.length > 0) {
            days.push({ date, lessons });
        }
    });

    return days;
}
