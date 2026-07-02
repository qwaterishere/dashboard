from pydantic_settings import BaseSettings, SettingsConfigDict


class IikoSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_prefix='IIKO_', extra='ignore')

    url: str
    login: str
    password: str


settings = IikoSettings()
