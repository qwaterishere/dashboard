# Frontend (Angular 22)

SPA дашборда «Сезоны». Данные **только с бэкенда** (`GET /api/*`).

## Development

Требуется **Node.js 22+** и запущенный API на `:8000`.

```bash
cd backend && uvicorn src.main:app --reload --port 8000   # терминал 1
cd frontend && npm install && npm start # терминал 2 → :4200
```

Proxy (`proxy.conf.json`) проксирует `/api` → `localhost:8000` (включая вложенные пути вроде `/api/auth/login`).

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

## Storybook

Каталог **Atomic Design System** — изолированный просмотр atoms/molecules без запуска API и без роутинга приложения.

```bash
cd frontend
npm install
npm run storybook                # http://localhost:6006
```

Статическая сборка (preview/deploy):

```bash
npm run build-storybook          # → frontend/storybook-static/
```

**Stories** лежат рядом с компонентами:

```
src/app/ui/atoms/button/button.stories.ts
src/app/ui/atoms/lfl-badge/lfl-badge.stories.ts
src/app/ui/molecules/segment-control/segment-control.stories.ts
```

Глобальные стили (`src/styles.scss`, токены, layout) подключаются через `browserTarget` в `angular.json`, бэкенд для Storybook не нужен.

Конфиг: `.storybook/` (`main.ts`, `preview.ts`). Addons: a11y, docs, onboarding.

## Реализовано (миграция)

- **4 страницы** + purchases/settings/support placeholders
- **PeriodService** — label из `/api/dashboard`, granularity фильтрует график и sales query
- **Stock panel** — данные из `/api/warehouse` на dashboard
- **Theme toggle** — `localStorage` + `[data-theme]` light/dark
- **Mobile sidebar** — drawer на `<900px`
- **Storybook** — atoms/molecules stories
- **ESLint** + **xss-safety.spec.ts**
- **E2E** — smoke + security в CI

## Ожидает бэкенд

| Блок | Статус |
|------|--------|
| Reviews panel | UI готов, API отдаёт `reviews: null` |
| Granularity year | UI есть, API — месячный календарь |
| Auth / Settings | Placeholder до OAuth2 |

## Deploy

Production build: `frontend/dist/frontend/browser/`.

**Важно:** статический хостинг без API покажет ошибки загрузки — для полного UX нужен бэкенд или reverse proxy на `/api`.
