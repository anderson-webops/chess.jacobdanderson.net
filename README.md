# Jacob Anderson Chess

A browser chess game with two presentation modes and two opponent modes:

- Play on an accessible, responsive board or entirely through SAN and coordinate notation.
- Play local human versus human on one device or human versus the built-in computer.
- Choose White or Black and select one of three computer search strengths.
- Undo moves, flip the board, inspect legal moves, and read FEN and PGN state.

The live application is designed for `https://chess.jacobdanderson.net`.

## How the game works

The Nuxt frontend owns an in-memory game session. `chess.js` is the rules authority for legal moves, check, checkmate,
stalemate, castling, en passant, promotion, repetition, the fifty-move rule, insufficient material, FEN, SAN, and PGN.
The board and headless notation interface operate on the same game instance, so switching views never changes the
position.

The computer is a deterministic alpha-beta-pruned negamax player. Its evaluation combines material, centralization,
pawn advancement, castling, checks, and terminal outcomes. Difficulty controls search depth and a bounded node budget.
It runs in an isolated browser worker, keeping the page responsive while it searches. No account, network service,
telemetry, or GPL engine binary is required.

Human versus human means same-device pass-and-play. This release does not claim remote matchmaking or network rooms.

## Project structure

- `front-end/`: Nuxt 4 static application, game UI, chess controller, and controller tests
- `back-end/`: standalone Express 5 health API retained for both production adapters
- `deploy/`: Docker-free Nginx and systemd production adapter
- `netlify/`: Netlify adapter for the same Express API

## Local development

Use Node.js `24.18.1` and npm `12.0.2` from the repository root.

```bash
npm ci
npm run server
npm run dev
```

The frontend normally listens on `http://localhost:3333`; the API listens on `127.0.0.1:3006`. Browser API traffic
stays same-origin at `/api`.

## Validation

```bash
npm run audit:all
npm run audit:prod
npm run validate
npm run a11y
```

`npm run validate` checks native bindings, lint, TypeScript, chess and API tests, production builds, and the expected
Netlify and direct deployment outputs. The accessibility smoke test checks both board and headless interfaces in light
and dark themes.

## Direct production deployment

Production can use static Nuxt output served by Nginx plus the compiled Express API under a hardened, loopback-only
systemd service. It does not require Docker.

```bash
sudo deploy/systemd/install-service.sh
# Install deploy/nginx/chess.jacobdanderson.net.server.conf in the certificate-covered TLS server.
deploy/systemd/prepare-release.sh /srv/chess.jacobdanderson.net/releases/<release>
sudo PUBLIC_HOST=chess.jacobdanderson.net \
  deploy/systemd/promote-release.sh /srv/chess.jacobdanderson.net/releases/<release>
```

See `deploy/README.md` for preparation, promotion, health, identity, and rollback gates.

## Netlify deployment

`netlify.toml` generates `front-end/.output/public` and routes `/api/*` to the bundled Express function before the SPA
fallback. Node and npm versions are pinned.

## Provenance and licenses

This app was informed by the headless minimax concepts in Jacob Anderson's CS 240 `softwareconstruction` chess work,
but it does not copy the legacy Java server or database layer. The current site uses a maintained TypeScript rules
engine and a new browser UI.

Project source is MIT licensed. `chess.js` is BSD-2-Clause; its required notice is in `THIRD_PARTY_NOTICES.md`.

## Git remotes

- `origin`: `anderson-webops/chess.jacobdanderson.net`
- `template`: `anderson-webops/vitesse-nuxt-template`
- `upstream`: `antfu/vitesse-nuxt`
