import { pgTable, serial, text, boolean, doublePrecision } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    completed: boolean("completed").default(false),
    position: doublePrecision(),
    desc: text("desc").default(''),
});
