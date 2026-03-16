# Контекст проекта dz-sirius-backend

## Что делает приложение

Парсит домашнее задание для **3-го класса** с сайта электронного дневника (требует авторизации), сохраняет в БД и раз в день отправляет красиво отформатированное сообщение в Telegram-канал.

---

## Структура src/

```
src/
├── db/
│   ├── db.ts              — подключение к PostgreSQL (Drizzle ORM)
│   ├── schema.ts          — таблица homework (date PK, tasks JSONB, updatedAt)
│   └── homework.ts        — вся работа с БД + хелперы
├── services/
│   ├── authAndFetch.ts    — авторизация на сайте дневника и загрузка HTML
│   ├── parser.ts          — парсинг HTML (cheerio) → Day[]
│   ├── scheduler.ts       — планировщик: парсинг каждые 10 мин + отправка в 17:40
│   └── telegramService.ts — формирование и отправка сообщений в Telegram
└── routes/
    └── homework.ts        — HTTP-эндпоинты
```

---

## Ключевые типы

```typescript
// parser.ts
interface Lesson {
    subject: string;
    task: string;
    task_group_1?: string; // ДЗ группы 1 по английскому (второй аккаунт)
}
interface Day {
    date: string; // "дд.мм.гггг"
    lessons: Lesson[];
}

// db/homework.ts
type Tasks = Record<string, string>;
// Ключи: "Математика", "Иностранный язык (английский)", "Иностранный язык (английский)::group1"
```

---

## Две группы по английскому

Иностранный язык ведут два разных учителя для двух групп.

- **Группа 1** — Вероника Олеговна (`SIRIUS_USERNAME_2` / `SIRIUS_PASSWORD_2`)
- **Группа 2** — Анушик Гургеновна (основной аккаунт `SIRIUS_USERNAME`)

`fetchAndParseDiaryMerged()` запускает оба аккаунта параллельно и мержит результат:
```typescript
// В Tasks хранится так:
"Иностранный язык (английский)"         → задание группы 2
"Иностранный язык (английский)::group1" → задание группы 1
```

Константа суффикса: `GROUP1_SUFFIX = "::group1"` (в `db/homework.ts`)

Хелпер `tasksToLessons(tasks)` фильтрует `::group1`-ключи и собирает `Lesson[]`.

---

## Telegram-уведомления

### Обычная отправка (17:40 пн–пт)
```
*ДЗ на 17.03.2026*

1️⃣ *Математика*
      с. 72 (р.т.)
4️⃣ *Иностранный язык (английский)*
      👩🏽 Группа 1 (Вероника Олеговна)
      учебник с. 57
      👩🏻 Группа 2 (Анушик Гургеновна)
      № 1, стр. 50 выучить на диктант
```

### Уведомление об обновлении (после 17:40, если ДЗ изменилось)
```
*❗️ДЗ на 17.03.2026 было обновлено ❗️*
...
```
`sendTelegramNotification(date, lessons, chatId?, isUpdate?)` — параметр `isUpdate = true` меняет заголовок.

---

## Логика обновления ДЗ (scheduler.ts)

Парсинг запускается **каждые 10 минут**. После сохранения в БД:

```
changed = upsertHomework() вернул { changed: true }
afterNotification = текущее время ≥ 17:40
targetDate = getNextWeekdayDate()   // следующий будний день

если (changed && afterNotification && day.date === targetDate)
    → sendTelegramNotification(..., isUpdate = true)
```

Сравнение задач — через `sortedStringify` (JSON с отсортированными ключами), чтобы порядок ключей не давал ложных срабатываний.

---

## Парсинг ссылок в заданиях

Сайт отображает ссылки с обрезанным текстом (`https://example.com/...`).
Перед вызовом `.text()` все `<a href>` внутри `.dnevnik-lesson__task` заменяются на свой полный `href`:
```typescript
taskElem.find("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (href) $(a).text(href);
});
```

---

## .env переменные

| Переменная | Назначение |
|---|---|
| `SIRIUS_USERNAME` | Логин основного аккаунта (группа 2) |
| `SIRIUS_PASSWORD` | Пароль основного аккаунта |
| `SIRIUS_USERNAME_2` | Логин второго аккаунта (группа 1) |
| `SIRIUS_PASSWORD_2` | Пароль второго аккаунта |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TG_DZ_CHANEL_ID` | ID основного канала с ДЗ |
| `TG_TEST_CHANEL_ID` | ID тестового канала |
| `DEBUG_SEND_EVERY_MINUTE` | `true` → отправка каждую минуту (отладка) |
| `DEBUG_SEND_TEST_CHANEL` | `true` → все отправки идут в тестовый канал |

---

## HTTP-эндпоинты (routes/homework.ts)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/homework/today` | ДЗ на сегодня из БД |
| GET | `/homework/next-day` | ДЗ на следующий будний день из БД |
| POST | `/homework/fetch` | Принудительный парсинг и сохранение |
| POST | `/homework/test-send-telegram` | Отправить ДЗ на следующий день в **тестовый** канал (без реальной отправки в основной) |

---

## Формат даты

Везде используется строка `"дд.мм.гггг"` (например `"17.03.2026"`).
