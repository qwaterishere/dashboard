# Runbook: локальная работа с проектом

Операционные рецепты. Мир после мультиарендного апдейта (13.07.2026):
все рестораны живут в ОДНОЙ базе (`orders.restaurant_id`), креды iiko —
в БД в зашифрованном виде, настройка — через Settings/API.
**Свопов «.env + файл базы парой» больше нет** — этот ритуал умер
вместе с однобазовой эпохой.

## Запуск

```powershell
# API (терминал 1)
cd D:\seasons\backend
..\venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000

# Фронт (терминал 2)
cd D:\seasons\frontend
npm start
```

- Дашборд: http://localhost:4200 (вход по учётке пользователя-ресторана)
- Swagger: http://localhost:8000/docs
- Миграции схемы выполняются сами при старте API (lifespan →
  `db_manager.create_all()` → `migrate.upgrade_schema`); старая база
  получает `restaurant_id` автоматически (старые заказы — NULL,
  их надо бэкфилить, см. ниже)
- venv живёт в КОРНЕ репо (../venv из backend/); npm ci требует
  `--legacy-peer-deps`
- **после git pull**: `..\venv\Scripts\python.exe -m pip install -r
  requirements\dev.txt` (появляются новые зависимости — cryptography и др.)

## Рестораны дев-стенда

Один пользователь = один ресторан (ограничение модели, карточка №11).
Учётки локального стенда:

| Ресторан | iiko-хост | email | restaurant_id |
|---|---|---|---|
| «Лесной» Бишкек (пилот, KGS) | kafe-bar-lesnoi.iiko.it | bishkek@seasons.local | (см. GET /api/auth/me/iiko) |
| «Лесной» Ташкент (UZS) | lesnoy-tash.iiko.it | tashkent@seasons.local | — » — |
| Кофейня (Россия, RUB) | Restoran-sayt-kofe-end-dayn.iiko.it | cafe@seasons.local | — » — |

Пароли дев-учёток — локально у Егора (dev-политика: ≥8 символов).

## Онбординг ресторана (новый порядок)

1. **Регистрация пользователя**: `POST /api/auth/register`
   `{email, password, first_name, last_name, position}`;
2. **Настройка iiko**: `PUT /api/auth/me/iiko`
   `{iiko_url, iiko_login, iiko_password}` — бэкенд проверяет креды
   живым логином в iiko и шифрует пароль в БД (Fernet, ключ —
   `CREDENTIALS_ENCRYPTION_KEY`/`JWT_SECRET_KEY` из окружения);
3. **Синк**: из UI (Settings) или `POST /api/auth/me/iiko/sync` —
   фоновая задача; статус, прогресс и `restaurant_id` —
   в `GET /api/auth/me/iiko`.

До подключения нового ресторана — аудит (см. ниже).

## Загрузка данных (CLI)

```powershell
cd D:\seasons\backend
# догрузка до вчера (план строится сам)
..\venv\Scripts\python.exe -m src.cli.sales_loader --restaurant-id <uuid>
# явный период
..\venv\Scripts\python.exe -m src.cli.sales_loader --restaurant-id <uuid> --from 2026-06-01 --to 2026-06-30
```

Идемпотентно: день перезагружается целиком (`replace_day`).
Пустой ресторан грузится с 1 января прошлого года (history_limit).
`--chunk-days 1` (дефолт) надёжнее — iiko рвёт большие ответы
(`incomplete chunked read`); при стабильном сервере можно 7.
Полную историю не гонять в часы пик заведения.

**Бэкфил старых данных** (однократно после миграции): заказы, загруженные
до мультиарендности, имеют `restaurant_id NULL` — их надо приписать
своему ресторану UPDATE-ом (это данные пилота из старой dashboard.db).
После бэкфила NULL-заказов остаться не должно (карточка №11: колонку —
в NOT NULL).

## Песочница iiko (локальная, НЕ в git)

Как раньше: `backend/scripts/iiko_sandbox.py` (+ scratch_*.py) работает
от `IIKO_*` из `.env` — теперь это ТОЛЬКО fallback для песочницы,
аудита и onboarding-тестов; боевые креды живут в БД ресторанов.
Шапка скрипта печатает, чей хост в кредах — смотреть перед запуском.
Готовые скретчи: daypart_revenue, daily_revenue, money_on_tables,
in_play_by_day, in_play_checkpoints, interval_revenue, today_now.

## Аудит нового ресторана (до подключения)

```powershell
cd D:\seasons\backend
# IIKO_* в .env — на аудируемый ресторан (fallback-путь песочницы)
..\venv\Scripts\python.exe -m pytest -o addopts="" -m onboarding tests/onboarding -q
```

Красные тесты = список работ по стандарту (docs/iiko-setup-standard.md).

## Тесты

```powershell
cd D:\seasons\backend
..\venv\Scripts\python.exe -m pytest -q          # onboarding исключён по умолчанию
```

## Бэкапы

Пока SQLite: копия `backend/dashboard.db` при остановленном API
(один файл = ВСЕ рестораны — потерять его теперь дороже).
После переезда на Postgres (карточка №10) — `pg_dump` по расписанию.
