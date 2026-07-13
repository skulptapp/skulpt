# Architecture

Skulpt is a local-first React Native and Expo application. Its product database is SQLite on the device. Network services, native platform APIs, and the watchOS target sit around that local core.

## Data flow

```text
screen, hook, or native target
             |
             v
      CRUD and services
             |
             v
    Drizzle ORM + SQLite
             |
             +---- local queries ----> UI, history, charts
             |
             +---- optional queue ---> SyncLayer provider
```

Workout operations commit to SQLite before any optional network work. The normal workout flow does not require an account or a reachable sync provider.

## Application layers

### Routes and screens

`src/routes/` contains Expo Router entry points and provider composition. Product screens live under `src/screens/`; reusable UI lives under `src/components/`.

`src/routes/_layout.tsx` starts database migrations and assembles the user, analytics, notifications, audio, health import, workout, review, and sync providers.

### Local data

`src/db/schema/` defines the SQLite schema with Drizzle ORM. Generated migrations live under `drizzle/` and run when the application starts.

Product writes belong in `src/crud/`. This keeps screens away from ad hoc SQL and gives the optional sync queue a consistent boundary.

The main local domains include:

- user preferences;
- exercises;
- workouts and workout groups;
- workout exercises and sets;
- body measurements;
- review-prompt state;
- sync queue and cursor metadata.

### Optional SyncLayer

`EXPO_PUBLIC_SYNC_HOST` selects a provider at build time. When the variable is absent, the regular application path does not mount the active sync provider, authenticate, or add new CRUD operations to `sync_queue`.

When the variable is present:

1. local create, update, and delete operations can add entries to `sync_queue`;
2. the sync engine compacts compatible operations for each record;
3. `POST /sync` sends the pending batch;
4. `GET /sync` requests changes after the saved timestamp;
5. returned records and deleted IDs are applied to SQLite;
6. completed queue entries are removed.

Authentication uses `POST /auth/token` with the local user ID and a persistent device ID. The client stores the returned token in MMKV, with an in-memory fallback for the current launch.

The client contract is not tied to one server implementation. Store builds can use the Skulpt-operated provider, while a custom build can use another compatible provider. See [SYNC_PROTOCOL.md](SYNC_PROTOCOL.md).

### Exercise catalogue

The maintained Skulpt exercise catalogue uses the same provider host but a separate `skulpt` pull scope and locale cursor. User-created exercises remain separate through their source and identifiers.

The catalogue is not currently bundled with the client. A clean build without a provider starts without the maintained system catalogue, but users can create exercises and use the workout flow locally.

### Health integrations

The iOS client reads authorised HealthKit data and can write completed workouts. Android uses Health Connect. Both integrations must handle missing services and denied permissions without breaking the local workout flow.

Authorised body measurements copied into Skulpt are stored in the local `measurement` table. Rows with `source: "health"` are currently eligible for optional SyncLayer in the same way as manual measurement rows.

### Apple Watch and Live Activities

`targets/watch/` contains the SwiftUI watchOS application. `modules/watch-connectivity/` bridges WatchConnectivity messages into the React Native client.

`modules/live-activity/` and `targets/workout-widget/` implement the Live Activity and Dynamic Island surfaces. Native target changes need simulator or physical-device verification in addition to JavaScript checks.

### Analytics, diagnostics, and updates

PostHog and AppMetrica are initialised only when their public keys are configured. Sentry uses `EXPO_PUBLIC_SENTRY_DSN`. Expo Updates uses the EAS project ID from the build configuration.

These services are separate from SyncLayer. A local-first build may still use one of them if its corresponding variable is configured.

## State boundaries

- SQLite stores product records and migrations.
- React Query manages asynchronous query state.
- Zustand and React providers manage interaction state.
- MMKV stores small persistent values such as auth and sync metadata fallbacks.
- HealthKit and Health Connect remain external platform stores accessed through user permissions.

Avoid storing the same persistent product fact in several state systems. Prefer a SQLite query for history and durable records.

## Tests

Jest covers sync flows, API and auth behaviour, health edge cases, review state, exercise search, and selected workout calculations. Run:

```bash
bun run verify
```

Native integrations and store-sensitive behaviour still require platform testing.
