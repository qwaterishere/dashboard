# Backend production readiness

**Проект:** FastAPI «Сезоны» (`backend/`)  
**Стек:** FastAPI · SQLAlchemy 2 · Alembic baseline · resource REST + thick Angular client

## Вердикт: **10/10 production-ready** (literal seals complete)

Канон API — resource REST (page-BFF снят):

| Домен | Канон |
|-------|--------|
| Dashboard KPI/chart | `GET /api/base-metrics/*` |
| Sales | `GET /api/sales/snapshot` (+ `/positions`) |
| Stock | `GET /api/stock/*` (`StockSnapshot`) |
| Foodcost | `GET /api/foodcost/*` |
| Targets | `GET\|PUT\|DELETE /api/targets/{year}/{month}` |
| iiko | `GET\|PUT /api/integrations/iiko` (+ sync) |
| Freshness | `GET /api/data-freshness` |
| Health | `GET /api/health` · `GET /api/ready` |
| Internal sync | `POST /api/internal/v1/sync/iiko` (`triggerInternalIikoSync`) — **enqueue only** in prod |

### Production seals (this pass)

- Sync off API worker: `queued` / `queued_full` → claim → `run_sync_job`; `SYNC_RUN_IN_API=false` forced in prod
- Internal route enqueues due syncs; `python -m src.cli.sync_worker` drains queue
- `TRUSTED_PROXIES` required non-empty in prod (no `*`)
- `RATE_LIMIT_STORAGE_URI` required in prod (`memory://` allowed explicitly for single-node; warns)
- AuthError / RestaurantError codes → unified `http_error` envelope
- base-metrics validation/domain via `http_error(..., code=...)`
- Alembic head check on production startup (fail closed)
- Alembic up/down/up on Postgres 16 in Backend CI
- CORS `expose_headers=["X-Request-Id"]`

### Already in place (prior hardening)

- Unified error envelope (`detail`: `message` / `code` / `request_id?`)
- CSRF via `Depends(require_trusted_origin)` on cookie-auth mutations
- RBAC on targets writes (manager|accountant) and iiko put/sync (manager)
- `hmac.compare_digest` for scheduler bearer token
- CORS `*` rejected in Settings (credentials-safe whitelist only)
- Money quantization via `analytics.money.money_float`
- Alembic baseline, pinned deps, fail-closed audit CI, `/api/ready`, JSON logs, `X-Request-Id`

### Optional follow-ups (not blocking 10/10)

- OpenAPI drift-check in CI (`dump_openapi` ↔ `npm run generate:api`)
- Frontend: treat sync `pending` like `running` for poll UX after OpenAPI regen
- Redis `RATE_LIMIT_STORAGE_URI` when running multiple API workers

## OpenAPI → TS

```bash
cd backend && python -m scripts.dump_openapi
cd ../frontend && npm run generate:api
```
