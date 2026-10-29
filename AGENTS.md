# Repository Guidelines

## Standing Dependency Completion Policy

Treat dependency remediation as part of completing authorized work on this
site, not as an optional follow-up. Proactively resolve vulnerabilities,
compatibility problems, broken installations and lockfile issues. Cover direct
and transitive dependencies, production and development dependencies,
workspaces and root-level tools. Do not dismiss findings because they are
pre-existing or development-only.

Before creating a release tag or publishing a release, require a clean locked
installation for every applicable dependency graph, zero known dependency
vulnerabilities in both full and production audits, and all applicable project
checks. An unavailable or incomplete audit is not a clean result. Use supported
upgrades, replacements or maintainable patches that preserve functionality.
Do not silence findings, weaken checks or force incompatible versions merely
to obtain a passing result.

Intermediate commits may capture coherent progress. Commit and push validated
work through this site's authorized delivery process, and complete meaningful
releases rather than stopping after reporting fixable dependency blockers.
Documentation-only housekeeping does not require an application release.

Preserve unrelated work, coordinate with other active chats, and retain existing
security, approval and production-access boundaries. Existing maintenance pauses
and repository exclusions remain in force; this policy does not expand access
or authorize otherwise excluded work. If a genuine blocker prevents completion,
preserve progress and report the exact blocker and remaining work. Distinguish
a published release from verified live deployment.

Treat this as a standing instruction for this site.


Shared Sites policy (`../AGENTS.md` when available) applies. These essentials also apply in standalone checkouts:
- Never SSH, SCP, SFTP, tunnel to, or configure access to production. Do not deploy it; protected server-side automation owns activation, and source delivery alone does not prove deployment.
- GitGuardian quota, authentication, network, or service failure is not a commit/push blocker. Review outgoing changes, run another available local secret scan, preserve other hooks, and stop on real secret findings.
- Commit small, coherent changes frequently as they become reviewable, and push completed, validated work through the authorized source path, usually the default branch; use pull requests only when required. Do not finish an implementation turn with completed work only in local files.
- Group related deployable changes into meaningful, immutable annotated version tags and GitHub releases. Content, copy, and UI fixes are deployable changes; publish the required release and validated assets in the same session instead of stopping at a commit, push, or tag. Never move published tags or replace published artifact bytes.
- Published releases trigger protected deployment. Finish deployable turns by verifying the publicly served release identity and affected behavior through read-only checks, or report the exact release or activation blocker. Keep production host access and infrastructure changes outside the source-agent boundary.

## Project Structure & Module Organization

- `front-end/` contains the Nuxt 4 application. UI lives in `src/components`, layouts in `src/layouts`, routes in
  `src/pages`, composables in `src/composables`, and shared constants under `src/constants`.
- `back-end/` contains the standalone Express API. Keep route wiring and middleware in `src/`, and emit compiled output
  to `dist/`.
- Root files (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `netlify.toml`) define the shared monorepo
  toolchain. `deploy/` contains the direct Nginx/systemd production path.

## Build, Test, and Development Commands

- `npm ci` installs the committed workspace dependency graph. Use Node 24.18.1 and npm 12.0.2 at the repo root; do not mix package managers for normal
  development.
- `npm run dev` starts the Nuxt front-end on port `3333`.
- `npm run server` starts the Express API with `tsx watch` on port `3006`.
- `npm run typecheck` runs both the Nuxt and back-end TypeScript checks.
- `npm run lint` runs ESLint across both workspaces.
- `npm run build` generates the static front-end to `front-end/.output/public` and compiles the back-end to
  `back-end/dist`.
- On Linux ARM64, run `npm run test:promotion` and `npm run package:runtime -- <empty .ai-work/runs directory>` for a release. Follow `deploy/README.md` for protected helpers, exact unpacked-artifact acceptance and browser checks.

## Coding Style & Naming Conventions

- Follow the repo ESLint configuration. Front-end files use the upstream Nuxt/Vitesse formatting style; root and
  back-end files follow the shared monorepo lint rules.
- Prefer descriptive component and composable names. Use PascalCase for Vue components and camelCase for utility and
  composable exports.
- Keep route-facing files in `front-end/src/pages` aligned with Nuxt’s file-based routing conventions.

## Testing & Verification

- Run `npm run validate` before delivering application changes; it includes lint, types, tests, build, and deployment-output checks.
- When changing API behavior, verify both the front-end call site and the Express route behavior together.
- Keep browser API traffic same-origin at `/api`; deployment adapters must route that path to the Express app.
- Preserve both Docker-free production adapters: direct Nginx/systemd and Netlify. Do not compile and discard the
  backend in either production path.
- Treat chess-controller breakage as high impact: the visible board, notation interface, and bot share one game state.

## Repository Workflow

- `origin` is the published `anderson-webops/chess.jacobdanderson.net` site repository.
- `template` points to `anderson-webops/vitesse-nuxt-template` for selective template updates.
- `upstream` must continue to point to `antfu/vitesse-nuxt`.
- Preserve the front-end/back-end workspace structure when evolving the site unless a deliberate architecture change
  is being made.

## Lockfile Boundaries

- Keep `back-end/package-lock.json` synchronized with backend manifest changes; it is the production-only direct API
  lock, while the root lock remains authoritative for workspace development and Netlify. Regenerate affected locks
  with manifest changes and verify a clean root `npm ci` plus the shared audit and validation gates.
