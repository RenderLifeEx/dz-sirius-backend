import axios from "axios";
import { Lesson } from "./parser";

const GROUP_1_LABEL = "      👩🏽 Группа 1 (Вероника Олеговна)";
const GROUP_2_LABEL = "      👩🏻 Группа 2 (Анушик Гургеновна)";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEBUG_SEND_TEST_CHANEL = process.env.DEBUG_SEND_TEST_CHANEL === 'true';
const TELEGRAM_CHAT_ID = DEBUG_SEND_TEST_CHANEL ? process.env.TG_TEST_CHANEL_ID :process.env.TG_DZ_CHANEL_ID;

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

    const emojiNumbers = [
        "1️⃣",
        "2️⃣",
        "3️⃣",
        "4️⃣",
        "5️⃣",
        "6️⃣",
        "7️⃣",
        "8️⃣",
        "9️⃣",
        "🔟",
    ];

    const header = isUpdate
        ? `*❗️ДЗ на ${date} было обновлено ❗️*`
        : `*ДЗ на ${date}*`;

    const lines: string[] = [header, ""];

    homeworkItems.forEach((item, index) => {
        const emoji = index < 10 ? emojiNumbers[index] : `${index + 1}.`;

        lines.push(`${emoji} *${item.subject}*`);

        if (item.task_group_1 !== undefined) {
            lines.push(GROUP_1_LABEL);
            lines.push(`      ${item.task_group_1.trim() || "—"}`);
            lines.push(GROUP_2_LABEL);
            lines.push(`      ${item.task.trim() || "—"}`);
        } else {
            lines.push(`      ${item.task.trim() || "—"}`);
        }

        lines.push("");
    });

    const message = lines.join("\n");

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: targetChatId,
            text: message,
            parse_mode: "Markdown",
        });
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
        await axios.post(url, {
            chat_id: TG_TEST_CHANEL_ID,
            text: message,
            parse_mode: "Markdown",
        });
        console.log("Уведомление об ошибке авторизации отправлено в Telegram");
    } catch (err) {
        console.error("Ошибка отправки уведомления об ошибке авторизации в Telegram:", err);
    }
}
