import { Router } from "express";

import { getTodayHomework, getNextWeekdayHomework, getAllHomeworkFromToday, upsertHomework, tasksToLessons } from "../db/homework";
import { fetchAndParseDiary } from "../diary/parser";
import { sendTelegramNotification } from "../notifications/telegram";
import { sendMaxNotification } from "../notifications/max";
import { cancelPendingNotification, sendToAllMessengers, getNextNotificationTime } from "../scheduler";

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

router.get("/available-days", async (_, res) => {
    try {
        const days = await getAllHomeworkFromToday();

        if (days.length === 0) {
            return res
                .status(404)
                .json({ message: "Нет доступных дней с домашним заданием" });
        }

        const result = days.map(({ date, tasks }) => ({
            date,
            homework: Object.entries(tasks).map(([subject, task]) => ({ subject, task })),
        }));

        res.json(result);
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get("/next-notification", async (_, res) => {
    const time = getNextNotificationTime();
    res.json({ scheduledAt: time ?? null });
});

const SEND_NOW_CONFIRM_CODE = (process.env.SEND_NOW_CODE ?? "поехали").toLowerCase();

router.post("/send-now", async (req, res) => {
    try {
        const { code } = req.body ?? {};
        if (typeof code !== "string" || code.trim().toLowerCase() !== SEND_NOW_CONFIRM_CODE) {
            return res.status(403).json({ error: "Неверный код подтверждения" });
        }

        let { date, tasks } = await getNextWeekdayHomework();
        let isAfterVacation = false;

        if (!tasks || Object.keys(tasks).length === 0) {
            // Следующий будний день пустой (праздник/каникулы) — ищем ближайшее ДЗ в БД
            const upcoming = await getAllHomeworkFromToday();
            const first = upcoming.find(r => Object.keys(r.tasks).length > 0);

            if (!first) {
                return res
                    .status(404)
                    .json({ message: "Нет домашнего задания на след учебный день" });
            }

            date = first.date;
            tasks = first.tasks;
            isAfterVacation = true;
        }

        const cancelled = cancelPendingNotification();
        const lessons = tasksToLessons(tasks);
        await sendToAllMessengers(date, lessons, false, isAfterVacation);

        res.json({
            message: `Отправлено в Telegram и MAX на ${date}`,
            date,
            scheduledNotificationCancelled: cancelled,
            homework: lessons,
        });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.post("/test-insert-bd", async (_, res) => {
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

router.post("/test-send-max", async (_, res) => {
    try {
        const { date, tasks } = await getNextWeekdayHomework();

        if (!tasks || Object.keys(tasks).length === 0) {
            return res
                .status(404)
                .json({ message: "Нет домашнего задания на след учебный день" });
        }

        const lessons = tasksToLessons(tasks);
        const testChannelId = Number(process.env.MAX_TEST_CHANNEL_ID);
        await sendMaxNotification(date, lessons, testChannelId);

        res.json({ message: `Отправлено в тестовый MAX канал на ${date}`, date, homework: lessons });
    } catch (err) {
        handleRouteError(err, res);
    }
});

router.get("/test-parser", async (_, res) => {
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
