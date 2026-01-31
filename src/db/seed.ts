import { db, closeConnection } from "./db";
import { todos } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
    try {
        // Проверяем наличие флага --clear
        const shouldClear = process.argv.includes("--clear");

        if (shouldClear) {
            // Очищаем таблицу
            await db.delete(todos).where(eq(todos.id, todos.id)); // Удаляем все записи
            console.log("🧹 Таблица todos очищена");
        }

        // Добавляем тестовые данные
        await db
            .insert(todos)
            .values([
                { title: "Купить молоко", position: 500 },
                { title: "Изучить Docker", completed: true, position: 400 },
                { title: "Выкатить фичу", completed: true, position: 300 },
            ]);

        console.log("✅ Тестовые данные добавлены");
    } catch (err) {
        console.error("❌ Ошибка:", err);
        process.exit(1);
    } finally {
        await closeConnection();
        process.exit(0);
    }
}

seed();
