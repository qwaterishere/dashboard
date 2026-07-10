# Frontend (Angular 22)

SPA дашборда «Сезоны». Данные с бэкенда (`GET /api/*`) с fallback на `/data/{page}.json`.

## Development

Требуется **Node.js 22+** и запущенный API на `:8000`.

```bash
cd backend && uvicorn src.main:app --reload --port 8000   # терминал 1
cd frontend && npm install && npm start                     # терминал 2 → :4200
```

Proxy (`proxy.conf.json`) проксирует `/api` → `localhost:8000`.

## Scripts

| Команда | Назначение |
|---------|------------|
| `npm start` | Dev server + API proxy |
| `npm run test:ci` | Unit tests (Vitest) |
| `npm run test:security` | XSS safety suite |
| `npm run lint` | ESLint + Angular template rules |
| `npm run lint:security` | Grep: no innerHTML / bypassSecurityTrust |
| `npm run e2e` | Playwright smoke + security |
| `npm run storybook` | Design system catalog (:6006) |
| `npm run build-storybook` | Static Storybook → `storybook-static/` |
| `npm run build` | Production build |

## Architecture (Atomic Design)

```
ui/atoms/ → ui/molecules/ → ui/organisms/ → ui/templates/ → features/*/pages/
core/services/period.service.ts        — granularity + sales date range
core/api/page-data.resource.ts         — typed httpResource factory
core/data/analytics-data-sync.service.ts — TTL + stale-while-revalidate polling
core/routing/analytics-route-reuse.strategy.ts — keep analytics pages alive
core/interceptors/api-fallback           — static JSON fallback
```

**Smart layer:** `AppShellHostComponent` (route) — greeting, period, right panel.  
**Dumb layer:** `AppShellTemplate` — layout slots only.

### Кэш данных и UI (Variant C)

| Слой | Поведение |
|------|-----------|
| **Root stores** | `DashboardDataStore`, `SalesDataStore`, `WarehouseDataStore`, `FoodcostDataStore` — единый fetch на вкладку |
| **RouteReuseStrategy** | dashboard / sales / warehouse / foodcost не уничтожаются при переключении вкладок |
| **TTL + polling** | `environment.analytics`: `staleAfterMs` (60s), `pollIntervalMs` (45s); `reload()` только для устаревших данных |

При возврате на вкладку UI и локальное состояние (ABC-фильтр, скролл) сохраняются; сеть — только если данные устарели или изменился period/query.

## Storybook

Каталог **Atomic Design System** — stories для всех 12 atoms + segment-control.

```bash
cd frontend && npm run storybook   # http://localhost:6006
```

В toolbar Storybook есть переключатель **«Тема»** (светлая / тёмная) — выставляет `data-theme` на `<html>`, как в приложении.

## Реализовано

- **4 страницы** + purchases/support placeholders; **настройки** — профиль и смена пароля
- **PeriodService** — granularity, sales query из dashboard period
- **Analytics data layer** — root stores + TTL polling + `AnalyticsRouteReuseStrategy`
- **WarehouseDataStore** — единый fetch `/api/warehouse` для dashboard + warehouse
- **api-fallback.interceptor** — `/data/{page}.json` при недоступности API
- **Per-page layout templates** — dashboard, sales, warehouse, foodcost
- **Theme toggle** — `localStorage` + `[data-theme]`
- **Mobile sidebar** — drawer на `<900px`
- **ESLint** + **xss-safety.spec.ts**
- **E2E** — smoke + security в CI

## Deploy

Production build: `frontend/dist/frontend/browser/`.

Статический fallback: положите `data/*.json` в `public/data/` перед сборкой.
