# SiriusDz — Backend API

Парсит домашнее задание с сайта электронного дневника [class.sirius-ft.ru](https://class.sirius-ft.ru/journal-app), сохраняет в PostgreSQL и ежедневно отправляет отформатированное ДЗ в Telegram-канал.

Авторизация: https://class.sirius-ft.ru/authorize?force_login=yes_please

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

---

## 📌 Особенности

- Парсинг ДЗ под двумя аккаунтами одновременно — для классов с двумя группами по иностранному языку
- Авто-отправка в Telegram-канал каждый будний день в **17:40**
- Если учитель обновил ДЗ после 17:40 — автоматически приходит повторное уведомление с пометкой **«было обновлено»**
- Парсинг запускается каждые **10 минут**, данные хранятся в PostgreSQL
- REST API для получения ДЗ из БД и ручного управления

---

## 🛠 Технологический стек

| Компонент      | Версия  | Назначение                              |
|----------------|---------|-----------------------------------------|
| **Node.js**    | 22.x    | Среда выполнения                        |
| **Express**    | 4.x     | Веб-фреймворк                           |
| **TypeScript** | 5.x     | Статическая типизация                   |
| **Drizzle ORM**| 0.43.x  | Работа с БД                             |
| **PostgreSQL** | 16.x    | Хранение ДЗ                             |
| **Cheerio**    | —       | Парсинг HTML страниц дневника           |
| **Axios**      | —       | HTTP-запросы (авторизация, парсинг)     |
| **CORS**       | 2.8.x   | Обработка CORS-запросов                 |

---

## 🚀 Быстрый старт

### Предварительные требования
- Node.js v22
- pnpm
- Docker v25

### Установка и запуск

```bash
# Клонировать репозиторий
git clone git@github.com:RenderLifeEx/dz-sirius-backend.git
cd dz-sirius-backend

# Установка зависимостей
pnpm install

# Копируем .env-файл
cp .env.example.local .env
# Заполните переменные (см. раздел «Переменные окружения»)

# Запуск базы данных
docker-compose up -d

# Накатить миграции
# (если контейнер уже существовал — сначала удалите volume)
pnpm run migrate

# Просмотр базы через Drizzle Studio
pnpm run studio

# Залить тестовые данные (опционально)
pnpm run seed

# Запуск в dev-режиме
nvm use 22
pnpm run dev

# Запуск в prod-режиме
pnpm run start
```

### Сборка production-версии
```bash
pnpm run build
pnpm start
```

API будет доступно по адресу: **http://localhost:3001**

---

## 📚 API Endpoints

| Метод  | Endpoint                          | Описание                                                |
|--------|-----------------------------------|---------------------------------------------------------|
| `GET`  | `/homework/today`                 | ДЗ на сегодня из БД                                     |
| `GET`  | `/homework/next-day`              | ДЗ на следующий будний день из БД                       |
| `POST` | `/homework/fetch`                 | Принудительный парсинг и сохранение в БД                |
| `POST` | `/homework/test-send-telegram`    | Отправить ДЗ на следующий день в **тестовый** канал     |

---

## 🔧 Переменные окружения

| Переменная              | Описание                                                    |
|-------------------------|-------------------------------------------------------------|
| `PORT`                  | Порт API (по умолчанию `3001`)                              |
| `FRONT_PORT`            | Порт фронтенда для CORS                                     |
| `DATABASE_URL`          | Строка подключения к PostgreSQL                             |
| `SIRIUS_USERNAME`       | Логин основного аккаунта (группа 2 по английскому)         |
| `SIRIUS_PASSWORD`       | Пароль основного аккаунта                                   |
| `SIRIUS_USERNAME_2`     | Логин второго аккаунта (группа 1 по английскому)           |
| `SIRIUS_PASSWORD_2`     | Пароль второго аккаунта                                     |
| `TELEGRAM_BOT_TOKEN`    | Токен Telegram-бота                                         |
| `TG_DZ_CHANEL_ID`       | ID основного Telegram-канала для отправки ДЗ               |
| `TG_TEST_CHANEL_ID`     | ID тестового Telegram-канала                                |
| `DEBUG_SEND_EVERY_MINUTE` | `true` — отправка в Telegram каждую минуту (отладка)    |
| `DEBUG_SEND_TEST_CHANEL`  | `true` — все отправки идут в тестовый канал             |

---

## 🐳 Команды Docker

```bash
docker ps                                      # список контейнеров
docker stop <container_id_or_name>            # остановить контейнер
docker rm <container_id_or_name>              # удалить контейнер
docker volume ls                               # список томов
docker volume rm <name>                        # удалить volume PostgreSQL
docker compose -p sirius-dz-app up -d         # запустить
docker compose down -v                         # остановить и удалить volumes
```

---

## 📜 Лицензия
MIT License
