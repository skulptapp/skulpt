# Build a local-only client

Skulpt's workout core uses SQLite on the device. SyncLayer is enabled only when `EXPO_PUBLIC_SYNC_HOST` contains a provider URL.

## Configure the environment

Copy the example:

```bash
cp .env.local.example .env.local
```

Leave the sync host empty or remove it:

```dotenv
EXPO_PUBLIC_SYNC_HOST=
```

Also leave these optional service variables empty if the build should not initialise analytics or error reporting:

```dotenv
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_APPMETRICA_API_KEY=
EXPO_PUBLIC_SENTRY_DSN=
```

`EXPO_PUBLIC_SYNC_HOST` controls SyncLayer only. Expo Updates uses `APP_EAS_PROJECT_ID`, and exercise media can use remote URLs. A build that must make no network requests at all must leave every hosted integration unconfigured and review those remaining paths separately.

## Install and run

```bash
bun install --frozen-lockfile
bun run verify
bun run ios
# or
bun run android
```

The iOS project includes an Apple Watch target, so use your own Apple Developer team in `APP_APPLE_TEAM_ID`. Expo Go is not supported because the project contains custom native modules.

## Behaviour without SyncLayer

In the regular application flow, an empty `EXPO_PUBLIC_SYNC_HOST` means:

- no provider token request;
- no active sync provider;
- no new CRUD entries in `sync_queue`;
- no user-data push or pull;
- no `skulpt` exercise-catalogue pull;
- workouts, custom exercises, sets, measurements, and settings remain in SQLite.

Local records do not depend on enabling a provider later. If a later build enables SyncLayer, the existing backfill logic can queue eligible records before sync.

## Exercise catalogue

The maintained Skulpt catalogue is currently delivered through the provider's separate `skulpt` scope. It is not bundled with this repository. A new local-only installation therefore starts without the system catalogue.

Users can create custom exercises and complete workouts locally. This catalogue limitation does not make personal-data sync mandatory, but it does affect the first-run experience of a provider-free build.

## Verify the boundary

Before distributing a local-only build:

1. install it with an empty database;
2. create a custom exercise;
3. plan and complete a workout in airplane mode;
4. relaunch the application and confirm the history remains;
5. inspect network traffic if the release promises to be network-silent;
6. confirm that store and privacy declarations match the exact build configuration.
