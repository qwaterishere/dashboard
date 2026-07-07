"""Настройки подключения к iiko (из .env инстанса, префикс IIKO_).

Настройки НЕ создаются при импорте модуля: на машинах без кредов
(CI, тесты без iiko) импорт цепочки src.sales.loader -> src.iiko.client
не должен падать. Fail-fast происходит при первом реальном обращении —
создании IikoClient или запуске загрузчика.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class IikoSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_prefix='IIKO_', extra='ignore')

    url: str
    login: str
    password: str


@lru_cache
def get_settings() -> IikoSettings:
    """Единственный экземпляр на процесс (lru_cache), создаётся лениво."""
    return IikoSettings()
