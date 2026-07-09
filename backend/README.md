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
python3 -m venv .venv          # один раз
source .venv/bin/activate      # в каждом новом терминале
pip install -r requirements/dev.txt
uvicorn src.main:app --reload --port 8000
```

Если `pip` не находится после `source .venv/bin/activate` — venv создан в другом месте; удалите `.venv` и создайте заново в `backend/`.

## CLI

```bash
cd backend
python -m src.cli.sales_loader
python -m src.cli.sales_loader --from 2026-01-01 --to 2026-01-31
python -m src.cli.sales_loader --from 2026-06-01 --to 2026-06-30 --chunk-days 1
```

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
