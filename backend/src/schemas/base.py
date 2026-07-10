from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Period(StrictModel):
    """Период календарными числами — имя месяца и падежи форматирует фронт."""

    year: int = Field(description="Год, например 2026")
    month: int = Field(description="Месяц 1..12")
    dayFrom: int = Field(description="Первое число периода (обычно 1)")
    dayTo: int = Field(description="Последний закрытый день периода")