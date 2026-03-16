# SiriusDz Node.js Backend API
Парсим и отдаем потом по api домашнее задание с сайта https://class.sirius-ft.ru/journal-app
Авторизация тут https://class.sirius-ft.ru/authorize?force_login=yes_please

## Проект использует:

- cheerio для парсинга HTML.
- axios для HTTP-запроса (аналог curl).
- express для сервера.
- setInterval для периодического выполнения запроса раз в 5 минут (300000 мс).

![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

Backend API для приложения парсера расписания с домашним заданием на Node.js с Express и TypeScript.

## 📌 Особенности проекта

- REST API для получения домашнего задания на текущий день
- Написано на TypeScript с полной типизацией

## 🛠 Технологический стек

| Компонент                 | Версия   | Назначение                          |
|---------------------------|----------|-------------------------------------|
| **Node.js**               | 20.x     | Среда выполнения                    |
| **Express**               | 4.18.x   | Веб-фреймворк                       |
| **TypeScript**            | 5.0.x    | Статическая типизация               |
| **CORS**                  | 2.8.x    | Обработка CORS-запросов             |
| **Drizzle**               | 0.43.x   | ORM                                 |

## 🚀 Быстрый старт

### Предварительные требования
- Node.js v20
- npm/pnpm/yarn
- Docker v25

### Установка и запуск
```bash
# Клонировать репозиторий
git clone git@github.com:RenderLifeEx/dz-sirius-backend.git
cd dz-sirius-backend

# Установка зависимостей
pnpm install

# Копируем и переименовываем .env-файл (Linux/Mac)
cp .env.development.local .env

# Запуск базы
docker-compose up -d

# Накатываем миграции, но если ранее уже был создан контейнер то нужно не забыть удалять volume
pnpm run migrate

# Просмотр базы
pnpm run studio

# Также можно залить тестовые данные *
pnpm run seed

# Запуск приложения в дев режиме
nvm use 20
pnpm run dev

# Запуск приложения в прод режиме
pnpm run start
```

### Сборка production-версии
```bash
pnpm run build
```

### Запуск production-версии
```bash
pnpm start
```

API будет доступно по адресу: http://localhost:3001

## 📚 API Endpoints

| Метод  | Endpoint           | Описание                               |
|--------|--------------------|----------------------------------------|
| `GET`  | `/list`            | Получить все домашние задания          |
| `GET`  | `/current`         | Получить домашнее задание на сегодня   |

## 🔧 Настройка
Перед деплоем установите необходимые переменные:
- PORT - порт для API (по умолчанию 3001)
- FRONT_PORT - порт фронтенд-приложения для CORS (по умолчанию 3001)

## Команды работы с Docker
```bash
docker ps # посмотреть список контейнеров
docker stop <container_id_or_name>  # останавливаем контейнер
docker rm <container_id_or_name>   # удаляем контейнер
docker volume ls  # посмотреть список томов
docker volume rm <name>  # удалить volume, связанный с PostgreSQL
docker compose -p sirius-dz-app up -d # монтируем
docker compose down -v  # флаг `-v` удаляет и контейнеры, и volumes
```

## 📜 Лицензия
MIT License