import { Router } from "express";

import { getTodayHomework, getNextWeekdayHomework, upsertHomework, tasksToLessons } from "../db/homework";
import { fetchAndParseDiary } from "../services/parser";
import { sendTelegramNotification } from "../services/telegramService";

const router = Router();

function handleRouteError(err: unknown, res: import("express").Response) {
    console.error(err);

    const cause = (err as any)?.cause;
    if (cause?.code === "ECONNREFUSED" || cause?.errors?.some((e: any) => e?.code === "ECONNREFUSED")) {
        return res.status(503).json({ error: "База данных недоступна. Проверьте, запущен ли Docker." });
    }

    res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

router.get("/today", async (_, res) => {
    try {
        const tasks = await getTodayHomework();

        if (!tasks || Object.keys(tasks).length === 0) {
            return res
                .status(404)
                .json({ message: "Нет домашнего задания на сегодня" });
        }

        const array = Object.entries(tasks).map(([subject, task]) => ({
            subject,
            task,
        }));

        res.json(array);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get("/next-day", async (_, res) => {
    try {
        const { date, tasks } = await getNextWeekdayHomework();

        if (!tasks || Object.keys(tasks).length === 0) {
            return res
                .status(404)
                .json({ message: "Нет домашнего задания на след учебный день" });
        }

        const array = Object.entries(tasks).map(([subject, task]) => ({
            subject,
            task,
        }));

        res.json({ date, homework: array });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post("/test-insert-bd", async (req, res) => {
    try {
        const newHomework = { 'Информатика': 'Написать прогу' }
        await upsertHomework("26.01.2026", newHomework);
        console.log(
            `✅ Сохранено`,
        );

        res.json(newHomework);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post("/test-send-telegram", async (_, res) => {
    try {
        const { date, tasks } = await getNextWeekdayHomework();

        if (!tasks || Object.keys(tasks).length === 0) {
            return res
                .status(404)
                .json({ message: "Нет домашнего задания на след учебный день" });
        }

        const lessons = tasksToLessons(tasks);
        const testChatId = process.env.TG_TEST_CHANEL_ID;
        await sendTelegramNotification(date, lessons, testChatId);

        res.json({ message: `Отправлено в тестовый канал на ${date}`, date, homework: lessons });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get("/test-parser", async (req, res) => {
    try {
        const currentWeekDays = await fetchAndParseDiary(0);
        const currentWeekDays2 = await fetchAndParseDiary(-1);
        console.log(
            `✅ Результат парсинга`,
            currentWeekDays,
            currentWeekDays2
        );

        res.json(currentWeekDays);
    } catch (err) {
        handleRouteError(err, res);
    }
});

export default router;
