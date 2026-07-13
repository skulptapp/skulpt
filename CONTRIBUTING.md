# Contributing to Skulpt

Skulpt is the open-source mobile client shipped through the App Store and Google Play. Changes can affect local workout records, optional sync, health integrations, the Apple Watch app, and store releases. Keep contributions focused and explain how you tested them.

You can also help with documentation, translations, accessibility, exercise corrections, tests, or reproducible device reports.

## Choose the right place

- Use [Issues](https://github.com/skulptapp/skulpt/issues) for reproducible bugs and accepted, scoped work.
- Use [Discussions](https://github.com/skulptapp/skulpt/discussions) for setup questions, product ideas, and architecture proposals.
- Follow [SECURITY.md](SECURITY.md) for vulnerabilities.
- Follow [SUPPORT.md](SUPPORT.md) for help with the released app or private account and data questions.

Do not put workout records, health samples, authentication tokens, credentials, signing files, or unredacted diagnostic exports in a public post.

## Before starting a large change

Open a Discussion before implementing work that changes:

- the product direction or roadmap;
- the database schema or SyncLayer protocol;
- HealthKit, Health Connect, authentication, analytics, or diagnostics;
- native modules, Apple targets, Android permissions, or store declarations;
- several screens or a major user flow;
- a dependency that adds a hosted service or a new data boundary.

Starting with a Discussion gives everyone a chance to agree on the problem and constraints before substantial work begins.

## Local setup

Requirements:

- Node.js 20 or newer
- Bun 1.3 or newer
- Xcode for iOS work
- Android Studio and the Android SDK for Android work

Install the repository:

```bash
git clone https://github.com/skulptapp/skulpt.git
cd skulpt
cp .env.local.example .env.local
bun install --frozen-lockfile
```

The example uses a development bundle identifier and leaves hosted integrations unconfigured. Use your own Apple Developer team in `APP_APPLE_TEAM_ID` for the iOS targets. Do not use Skulpt production credentials for contribution work.

Skulpt includes custom native modules, so Expo Go is not supported. Run a native client:

```bash
bun run ios
bun run android
```

Changes limited to documentation or isolated unit tests may not need a native build. In the pull request, say which checks you ran and which you skipped.

## Repository checks

Run the same checks used for pull requests:

```bash
bun run verify
```

This command runs ESLint, TypeScript, and Jest. Add or update tests when behaviour changes. If automated coverage is impractical, give exact manual verification steps.

## Working on the codebase

Create a branch from the latest `main`. Keep unrelated formatting, refactoring, and dependency changes out of the same pull request.

Use a commit message that describes the result, for example `Handle Health Connect unavailable state`, instead of a generic message such as `Fix bug`.

### Database changes

After editing a schema under `src/db/schema/`, run:

```bash
bun run db:generate
```

Commit the generated migration and Drizzle metadata. Test a clean database and an upgrade from an existing database when stored user data changes.

### SyncLayer changes

The mobile client writes to SQLite before optional provider sync. Cover the provider-disabled path, offline behaviour, retries, partial updates, deletes, and existing local records.

If the HTTP contract changes, update [docs/SYNC_PROTOCOL.md](docs/SYNC_PROTOCOL.md), its schema header where necessary, and the related tests in the same pull request.

### Health and measurement changes

List the permissions and data sources used by the change. Test denied permissions and unavailable services. Check whether imported rows can enter SyncLayer and whether the store privacy declarations need an update.

Never include real health samples in a test fixture, screenshot, log, or issue.

### Native changes

For changes under `modules/`, `targets/`, `app.config.js`, or native permissions, record the physical device, simulator, emulator, OS version, and Watch setup used for testing.

Check phone-only fallback behaviour when the change touches WatchConnectivity or Live Activities.

### User-interface changes

Include screenshots or a short recording. Check light and dark themes, long translated text, loading and disabled states, and larger text where practical. Use synthetic workout data in public images.

### Translations

Keep keys and interpolation variables unchanged. Name the language and explain how the wording was reviewed. Do not replace an entire locale with unreviewed machine translation.

## Pull requests

A pull request should include:

- the problem it solves;
- the chosen change;
- a linked Issue or Discussion when one exists;
- automated and manual checks you ran;
- screenshots for visible changes;
- database, sync, privacy, permission, and store impact where relevant;
- known follow-up work that is intentionally outside the pull request.

Draft pull requests are useful for early technical feedback. Mark a pull request ready when the change and description are complete and the checks pass.

## Review and product direction

The roadmap in [README.md](README.md#roadmap) defines the current product direction. A contribution can propose a roadmap change, but it must do so explicitly rather than contradicting the current plan elsewhere.

Maintainers decide what is merged and released. See [GOVERNANCE.md](GOVERNANCE.md) for the current maintainer-led model.

## License

By contributing, you agree that your contribution will be distributed under the repository's [GPL-3.0 license](LICENSE).
