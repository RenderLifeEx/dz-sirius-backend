import { drizzle } from "drizzle-orm/postgres-js";
//import { drizzle } from "drizzle-orm/node-postgres";
import postgres from "postgres";
import * as schema from "./schema";
import "dotenv/config";

// Проверка переменной окружения
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in .env file!");
}

// Определяем режим работы
const isDev = process.env.NODE_ENV === "development";

// Создание клиента PostgreSQL
export const sql = postgres(databaseUrl, {
    max: isDev ? 1 : 10,
    idle_timeout: isDev ? 20 : 30,
    transform: {
        undefined: null,
    },
    connection: {
        application_name: "todo-app",
    },
    // Добавляем параметры для лучшей диагностики
    // onnotice: isDev ? console.log : undefined,
    // onparameter: isDev ? console.log : undefined,
});

// Инициализация Drizzle ORM
export const db = drizzle(sql, {
    schema,
    //logger: isDev, // Логирование в dev-режиме
});

// Функция для закрытия соединения (для скриптов)
export async function closeConnection() {
    try {
        if (!isDev) console.log("Closing database connection pool...");
        await sql.end({ timeout: 5 }); // Таймаут на закрытие
    } catch (err) {
        console.error("Error closing connection:", err);
    }
}

// Проверка подключения при старте
if (isDev) {
    sql`SELECT 1`
        .then(() => console.log("✅ Database connection established"))
        .catch((err) => console.error("❌ Database connection failed:", err));
}
