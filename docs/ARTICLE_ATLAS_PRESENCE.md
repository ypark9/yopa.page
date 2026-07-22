# Article Atlas Presence MVP

## Scope

Presence makes anonymous visitors visible on the homepage minimap and the full
Article Atlas. It is not chat, identity, analytics, or a durable activity log.

The MVP has one public room named `atlas`. A connection receives a temporary
server-side identity and a two-letter country code. No account, user-provided
name, free-form text, precise location, or browser fingerprint is accepted.

## Privacy boundary

The allowed persisted fields are:

- API Gateway connection ID
- random public visitor ID
- ISO 3166-1 alpha-2 country code, or `XX`
- normalized map position
- status: `active` or `paused`
- last-seen and expiration timestamps

The original IP address must not be written to DynamoDB, application logs, or
client messages. CloudFront converts the request location to a country code and
forwards only that code to the WebSocket origin. Lambda validates the code
against `^[A-Z]{2}$` and substitutes `XX` for any invalid value.

API Gateway access logs must omit source IP, request headers, and message
bodies. Lambda logs contain event type, aggregate counts, and error classes
only. They must not log the complete event object.

## Client-to-server messages

Every message is JSON and must remain under 512 bytes.

### Hello

```json
{"action":"hello"}
```

The client sends hello immediately after the WebSocket opens. This allows the
connection to finish establishing before the backend sends its welcome and
first snapshot.

### Move

```json
{"action":"move","x":0.42,"y":0.68}
```

- `x` and `y` are finite numbers in the inclusive range `0..1`.
- The client sends no more than one move message every five seconds.
- The server rejects or ignores updates received within five seconds of the previous
  accepted update for that connection.

### Pause

```json
{"action":"pause"}
```

The visitor remains visible but changes to `paused`. The client stops sending
move events.

### Resume

```json
{"action":"resume","x":0.42,"y":0.68}
```

Resume has the same coordinate validation as move.

### Heartbeat

```json
{"action":"heartbeat"}
```

The client sends a heartbeat every 30 seconds. This refreshes presence without
writing to DynamoDB on every snapshot read.

### Snapshot request

```json
{"action":"snapshot"}
```

The client requests one snapshot every five seconds. A snapshot is returned
only to the requesting connection; state changes are never fanned out to the
whole room. Clients interpolate between coordinates so the map remains smooth.

## Server-to-client messages

### Welcome

```json
{
  "type":"welcome",
  "visitorId":"temporary-public-id",
  "country":"KR",
  "serverTime":1784700200000
}
```

### Snapshot

```json
{
  "type":"snapshot",
  "serverTime":1784700200000,
  "visitors":[
    {
      "id":"temporary-public-id",
      "country":"KR",
      "x":0.42,
      "y":0.68,
      "status":"active",
      "lastSeen":1784700200000
    }
  ]
}
```

Clients interpolate between received coordinates. They mark a visitor idle
after 30 seconds and remove it after 60 seconds, independent of DynamoDB TTL.

## Capacity and abuse limits

- Maximum displayed room size: 20 connections.
- Move frequency: one accepted message every five seconds per connection.
- API Gateway stage throttling provides an account-side backstop.
- `$connect` accepts only `https://www.yopa.page`, `https://yopa.page`, and an
  explicitly configured localhost origin for development.
- Invalid JSON, unknown actions, oversized values, and invalid coordinates are
  rejected without broadcasting.
- Gone WebSocket connections are deleted when callback delivery returns HTTP
  410.

The backend never broadcasts a state change to the room. Each browser fetches
one compact snapshot every five seconds, making message growth linear rather
than quadratic. At the 20-connection cap, normal traffic is about nine inbound
messages per second before connect/disconnect events. The stage is throttled at
12 messages per second with a burst of 24, and Lambda reserved concurrency is
five. These controls are cost backstops, not substitutes for AWS Budgets.

## Lifecycle

- `$connect`: validate origin and room capacity, derive country, create the
  ephemeral record, then return success.
- `hello`: send one combined welcome and active-room snapshot after the connection
  has finished establishing.
- `move`, `pause`, `resume`, `heartbeat`: validate and refresh the caller's
  state without broadcasting.
- `snapshot`: query active visitors and reply only to the caller without a
  DynamoDB write.
- `$disconnect`: delete the connection record. Delivery is best effort, so
  stale records are also excluded using `last_seen`.
- DynamoDB TTL: cleanup only. Expired records may remain physically present for
  days and must always be excluded by application reads.
- API Gateway connections are expected to reconnect with jitter after the
  ten-minute idle timeout, the two-hour maximum lifetime, or network failure.

## Release gates

- **Cost gate (blocking):** no state-changing route broadcasts to the room;
  snapshot requests receive exactly one callback to their caller.
- **Cost gate (blocking):** move interval is at least five seconds, the global
  stage rate is at most 12 messages/second, burst is at most 24, room size is at
  most 20, and Lambda reserved concurrency is at most five.
- **Cost gate (blocking):** configure AWS Budget alerts at USD 5, 10, and 25 and
  verify the notification destination before production traffic is enabled.
- **Cost gate (blocking):** `params.articleAtlasPresenceEnabled` remains `false`
  through the infrastructure deploy and is enabled only after the budget alerts
  and production smoke test pass.
- **Cost gate (blocking):** review the production Cost Explorer after 24 hours
  and again after seven days; keep the presence kill switch available.

- No IP, header dump, or full event appears in CloudWatch or DynamoDB.
- Two browsers converge on the same positions within ten seconds.
- Pause stops outbound movement and changes remote status.
- Stale visitors disappear within 60 seconds even if TTL has not deleted them.
- A failed WebSocket falls back to the honest empty/single-player state.
- The room cap and route throttles are covered by deterministic tests.
- A reviewed OpenTofu plan contains no unrelated replacement or destroy.
