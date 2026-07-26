"""Квантование денег: Decimal → стабильный float для JSON (4 знака как в БД)."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

MONEY_QUANT = Decimal('0.0001')


def money(value: object) -> Decimal:
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def zero() -> Decimal:
    return Decimal('0.0000')


def money_float(value: Decimal | float | int | None) -> float:
    """JSON-совместимое число без float-дрифта накопления."""
    if value is None:
        return 0.0
    if not isinstance(value, Decimal):
        value = money(value)
    return float(value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP))


def ratio_float(numerator: Decimal | float | int, denominator: int | float) -> float | None:
    if not denominator:
        return None
    num = money(numerator) if not isinstance(numerator, Decimal) else numerator
    return float(num / Decimal(denominator))
