import { Bot } from "@maxhub/max-bot-api";
import { Lesson } from "../diary/parser";
import { buildHomeworkMessage } from "./helpers";

const bold = (text: string) => `**${text}**`;

const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const DEBUG_SEND_TEST_CHANEL = process.env.DEBUG_SEND_TEST_CHANEL === "true";

const MAX_CHANNEL_ID = DEBUG_SEND_TEST_CHANEL
    ? Number(process.env.MAX_TEST_CHANNEL_ID)
    : Number(process.env.MAX_CHANNEL_ID);

let botInstance: Bot | null = null;

function getBot(): Bot {
    if (!botInstance) {
        if (!MAX_BOT_TOKEN) {
            throw new Error("MAX_BOT_TOKEN не задан");
        }
        botInstance = new Bot(MAX_BOT_TOKEN);
    }
    return botInstance;
}

export async function sendMaxNotification(
    date: string,
    homeworkItems: Lesson[],
    channelId?: number,
    isUpdate?: boolean,
): Promise<void> {
    const targetChannelId = channelId ?? MAX_CHANNEL_ID;

    if (!MAX_BOT_TOKEN) {
        console.warn(
            "MAX_BOT_TOKEN не задан → уведомление в MAX не отправлено",
        );
        return;
    }

    if (!targetChannelId || isNaN(targetChannelId)) {
        console.warn(
            "MAX channel ID не задан → уведомление в MAX не отправлено",
        );
        return;
    }

    if (homeworkItems.length === 0) {
        return;
    }

    const message = buildHomeworkMessage(date, homeworkItems, bold, isUpdate);

    try {
        const bot = getBot();
        await bot.api.sendMessageToChat(targetChannelId, message, {
            format: "markdown",
        });
        const label = isUpdate ? "Уведомление об обновлении" : "Уведомление";
        console.log(`${label} отправлено в MAX на ${date}`);
    } catch (err) {
        console.error("Ошибка отправки в MAX:", err);
    }
}

export async function sendMaxAuthErrorNotification(): Promise<void> {
    const testChannelId = Number(process.env.MAX_TEST_CHANNEL_ID);

    if (!MAX_BOT_TOKEN) {
        console.warn(
            "MAX_BOT_TOKEN не задан → уведомление об ошибке в MAX не отправлено",
        );
        return;
    }

    if (!testChannelId || isNaN(testChannelId)) {
        console.warn(
            "MAX_TEST_CHANNEL_ID не задан → уведомление об ошибке в MAX не отправлено",
        );
        return;
    }

    const message = `⚠️ ${bold("Ошибка авторизации")}: парсер вернул пустой массив.`;

    try {
        const bot = getBot();
        await bot.api.sendMessageToChat(testChannelId, message, {
            format: "markdown",
        });
        console.log("Уведомление об ошибке авторизации отправлено в MAX");
    } catch (err) {
        console.error(
            "Ошибка отправки уведомления об ошибке авторизации в MAX:",
            err,
        );
    }
}
