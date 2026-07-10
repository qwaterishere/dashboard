# Security backlog — открытые задачи hardening

> Обновлено после закрытия P1 (rate limit, HttpOnly access cookie, CSRF Origin, anti-enumeration).
> Намеренно **не включено**: сброс/смена пароля, верификация email.

## P0 — перед production с реальными данными

| # | Проблема | Риск | Рекомендация |
|---|----------|------|--------------|
| 1 | **Открытая регистрация** | Любой может создать аккаунт и читать дашборд | `REGISTER_ENABLED=false` в prod или invite-only / admin API |
| 2 | **Нет RBAC** | Все пользователи видят одни и те же данные | Роли + route/service permissions по `position` или отдельному полю |
| 3 | **CI не блокирует уязвимости** | `pip-audit \|\| true`, `bandit \|\| true` в `security-ci.yml` | Убрать `\|\| true`, fail on high |
| 4 | **OpenAPI `/docs`, `/redoc`** | Раскрытие структуры API | Отключить при `APP_ENV=production` |

## P2 — hardening

| # | Проблема | Рекомендация |
|---|----------|--------------|
| 5 | Нет `SECURITY.md` | Политика responsible disclosure |
| 6 | Нет pre-commit | Gitleaks + detect-private-key до push |
| 7 | Нет Alembic | Миграции схемы БД для prod (`token_version` и далее) |
| 8 | Узкое XSS-покрытие | Расширить `xss-safety.spec.ts` на все компоненты с API strings |
| 9 | E2E security неполный | CSP inline-script, HSTS, clickjacking в браузере |
| 10 | Нет audit log | Login failures, refresh reuse, logout — structured audit |
| 11 | Нет account lockout | Помимо rate limit — блокировка после N неудачных login |
| 12 | Нет лимита размера тела запроса | Защита register/login от больших payload |
| 13 | iiko credentials в `.env` | Secret manager в prod |
| 14 | **Нет сброса пароля по email** | Self-service recovery без верификации email (отложено) |
| 15 | **Нет верификации email** | Подтверждение адреса при регистрации (отложено) |

## P3 — инфраструктура / cutover

| # | Проблема | Рекомендация |
|---|----------|--------------|
| 16 | StaticFiles cutover | Mount только `frontend/dist/`, не весь ROOT |
| 17 | Нет CodeQL / OWASP ZAP | Добавить в CI или weekly scan |
| 18 | CSP `unsafe-inline` (стили) | Минимизировать; nonce/hash где возможно |
| 19 | Docs CSP с `cdn.jsdelivr.net` | Отключить docs в prod |

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
