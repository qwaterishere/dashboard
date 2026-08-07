"""Unit tests for pace risk threshold (single source)."""

from src.services.analytics.pace import PACE_RISK_RATIO, is_pace_risk


def test_pace_risk_ratio_canon():
    assert PACE_RISK_RATIO == 0.98


def test_is_pace_risk_boundary():
    pace = 1000.0
    assert is_pace_risk(979.0, pace) is True
    assert is_pace_risk(980.0, pace) is False
    assert is_pace_risk(1000.0, pace) is False
    assert is_pace_risk(1000.0, None) is False
    assert is_pace_risk(1000.0, 0.0) is False
