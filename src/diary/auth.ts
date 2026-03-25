// https://class.sirius-ft.ru/authorize?force_login=yes_please

import axios from "axios";
import jwt from "jsonwebtoken";

interface SessionState {
    cachedCookies: string;
    lastJwtToken: string | null;
}

// Хранит состояние сессии отдельно для каждого пользователя (ключ — username)
const sessions = new Map<string, SessionState>();

function getSession(username: string): SessionState {
    if (!sessions.has(username)) {
        sessions.set(username, { cachedCookies: "", lastJwtToken: null });
    }
    return sessions.get(username)!;
}

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

// Основная функция авторизации → получает свежие куки для указанного пользователя
async function refreshSession(username: string, password: string): Promise<string> {
    console.log(`[auth] Выполняем авторизацию для ${username}...`);

    const session = getSession(username);

    try {
        const loginUrl = "https://class.sirius-ft.ru/ajaxauthorize";

        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);
        formData.append("return_uri", "/");

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

        if (session.cachedCookies) {
            headers["Cookie"] = session.cachedCookies;
        }

        const response = await axios.post(loginUrl, formData, {
            headers,
            withCredentials: true,
            maxRedirects: 5,
        });

        const setCookieHeaders = response.headers["set-cookie"];
        if (
            !setCookieHeaders ||
            !Array.isArray(setCookieHeaders) ||
            setCookieHeaders.length === 0
        ) {
            console.warn(`[auth] Нет Set-Cookie в ответе авторизации для ${username}`);
        }

        const cookiesMap: Record<string, string> = {};
        if (session.cachedCookies) {
            session.cachedCookies.split(";").forEach((cookie) => {
                const parts = cookie.trim().split("=");
                if (parts.length >= 1) {
                    const name = parts[0];
                    const value = parts.slice(1).join("=");
                    if (name) cookiesMap[name] = value;
                }
            });
        }

        if (setCookieHeaders) {
            setCookieHeaders.forEach((c) => {
                const mainPart = c.split(";")[0].trim();
                const [name, ...valueParts] = mainPart.split("=");
                const value = valueParts.join("=");

                if (name) {
                    if (value === "deleted") {
                        delete cookiesMap[name];
                    } else {
                        cookiesMap[name] = value;
                    }
                }
            });
        }

        const newCookies = Object.entries(cookiesMap)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

        const newJwt = extractJwtFromCookies(newCookies);
        if (!newJwt) {
            throw new Error(`После авторизации не найден jwt_v_2 в куках для ${username}`);
        }

        session.cachedCookies = newCookies;
        session.lastJwtToken = newJwt;

        console.log(`[auth] Авторизация успешна для ${username} → новые куки сохранены`);
        return session.cachedCookies;
    } catch (err: any) {
        console.error(`[auth] Ошибка авторизации для ${username}:`, err.message);
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

// Получаем валидные куки для указанного пользователя (обновляем если нужно)
async function getValidCookies(username: string, password: string): Promise<string> {
    const session = getSession(username);
    if (!session.cachedCookies || !session.lastJwtToken || isTokenExpired(session.lastJwtToken)) {
        return await refreshSession(username, password);
    }
    return session.cachedCookies;
}

export async function fetchDiaryPage(
    weekOffset: number = 0,
    credentials?: { username: string; password: string },
): Promise<string> {
    const username = credentials?.username || process.env.SIRIUS_USERNAME || "";
    const password = credentials?.password || process.env.SIRIUS_PASSWORD || "";

    const cookies = await getValidCookies(username, password);
    const session = getSession(username);

    const url = `https://class.sirius-ft.ru/journal-app/week.${weekOffset}`;

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
                `[fetch] Ошибка авторизации (401/403/302) для ${username} → принудительно обновляем сессию`,
            );
            session.cachedCookies = "";
            session.lastJwtToken = null;
        }
        throw err;
    }
}
