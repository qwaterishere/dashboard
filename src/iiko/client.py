import hashlib
from datetime import timedelta

import httpx

from src.iiko.config import get_settings
from src.iiko.exceptions import IikoAuthError, IikoRequestError


class IikoClient:
    def __init__(self,
                 url: str | None = None,
                 login: str | None = None,
                 password: str | None = None):
        # Настройки читаются лениво и только если параметр не передан явно:
        # импорт модуля (и сбор тестов в CI без .env) кредов не требует.
        if url is None or login is None or password is None:
            settings = get_settings()
            url = url or settings.url
            login = login or settings.login
            password = password or settings.password
        self._url = url
        self._login = login
        self._password = password
        self._token: str | None = None
        self._http = httpx.Client(base_url=url, timeout=120)

    def __enter__(self):
        password_hash = hashlib.sha1(self._password.encode('utf-8')).hexdigest()

        response = self._http.get('resto/api/auth', params={'login': self._login, 'pass': password_hash})

        if response.status_code != 200:
            raise IikoAuthError(f'auth failed: {response.status_code} {response.text}')

        self._token = response.text.strip()

        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if self._token is not None:
                self._http.get('resto/api/logout', params={'key': self._token})
                self._token = None
        finally:
            self._http.close()

    def fetch_sales(self, date_from, date_to) -> list[dict]:
        body = {
            "reportType": "SALES",
            "buildSummary": False,
            "groupByRowFields": ["ItemSaleEvent.Id", "DishName", "DishCategory", "DishGroup",
                                 "DishGroup.TopParent",
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
        response = self._http.post('resto/api/v2/reports/olap', params={'key': self._token}, json=body)

        if response.status_code != 200:
            raise IikoRequestError(f'olap failed: {response.status_code} {response.text}')

        return response.json()['data']
