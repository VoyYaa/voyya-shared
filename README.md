# @voyyaa/shared

Shared Zod contracts, DTOs, types, enums and the trip state machine for VoyYa. Single source of
truth consumed by the backend (NestJS) and the frontend clients (Expo, Vite). Validation runs
through [Zod](https://zod.dev) on every side; TypeScript strict, no `any`.

## What's inside

- `contracts/auth` — roles, JWT payload, session tokens, OTP/login/refresh/logout DTOs, auth
  error codes and auth domain events.
- `contracts/trips` — service type, payment method, trip status, fare breakdown, quote/create/
  cancel trip request DTOs, trip error codes and trip domain events.
- `contracts/assignment` — driver status, assignment status, driver candidate, assignment
  notification, accept/reject/cancel assignment DTOs, assignment error codes and assignment
  domain events.
- `domain/trip-state-machine` — the single source of truth for valid trip request and assignment
  status transitions, reusing the predicates exported by the contracts above.

## Install

This package is published to GitHub Packages under the `@voyyaa` scope. GitHub Packages requires
authentication to install a package even when it is public, so every consumer needs an `.npmrc`
with a GitHub token that has at least the `read:packages` scope:

```
@voyyaa:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Export `GITHUB_TOKEN` in your shell or CI environment (a classic personal access token, or a
fine-grained token with `read:packages`), then install:

```
pnpm add @voyyaa/shared
```

## Publish

Releases are automated by `.github/workflows/publish.yml`:

1. Bump `version` in `package.json` following semver.
2. Tag the commit and push the tag:

   ```
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. GitHub Actions builds the package and publishes it to `npm.pkg.github.com` using the
   workflow's own `GITHUB_TOKEN` — no manual `npm publish` needed. The workflow can also be
   triggered by hand from the Actions tab (`workflow_dispatch`).

## Scripts

- `pnpm build` — compiles `src` to `dist` (JS + `.d.ts`) via `tsconfig.build.json`.
- `pnpm typecheck` — type-checks the package without emitting.

## Notes

- The package is public within the VoyYaa GitHub organization.
- License is `UNLICENSED`: internal use across VoyYa repositories, not for external redistribution.
