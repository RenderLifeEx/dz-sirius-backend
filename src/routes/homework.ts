import { Router } from "express";

import { getTodayHomework, getNextWeekdayHomework } from "../db/homework";

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

        console.log('✅ data', tasks)
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

export default router;
