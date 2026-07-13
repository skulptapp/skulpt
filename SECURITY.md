# Security policy

## Report a vulnerability privately

Send a private report to [errors@skulpt.app](mailto:errors@skulpt.app) with the subject `[SECURITY]`. If GitHub private vulnerability reporting is enabled, you can use that instead.

Do not open a public issue before a fix or safe disclosure plan exists.

Include only what you can safely share:

- affected version and platform
- impact and who may be affected
- reproduction steps or a small proof of concept
- conditions required to trigger the issue
- a suggested fix, if you have one

Remove credentials, auth tokens, signing material, workout records, health samples, and personal identifiers. Ask before sending any sensitive data the report requires.

## Scope

Reports can cover:

- the mobile client in this repository
- authentication and SyncLayer behaviour used by the client
- unintended exposure of workout, measurement, health, account, or diagnostic data
- a bypass of an intended permission or privacy boundary
- a dependency or native-module vulnerability that affects released users
- build and update behaviour that could deliver unauthorised code

General product bugs and feature requests belong in Issues or Discussions unless they have a concrete security impact.

## Supported code

Security fixes target the latest `main` branch and current public store versions. Users on older application versions may need to update to receive a fix.

Fix and disclosure timing depends on severity, mobile-store review, and whether the issue affects the client, a provider, or both. Give the maintainers time to investigate and prepare a fix before disclosing the issue publicly.

Skulpt does not currently offer a bug-bounty programme. With the reporter's permission, we may credit a useful report in an advisory or release notes when disclosure is safe.
