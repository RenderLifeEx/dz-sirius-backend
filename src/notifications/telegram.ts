import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Lesson } from "../diary/parser";
import { buildHomeworkMessage } from "./helpers";

const bold = (text: string) => `*${text}*`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEBUG_SEND_TEST_CHANEL = process.env.DEBUG_SEND_TEST_CHANEL === "true";
const TELEGRAM_CHAT_ID = DEBUG_SEND_TEST_CHANEL
    ? process.env.TG_TEST_CHANEL_ID
    : process.env.TG_DZ_CHANEL_ID;

// Создаем базовую конфигурацию для запроса
const getAxiosConfig = () => {
    const config: any = {
        timeout: 10_000,
        proxy: false, // отключаем встроенный proxy axios, чтобы не слал обычный HTTP
    };

    // Если заданы настройки прокси, используем httpsAgent для CONNECT-туннеля
    if (process.env.HTTP_PROXY_HOST) {
        const { HTTP_PROXY_HOST, HTTP_PROXY_PORT, HTTP_PROXY_USER, HTTP_PROXY_PASS } = process.env;
        const auth = HTTP_PROXY_USER
            ? `${HTTP_PROXY_USER}:${HTTP_PROXY_PASS}@`
            : "";
        const proxyUrl = `http://${auth}${HTTP_PROXY_HOST}:${HTTP_PROXY_PORT}`;
        config.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    return config;
};

export async function sendTelegramNotification(
    date: string,
    homeworkItems: Lesson[],
    chatId?: string,
    isUpdate?: boolean,
) {
    const targetChatId = chatId ?? TELEGRAM_CHAT_ID;
    if (!TELEGRAM_BOT_TOKEN || !targetChatId) {
        console.warn(
            "Telegram токен или chat_id не заданы → уведомление не отправлено",
        );
        return;
    }

    if (homeworkItems.length === 0) {
        return;
    }

    const message = buildHomeworkMessage(date, homeworkItems, bold, isUpdate);
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(
            url,
            {
                chat_id: targetChatId,
                text: message,
                parse_mode: "Markdown",
            },
            getAxiosConfig(),
        ); // Передаем конфиг с прокси

        const label = isUpdate ? "Уведомление об обновлении" : "Уведомление";
        console.log(`${label} отправлено в Telegram на ${date}`);
    } catch (err) {
        console.error("Ошибка отправки в Telegram:", err);
    }
}

export async function sendTelegramAuthErrorNotification() {
    const TG_TEST_CHANEL_ID = process.env.TG_TEST_CHANEL_ID;

    if (!TELEGRAM_BOT_TOKEN || !TG_TEST_CHANEL_ID) {
        console.warn(
            "Telegram токен или TG_TEST_CHANEL_ID не заданы → уведомление не отправлено",
        );
        return;
    }

    const message = "⚠️ *Ошибка авторизации*: парсер вернул пустой массив.";
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(
            url,
            {
                chat_id: TG_TEST_CHANEL_ID,
                text: message,
                parse_mode: "Markdown",
            },
            getAxiosConfig(),
        ); // Передаем конфиг с прокси

        console.log("Уведомление об ошибке авторизации отправлено в Telegram");
    } catch (err) {
        console.error(
            "Ошибка отправки уведомления об ошибке авторизации в Telegram:",
            err,
        );
    }
}
