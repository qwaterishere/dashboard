import hashlib
import time
from datetime import timedelta

import httpx

from src.core.config import get_settings
from src.core.iiko_url import (
    assert_hostname_allowlisted,
    assert_safe_resolved_host,
    get_iiko_url_allowed_suffixes,
    iiko_hostname_from_url,
    validate_iiko_url,
)
from src.integrations.iiko.exceptions import IikoAuthError, IikoBlockedHostError, IikoRequestError

_TRANSIENT_ERRORS = (
    httpx.RemoteProtocolError,
    httpx.ReadTimeout,
    httpx.ConnectError,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
)
_MAX_RETRIES = 3


def reject_iiko_redirect_response(response: httpx.Response) -> None:
    """Блокирует follow-up на internal/metadata через 3xx от iiko."""
    if 300 <= response.status_code < 400:
        response.close()
        raise IikoBlockedHostError("Redirects are not allowed for iiko connections")


class IikoClient:
    def __init__(
        self,
        url: str | None = None,
        login: str | None = None,
        password: str | None = None,
        *,
        timeout: float = 300,
    ):
        settings = get_settings()
        if url is None or login is None or password is None:
            url, login, password = settings.require_iiko()
        else:
            try:
                url = validate_iiko_url(url, resolve_dns=False)
            except ValueError as exc:
                raise IikoBlockedHostError("Blocked outbound connection") from exc
        self._url = url
        self._login = login
        self._password = password
        self._token: str | None = None
        try:
            self._hostname = iiko_hostname_from_url(url)
        except ValueError as exc:
            raise IikoRequestError("invalid iiko base URL") from exc
        self._ensure_safe_outbound()
        self._http = httpx.Client(
            base_url=url,
            timeout=timeout,
            follow_redirects=False,
            event_hooks={"response": [reject_iiko_redirect_response]},
        )

    def _ensure_safe_outbound(self) -> None:
        try:
            assert_hostname_allowlisted(self._hostname, get_iiko_url_allowed_suffixes())
            assert_safe_resolved_host(self._hostname)
        except ValueError as exc:
            raise IikoBlockedHostError("Blocked outbound connection") from exc

    def __enter__(self):
        self._ensure_safe_outbound()
        password_hash = hashlib.sha1(self._password.encode('utf-8')).hexdigest()

        response = self._http.get('resto/api/auth', params={'login': self._login, 'pass': password_hash})

        if response.status_code != 200:
            raise IikoAuthError(f'auth failed: {response.status_code} {response.text}')

        self._token = response.text.strip()

        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if self._token is not None:
                self._ensure_safe_outbound()
                self._http.get('resto/api/logout', params={'key': self._token})
                self._token = None
        finally:
            self._http.close()

    def fetch_sales(self, date_from, date_to) -> list[dict]:
        self._ensure_safe_outbound()
        body = {
            "reportType": "SALES",
            "buildSummary": False,
            "groupByRowFields": ["ItemSaleEvent.Id", "DishName", "DishCategory", "DishGroup",
                                 "DishGroup.TopParent",
                                 "DishId", "DishGroup.Id", "DishCategory.Id",
                                 "OrderNum", "SessionNum", "OpenDate.Typed", "GuestNum",
                                 "PayTypes.Group", "PayTypes", "OrderType"],
            "aggregateFields": ["DishSumInt", "DiscountSum", "ProductCostBase.ProductCost",
                                "DishDiscountSumInt", "DishAmountInt"],
            "filters": {
                "OpenDate.Typed": {
                    "filterType": "DateRange", "periodType": "CUSTOM",
                    "from": date_from.isoformat(),
                    "to": (date_to + timedelta(days=1)).isoformat(),  # правая граница исключается
                },
                "DeletedWithWriteoff": {"filterType": "IncludeValues", "values": ["NOT_DELETED"]},
                "OrderDeleted": {"filterType": "IncludeValues", "values": ["NOT_DELETED"]},
                "Storned": {"filterType": "IncludeValues", "values": ["FALSE"]},
            }
        }
        last_error: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                self._ensure_safe_outbound()
                response = self._http.post(
                    'resto/api/v2/reports/olap',
                    params={'key': self._token},
                    json=body,
                )
                if response.status_code != 200:
                    raise IikoRequestError(
                        f'olap failed: {response.status_code} {response.text}'
                    )
                return response.json()['data']
            except _TRANSIENT_ERRORS as exc:
                last_error = exc
                if attempt + 1 >= _MAX_RETRIES:
                    break
                time.sleep(2 ** attempt)
        raise IikoRequestError(
            f'olap failed after {_MAX_RETRIES} attempts: {last_error}'
        ) from last_error
