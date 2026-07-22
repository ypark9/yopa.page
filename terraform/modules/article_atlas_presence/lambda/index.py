import json
import os
import time
import uuid
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from validation import coordinate, country_code, parse_body


TABLE_NAME = os.environ["TABLE_NAME"]
ALLOWED_ORIGINS = set(filter(None, os.environ.get("ALLOWED_ORIGINS", "").split(",")))
ACTIVE_SECONDS = int(os.environ.get("ACTIVE_SECONDS", "60"))
TTL_SECONDS = int(os.environ.get("TTL_SECONDS", "3600"))
MAX_ROOM_SIZE = int(os.environ.get("MAX_ROOM_SIZE", "20"))
MOVE_INTERVAL_MS = int(os.environ.get("MOVE_INTERVAL_MS", "5000"))
ROOM_ID = "atlas"

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def response(status_code, body=None):
    result = {"statusCode": status_code}
    if body is not None:
        result["body"] = json.dumps(body, separators=(",", ":"))
    return result


def now_seconds():
    return int(time.time())


def now_millis():
    return int(time.time() * 1000)


def request_context(event):
    return event.get("requestContext") or {}


def connection_id(event):
    return request_context(event).get("connectionId", "")


def route_key(event):
    return request_context(event).get("routeKey", "$default")


def headers(event):
    return {str(key).lower(): value for key, value in (event.get("headers") or {}).items()}


def active_connections(limit=MAX_ROOM_SIZE + 1):
    cutoff = now_seconds() - ACTIVE_SECONDS
    result = table.query(
        IndexName="room-last-seen-index",
        KeyConditionExpression=Key("room_id").eq(ROOM_ID) & Key("last_seen").gt(cutoff),
        Limit=limit,
    )
    return result.get("Items", [])


def connect(event):
    origin = headers(event).get("origin", "")
    if origin not in ALLOWED_ORIGINS:
        return response(403, {"error": "origin_not_allowed"})

    if len(active_connections()) >= MAX_ROOM_SIZE:
        return response(429, {"error": "room_full"})

    country = country_code(headers(event).get("cloudfront-viewer-country"))

    current = now_seconds()
    table.put_item(
        Item={
            "connection_id": connection_id(event),
            "visitor_id": uuid.uuid4().hex[:16],
            "room_id": ROOM_ID,
            "country": country,
            "x": Decimal("0.5"),
            "y": Decimal("0.12"),
            "status": "active",
            "last_seen": current,
            "expire_at": current + TTL_SECONDS,
        },
        ConditionExpression="attribute_not_exists(connection_id)",
    )
    return response(200)


def disconnect(event):
    identifier = connection_id(event)
    if identifier:
        table.delete_item(Key={"connection_id": identifier})
    return response(200)


def update_state(event, action, body):
    identifier = connection_id(event)
    current = now_seconds()
    values = {
        ":last_seen": current,
        ":expire_at": current + TTL_SECONDS,
    }
    assignments = ["last_seen = :last_seen", "expire_at = :expire_at"]
    condition = "attribute_exists(connection_id)"

    if action in {"move", "resume"}:
        values[":x"] = coordinate(body.get("x"))
        values[":y"] = coordinate(body.get("y"))
        values[":active"] = "active"
        values[":move_ms"] = now_millis()
        values[":move_cutoff"] = now_millis() - MOVE_INTERVAL_MS
        assignments.extend(["x = :x", "y = :y", "#status = :active", "last_move_ms = :move_ms"])
        condition += " AND (attribute_not_exists(last_move_ms) OR last_move_ms < :move_cutoff)"
    elif action == "pause":
        values[":paused"] = "paused"
        assignments.append("#status = :paused")

    names = {"#status": "status"} if action in {"move", "resume", "pause"} else None

    try:
        table.update_item(
            Key={"connection_id": identifier},
            UpdateExpression="SET " + ", ".join(assignments),
            ConditionExpression=condition,
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {}),
        )
        return True
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def management_client(event):
    context = request_context(event)
    endpoint = f"https://{context['domainName']}/{context['stage']}"
    return boto3.client("apigatewaymanagementapi", endpoint_url=endpoint)


def public_visitor(item):
    return {
        "id": item["visitor_id"],
        "country": item.get("country", "XX"),
        "x": float(item.get("x", 0.5)),
        "y": float(item.get("y", 0.12)),
        "status": item.get("status", "active"),
        "lastSeen": int(item["last_seen"]) * 1000,
    }


def send(client, identifier, payload):
    try:
        client.post_to_connection(
            ConnectionId=identifier,
            Data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        )
        return True
    except client.exceptions.GoneException:
        table.delete_item(Key={"connection_id": identifier})
        return False


def send_snapshot(event, include_welcome=False):
    items = active_connections(MAX_ROOM_SIZE)
    client = management_client(event)
    current_ms = now_millis()
    caller = connection_id(event)

    own = None
    if include_welcome:
        own = table.get_item(Key={"connection_id": caller}, ConsistentRead=True).get("Item")
    payload = {
        "type": "welcome" if own else "snapshot",
        "serverTime": current_ms,
        "visitors": [public_visitor(item) for item in items],
    }
    if own:
        payload.update({"visitorId": own["visitor_id"], "country": own.get("country", "XX")})
    send(client, caller, payload)


def message(event):
    action = route_key(event)
    if action == "$default":
        return response(400, {"error": "unknown_action"})

    try:
        body = parse_body(event.get("body"))
    except (json.JSONDecodeError, UnicodeError, ValueError) as error:
        return response(400, {"error": str(error)})

    if body.get("action") != action:
        return response(400, {"error": "action_mismatch"})

    if action == "hello":
        send_snapshot(event, include_welcome=True)
        return response(200)

    if action == "snapshot":
        send_snapshot(event)
        return response(200)

    try:
        changed = update_state(event, action, body)
    except ValueError as error:
        return response(400, {"error": str(error)})

    return response(200)


def handler(event, _context):
    route = route_key(event)
    if route == "$connect":
        return connect(event)
    if route == "$disconnect":
        return disconnect(event)
    return message(event)
