// https://class.sirius-ft.ru/authorize?force_login=yes_please

import axios from "axios";
import jwt from "jsonwebtoken";

let cachedCookies: string = ""; // полная строка Cookie
let lastJwtToken: string | null = null;

// Проверка, истёк ли токен (запас 5 минут)
function isTokenExpired(token: string): boolean {
    try {
        const decoded: any = jwt.decode(token);
        if (!decoded || !decoded.exp) return true;
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime > decoded.exp - 300;
    } catch {
        return true;
    }
}

// Извлекаем jwt_v_2 из строки cookies
function extractJwtFromCookies(cookiesStr: string): string | null {
    const match = cookiesStr.match(/jwt_v_2=([^;]+)/);
    return match ? match[1] : null;
}

// Основная функция авторизации → получает свежие куки
async function refreshSession(): Promise<string> {
    console.log("[auth] Выполняем авторизацию...");

    try {
        const loginUrl = "https://class.sirius-ft.ru/ajaxauthorize";

        const formData = new FormData();
        formData.append("username", process.env.SIRIUS_USERNAME || "");
        formData.append("password", process.env.SIRIUS_PASSWORD || "");
        formData.append("return_uri", "/");

        // Базовые заголовки (без Content-Type — axios сам поставит с boundary)
        const headers: Record<string, string> = {
            accept: "*/*",
            "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            origin: "https://class.sirius-ft.ru",
            referer:
                "https://class.sirius-ft.ru/authorize?force_login=yes_please",
            "sec-ch-ua":
                '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            priority: "u=1, i",
        };

        // Если уже есть какие-то куки — передаём их (CSRF-TOKEN может быть нужен)
        if (cachedCookies) {
            headers["Cookie"] = cachedCookies;
        }

        const response = await axios.post(loginUrl, formData, {
            headers,
            withCredentials: true,
            maxRedirects: 5,
        });

        // Извлекаем все Set-Cookie
        const setCookieHeaders = response.headers["set-cookie"];
        if (
            !setCookieHeaders ||
            !Array.isArray(setCookieHeaders) ||
            setCookieHeaders.length === 0
        ) {
            console.warn("[auth] Нет Set-Cookie в ответе авторизации");
            // но иногда сессия может устанавливаться через другие механизмы — проверим тело ответа
        }

        // --- ИСПРАВЛЕННАЯ ЛОГИКА ОБРАБОТКИ КУКОВ ---

        // 1. Парсим текущие куки в объект { name: value }
        const cookiesMap: Record<string, string> = {};
        if (cachedCookies) {
            cachedCookies.split(";").forEach((cookie) => {
                const parts = cookie.trim().split("=");
                if (parts.length >= 1) {
                    const name = parts[0];
                    const value = parts.slice(1).join("="); // на случай, если в значении есть =
                    if (name) cookiesMap[name] = value;
                }
            });
        }

        // 2. Обновляем/добавляем/удаляем куки из ответа сервера
        if (setCookieHeaders) {
            setCookieHeaders.forEach((c) => {
                // Берем только часть "name=value", отсекая атрибуты вроде Path; Secure; HttpOnly
                const mainPart = c.split(";")[0].trim();
                const [name, ...valueParts] = mainPart.split("=");
                const value = valueParts.join("=");

                if (name) {
                    if (value === "deleted") {
                        // Сервер просит удалить куку
                        delete cookiesMap[name];
                    } else {
                        // Перезаписываем куку с таким именем новой (или создаем)
                        cookiesMap[name] = value;
                    }
                }
            });
        }

        // 3. Собираем объект обратно в строку
        const newCookies = Object.entries(cookiesMap)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        // -----------------------------------------

        const newJwt = extractJwtFromCookies(newCookies);
        if (!newJwt) {
            throw new Error("После авторизации не найден jwt_v_2 в куках");
        }

        cachedCookies = newCookies;
        lastJwtToken = newJwt;

        console.log("[auth] Авторизация успешна → новые куки сохранены");
        return cachedCookies;
    } catch (err: any) {
        console.error("[auth] Ошибка авторизации:", err.message);
        if (err.response) {
            console.error(
                "[auth] Ответ сервера:",
                err.response.status,
                err.response.data,
            );
        }
        throw err;
    }
}

// Получаем валидные куки (обновляем если нужно)
async function getValidCookies(): Promise<string> {
    if (!cachedCookies || !lastJwtToken || isTokenExpired(lastJwtToken)) {
        return await refreshSession();
    }
    return cachedCookies;
}

export async function fetchDiaryPage(weekOffset: number = 0): Promise<string> {
    const cookies = await getValidCookies();

    const url = `https://class.sirius-ft.ru/journal-app/u.22933/week.${weekOffset}`;

    const headers = {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "ru-RU,ru;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        referer: "https://class.sirius-ft.ru/",
        "sec-ch-ua":
            '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "upgrade-insecure-requests": "1",
        "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        Cookie: cookies,
    };

    try {
        const res = await axios.get(url, { headers, withCredentials: true });
        return res.data as string;
    } catch (err: any) {
        if (
            err.response?.status === 401 ||
            err.response?.status === 403 ||
            err.response?.status === 302
        ) {
            console.warn(
                "[fetch] Ошибка авторизации (401/403/302) → принудительно обновляем сессию",
            );
            cachedCookies = "";
            lastJwtToken = null;
        }
        throw err;
    }
}
