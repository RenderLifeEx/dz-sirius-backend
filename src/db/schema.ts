import {
    pgTable,
    text,
    jsonb,
    timestamp
} from "drizzle-orm/pg-core";

export const homework = pgTable("homework", {
    date: text("date").primaryKey(), // "26.01.2026" — строка, уникальный ключ
    tasks: jsonb("tasks").$type<Record<string, string>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())
});
