# Release process

Skulpt uses Expo Application Services for mobile builds, OTA updates, and store submission. GitHub Actions checks pull requests but does not build or publish the applications.

This document is for maintainers. Contributors do not need store credentials, signing files, or access to Skulpt's EAS project.

## Configuration

Copy the account-specific EAS example:

```bash
cp eas.json.example eas.json
```

`eas.json` is ignored. Fill in the Apple and Google values through local or EAS-managed configuration. Do not commit signing material, store credentials, service-account files, or Sentry tokens.

The build reads app identity and integration settings from the selected EAS environment. `APP_VERSION` and `APP_BUILD_NUMBER` control the public version and platform build number.

The checked-in example defines these profiles:

| Profile       | Distribution                | Channel       |
| ------------- | --------------------------- | ------------- |
| `development` | Internal development client | `development` |
| `preview`     | Internal preview build      | `preview`     |
| `production`  | Store build                 | `production`  |

## Checks before a build

Run the repository checks on the intended commit:

```bash
bun install --frozen-lockfile
bun run verify
```

For a database migration, test both a clean install and an upgrade from the current store version. Native, permission, HealthKit, Health Connect, Watch, Live Activity, and notification changes need platform testing on the devices they affect.

Review the release configuration against the privacy policy, App Store privacy answers, Google Play Data safety answers, requested permissions, and enabled network services.

## Development builds

```bash
bun run build:ios
bun run build:android
```

These scripts use the EAS `development` profile.

## Production builds and submission

```bash
bun run release:ios
bun run release:android
```

The scripts run EAS production builds with automatic submission. Store review and rollout happen separately on App Store and Google Play. Check each public listing before announcing the release.

## OTA updates

```bash
bun run update:all
```

This publishes to the production EAS channel and then uploads source maps. Use an OTA update only when the change is compatible with the installed native runtime and current `runtimeVersion` policy.

## Source tag and GitHub release

Tag the exact source commit used for a public version:

```bash
git tag -a v8.0 -m "Skulpt 8.0"
git push origin v8.0
```

Replace the example version with the version being released. Create the GitHub release from the same tag. Include user-visible changes, useful technical notes, known limitations, and contributor credit.

Do not move a published version tag to another commit. Publish a correction through a new version if the tagged source is wrong.
