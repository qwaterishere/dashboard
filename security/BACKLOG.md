# Security backlog — открытые задачи hardening

> Обновлено после аудита фичи **iiko (подключение + sync через настройки)**, июль 2026.
> Намеренно **не включено**: сброс/смена пароля, верификация email.

## P0 — перед production с реальными данными

| # | Проблема | Риск | Рекомендация |
|---|----------|------|--------------|
| 1 | **Открытая регистрация** | Любой может создать аккаунт, подключить iiko и грузить данные | `REGISTER_ENABLED=false` в prod или invite-only / admin API |
| 2 | **Нет RBAC** | Нет ролей; модель 1 user = 1 restaurant, но нет командного доступа и разграничения по `position` | Роли + route/service permissions |
| 3 | **CI не блокирует уязвимости** | `pip-audit \|\| true`, `bandit \|\| true` в `security-ci.yml` | Убрать `\|\| true`, fail on high |
| 4 | **OpenAPI `/docs`, `/redoc`** | Раскрытие структуры API | Отключить при `APP_ENV=production` |
| 21 | **iiko credentials at rest — один ключ** | Компрометация БД + `CREDENTIALS_ENCRYPTION_KEY` / `JWT_SECRET_KEY` → все iiko-пароли | Отдельный секрет в secret manager; не fallback на JWT; план ротации ключа |

## P1 — iiko / sync (до prod с реальными данными)

| # | Проблема | Риск | Рекомендация |
|---|----------|------|--------------|
| 22 | **Нет API IDOR-тестов для iiko** | Tenant isolation есть в коде, но нет HTTP-тестов «user A ≠ user B» на `/me/iiko`, `/me/iiko/sync`, `/dashboard`, `/sales` | `tests/test_iiko_security.py` или расширить `test_tenant_isolation` через TestClient |
| 23 | **Sync DoS / нет очереди** | Тяжёлая первая выгрузка (~год) + `BackgroundTasks` без изоляции нагрузки; 3 req/min × N пользователей | Job queue (Celery/Redis), per-tenant throttle, лимит глубины первой загрузки через UI |
| 24 | **Нет audit log для iiko** | Смена creds, старт/ошибка sync не в structured audit | Логировать: user_id, restaurant_id, action, result (без password/URL creds) |

## P2 — hardening

| # | Проблема | Рекомендация |
|---|----------|--------------|
| 5 | Нет `SECURITY.md` | Политика responsible disclosure |
| 6 | Нет pre-commit | Gitleaks + detect-private-key до push |
| 7 | Нет Alembic | Миграции схемы БД для prod (`token_version`, `restaurants`, `sync_*` и далее) |
| 8 | Узкое XSS-покрытие | Расширить `xss-safety.spec.ts` на все компоненты с API strings |
| 9 | E2E security неполный | CSP inline-script, HSTS, clickjacking в браузере |
| 10 | Нет audit log (auth) | Login failures, refresh reuse, logout — structured audit |
| 11 | Нет account lockout | Помимо rate limit — блокировка после N неудачных login |
| 12 | Нет лимита размера тела запроса | Защита register/login и `PUT /me/iiko` от больших payload |
| 13 | ~~iiko credentials в `.env`~~ | **Частично закрыто:** creds в БД (encrypted). Осталось: secret manager в prod, убрать dev-fallback |
| 25 | **CLI sync без auth** | `sales_loader --restaurant-id` — любой с shell-доступом синкает любой tenant по UUID | Ограничить deploy access; опционально CLI auth token; не считать `restaurant_id` секретом |
| 14 | **Нет сброса пароля по email** | Self-service recovery без верификации email (отложено) |
| 15 | **Нет верификации email** | Подтверждение адреса при регистрации (отложено) |

## P3 — инфраструктура / cutover

| # | Проблема | Рекомендация |
|---|----------|--------------|
| 16 | StaticFiles cutover | Mount только `frontend/dist/`, не весь ROOT |
| 17 | Нет CodeQL / OWASP ZAP | Добавить в CI или weekly scan |
| 18 | CSP `unsafe-inline` (стили) | Минимизировать; nonce/hash где возможно |
| 19 | Docs CSP с `cdn.jsdelivr.net` | Отключить docs в prod |

## Аудит iiko (июль 2026) — вердикт

**MVP / dev с доверенными пользователями:** базовая модель приемлема.

**Production в интернете:** недостаточно до закрытия P0 #21 и P1 #22–24.

| Область | Статус |
|---------|--------|
| AuthN на iiko/sync endpoints | ✅ |
| Tenant isolation (1 user = 1 restaurant) | ✅ (код + unit-тесты) |
| Пароль не в API response | ✅ |
| Fernet at rest | ✅ (dev OK; prod — см. #21) |
| CSRF на PUT/POST iiko | ✅ |
| Rate limit (5/min save, 3/min sync) | ✅ |
| Generic error messages | ✅ |
| SSRF validation URL | ✅ (`validate_iiko_url`, DNS blocklist, suffix-allowlist, no redirects) |
| Open registration + финансовые данные | ❌ #1 |
| Audit iiko events | ❌ #24 |
| API IDOR tests | ❌ #22 |

## Закрыто (для справки)

- HSTS (prod)
- Политика паролей (prod strict / dev relaxed)
- Revocable access (`token_version`)
- Refresh только HttpOnly cookie
- Access token в HttpOnly cookie (не в JS)
- SQLite запрещён в production
- Rate limit на все API-эндпоинты
- CSRF: Origin/Referer check на auth POST + SameSite strict (prod)
- Anti-enumeration: register duplicate → 400 «Registration failed»
- Settings: PATCH `/api/auth/me`, POST `/api/auth/change-password`, страница настроек (профиль, пароль)
- **iiko:** per-user restaurant, `restaurant_id` на orders, encrypted password in DB, `GET/PUT /api/auth/me/iiko`, `POST /api/auth/me/iiko/sync` (фон), CSRF + rate limit на мутациях
- **SSRF iiko_url:** https-only, suffix-allowlist (`IIKO_URL_ALLOWED_SUFFIXES`), DNS blocklist private/reserved, re-check на каждый outbound, `follow_redirects=false`, тесты в `test_iiko_url.py`
