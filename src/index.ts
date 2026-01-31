import express from "express";
import todoRoutes from "./routes/todos";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3001;

// Проверяем, что находимся в режиме разработки
const isDev = process.env.NODE_ENV === "development";

// CORS применяем только в dev-режиме
if (isDev) {
    app.use(cors({
        origin: `http://localhost:3000`,
    }));
}

app.use(bodyParser.json());
app.use("/todos", todoRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || "production"}`); // Для отладки
});
