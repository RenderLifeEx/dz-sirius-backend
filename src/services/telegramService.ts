import axios from "axios";
import { Lesson } from "./parser";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEBUG_SEND_EVERY_MINUTE = process.env.DEBUG_SEND_EVERY_MINUTE === 'true';
const TELEGRAM_CHAT_ID = DEBUG_SEND_EVERY_MINUTE ? process.env.TG_TEST_CHANEL_ID :process.env.TG_DZ_CHANEL_ID;

export async function sendTelegramNotification(
    date: string,
    homeworkItems: Lesson[],
) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
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

    const lines: string[] = [`*на ${date}*`, ""];

    homeworkItems.forEach((item, index) => {
        const emoji = index < 10 ? emojiNumbers[index] : `${index + 1}.`;
        const taskText = item.task.trim() || "—";

        lines.push(`${emoji} *${item.subject}*`);
        lines.push(`   ${taskText}`);
        lines.push("");
    });

    const message = lines.join("\n");

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "Markdown",
        });
        console.log(`Уведомление отправлено в Telegram на ${date}`);
    } catch (err) {
        console.error("Ошибка отправки в Telegram:", err);
    }
}
