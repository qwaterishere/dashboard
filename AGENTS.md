# AGENTS.md — Контекст миграции «Сезоны» на Angular 22

> **Назначение файла:** единый источник правды для AI-агента при работе над проектом.
> Следуй этому документу максимально буквально. Не отклоняйся от архитектуры без явного запроса пользователя.

> **Security-first:** проект должен быть **крайне безопасным** — без backdoor'ов, без доверия к недоверенным данным, с обязательными security-тестами в CI на каждый PR. Безопасность не опциональна и не откладывается «на потом».

---

## 0. Критическое уточнение

Текущий проект — **не Angular-приложение**. Это MVP на **vanilla JS (ES modules) + HTML MPA + CSS + FastAPI**.

| Аспект | Сейчас |
|--------|--------|
| Фреймворк | Нет (чистый JS) |
| Сборка | Нет (`python -m http.server` / uvicorn) |
| TypeScript | Нет |
| Тесты | Нет |
| CI/CD | Нет |
| Страницы | 4 рабочих + 1 заглушка (`purchases.html`) |
| Файлов JS | ~1 200 строк логики |

**Миграция = greenfield-переписывание фронтенда**, а не обновление версии Angular.

---

## 1. Назначение проекта

Дашборд ресторанной сети **«Сезоны»**: KPI, продажи, склад, фудкост.

**Контракт данных:** бэкенд отдаёт **сырые числа**, фронтенд форматирует в ru-RU.

```
data/<страница>.json   ← контракт API + static fallback
backend/app.py         ← FastAPI: GET /api/{page}
app/js/                ← legacy (удалить после cutover)
```

Принцип: `8144000`, а не `"8 144 000 ₽"`; категория — ключ `"k"`, имя «Кухня» — на клиенте.

---

## 2. Atomic Design System — обязательная методология

### 2.1. Теория (Brad Frost)

Atomic Design — иерархическая методология построения UI из пяти уровней:

```
Atoms → Molecules → Organisms → Templates → Pages
```

| Уровень | Определение | Правило |
|---------|-------------|---------|
| **Atoms** | Неделимые UI-элементы: кнопка, метка, иконка, badge, progress-fill | Не импортируют другие компоненты. Только `@Input`/`@Output`, без бизнес-логики |
| **Molecules** | Группы атомов с одной функцией: segment control, KPI value + badge, bar row | Импортируют только atoms |
| **Organisms** | Сложные секции UI: sidebar, KPI grid, donut chart block, ABC table | Импортируют atoms + molecules (+ organisms того же или нижнего уровня) |
| **Templates** | Каркас страницы: layout + слоты для organisms, **без реальных данных** | Импортируют organisms. Демонстрируют структуру, не content |
| **Pages** | Smart-компоненты: template + реальные данные из API | Импортируют templates + organisms. Содержат data-fetching и feature-логику |

**Pages** в Angular = route-level компоненты с `httpResource()` / сервисами.
**Templates** = layout-компоненты со `<ng-content>` / slot-проекцией.

### 2.2. Правила зависимостей (строго)

```
Pages       → Templates, Organisms, Core/Services
Templates   → Organisms, Molecules
Organisms   → Molecules, Atoms
Molecules   → Atoms
Atoms       → (ничего из ui/)
```

**Запрещено:**
- Atom импортирует Molecule/Organism
- Molecule импортирует Organism
- UI-компонент (atoms–organisms) импортирует feature/page
- Бизнес-логика (агрегация ABC, расчёт rev) внутри atoms/molecules

**Разрешено:**
- Feature-specific organisms в `features/{name}/organisms/` — если не переиспользуются
- Shared organisms в `ui/organisms/` — если используются ≥2 features
- Pipes/utils в `shared/` — импортируются всеми уровнями

### 2.3. Presentational vs Smart

| Тип | Где | Data fetching | Пример |
|-----|-----|---------------|--------|
| **Dumb (presentational)** | atoms, molecules, большинство organisms | `@Input()` only | `DonutChartOrganism`, `KpiCardOrganism` |
| **Smart (container)** | pages | `httpResource()`, services, signals | `DashboardPageComponent` |

### 2.4. Storybook (рекомендуется)

Каждый atom, molecule, organism — co-located story:

```
ui/atoms/button/
├── button.component.ts
├── button.component.html
├── button.component.scss
├── button.component.spec.ts
└── button.stories.ts
```

Storybook — каталог design system. Pages в Storybook не обязательны (покрываются e2e).

### 2.5. BEM + SCSS tokens

- SCSS-переменные из legacy `app/base.css` → `assets/styles/_tokens.scss`
- BEM в scoped component styles: `.btn`, `.btn--primary`, `.btn__icon`
- Page modifiers: `[data-page="foodcost"]` на host (инвертированный семафор)

---

## 3. Каталог компонентов Atomic Design (маппинг legacy → Angular)

### 3.1. Atoms (`frontend/src/app/ui/atoms/`)

| Компонент | Legacy-источник | Описание |
|-----------|-----------------|----------|
| `ButtonComponent` | `.pill`, `.seg button`, nav | Варианты: primary, ghost, segment |
| `IconComponent` | inline SVG в HTML | `@Input() name`, SVG sprite или inline |
| `BadgeComponent` | `.badge`, `.abc-tag`, `.tag` | Числовой/буквенный badge |
| `AvatarComponent` | `.ava` | Инициалы пользователя |
| `LabelComponent` | `.ttl`, `.dc-label`, `.fc-name` | Текстовая метка |
| `HeadingComponent` | `.head h1`, `.p-head h3` | h1–h4 с типографикой |
| `TextComponent` | `.k-sub`, `.r-cap`, `.bc-sub` | Muted/secondary text |
| `DotComponent` | `.lg-dot`, `.store-dot` | Цветная точка |
| `ProgressFillComponent` | `<i style="width:...">` в bars | `@Input() width`, `@Input() variant` |
| `ProgressTrackComponent` | `.g-track`, `.bar`, `.br-track` | Track + slot для fill |
| `MarkLineComponent` | `.g-mark`, `.fc-goal` | Вертикальная/горизонтальная метка плана |
| `SparkDotComponent` | chart circles | SVG circle для line charts |
| `DividerComponent` | `.nav-sep`, `.r-divider`, `.pc-divider` | Horizontal rule |
| `LinkComponent` | `.r-link`, `.ft a` | Styled anchor |
| `LflBadgeAtom` | `.lfl.up/.dn` | `@Input() direction`, `@Input() value` — обёртка над pipe |

**Pipes (не компоненты, но atoms-level utilities):** `MoneyPipe`, `PercentPipe`, `SignedPercentPipe`, `SignedPpPipe`, `FmtPipe`, `DecimalPipe`, `MillionsPipe`, `KPipe` — из `app/js/format.js`.

**Constants:** `category.constants.ts` — из `app/js/palette.js`.

**Utils:** `chart.utils.ts` — `describeArc`, `shade` из `app/js/charts.js`.

### 3.2. Molecules (`frontend/src/app/ui/molecules/`)

| Компонент | Состав atoms | Legacy-источник |
|-----------|--------------|-----------------|
| `SegmentControlComponent` | Button × N | `#levelSeg`, `#storeSeg`, `#freqSeg`, `#abcAxis`, `#metricSeg` |
| `DatePillComponent` | Icon + Text | `.date-pill` |
| `ComparePillComponent` | Text + Button | `.cmp-pill` |
| `PanelHeaderComponent` | Heading + SegmentControl/Pill | `.p-head` |
| `KpiValueComponent` | Heading + LflBadgeAtom | `.k-val` |
| `GoalTrackComponent` | ProgressTrack + ProgressFill + MarkLine + Text | `.k-goal` |
| `KpiSubtextComponent` | Text + Icon | `.k-sub` |
| `LegendRowComponent` | Dot + Label + Text | `.lg-row` |
| `BarRowComponent` | Label + ProgressTrack + Text | `.bar-row`, `.top-row` |
| `NavItemComponent` | Icon + Label + Badge | `.nav a` |
| `StoreRowComponent` | Dot + Label + Text | `.store-row`, `.ss-row` |
| `CategoryBarComponent` | Label + ProgressTrack | `.cat`, `.fc-item` |
| `ReviewScoreComponent` | Heading + Text | `.rev-score` |
| `ReviewBarComponent` | 3× ProgressFill | `.rev-bar` |
| `SourceRowComponent` | Label + Text | `.src-row` |
| `AbcPillComponent` | Dot + Badge + Text | `.abc-pill` |
| `SortableHeaderComponent` | Label + Text (arrow) | `#posHead th` |
| `PopoverRowComponent` | Label + Text | `.pr` в popover |
| `TableRowComponent` | generic td cells | базовая строка таблицы |
| `DiscCellComponent` | Label + Text | `.disc-cell` |
| `LoadErrorComponent` | Text | `.load-error` |
| `ThemeToggleComponent` | Dot + Text | `.mode` |
| `ProfileBlockComponent` | Icon + Avatar + Text | `.profile` |

### 3.3. Organisms (`frontend/src/app/ui/organisms/` + feature-specific)

#### Shared organisms (`ui/organisms/`)

| Компонент | Состав | Legacy |
|-----------|--------|--------|
| `SidebarOrganism` | Logo + NavItem × N + ThemeToggle | `<aside class="side">` |
| `DonutChartOrganism` | SVG paths + LegendRow × N + center slot | `#donut`, `#legend` (sales + warehouse) |
| `BarChartGroupsOrganism` | PanelHeader + BarRow × N (grouped) | `#bars` |
| `DetailPopoverOrganism` | PopoverRow × N + Link | `.kpop` (dashboard KPI popovers) |
| `DayDetailPopoverOrganism` | PopoverRow × N + Link | `.kpop.day` (chart day) |
| `SegmentedChartOrganism` | SVG chart area + axes | generic SVG wrapper |

#### Feature organisms (`features/{feature}/organisms/`)

| Feature | Organism | Legacy |
|---------|----------|--------|
| dashboard | `KpiGridOrganism` | `#kpis` (3 KPI cards) |
| dashboard | `KpiCardOrganism` | `.kpi.m-rev` etc. |
| dashboard | `RevenueDaysChartOrganism` | `#daysChart` + day popover |
| dashboard | `ReviewsPanelOrganism` | `#reviews` |
| dashboard | `FoodcostMiniOrganism` | `#fcMini` |
| dashboard | `CategoriesPanelOrganism` | `#categories` |
| dashboard | `StockPanelOrganism` | `#stockTotal`, `#storeSplit` |
| sales | `SalesStructureOrganism` | donut/bars toggle block |
| sales | `AbcAnalysisOrganism` | pills + table |
| sales | `PositionsTableOrganism` | `#posBody` |
| warehouse | `StockTotalsOrganism` | totals + byStore |
| warehouse | `StockDynamicsOrganism` | `#stockChart` |
| warehouse | `TopPositionsOrganism` | `#topBars` |
| foodcost | `OverviewCardsOrganism` | `#cleanCard`, `#dirtyCard` |
| foodcost | `UnitsGridOrganism` | `#units` |
| foodcost | `LossesTableOrganism` | `#lossBody`, `#lossFoot` |
| foodcost | `DiscountsGridOrganism` | `#discGrid` |
| foodcost | `CategoryTabsOrganism` | `#catTabs` + `#catBody` |
| foodcost | `ProductsCostChartOrganism` | `#pcChart` + `#pcTip` |

### 3.4. Templates (`frontend/src/app/ui/templates/`)

| Template | Layout | Слоты |
|----------|--------|-------|
| `AppShellTemplate` | Grid 208px \| 1fr \| 296px | `sidebar`, `main`, `right` |
| `DashboardLayoutTemplate` | AppShell + period bar + main panels + right panels | `header`, `period`, `content`, `rightTop`, `rightBottom` |
| `SalesLayoutTemplate` | AppShell без right panel (full width main) | `header`, `period`, `content` |
| `WarehouseLayoutTemplate` | AppShell full width | `header`, `meta`, `content` |
| `FoodcostLayoutTemplate` | AppShell full width | `header`, `period`, `content` |
| `PlaceholderLayoutTemplate` | AppShell + empty state | `title`, `message` |

Templates **не** вызывают API. Получают `@Input()` или проецируют `<ng-content>`.

### 3.5. Pages (`frontend/src/app/features/{feature}/pages/`)

| Page | Route | Template | Data resource |
|------|-------|----------|---------------|
| `DashboardPageComponent` | `/dashboard` | `DashboardLayoutTemplate` | `httpResource<DashboardData>('dashboard')` |
| `SalesPageComponent` | `/sales` | `SalesLayoutTemplate` | `httpResource<SalesData>('sales')` |
| `WarehousePageComponent` | `/warehouse` | `WarehouseLayoutTemplate` | `httpResource<WarehouseData>('warehouse')` |
| `FoodcostPageComponent` | `/foodcost` | `FoodcostLayoutTemplate` | `httpResource<FoodcostData>('foodcost')` |
| `PurchasesPageComponent` | `/purchases` | `PlaceholderLayoutTemplate` | stub |

Pages — **единственное место**, где допустимы:
- `httpResource()` / `ApiService`
- Feature services (`SalesAggregationService`)
- Локальный UI state через `signal()`

---

## 4. Целевая структура проекта

```
dashboard/
├── AGENTS.md                          ← этот файл
├── frontend/                          # NEW: Angular 22 SPA
│   ├── angular.json
│   ├── package.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   ├── core/
│   │   │   │   ├── api/
│   │   │   │   │   ├── api.service.ts
│   │   │   │   │   └── page-data.resource.ts
│   │   │   │   ├── config/
│   │   │   │   │   └── environment.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── api-fallback.interceptor.ts
│   │   │   │   └── services/
│   │   │   │       └── period.service.ts
│   │   │   ├── shared/
│   │   │   │   ├── models/            # TS interfaces из data/*.json
│   │   │   │   ├── pipes/
│   │   │   │   ├── constants/
│   │   │   │   └── utils/
│   │   │   ├── ui/                    # ★ Atomic Design System
│   │   │   │   ├── atoms/
│   │   │   │   │   ├── button/
│   │   │   │   │   ├── icon/
│   │   │   │   │   ├── badge/
│   │   │   │   │   └── ...
│   │   │   │   ├── molecules/
│   │   │   │   │   ├── segment-control/
│   │   │   │   │   ├── kpi-value/
│   │   │   │   │   └── ...
│   │   │   │   ├── organisms/
│   │   │   │   │   ├── sidebar/
│   │   │   │   │   ├── donut-chart/
│   │   │   │   │   └── ...
│   │   │   │   └── templates/
│   │   │   │       ├── app-shell/
│   │   │   │       ├── dashboard-layout/
│   │   │   │       └── ...
│   │   │   └── features/
│   │   │       ├── dashboard/
│   │   │       │   ├── organisms/     # feature-specific organisms
│   │   │       │   ├── pages/
│   │   │       │   └── dashboard.routes.ts
│   │   │       ├── sales/
│   │   │       │   ├── organisms/
│   │   │       │   ├── pages/
│   │   │       │   ├── services/
│   │   │       │   │   └── sales-aggregation.service.ts
│   │   │       │   └── sales.routes.ts
│   │   │       ├── warehouse/
│   │   │       ├── foodcost/
│   │   │       └── purchases/
│   │   ├── assets/styles/
│   │   │   ├── _tokens.scss
│   │   │   ├── _layout.scss
│   │   │   └── pages/
│   │   └── index.html
│   ├── e2e/                           # Playwright
│   └── .storybook/                    # Design system catalog
├── backend/                           # существующий FastAPI
├── data/                              # JSON-контракты + fallback
├── .github/
│   ├── workflows/
│   │   ├── frontend-ci.yml
│   │   ├── backend-ci.yml
│   │   ├── security-ci.yml          # SAST, dependency audit, secrets scan
│   │   └── deploy.yml
└── security/
    ├── SECURITY.md                  # политика уязвимостей + responsible disclosure
    └── headers.conf                 # эталон CSP / security headers (nginx/reference)
```

### Генерация компонентов (CLI)

```bash
# Atom
ng g c ui/atoms/button --standalone --change-detection=OnPush

# Molecule
ng g c ui/molecules/segment-control --standalone --change-detection=OnPush

# Organism
ng g c ui/organisms/sidebar --standalone --change-detection=OnPush

# Template
ng g c ui/templates/app-shell --standalone --change-detection=OnPush

# Page
ng g c features/dashboard/pages/dashboard-page --standalone --change-detection=OnPush
```

---

## 5. Ключевые технические решения Angular 22

| Решение | Обоснование |
|---------|-------------|
| **Standalone components** | Стандарт, без NgModules |
| **OnPush по умолчанию** | Дефолт Angular 22 |
| **`httpResource()`** | Стабилен в v22; data fetching на Pages |
| **Signals** | Локальный UI state в pages/organisms |
| **Lazy routes** | `loadComponent` для каждой Page |
| **Fetch backend** | Дефолт HttpClient в v22 |
| **Angular Aria** | SegmentControl, Popover, Tabs (foodcost) — accessibility |
| **TypeScript 6** | Требование Angular 22 |
| **Application builder** | Webpack deprecated |
| **Node.js ≥ 22** | Node 20 dropped |

### Маршрутизация (MPA → SPA)

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: '',
    component: AppShellTemplate, // или wrapper
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/pages/dashboard-page/...') },
      { path: 'sales',     loadComponent: () => import('./features/sales/pages/sales-page/...') },
      { path: 'warehouse', loadComponent: () => import('./features/warehouse/pages/warehouse-page/...') },
      { path: 'foodcost',  loadComponent: () => import('./features/foodcost/pages/foodcost-page/...') },
      { path: 'purchases', loadComponent: () => import('./features/purchases/pages/purchases-page/...') },
    ],
  },
];
```

### Data layer (замена `app/js/api.js`)

```typescript
// core/interceptors/api-fallback.interceptor.ts
// При network error / API недоступен → GET /data/{page}.json

// core/api/page-data.resource.ts
export function createPageResource<T>(page: () => string) {
  return httpResource<T>(() => ({
    url: `${inject(ENV).apiBase}/${page()}`,
  }));
}
```

---

## 6. Что переиспользовать из legacy

| Legacy | Angular equivalent | Уровень Atomic |
|--------|-------------------|----------------|
| `app/js/format.js` | Pipes в `shared/pipes/` | Atoms utilities |
| `app/js/palette.js` | `shared/constants/category.constants.ts` | Atoms constants |
| `app/js/charts.js` | `shared/utils/chart.utils.ts` | Atoms utilities |
| `app/js/api.js` | `core/api/` + interceptor | Core (не UI) |
| `app/base.css` | `_tokens.scss`, `_layout.scss` | Design tokens |
| `app/{page}.css` | Page-scoped styles + `[data-page]` | Templates/Pages |
| `data/*.json` | `shared/models/*.model.ts` | Core contracts |
| Sidebar HTML × 4 | `SidebarOrganism` | Organism |
| `#levelSeg` × 5 | `SegmentControlComponent` | Molecule |

---

## 7. Поэтапный план миграции

### Фаза 0 — Scaffold (1–2 дня)

```bash
ng new frontend --standalone --routing --style=scss --ssr=false
cd frontend && ng update @angular/core@22 @angular/cli@22
npx storybook@latest init
npx playwright install
```

- ESLint + `@angular-eslint`, Prettier
- `environment.ts`: `apiBase: '/api'`
- Создать структуру папок `ui/atoms`, `ui/molecules`, `ui/organisms`, `ui/templates`
- CI skeleton (`.github/workflows/frontend-ci.yml`, `security-ci.yml`)
- Pre-commit: gitleaks + detect-private-key
- SCSS tokens из `app/base.css` → `_tokens.scss`

### Фаза 1 — Atoms + Pipes + Core (3–4 дня)

**Порядок:** сначала atoms, потом molecules (не нарушать иерархию).

1. TypeScript-модели из `data/*.json`
2. Все pipes из `format.js` + unit-тесты
3. `category.constants.ts`, `chart.utils.ts` + тесты
4. Atoms: Button, Icon, Badge, Label, Heading, Text, Dot, ProgressFill, ProgressTrack, MarkLine, LflBadgeAtom
5. ApiService + fallback interceptor + security interceptor tests
6. Storybook stories для каждого atom
7. `xss-safety.spec.ts` — базовый XSS test suite

**Gate:** все atom stories рендерятся, pipes ≥ 100% coverage, XSS tests pass.

### Фаза 2 — Molecules + Templates (2–3 дня)

1. Molecules: SegmentControl, DatePill, ComparePill, PanelHeader, KpiValue, GoalTrack, LegendRow, BarRow, NavItem, LoadError, ...
2. Templates: AppShell, DashboardLayout, SalesLayout, WarehouseLayout, FoodcostLayout
3. Organism: Sidebar
4. Storybook stories для molecules и templates (с mock content)

**Gate:** AppShellTemplate рендерит sidebar + empty slots.

### Фаза 3 — Dashboard Page (3–4 дня)

1. Feature organisms: KpiCard, KpiGrid, RevenueDaysChart, ReviewsPanel, FoodcostMini, CategoriesPanel, StockPanel
2. Shared organisms: DonutChart (если нужен), DetailPopover, DayDetailPopover
3. `DashboardPageComponent` — httpResource + compose template
4. Unit tests: KpiCard, GoalTrack width, chart utils
5. E2E: dashboard smoke

**Gate:** pixel-parity с `index.html` + `dashboard.js`.

### Фаза 4 — Sales Page (4–5 дней)

1. `SalesAggregationService` (из `sales.js` RAW/aggBy/ABC)
2. Organisms: SalesStructure, AbcAnalysis, PositionsTable
3. Reuse: DonutChartOrganism, BarChartGroupsOrganism, SegmentControl
4. Unit tests: ABC boundaries (80%/95%), aggregation
5. E2E: donut hover, ABC filter, table sort

### Фаза 5 — Warehouse + Foodcost (4–5 дней)

**Warehouse:** StockTotals, StockDynamics, TopPositions — reuse DonutChart, SegmentControl.

**Foodcost:** OverviewCards, UnitsGrid, LossesTable, DiscountsGrid, CategoryTabs, ProductsCostChart.
- `[data-page="foodcost"]` для инвертированного семафора
- Angular Aria для tabs

### Фаза 6 — Backend hardening (2–3 дня, параллельно)

```python
# backend/schemas/dashboard.py — Pydantic models
# openapi-typescript → auto TS types (optional)
# pytest для /api/{page}
```

### Фаза 7 — Stubs + unwired UI (2 дня)

- `PurchasesPageComponent` — placeholder
- `PeriodService` (signal) — wiring period toggles
- `ThemeToggleComponent` — dark/light
- Settings/Support — placeholder или скрыть

### Фаза 8 — Cutover (1–2 дня)

1. `ng build --configuration=production`
2. FastAPI: `app.mount("/", StaticFiles(directory=ROOT / "frontend" / "dist", html=True))`
3. Удалить legacy: `index.html`, `sales.html`, `app/js/`
4. Обновить README
5. GitHub Pages: deploy `dist/` + `data/`

### Фаза 9 — Security hardening + audit (2–3 дня, параллельно с 6–8)

1. Включить security CI (см. §8.10)
2. Написать security unit/integration тесты (см. §8.9)
3. CSP + security headers в FastAPI/nginx
4. `npm audit` / `pip-audit` — 0 high/critical
5. Финальный security checklist (§8.11) — все пункты зелёные

**Gate:** security-ci проходит на main; нет открытых high/critical CVE в lockfiles.

---

## 8. Безопасность проекта (Security-first)

### 8.1. Принципы (обязательны)

| Принцип | Реализация |
|---------|------------|
| **Zero trust к данным** | Любые данные API/JSON — недоверенные; валидация на бэкенде (Pydantic) + типизация на фронте |
| **Defense in depth** | CSP + sanitization + typed templates + rate limiting + minimal CORS |
| **Least privilege** | API только GET; нет write-эндпоинтов без auth; минимальные CI permissions |
| **No secrets in repo** | `.env` в `.gitignore`; GitHub Secrets для CI; pre-commit secret scan |
| **Supply chain integrity** | Lockfiles (`package-lock.json`, `requirements.txt` с pins); audit в CI |
| **No backdoors** | Запрет `eval`, `Function()`, dynamic `import()` из user input, `bypassSecurityTrust*`, postinstall-скриптов без review |
| **Fail secure** | При ошибке API — generic message пользователю, детали только в server logs |
| **Security tests mandatory** | Каждый PR: lint + unit + security scans; security-тесты не skip'аются |

### 8.2. Уязвимости legacy (устранить при миграции)

| Уязвимость | Где | Severity | Митигация в Angular |
|------------|-----|----------|---------------------|
| **XSS через `innerHTML`** | Все `app/js/pages/*.js` | **Critical** | Angular templates + `@for`; **запрет** `innerHTML`, `[innerHTML]`, `DomSanitizer.bypassSecurityTrustHtml` |
| **DOM XSS в popover** | `dashboard.js`, `foodcost.js` | **High** | `DetailPopoverOrganism` с text interpolation через `{{ }}` |
| **Open CORS `*`** | `backend/app.py` | **Medium** (prod) | Whitelist origins; dev-only `*` |
| **Path traversal в `{page}`** | `backend/app.py` | **Low** (whitelist есть) | Сохранить whitelist `PAGES`; добавить тест |
| **Static file exposure** | `StaticFiles(directory=ROOT)` | **Medium** | Не отдавать `backend/`, `.git`, `.env`; mount только `dist/` |
| **Нет auth** | Весь проект | **High** (prod) | Roadmap: OAuth2/JWT + route guards (§8.8) |
| **Нет CSP headers** | Static hosting | **Medium** | Content-Security-Policy (§8.7) |
| **Нет rate limiting** | API | **Medium** | `slowapi` / reverse proxy limit |
| **Error leakage** | `loadPage` показывает `err.message` | **Low** | Generic UI error; log server-side |

### 8.3. Frontend security (Angular 22)

#### XSS prevention (Critical)

```typescript
// ✅ РАЗРЕШЕНО — Angular auto-escapes
<span>{{ product.name }}</span>
<span [attr.data-key]="category.key"></span>

// ❌ ЗАПРЕЩЕНО — никогда без explicit security review + тест
element.innerHTML = userData;
[innerHTML]="untrustedHtml"
DomSanitizer.bypassSecurityTrustHtml(...)
DomSanitizer.bypassSecurityTrustResourceUrl(...)
DomSanitizer.bypassSecurityTrustScript(...)
```

**ESLint rule (обязательно):**
```json
"@angular-eslint/template/no-call-expression": "error",
"no-restricted-imports": ["error", { "paths": [{ "name": "@angular/platform-browser", "importNames": ["DomSanitizer"], "message": "Use templates instead of bypassSecurityTrust*" }] }]
```

#### API & HTTP

- `HttpClient` только к same-origin (`/api`) или whitelist в `environment.ts`
- **Запрет** передавать user input в URL path без whitelist (page names — enum, не string from URL param directly)
- Interceptor: не логировать tokens/credentials в console
- `httpResource` — validate response shape (runtime guard или Zod/io-ts optional layer)

#### Client storage

- **Не хранить** secrets/tokens в `localStorage` без encryption (prefer httpOnly cookies для auth)
- Theme preference — единственное допустимое использование localStorage на MVP

#### Dependencies (anti-backdoor)

```bash
npm ci                    # только ci, не install (deterministic)
npm audit --audit-level=high
npx lockfile-lint --path package-lock.json --allowed-hosts npm
```

- Review **каждой** новой npm-зависимости: maintainer, downloads, postinstall scripts
- **Запрет** packages с `preinstall`/`postinstall` shell без явного approval
- Pin major versions; обновлять deps вручную по необходимости

#### Build security

- Production: `ng build --configuration=production` (AOT, no source maps публично)
- Subresource Integrity (SRI) для CDN (Google Fonts — self-host preferred)
- `crossorigin` attributes где нужно

### 8.4. Backend security (FastAPI)

```python
# backend/core/security.py — централизованные настройки

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:8000").split(",")
ALLOWED_PAGES = frozenset({"dashboard", "sales", "warehouse", "foodcost"})

# Path param validation — уже есть, сохранить + тест:
if page not in ALLOWED_PAGES:
    raise HTTPException(404, detail="Not found")  # generic, не раскрывать internals
```

| Мера | Реализация |
|------|------------|
| **Input validation** | Pydantic `response_model` + strict schemas; reject unknown fields |
| **Read-only API** | Только `GET /api/{page}`; POST/PUT/DELETE — только с auth |
| **Rate limiting** | `slowapi`: 60 req/min per IP на `/api/*` |
| **Security headers** | Middleware: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP |
| **Static mount** | `StaticFiles(directory=ROOT / "frontend" / "dist")` — **не** весь ROOT |
| **Error handling** | Global handler: 500 → `{"detail": "Internal server error"}` |
| **Logging** | Structured logs; **не** логировать PII без необходимости |
| **Dependencies** | `pip-audit`; pin versions in `requirements.txt` |

```python
# backend/middleware/security_headers.py
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "  # Angular inline styles — минимизировать
        "font-src 'self'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
}
```

### 8.5. Secrets & configuration

```
.env                  ← NEVER commit
.env.example          ← commit (placeholder values only)
frontend/src/environments/
  environment.ts      ← apiBase only, no secrets
  environment.prod.ts
```

| Secret | Где хранить |
|--------|-------------|
| API keys (future) | GitHub Secrets → env inject in CI/deploy |
| DB credentials (future) | Vault / GitHub Secrets / cloud secret manager |
| JWT signing key (future) | Env var, rotate quarterly |

**Pre-commit hook (обязательно):**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: detect-private-key
```

### 8.6. Authentication roadmap (§8.8 — до production с реальными данными)

MVP с mock-данными может работать без auth. **Перед подключением реальной БД — обязательно:**

1. OAuth2 / OpenID Connect (Keycloak, Auth0, или corporate IdP)
2. Angular `authGuard` + `canMatch` на все routes
3. Backend: JWT validation middleware; user context в services
4. RBAC: роли «Управляющий», «Бухгалтер», «Склад» — route-level permissions
5. Session timeout + refresh token rotation
6. E2E тесты: unauthorized → redirect login; forbidden → 403 page

### 8.7. Security testing (обязательно)

Security-тесты — **часть CI**, не отдельный audit «раз в год».

#### A. Static Application Security Testing (SAST)

| Tool | Scope | CI |
|------|-------|-----|
| `npm audit` | npm CVE | Every PR |
| `pip-audit` | Python CVE | Every PR |
| `@angular-eslint` | XSS patterns, template safety | Every PR |
| `eslint-plugin-security` | JS anti-patterns (`eval`, etc.) | Every PR |
| `bandit` | Python security linter | Every PR |
| `semgrep` (optional) | OWASP rules | Weekly |

#### B. Unit/Integration security tests (обязательные)

```typescript
// frontend/src/app/shared/security/xss-safety.spec.ts
describe('XSS safety', () => {
  const maliciousPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '{{constructor.constructor("return this")()}}',
  ];

  it.each(maliciousPayloads)('renders payload "%s" as plain text', (payload) => {
    // Render PositionsTable / KpiCard with malicious product.name
    // Assert: no <script> in DOM, textContent contains escaped payload
  });
});
```

```typescript
// frontend/src/app/core/interceptors/api-fallback.interceptor.spec.ts
it('rejects non-whitelisted page names', () => { ... });
it('does not expose stack traces in error UI', () => { ... });
```

```python
# backend/tests/test_security.py
def test_unknown_page_returns_404_not_500(client):
    assert client.get("/api/../../../etc/passwd").status_code in (404, 422)

def test_cors_rejects_unknown_origin(client):
    r = client.get("/api/dashboard", headers={"Origin": "https://evil.com"})
    assert "evil.com" not in (r.headers.get("access-control-allow-origin") or "")

def test_security_headers_present(client):
    r = client.get("/api/dashboard")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert "Content-Security-Policy" in r.headers

def test_rate_limit_blocks_excessive_requests(client):
    for _ in range(70):
        client.get("/api/dashboard")
    r = client.get("/api/dashboard")
    assert r.status_code == 429

@pytest.mark.parametrize("page", ["dashboard", "sales", "warehouse", "foodcost"])
def test_api_response_matches_strict_schema(page, client):
    data = client.get(f"/api/{page}").json()
    SchemaRegistry[page].model_validate(data)  # reject extra/missing fields
```

#### C. Dependency integrity tests

```typescript
// frontend/src/app/core/security/supply-chain.spec.ts (CI script, not unit)
// npm audit --json → fail if high/critical
// lockfile-lint → fail if non-npm registry
```

#### D. E2E security tests (Playwright)

```typescript
// e2e/security.spec.ts
test('CSP blocks inline script injection', async ({ page }) => {
  await page.goto('/dashboard');
  const result = await page.evaluate(() => {
    try {
      const s = document.createElement('script');
      s.textContent = 'window.__xss = true';
      document.body.appendChild(s);
      return (window as any).__xss === true;
    } catch { return false; }
  });
  expect(result).toBe(false);
});

test('no sensitive data in console errors', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  await page.route('/api/dashboard', route => route.abort());
  await page.goto('/dashboard');
  expect(logs.join('')).not.toMatch(/stack|trace|internal/i);
});

test('X-Frame-Options prevents clickjacking', async ({ request }) => {
  const r = await request.get('/api/dashboard');
  expect(r.headers()['x-frame-options']).toBe('DENY');
});
```

#### E. Penetration testing checklist (перед production)

- [ ] OWASP Top 10 review (Injection, XSS, Broken Access Control, SSRF, etc.)
- [ ] Manual test: подмена `data/*.json` — UI не исполняет скрипты
- [ ] Manual test: CORS bypass attempt
- [ ] Manual test: path traversal `/api/..%2f..%2f`
- [ ] `zap-baseline.py` против staging (OWASP ZAP baseline scan)

### 8.8. Security CI/CD

#### `.github/workflows/security-ci.yml`

```yaml
name: Security CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read          # least privilege
  security-events: write  # for SARIF upload

jobs:
  frontend-security:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - name: npm audit (fail on high+)
        run: npm audit --audit-level=high
      - name: ESLint security rules
        run: npm run lint
      - name: Security unit tests
        run: npm run test:ci -- --include='**/*security*.spec.ts' --include='**/*xss*.spec.ts'

  backend-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt pip-audit bandit pytest httpx
      - name: pip-audit
        run: pip-audit -r backend/requirements.txt
      - name: bandit SAST
        run: bandit -r backend/ -ll
      - name: Security tests
        run: pytest backend/tests/test_security.py -v

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2

  codeql:                    # optional but recommended
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript, python
      - uses: github/codeql-action/analyze@v3
```

#### Branch protection (GitHub Settings)

Required checks on `main`:
- Frontend CI (lint + test + build)
- Backend CI
- **Security CI** (npm audit + pip-audit + gitleaks + security tests)
- E2E

### 8.9. SECURITY.md (создать в корне)

```markdown
# Security Policy

## Supported versions
| Version | Supported |
|---------|-----------|
| main    | ✅        |

## Reporting a vulnerability
Email: security@example.com (заменить на реальный)
Do NOT open public GitHub issues for security bugs.

## Response SLA
- Acknowledgment: 48 hours
- Fix critical: 7 days
- Fix high: 30 days
```

### 8.10. Security checklist (production gate)

- [ ] 0 high/critical CVE в `npm audit` и `pip-audit`
- [ ] Gitleaks: 0 secrets в repo history (или rotated)
- [ ] CSP deployed и протестирован (e2e/security.spec.ts)
- [ ] CORS whitelist (не `*`) в production
- [ ] StaticFiles mount только `frontend/dist/`
- [ ] Rate limiting на `/api/*`
- [ ] XSS security tests pass (malicious payloads → escaped text)
- [ ] Pydantic strict schemas reject malformed API responses
- [ ] No `innerHTML` / `bypassSecurityTrust*` в codebase (grep CI check)
- [ ] Auth implemented (если real data)
- [ ] Error messages generic для пользователя
- [ ] CodeQL / bandit без high findings
- [ ] OWASP ZAP baseline — 0 high alerts на staging

#### CI grep-check (добавить в security-ci)

```bash
# Fail if dangerous patterns found in frontend/src
! grep -rE 'innerHTML|bypassSecurityTrust|eval\(|new Function\(' frontend/src/
! grep -rE 'allow_origins=\["\*"\]' backend/  # prod check via env flag
```

---

## 9. Стратегия тестирования

> **Security tests — обязательная часть пирамиды**, не отдельный слой. См. §8.7.

### Пирамида

```
           ┌──────────────┐
           │  E2E + Sec   │  Playwright smoke + security.spec.ts
          ┌┴──────────────┴┐
          │   Component    │  Angular Testing Library (~30)
         ┌┴────────────────┴┐
         │  Unit + Security   │  Pipes, services, XSS payloads (~90)
        ┌┴──────────────────────┴┐
        │   SAST / Audit (CI)    │  npm audit, pip-audit, bandit, gitleaks
        └────────────────────────┘
```

### Unit (приоритет 1)

| Модуль | Что тестировать |
|--------|-----------------|
| Pipes | ru-RU, `−` vs `-`, edge cases |
| `chart.utils` | `describeArc`, `shade` |
| `abc-analysis.utils` | границы A/B/C |
| `SalesAggregationService` | rev = qty × price |
| API interceptor | fallback на static JSON |
| **XSS safety** | malicious payloads → escaped text, no script execution |
| **Page name whitelist** | invalid page → error, no path traversal |
| **Error UI** | generic message, no stack traces |

### Security tests (приоритет 1 — параллельно с unit)

| Suite | Файл | Что проверяет |
|-------|------|---------------|
| XSS payloads | `xss-safety.spec.ts` | `<script>`, event handlers в data fields |
| API security | `api-fallback.interceptor.spec.ts` | whitelist pages, no leak in errors |
| Backend security | `backend/tests/test_security.py` | headers, CORS, rate limit, schema strict |
| Supply chain | CI: `npm audit`, `pip-audit` | 0 high/critical CVE |
| Secrets | CI: gitleaks | 0 secrets in diff |
| Dangerous patterns | CI: grep check | no innerHTML, eval, bypassSecurityTrust |

### Component (приоритет 2)

- Atoms: Button variants, LflBadgeAtom directions
- Molecules: SegmentControl selection, GoalTrack width
- Organisms: DonutChart segments, KpiCard rendering
- Templates: slot projection

### E2E — Playwright (10 smoke)

1. Dashboard: KPI + chart click
2. Sales: donut + ABC filter
3. Warehouse: dynamics store toggle
4. Foodcost: tabs + product chart tooltip
5. Navigation: 4 routes
6. Fallback без API
7. 404 route
8. Mobile viewport
9. Keyboard nav (Angular Aria)
10. LCP < 3s

### E2E — Security (обязательно, `e2e/security.spec.ts`)

11. CSP blocks inline script injection
12. Security headers present (X-Frame-Options, CSP)
13. No sensitive data in console on API failure
14. Malicious JSON fallback data rendered safely

### Backend (pytest)

```python
def test_api_dashboard_returns_valid_schema(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    DashboardResponse.model_validate(r.json())
```

---

## 10. CI/CD — GitHub Actions

> Security workflow — **§8.8** (`security-ci.yml`). Обязателен как required check на `main`.

### `.github/workflows/frontend-ci.yml`

```yaml
name: Frontend CI

on:
  push:
    branches: [main]
    paths: ['frontend/**', '.github/workflows/frontend-ci.yml']
  pull_request:
    paths: ['frontend/**']

defaults:
  run:
    working-directory: frontend

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci
      - run: npm run build -- --configuration=production
      - name: Upload coverage
        if: matrix.node-version == 22
        uses: codecov/codecov-action@v4
        with:
          directory: frontend/coverage

  e2e:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npx playwright install --with-deps chromium
        working-directory: frontend
      - name: Start backend
        run: |
          pip install -r backend/requirements.txt
          uvicorn backend.app:app --port 8000 &
          npx wait-on http://localhost:8000/api/dashboard
      - run: npm run e2e:ci
        working-directory: frontend
```

### `.github/workflows/backend-ci.yml`

```yaml
name: Backend CI
on:
  push:
    branches: [main]
    paths: ['backend/**', 'data/**']
  pull_request:
    paths: ['backend/**', 'data/**']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt pytest httpx
      - run: pytest backend/tests/ -v
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-pages:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci && npm run build
        working-directory: frontend
      - run: cp -r data frontend/dist/data
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist
      - uses: actions/deploy-pages@v4
```

### `package.json` scripts

```json
{
  "scripts": {
    "lint": "ng lint",
    "test": "ng test",
    "test:ci": "ng test --no-watch --code-coverage --browsers=ChromeHeadless",
    "e2e": "playwright test",
    "e2e:ci": "playwright test --reporter=line",
    "build": "ng build",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "audit:security": "npm audit --audit-level=high",
    "test:security": "ng test --no-watch --include='**/*security*.spec.ts' --include='**/*xss*.spec.ts'"
  }
}
```

---

## 11. Рекомендации по улучшению (обязательны при миграции)

### Критичные

1. **Убрать `innerHTML`** → Angular templates + `@for` + pipes (XSS)
2. **DonutChartOrganism** — один shared organism для sales + warehouse (DRY)
3. **SegmentControlComponent** — один molecule для 5+ toggles
4. **Типизировать API** — Pydantic → TS interfaces
5. **Агрегация sales** — `SalesAggregationService` с тестами; позже на бэкенд

### Архитектурные

6. **`PeriodService`** — signal-based, централизовать period toggles
7. **Popover** — CDK Overlay или Angular Aria (не `document.createElement`)
8. **i18n** — `@angular/localize` для дат («1 июня» → DatePipe `'ru-RU'`)
9. **Feature organisms** — не выносить в `ui/organisms/` без 2+ потребителей

### CSS / UX

10. **Responsive** — sidebar drawer на mobile
11. **Dark theme** — `[data-theme]` + localStorage
12. **`.page-foodcost`** → `[data-page="foodcost"]` на Page host

### Backend

13. **Структура:** `api/ → services/ → crud/ → models/ + schemas/`
14. **CORS whitelist** для prod (не `*`)
### Безопасность (обязательны)

16. **Security CI** — `security-ci.yml` с первого PR (§8.8)
17. **Pre-commit gitleaks** — блокировать secrets до push
18. **CSP + security headers** — middleware FastAPI (§8.4)
19. **Static mount** — только `frontend/dist/`, не весь ROOT
20. **Rate limiting** — `slowapi` на `/api/*`
21. **Strict Pydantic** — `model_config = ConfigDict(extra='forbid')`
22. **Self-host fonts** — убрать CDN Google Fonts (supply chain risk)
23. **SECURITY.md** — responsible disclosure policy

---

## 12. Оценка сроков

| Фаза | Дни | Зависимости |
|------|-----|-------------|
| 0. Scaffold + CI + Storybook | 1–2 | — |
| 1. Atoms + Pipes + Core | 3–4 | 0 |
| 2. Molecules + Templates + Sidebar | 2–3 | 1 |
| 3. Dashboard Page | 3–4 | 2 |
| 4. Sales Page | 4–5 | 2 |
| 5. Warehouse + Foodcost | 4–5 | 2 |
| 6. Backend schemas + tests | 2–3 | параллельно |
| 7. Stubs + unwired UI | 2 | 3–5 |
| 8. Cutover + E2E polish | 1–2 | все |
| 9. Security hardening + audit | 2–3 | параллельно 6–8 |
| **Итого** | **24–33 раб. дней** | 1 dev |

---

## 13. Риски

| Риск | Митигация |
|------|-----------|
| Over-engineering atoms | Не создавать atom, если нет ≥2 использований; начинать inline, extract позже |
| Pixel drift | Playwright visual regression |
| Fallback на GitHub Pages | Interceptor + `data/` в `dist/` |
| ABC regression | Unit-тесты до порта |
| Scope creep | Purchases/Settings — placeholder only |
| **XSS через API data** | Strict templates + XSS unit tests + no innerHTML |
| **Supply chain attack (npm/pip)** | Lockfiles + audit CI + review new deps |
| **Secret leak в repo** | gitleaks pre-commit + CI |
| **Broken auth (future)** | authGuard + JWT tests before real DB |

---

## 14. Чеклист production-ready

### Функциональность
- [ ] Все 4 страницы — pixel-parity с MVP
- [ ] Atomic Design: все компоненты в правильном слое, нет нарушений импортов
- [ ] Storybook: все atoms, molecules, shared organisms задокументированы
- [ ] Fallback `data/*.json` без бэкенда
- [ ] Legacy HTML/JS удалён
- [ ] README обновлён

### Тестирование
- [ ] Unit coverage ≥ 80% shared/core
- [ ] 10+ E2E smoke в CI
- [ ] **XSS security tests pass** (§8.7.B)
- [ ] **Backend security tests pass** (`test_security.py`)
- [ ] **E2E security.spec.ts pass**

### Безопасность (§8.10 — все пункты)
- [ ] 0 high/critical CVE (`npm audit`, `pip-audit`)
- [ ] Gitleaks: 0 secrets
- [ ] CSP + security headers deployed
- [ ] CORS whitelist в production
- [ ] Rate limiting на API
- [ ] No `innerHTML` / `bypassSecurityTrust*` (CI grep)
- [ ] StaticFiles → только `dist/`
- [ ] SECURITY.md опубликован
- [ ] Branch protection (lint + test + build + **security-ci**)
- [ ] Auth (если подключена реальная БД)

### Качество
- [ ] Lighthouse Performance ≥ 90, A11y ≥ 90
- [ ] ESLint 0 errors, enforce atomic import boundaries
- [ ] Production build < 500 KB initial (lazy routes)

---

## 15. Правила для AI-агента

### DO

- Читать этот файл перед любой задачей по фронтенду
- Следовать Atomic Design: определи уровень компонента **до** создания файла
- Использовать standalone + OnPush + signals
- Писать co-located `.spec.ts` для pipes, services, atoms, molecules
- **Писать security-тесты** для любого компонента, отображающего API data (§8.7)
- **Запускать `npm audit`** после добавления npm-зависимостей
- Сохранять JSON-контракт API без breaking changes
- Переиспользовать существующие ui/ компоненты вместо дублирования
- Минимальный diff — не трогать unrelated code
- Match existing naming: `*Organism`, `*Component`, `*PageComponent`, `*Template`
- Использовать Angular template binding (`{{ }}`) для **всех** user/API strings
- Валидировать API responses через Pydantic strict schemas на бэкенде

### DON'T

- Не создавать NgModules
- **Не использовать `innerHTML` / `[innerHTML]` / `DomSanitizer.bypassSecurityTrust*`** — zero tolerance
- **Не использовать `eval()`, `new Function()`, `document.write()`**
- **Не добавлять npm/pip packages без проверки** (downloads, maintainer, postinstall)
- **Не хардкодить secrets**, API keys, tokens в коде или `environment.ts`
- **Не использовать `allow_origins=["*"]`** в production config
- **Не монтировать StaticFiles на весь ROOT** — только `frontend/dist/`
- **Не логировать** tokens, passwords, PII в console или server logs
- **Не skip'ать security tests** в CI
- Не класть business logic в atoms/molecules
- Не импортировать вверх по иерархии (atom → molecule)
- Не создавать monolithic page components — decompose на organisms
- Не коммитить без явного запроса пользователя
- Не создавать markdown/docs файлы без запроса (кроме AGENTS.md, SECURITY.md)
- Не over-abstract: 5 строк inline лучше, чем atom с одним использованием

### Порядок реализации новой UI-фичи

1. Есть ли готовый atom/molecule/organism в `ui/`? → Reuse
2. Нет → определи уровень (atom/molecule/organism)
3. Создай компонент + spec + story (для ui/ уровней)
4. Подключи в organism или template
5. Подключи в page (data binding)
6. E2E smoke если новый user flow
7. **Security test** если компонент рендерит API strings (XSS payload в spec)

---

## 16. Ссылки

- [Atomic Design — Brad Frost](https://atomicdesign.bradfrost.com/chapter-2/)
- [Angular 22 release](https://blog.angular.dev/announcing-angular-v22-c52bb83a4664)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Angular Security Guide](https://angular.dev/best-practices/security)
- Legacy README: `README.md`
- JSON contracts: `data/*.json`
