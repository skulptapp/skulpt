<p align="center">
  <picture>
    <img alt="Skulpt" src="./.github/resources/banner.png" />
  </picture>
</p>

<p align="center">
  <a href="https://apps.apple.com/us/app/skulpt-gym-workout-tracker/id6749158262"><img src="https://img.shields.io/badge/App_Store-Download-0A84FF?style=flat&logo=apple&logoColor=white" alt="Download Skulpt on the App Store" /></a>
  &nbsp;
  <a href="https://play.google.com/store/apps/details?id=app.skulpt"><img src="https://img.shields.io/badge/Google_Play-Download-34A853?style=flat&logo=googleplay&logoColor=white" alt="Download Skulpt on Google Play" /></a>
  &nbsp;
  <a href="https://github.com/skulptapp/skulpt/actions/workflows/ci.yml"><img src="https://github.com/skulptapp/skulpt/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  &nbsp;
  <img src="https://img.shields.io/github/license/skulptapp/skulpt?style=flat&color=22c55e" alt="GPL-3.0 license" />
  &nbsp;
  <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey?style=flat" alt="Platforms: iOS and Android" />
  &nbsp;
  <img src="https://img.shields.io/github/stars/skulptapp/skulpt?style=flat&color=facc15" alt="GitHub stars" />
</p>

<p align="center">
  <strong>Free · Open Source · Local-First · No Subscriptions</strong><br />
  A workout tracker for iPhone, Apple Watch, and Android.
</p>

# Skulpt

Skulpt is a workout planner and training log built with React Native, Expo, SQLite, and native platform integrations. Its working database lives on the device, so planning a workout, logging sets, and reviewing history do not depend on a server connection.

Sync is an optional layer over that local database. The App Store and Google Play builds use the Skulpt-operated SyncLayer. A custom build can connect to another compatible provider or omit sync entirely.

The repository contains the mobile client that ships through the stores. It is licensed under GPL-3.0.

## Why Skulpt

- Free to use, with no subscription
- Open source under GPL-3.0
- Local-first SQLite storage
- Works offline for the core workout flow
- Optional sync through the Skulpt provider or another compatible implementation
- Apple Watch workout control
- Live Activities and Dynamic Island on supported iPhones
- HealthKit on iOS and Health Connect on Android

## Get the app

- [Download Skulpt on the App Store](https://apps.apple.com/us/app/skulpt-gym-workout-tracker/id6749158262)
- [Download Skulpt on Google Play](https://play.google.com/store/apps/details?id=app.skulpt)
- [Privacy policy](https://skulpt.app/privacy)

The store builds are free and do not require a subscription. They include the Skulpt SyncLayer. Analytics and diagnostics depend on the release configuration, and developers can build the same client without any of these services.

## Features

- Workout planning, live logging, and history
- Working, warm-up, drop, failure, time, and distance sets
- Supersets, trisets, and circuits
- Body measurements and charts
- Automatic measurement import from Apple Health or Google Health Connect
- Configurable rest timers with sound and haptics
- Apple Watch workout control and heart-rate zones
- Configurable maximum-heart-rate formulas: Nes, Fox, Tanaka, Inbar, Gulati, Gellish, or manual
- Live Activity and Dynamic Island support on iOS 16.1 and later
- Exercise history, volume, and personal records
- English, Spanish, Hindi, Russian, and Chinese localisations
- Light, dark, and system themes
- Configurable units: kg or lb, km or mi, cm or in, and Celsius or Fahrenheit

## Local-first data and optional sync

SQLite is the source of truth for the mobile app. Product writes complete locally first. If a sync provider is enabled, eligible changes are then added to `sync_queue` and sent in the background.

| Build mode            | Configuration                                        | Behaviour                                                              |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Skulpt store build    | Skulpt provider configured at build time             | Local database plus optional cross-device sync                         |
| Custom provider build | Set `EXPO_PUBLIC_SYNC_HOST` to a compatible provider | Local database plus sync through that provider                         |
| Local-only build      | Leave `EXPO_PUBLIC_SYNC_HOST` unset                  | Local database with no authentication, push, or pull through SyncLayer |

Provider selection is currently a build-time setting. The public app does not expose a server URL field in Settings.

SyncLayer is separate from other optional network integrations. PostHog and Sentry each have their own environment variable. Leave those variables unset when building without analytics or diagnostics. See [Build a local-only client](docs/LOCAL_ONLY.md) for the exact configuration and current exercise-catalogue limitation.

Skulpt can copy authorised body measurements from HealthKit or Health Connect into its own `measurement` table. When SyncLayer is enabled, imported measurements follow the same optional sync path as measurements entered by hand. Skulpt does not copy or upload the complete contents of either health store.

## SyncLayer

The mobile client talks to a provider through a small HTTP contract:

```text
POST /auth/token
GET  /sync
POST /sync
```

`POST /sync` sends compacted local changes. `GET /sync` pulls records changed after the last stored timestamp. The same pull route also distributes the maintained Skulpt exercise catalogue under a separate scope.

The Skulpt-operated service is one implementation. Anyone can implement a compatible server and point a custom build at it with:

```dotenv
EXPO_PUBLIC_SYNC_HOST=https://sync.example.com
```

The current request and response shapes are documented in [Sync provider protocol](docs/SYNC_PROTOCOL.md).

## Roadmap

### ① Stable workout core

Polish and harden the full workout experience, from planning and logging to reviewing workout history. This is the foundation everything else builds on.

### ② Whoop-level health intelligence

Deep tracking of recovery, readiness, and training load on par with dedicated wearables. Metrics come from Apple Health on iOS and Google Health Connect on Android. Both collect data from connected devices such as Apple Watch, Garmin, Whoop, Oura, and Polar, so Skulpt works with the hardware the user already owns.

### ③ AI-ready tool layer

A set of composable, privacy-first tools designed for AI agents: each tool computes a specific metric or insight (volume load, recovery score, HRV trend, strain index, etc.) and returns the result without ever exposing the underlying raw data to an external system. Source data flows from the user's wearables into Apple Health / Google Health Connect, and only derived, aggregated values leave the device.

### ④ Agentic protocol

An open, vendor-neutral protocol for connecting AI agents to Skulpt. An agent can query the tool layer, reason over computed metrics, and surface personalised recommendations regardless of its model or platform. The protocol is deliberately model-agnostic: it defines a contract rather than an implementation, so it can work with a local on-device model, a self-hosted LLM, or a cloud AI service.

### ⑤ First-class agent UI

A native interface for managing and interacting with connected agents inside the app. Users will be able to configure agent access, inspect what each agent can see, and have conversations grounded in their training data without leaving Skulpt.

## Architecture

```text
screens, hooks, and native targets
                |
                v
        CRUD and services
                |
                v
       Drizzle ORM + SQLite
                |
                +------ local queries ------> history, charts, next workout
                |
                +------ optional queue -----> SyncLayer provider
```

The main implementation areas are:

| Path                       | Responsibility                                                        |
| -------------------------- | --------------------------------------------------------------------- |
| `src/routes/`              | Expo Router entry points and application providers                    |
| `src/screens/`             | Product screens                                                       |
| `src/crud/`                | Local database operations and optional queue writes                   |
| `src/db/` and `drizzle/`   | SQLite schema and migrations                                          |
| `src/api/` and `src/sync/` | SyncLayer transport and sync engine                                   |
| `src/services/`            | Health, authentication, diagnostics, and product services             |
| `modules/`                 | Native Expo modules, including Watch connectivity and Live Activities |
| `targets/watch/`           | SwiftUI watchOS application                                           |
| `targets/workout-widget/`  | Live Activity and widget target                                       |

Read [Architecture](docs/ARCHITECTURE.md) for the data flow and platform boundaries.

## Development

### Requirements

- Node.js 20 or newer
- Bun 1.3 or newer
- Xcode for iOS development
- Android Studio and the Android SDK for Android development
- EAS CLI for remote device builds and store submissions

Skulpt uses custom native modules. Expo Go cannot run this project; use a native development build.

### Install

```bash
git clone https://github.com/skulptapp/skulpt.git
cd skulpt
cp .env.local.example .env.local
bun install --frozen-lockfile
```

The example file uses a development bundle identifier. Set `APP_APPLE_TEAM_ID` to your own Apple Developer team before building the iOS targets. Contributors do not need Skulpt production credentials.

### Run

```bash
bun run ios
bun run android
```

### Check a change

```bash
bun run verify
```

This runs ESLint, TypeScript, and the Jest suite. The same commands run for pull requests on GitHub. EAS remains the build and store-release system; GitHub Actions does not build or submit the mobile applications.

### Database migrations

After changing a Drizzle schema:

```bash
bun run db:generate
```

Review and commit the generated migration and metadata. The app applies bundled migrations at startup.

### Useful commands

| Command               | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `bun start`           | Start the Expo development server        |
| `bun run ios`         | Build and run the iOS client locally     |
| `bun run android`     | Build and run the Android client locally |
| `bun run verify`      | Run lint, TypeScript, and tests          |
| `bun run lint`        | Run Expo ESLint                          |
| `bun run typecheck`   | Run TypeScript without emitting files    |
| `bun run test`        | Run Jest in development mode             |
| `bun run db:generate` | Generate a Drizzle migration             |
| `bun run locale`      | Update translation resources             |
| `bun run prebuild`    | Regenerate the local iOS project         |

## EAS builds and releases

The repository includes `eas.json.example`. Copy it to the ignored `eas.json` and add account-specific values before using EAS.

| Command                   | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `bun run build:ios`       | iOS development build through EAS                   |
| `bun run build:android`   | Android development build through EAS               |
| `bun run release:ios`     | Production iOS build and submission through EAS     |
| `bun run release:android` | Production Android build and submission through EAS |
| `bun run update:all`      | Production OTA update and source-map upload         |

Maintainer steps are documented in [Release process](docs/RELEASING.md).

## Contributing

You can contribute code, tests, documentation, translations, accessibility fixes, or reproducible bug reports. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

- Use [GitHub Issues](https://github.com/skulptapp/skulpt/issues) for reproducible bugs and scoped work.
- Use [GitHub Discussions](https://github.com/skulptapp/skulpt/discussions) for questions, ideas, and architecture proposals.
- Follow [SECURITY.md](SECURITY.md) for private vulnerability reports.
- Follow [SUPPORT.md](SUPPORT.md) for app support and private data questions.

## Project documents

- [Architecture](docs/ARCHITECTURE.md)
- [Build a local-only client](docs/LOCAL_ONLY.md)
- [Sync provider protocol](docs/SYNC_PROTOCOL.md)
- [Release process](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md)
- [Governance](GOVERNANCE.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## License

Skulpt is licensed under the [GNU General Public License v3.0](LICENSE).
