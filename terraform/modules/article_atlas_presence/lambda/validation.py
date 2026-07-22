import json
import math
import re
from decimal import Decimal


COUNTRY_PATTERN = re.compile(r"^[A-Z]{2}$")


def country_code(value):
    candidate = str(value or "XX").upper()
    return candidate if COUNTRY_PATTERN.fullmatch(candidate) else "XX"


def parse_body(raw):
    value = raw or "{}"
    if len(value.encode("utf-8")) > 512:
        raise ValueError("message_too_large")
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("invalid_message")
    return parsed


def coordinate(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("invalid_coordinate")
    if not math.isfinite(value) or value < 0 or value > 1:
        raise ValueError("invalid_coordinate")
    return Decimal(str(round(value, 4)))
