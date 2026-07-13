# Sync provider protocol

Skulpt's mobile client is local-first. This document describes the optional provider contract used when a build sets `EXPO_PUBLIC_SYNC_HOST`.

The Skulpt-operated SyncLayer is one implementation. Another server can implement the same contract and serve a custom build. Provider selection currently happens at build time.

## Compatibility header

Sync requests include:

```http
x-skulpt-sync-schema: 2
```

A provider should reject an unsupported schema version instead of silently accepting an incompatible payload.

## Authentication

The client obtains a bearer token before syncing:

```http
POST /auth/token
Content-Type: application/json

{
  "userId": "local-user-id",
  "deviceId": "persistent-device-id"
}
```

Expected response:

```json
{
    "token": "provider-token",
    "expiresAt": 1783900000000
}
```

`expiresAt` is Unix time in milliseconds. Sync requests send `Authorization: Bearer <token>`. After a `401`, the client clears the stored token, requests another token, and retries the failed request once.

This endpoint describes client compatibility, not a complete security design. A provider is responsible for authenticating or provisioning users, isolating tenants, validating tokens, limiting abuse, and protecting stored data.

## Push local changes

```http
POST /sync
Authorization: Bearer <token>
Content-Type: application/json
x-skulpt-sync-schema: 2
```

The request body groups changes by SQLite table name:

```json
{
    "workout": {
        "created": [
            {
                "id": "workout-id",
                "userId": "local-user-id",
                "name": "Push day"
            }
        ],
        "updated": [
            {
                "id": "another-workout-id",
                "name": "Pull day"
            }
        ],
        "deleted": ["deleted-workout-id"]
    }
}
```

Creates normally contain a complete row. Updates can be partial patches and include the record ID. Deletes contain record IDs.

Expected success response:

```json
{
    "success": true
}
```

If an update refers to a missing server record, the client recognises this conflict:

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "success": false,
  "type": "conflict",
  "code": "missing_record",
  "table": "workout",
  "id": "workout-id"
}
```

The client marks the stale queued update as resolved, pulls current state, and retries any remaining pending changes.

## Pull provider changes

```http
GET /sync?since=1783900000000&userId=local-user-id&type=user
Authorization: Bearer <token>
x-skulpt-sync-schema: 2
```

Query parameters:

| Parameter | Meaning                                             |
| --------- | --------------------------------------------------- |
| `since`   | Last successful cursor as Unix time in milliseconds |
| `userId`  | Local user whose records are requested              |
| `type`    | `user`, `skulpt`, or `all`                          |
| `locale`  | Exercise locale for the `skulpt` scope              |

The response wraps table packs in `data`:

```json
{
    "data": {
        "workout": {
            "records": [
                {
                    "id": "workout-id",
                    "userId": "local-user-id",
                    "name": "Push day"
                }
            ],
            "deletedIds": ["deleted-workout-id"],
            "timestamp": 1783900005000
        }
    }
}
```

Each table pack contains changed records, deleted IDs, and a cursor. The client applies the packs to SQLite and stores the greatest returned timestamp.

The user scope currently handles these tables:

- `user`
- `app_review_prompt`
- `exercise`
- `workout`
- `workout_group`
- `workout_exercise`
- `exercise_set`
- `measurement`

The `skulpt` scope distributes maintained exercise records separately from user-created exercises. Current field definitions live in `src/db/schema/`.

## Retry behaviour

The client treats transport failures, timeouts, `408`, `429`, `502`, `503`, and `504` as retryable. Providers should make repeated creates, updates, deletes, and pulls idempotent.

Other validation and server errors should use an appropriate HTTP status and a concise machine-readable response.

## Provider responsibilities

A compatible implementation must still define and enforce:

- authentication and account recovery;
- tenant and record ownership;
- accepted table and field names;
- relationship and timestamp validation;
- token expiry and revocation;
- transport and storage security;
- deletion and retention behaviour;
- backups and restore behaviour;
- privacy disclosures for the service it operates.

The client does not make an arbitrary incoming payload safe. Validate all writes and reads at the provider boundary.

## Changing the contract

A protocol change must update the client, tests, this document, and the schema header when older providers cannot safely accept the new format.
