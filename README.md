# MVP dashboard app (monorepo)

| Пакет | Путь | Стек |
|-------|------|------|
| **Frontend** | `frontend/` | Angular 22 |
| **Backend** | `backend/` | FastAPI, SQLAlchemy |
| **Контракты** | `docs/frontend-handoff.md` | shared API spec |

Legacy HTML (`index.html`, `app/js/`).

## Запуск (dev)

**Backend:**
```bash
cd backend
pip install -r requirements/dev.txt
uvicorn src.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install && npm start    # http://localhost:4200, proxy /api → :8000
```

Переменные окружения: `backend/.env` (шаблон — `backend/.env.example`).

## API

| Эндпоинт | Источник |
|----------|----------|
| `/api/dashboard` | БД (v2) |
| `/api/sales` | БД |
| `/api/warehouse`, `/api/foodcost` | `backend/data/*.json` (до миграции) |

Подробности бэкенда — [backend/README.md](backend/README.md).

## Принцип контракта

**Бэкенд присылает сырые числа, фронтенд форматирует.**  
Категория — ключ `"k"`, имя «Кухня» подставит фронт. Позиции: `qty`, `price`, `unitCost`.
