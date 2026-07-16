# MVP dashboard app (monorepo)

| Пакет | Путь | Стек |
|-------|------|------|
| **Frontend** | `frontend/` | Angular 22 SPA |
| **Backend** | `backend/` | FastAPI, SQLAlchemy |
| **Контракты** | `docs/frontend-handoff.md` | shared API spec |

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
npm install && npm start    # http://localhost:4200
```

## API

| Эндпоинт | Источник |
|----------|----------|
| `/api/dashboard` | БД (v2) |
| `/api/sales` | БД |
| `/api/warehouse`, `/api/foodcost` | БД |
| `/health` | liveness probe |

Подробности бэкенда — [backend/README.md](backend/README.md).  
Parity checklist и E2E — [frontend/README.md](frontend/README.md).

## Принцип контракта

**Бэкенд присылает сырые числа, фронтенд форматирует.**  
Категория — ключ `"k"`, имя «Кухня» подставит фронт. KPI: `prevValue`, не строка LfL.
