# Backend review → backlog для прода

**Проект:** FastAPI «Сезоны» (`backend/`)  
**Назначение:** задание бэкендеру на доработку (не дифф в коде).  
**Стек:** FastAPI · SQLAlchemy 2 · ~155 tests · services ~3.8k LOC  

| Метрика | Значение |
|---------|----------|
| P0 blockers | 8 |
| P1 prod hardening | 14 |
| P2 clean REST / architecture | 18 |
| `dashboard.py` | ~1003 LOC |
| Alembic migrations | 0 |
| CSRF на writes | только auth |
| Dependencies | unpinned, нет `psycopg` в requirements |

---

## Вердикт

Для mock/MVP — хорошо. Для прода с реальными данными — **блокер**: миграции, pin deps + Postgres driver, CSRF на все cookie-writes, отдельный sync-worker, readiness + structured logs. Параллельно — привести URL к читаемому REST.

---

## Scorecard

| Область | Статус | Комментарий |
|---------|--------|-------------|
| Auth / cookies / refresh | Strong | Argon2, rotation, reuse detection |
| iiko SSRF outbound | Strong | Allowlist + DNS / private IP block |
| Pydantic contracts | Strong | `extra=forbid` на page schemas |
| Tenant isolation | Good | Есть тесты; `restaurant_id` везде |
| REST path design | Weak | Query вместо path; iiko под `/auth/me` |
| Migrations | Weak | `create_all` + hand-rolled ALTER, нет Alembic |
| Deps / Postgres driver | Weak | Unpinned; `psycopg` не в requirements |
| CSRF coverage | Partial | Только auth writes; targets без CSRF |
| Observability | Weak | Text logs; нет request-id / readiness |
| Service architecture | Debt | `dashboard.py` ~1000 LOC god-file |

---

## P0 — блокеры продакшена

Без этого нельзя выкатывать с реальными данными / Postgres.

- [ ] **Alembic** (или эквивалент): версионируемые миграции вместо `create_all` + `migrate.py` ALTER. Rollback-скрипты. CI: migrate up/down на Postgres.
- [ ] **Pin зависимостей:** `requirements.lock` / pip-compile. Добавить `psycopg` (или `psycopg2`) в `base.txt` — сейчас prod URL `postgresql+psycopg://` без драйвера в deps.
- [ ] **CSRF** (Origin/Referer или double-submit) на **все** cookie-auth mutations: `PUT`/`DELETE /api/targets`, lock/unlock, iiko settings/sync. Сейчас только auth routes.
- [ ] **12-Factor XII:** в prod запретить `SYNC_EMBEDDED_WORKER`. Отдельный процесс `sync_worker` + cron/k8s CronJob. Web ≠ background jobs.
- [ ] **`GET /api/ready`:** проверка DB (и опционально encryption key). `/health` оставить liveness. K8s/LB probes развести.
- [ ] **Secrets:** отдельный `CREDENTIALS_ENCRYPTION_KEY` (не fallback на JWT). Ротация ключей. Запретить `AUTH_ENABLED=false` в production validator.
- [ ] **Rate limit / client IP** за reverse proxy: `X-Forwarded-For` / trusted proxies (сейчас `get_remote_address` → один IP прокси).
- [ ] **CI:** `pip-audit`, bandit, pytest security suite обязательны на каждый PR (как в `AGENTS.md`).

---

## P1 — hardening до «готового продукта»

- [ ] Structured JSON logs (`request_id`, `restaurant_id`, `user_id`, path, status, latency). Correlation ID middleware.
- [ ] Единый error envelope: `{ detail, code?, request_id }`. Не отдавать внутренности; маппинг domain errors → HTTP.
- [ ] Слой repositories (или query objects): убрать прямой ORM из толстых services. Services = use-cases.
- [ ] Декомпозировать `services/dashboard.py` (~1003 LOC) → kpi / chart / units / assemble. Аналогично `targets.py` (~593). *(см. раздел ниже)*
- [ ] Общий `src/services/periods.py` (TODO уже в foodcost/sales): единые правила week/month/year/compare.
- [ ] Один источник sync-status: либо Restaurant columns, либо `restaurant_sync_domains` — не dual-track sales vs warehouse.
- [ ] Унифицировать ORM: `Mapped[]` везде (`sales.py` ещё на `Column()`). Nullable `restaurant_id` на orders — сделать `NOT NULL` + backfill.
- [ ] Dashboard: `response_model=Dashboard` + ETag через Response param (сейчас `response_model=None` + ручной `JSONResponse`).
- [ ] `foodcost` в `SCHEMA_REGISTRY` / `API_PAGES` consistency; security tests на все page contracts.
- [ ] Тесты warehouse build/route depth; CSRF на targets mutations; internal scheduler token; Postgres в CI matrix.
- [ ] OpenAPI: стабильные `operationId`, примеры, error responses. Версия API `1.0.0`. Актуализировать README (убрать `data/` mocks).
- [ ] Убрать `httpx2` из `dev.txt` (похоже на мусор). `pytest-cov` + coverage gate на shared/core.
- [ ] Не хранить `dashboard.db*` / бэкапы в `backend/` для деплоя. `.gitignore` + volume mounts. Seed только через scripts.
- [ ] Закрыть TODO staff в foodcost или явно задокументировать как out-of-scope v1 (нули → `null` + feature flag).

### Пояснение: декомпозиция `dashboard.py` и `targets.py`

Не переписывать с нуля — **разнести зоны ответственности** по файлам. Поведение API не меняется.

**`dashboard.py` сейчас смешивает:** период/bounds, SQL-агрегаты (`_totals`/`_daily`/`_monthly`), прогнозы (`ForecastContext`), KPI, сборку ответов (`build_dashboard` / chart / kpi). Часть уже тянут `sales`, `foodcost`, `data_freshness`, `dashboard_week` через приватные импорты (`_data_bounds` и т.д.).

Целевая нарезка (пример):

```
services/
  periods.py              # общие date/week/month/compare
  dashboard_queries.py    # totals/daily/monthly/units/bounds
  dashboard_forecast.py   # ForecastContext + расчёты
  dashboard_kpi.py        # build_dashboard_kpi + helpers
  dashboard_chart.py      # build_dashboard_chart
  dashboard.py            # build_dashboard — только compose
```

**`targets.py` смешивает:** CRUD/lock страницы «Цели» и **проекции для дашборда/фудкоста** (`load_revenue_plans`, `load_foodcost_goals`, `targets_version_token`).

Целевая нарезка:

```
services/
  targets_plan.py         # уже есть
  targets_queries.py      # load_*, version token
  targets_write.py        # save / clear / lock / unlock
  targets.py              # build_targets + list_* — сборка ответа страницы
```

Делать маленькими PR: сначала `periods` + queries, потом forecast/KPI.

---

## REST: целевая карта путей

**Принцип:** ресурс в path, фильтры в query, действия — POST на sub-resource. `snake_case` query params. Интеграции вне `/auth`. Версию можно без `/v1` в URL, но зафиксировать contract version в OpenAPI + changelog.

| Сейчас | Целевой REST | Зачем |
|--------|--------------|-------|
| `GET /health` | `GET /api/health` + `GET /api/ready` | Единый префикс `/api`; readiness отдельно от liveness |
| `GET\|PUT\|DELETE /api/targets?year&month` | `GET\|PUT\|DELETE /api/targets/{year}/{month}` | Месяц — ресурс в path, не query на коллекции |
| `POST /api/targets/lock?year&month` | `POST /api/targets/{year}/{month}/lock` | Sub-resource / action на конкретном месяце |
| `POST /api/targets/unlock?year&month` | `POST /api/targets/{year}/{month}/unlock` или `DELETE …/lock` | Симметрия с lock; `DELETE /lock` = unlock |
| `GET /api/targets/locks` + `/configured` | `GET /api/targets?status=locked\|configured` | Один list-endpoint + фильтр |
| `GET\|PUT /api/auth/me/iiko` + sync | `GET\|PUT /api/integrations/iiko` + sync | iiko — интеграция ресторана, не профиль |
| `GET /api/data-freshness` | `/api/dashboard/freshness` или `/api/meta/…` | Сейчас «сирота» без домена |
| `weekStart` / `date_from` / `from` | `date_from` / `date_to` везде (snake) | Единый query-стиль |
| `POST /api/internal/iiko/sync` | `POST /api/internal/v1/sync/iiko` | Версионирование internal API |

### Предлагаемый каталог endpoints (целевой)

**System**  
`GET /api/health` · `GET /api/ready`

**Auth**  
`POST /api/auth/register|login|refresh|logout` · `GET|PATCH /api/auth/me` · `POST /api/auth/change-password`

**Integrations**  
`GET|PUT /api/integrations/iiko` · `POST /api/integrations/iiko/sync?full=`

**Analytics pages**  
`GET /api/dashboard` · `/chart` · `/kpi` · `/freshness` · `GET /api/sales` · `/warehouse` · `/foodcost`

**Targets**  
`GET /api/targets?status=` · `GET|PUT|DELETE /api/targets/{year}/{month}` · `POST …/lock` · `POST …/unlock`

**Internal**  
`POST /api/internal/v1/sync/iiko` (Bearer `SYNC_SCHEDULER_TOKEN`)

---

## P2 — чистый REST, DX, декомпозиция

- [ ] Миграция фронта + бэка: `/api/targets/{year}/{month}`, lock/unlock как sub-paths. Query `year`/`month` deprecate → 410/sunset header.
- [ ] Вынести iiko из `/api/auth/me/iiko` → `/api/integrations/iiko` (+ отдельный router). Auth router только identity.
- [ ] Унифицировать query: `date_from`/`date_to`; убрать camelCase aliases или оставить только как deprecated.
- [ ] Один Period DTO (или иерархия `PeriodMonth` / `PeriodRange`) вместо трёх разных Period в schemas.
- [ ] Слить `/targets/locks` + `/targets/configured` → `GET /api/targets?status=…`.
- [ ] Рассмотреть `DELETE /api/targets/{y}/{m}/lock` вместо `POST unlock` (идемпотентность).
- [ ] Перенести `GET /api/data-freshness` → `/api/dashboard/freshness` (или `/api/meta/…`).
- [ ] Перенести `/health` → `/api/health` (или оставить оба alias).
- [ ] Упростить `create_*_router(limiter)`: limiter через `app.state`.
- [ ] Удалить пустой `schemas/stubs/`. Убрать мёртвые экспорты. Почистить `PAGES` из `main` если не нужны.
- [ ] Не импортировать private `_unit_cost_sums` между foodcost ↔ targets — вынести в shared module.
- [ ] Roadmap RBAC: роли (управляющий / бухгалтер / склад), audit log на lock/unlock/settings.
- [ ] `Idempotency-Key` на `PUT` targets и sync start (202).
- [ ] Если sales/warehouse positions разрастутся — cursor pagination + sparse fieldsets.
- [ ] Генерация TS types из OpenAPI (`openapi-typescript`) → единый контракт с фронтом.
- [ ] Per-restaurant timezone обязателен в API settings (не только DDL default `Asia/Bishkek`).
- [ ] Контракт ошибок `409 locked` стабилен; clear-month confirm на фронте — вне scope бэка.
- [ ] Политика breaking changes: Accept-Version / sunset headers; `BACKEND_CHANGELOG.md`.

---

## 12-Factor checklist

### Уже близко

- III Config — pydantic-settings + `.env`
- IV Backing services — `DB_URL`
- V Build/run — `create_app` factory
- VII Port — uvicorn
- VIII Concurrency — готово к отдельным процессам

### Долги

- I Codebase — db artifacts в дереве
- II Dependencies — unpinned, нет lock
- VI Processes — embedded worker в web
- IX Disposability — нет graceful DB drain/ready
- XI Logs — не event stream / JSON
- XII Admin — CLI ок; seed/e2e смешаны с runtime

---

## Порядок внедрения (рекомендация)

1. **Спринт A (P0):** Alembic + pins + psycopg · CSRF на writes · ready probe · forbid embedded worker in prod · pip-audit CI  
2. **Спринт B (P1):** split dashboard/targets · `periods.py` · structured logs · sync-status unify · warehouse/CSRF tests · OpenAPI polish  
3. **Спринт C (P2 REST):** path redesign targets + `integrations/iiko` · query naming · deprecate aliases · OpenAPI→TS · RBAC roadmap  

---

*Источник: code review `backend/` · можно пересылать как есть.*
