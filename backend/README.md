# Dashboard API

Бэкенд проекта "Дашборд".

## Структура

```
backend/
├── src/              # dashboard-api (FastAPI)
│   ├── api/routes/   # HTTP
│   ├── services/     # бизнес-логика
│   ├── db/           # SQLAlchemy
│   ├── schemas/      # Pydantic DTO
│   ├── integrations/ # iiko и др. backing services
│   └── cli/          # admin processes (загрузка продаж)
├── tests/
├── requirements/
└── data/             # JSON-мокапы warehouse/foodcost
```

## Запуск

```bash
cd backend
cp .env.example .env          # один раз
python3 -m venv .venv          # один раз
source .venv/bin/activate      # в каждом новом терминале
pip install -r requirements/dev.txt
uvicorn src.main:app --reload --port 8000
```

Локально по умолчанию `APP_ENV=development`: SQLite (`dashboard.db`), мягкая политика паролей (≥8 символов), без HSTS, `JWT_COOKIE_SECURE=false`.

### Production profile

В production задайте в окружении (см. комментарии в `.env.example`):

| Переменная | Значение |
|------------|----------|
| `APP_ENV` | `production` |
| `DB_URL` | PostgreSQL (`postgresql+psycopg://...`) — SQLite запрещён |
| `JWT_SECRET_KEY` | уникальный секрет (`openssl rand -hex 32`) |
| `JWT_COOKIE_SECURE` | `true` |
| `HSTS_ENABLED` | `true` (или опустить — включится автоматически) |
| `CORS_ORIGINS` | whitelist вашего фронтенда |

При `APP_ENV=production` приложение не стартует с dev-секретом, SQLite или небезопасными cookies. Пароли: ≥12 символов, верхний/нижний регистр, цифра, спецсимвол.

**Сессия:** access и refresh токены — только **HttpOnly cookies** (`/api`, `/api/auth`). JSON body не содержит токенов. SPA шлёт `withCredentials`; Bearer в заголовке поддерживается для API-клиентов и тестов.

**Настройки:** `PATCH /api/auth/me` (профиль), `POST /api/auth/change-password` (смена пароля + новая сессия).

Если `pip` не находится после `source .venv/bin/activate` — venv создан в другом месте; удалите `.venv` и создайте заново в `backend/`.

## CLI

```bash
cd backend
# одноразовый ключ регистрации (plaintext печатается один раз)
PYTHONPATH=. python -m src.cli.create_invite
PYTHONPATH=. python -m src.cli.create_invite --ttl-days 7 --note "Ташкент"

python -m src.cli.sales_loader --restaurant-id <uuid>
python -m src.cli.sales_loader --restaurant-id <uuid> --from 2026-01-01 --to 2026-01-31
```

`restaurant_id` возвращается в `GET /api/auth/me/iiko` после регистрации.
Регистрация требует `invite_key` из `create_invite`.
iiko credentials задаются пользователем в настройках (`PUT /api/auth/me/iiko`).
Загрузка продаж из UI: `POST /api/auth/me/iiko/sync` (фоновая задача, статус в `GET /api/auth/me/iiko`).
Переменные `IIKO_*` в `.env` — опциональный fallback для аудита/onboarding-тестов.

OLAP iiko часто обрывает большие ответы (`RemoteProtocolError: incomplete chunked read`).
По умолчанию загрузчик бьёт диапазон **по 1 дню**; при стабильном сервере можно `--chunk-days 7`.

## Тесты

```bash
cd backend
pytest tests/ -v
pytest -m onboarding   # живой аудит iiko
```

## Будущие микросервисы

```
backend/
├── services/
│   ├── dashboard-api/   ← текущий src/ (после split)
│   ├── warehouse-api/
│   └── foodcost-api/
└── packages/
    └── common/          # shared schemas, auth, logging
```

Контракты API остаются в `docs/frontend-handoff.md` на уровне монорепо.
