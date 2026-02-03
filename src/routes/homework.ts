import { Router } from "express";

import { getTodayHomework, getNextWeekdayHomework, upsertHomework } from "../db/homework";

const router = Router();

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
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
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
        console.error(err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

router.post("/test", async (req, res) => {
    try {
        const newHomework = { 'test': '123' }
        await upsertHomework("26.01.2026", newHomework);
        console.log(
            `test Сохранено`,
        );

        res.json(newHomework);
    } catch (error: unknown) { // Явно указываем тип unknown
        let errorMessage = "Unknown error occurred";

        // Проверяем тип ошибки
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }

        res.status(500).json({
            status: "error",
            message: "Internal server error",
            details: errorMessage
        });
    }
});

export default router;
