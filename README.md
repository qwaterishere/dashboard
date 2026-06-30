# MVP dashbord app

Страницы: index (дашборд), sales (продажи), warehouse (склад), foodcost (фудкост).
Меню: Дашборд, Продажи, Склад, Закупки (purchases.html — заглушка), Фудкост.

## Как работает

Данные вынесены в отедльную папку от вёрстки. Каждая страница:
1. загружает JSON (через `app/js/api.js`),
2. форматирует числа и рисует DOM (модуль в `app/js/pages/`).

```
data/<страница>.json   ← данные (КОНТРАКТ: то, что должен вернуть бэкенд)
backend/app.py         ← FastAPI: отдаёт тот же JSON 
app/js/
  config.js   — адрес API (API_BASE)
  api.js      — загрузка данных: сначала API, при сбое — data/<страница>.json
  format.js   — форматирование чисел ru-RU (₽, %, разряды)
  palette.js  — названия/цвета категорий, дни недели
  charts.js   — общие SVG-помощники (дуга пончика, оттенок)
  pages/      — логика отрисовки каждой страницы (без данных)
app/*.css     — стили (base.css — общие; остальные — по странице)
```

Принцип контракта: **бэкенд присылает сырые числа, фронтенд форматирует.**
Например `8144000`, а не `"8 144 000 ₽"`; `8.4`, а не `"+8,4 %"`; категория — ключ
`"k"`, а имя «Кухня» подставит `palette.js`. Для позиций (продажи/склад) бэкенд
присылает исходные поля (`qty`, `price`, `unitCost`)
## Запуск

**Без бэкенда (статика, как раньше):**
```
python -m http.server 8000   →   http://localhost:8000/
```
API не отвечает → фронтенд берёт `data/*.json`. Так же работает и GitHub Pages
(содержимое папки в корень репо, вместе с `app/`, `data/` и `.nojekyll`;
регистр имён важен).

**С бэкендом (FastAPI отдаёт и сайт, и API — рекомендуется):**
```
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload --port 8000   →   http://localhost:8000/
```
API: `http://localhost:8000/api/dashboard`. Один origin — CORS не нужен.

Если фронт и бэкенд на разных портах — впишите полный адрес в
`app/js/config.js` (`API_BASE`); CORS в `backend/app.py` уже включён.

## Свой Python-бэкенд

Сейчас `backend/app.py` просто читает `data/<страница>.json`. 
Переход на реальные данные **по одной странице**: замените чтение файла на свой расчёт,
но верните **ту же структуру**, что в соответствующем `data/*.json`. Файл —
это образец-схема ответа и одновременно фолбэк, пока эндпоинт не готов.

## Стили

Отдельно для каждой страниы  → её css; общая оболочка → `base.css` осознанно.
Семафор фудкоста инвертирован через `.page-foodcost` (рост = плохо).

### Backend logic 

api (controller)  →  service (logic)  →  crud (DB ops)  →  model (tables)
        ↕                                                     
     schema (Pydantic DTO crosses the boundary)

route never touches the DB directly; it calls a service, which calls crud.
