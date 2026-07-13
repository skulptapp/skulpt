# Security policy

## Report a vulnerability privately

Email [errors@skulpt.app](mailto:errors@skulpt.app) with the subject `[SECURITY]`. If GitHub private vulnerability reporting is enabled, you can use that route instead.

Do not open a public issue before a fix or safe disclosure plan exists.

Include what you can safely provide:

- affected version and platform;
- impact and who may be affected;
- reproduction steps or a small proof of concept;
- conditions required to trigger the issue;
- a suggested fix, if you have one.

Remove credentials, auth tokens, signing material, workout records, health samples, and personal identifiers. Ask before sending sensitive data that is essential to the report.

## Scope

Security reports may cover:

- the mobile client in this repository;
- authentication and SyncLayer behaviour used by the client;
- unintended exposure of workout, measurement, health, account, or diagnostic data;
- a bypass of an intended permission or privacy boundary;
- a dependency or native-module vulnerability that affects released users;
- build and update behaviour that could deliver unauthorised code.

General product bugs and feature requests belong in Issues or Discussions unless they have a concrete security impact.

## Supported code

Security work targets the latest `main` branch and current public store versions. Older application versions may need to update before receiving a fix.

Fix and disclosure timing depends on severity, mobile-store review, and whether the issue affects the client, a provider, or both. Please allow time for investigation and remediation before public disclosure.

Skulpt does not currently publish a bug-bounty programme. A useful report can still be credited in an advisory or release notes if the reporter requests it and disclosure is safe.
