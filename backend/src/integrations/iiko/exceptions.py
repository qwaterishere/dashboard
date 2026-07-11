"""Исключения интеграции с iiko.

Свои классы нужны, чтобы вызывающий код ловил проблемы источника
одним `except IikoError`, не разбирая внутренности httpx.
"""


class IikoError(Exception):
    """Базовая ошибка интеграции с iiko."""


class IikoAuthError(IikoError):
    """Не удалось авторизоваться: неверные креды или заняты лицензионные слоты."""


class IikoRequestError(IikoError):
    """Запрос к API не удался: сеть, таймаут, 5xx или неожиданный ответ."""


class IikoBlockedHostError(IikoError):
    """Исходящее подключение заблокировано политикой безопасности (SSRF)."""
