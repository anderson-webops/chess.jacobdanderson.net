# Docker-free production rollout

Chess serves static Nuxt files through the existing Nginx host and a small Express
API through systemd. Netlify remains a separate supported adapter. Preserve the
existing `chess-jacobdanderson-net-api.service`, loopback `127.0.0.1:3006`,
`/srv/chess.jacobdanderson.net/current`, IPv4/IPv6 listeners, certificates and edge
policy. No application credentials, database, queue or durable writable state are
required. Logs remain in the existing journal. There are no schema migrations.

## Administrative trust boundary

Builds and package lifecycle scripts run without root privileges, away from the
production host where practical. Never run a promotion script or verification
program from a build-owned checkout as root. A clean Git checkout before a build
does not protect a script against modification during that build.

Bootstrap the reviewed administrative helpers from a separate root-owned checkout
of the exact published source tag, with root-owned, non-writable ancestors. Review
that checkout independently before invoking `deploy/systemd/install-service.sh`.
Do not copy administrative executables from a prepared application tree. The
installer places versioned helpers under
`/usr/local/libexec/chess-release/<version>/` and refuses to overwrite a version.
It checks ownership and modes, keeps the active-pointer parent and release root
root-controlled, and uses a separate `builds/` directory for unprivileged work.

Use the approved Node `24.18.1` binary, normally
`/opt/node-24.18.1/bin/node`, and npm `12.0.2` for builds. `NODE_BIN_DIR` may select a
reviewed protected runtime location. Do not replace the host-wide `/usr/bin/node`.
The sample systemd unit uses the `/opt` runtime. The installer preserves an
existing unit; an alternate installed runtime requires explicit operator review.

An existing deployment created by the old build-owned-directory runbook needs a
separate ownership review before using these helpers. Preserve its exact serving
release and rollback target, validate their contents, and freeze the reviewed
release trees and pointer parent under root control. Do not recursively change
ownership of unknown state or replace an installed topology from this template.
The new promoter fails closed until these administrative inputs are protected.

## Build and accept the release

1. Use a clean Linux ARM64 checkout with the committed root and standalone backend
   locks, Node `24.18.1`, npm `12.0.2`, Python 3, bubblewrap, Nginx, curl and OpenSSL. Install with
   `npm ci --include=optional --strict-allow-scripts`. Run full and production
   audits, standalone backend audits, package signatures, lint, types, application
   tests, build, native-binding checks, deployment-output checks and accessibility.
   Run `npm run test:artifact` and `npm run test:promotion` as well.
2. Commit the validated source and create its annotated version tag. The metadata
   writer rejects a dirty tree, a mismatched commit or an unrelated tag. Keep
   `origin` canonical and preserve the exact main/tag release gate. In the public
   metadata, the legacy `deployedAt` field is preparation time, not proof of live
   activation.
3. In that exact checkout, create an empty directory under `.ai-work/runs/` and run
   `npm run package:runtime -- <absolute-output-directory>`. The packager installs
   production dependencies independently, verifies signatures and audits, and
   creates the archive, `runtime-manifest.json`, `SHA256SUMS` and `acceptance.json`.
   Publish those four assets together after acceptance succeeds.

The independently maintained `deploy/runtime-artifact.json` specifies required
entrypoints, production dependency roots, static assets and the absence of
external modules, generated clients, native runtime bindings and writable state.
The manifest records every file's hash and size and the exact source identity.
Secret/private configuration paths, symlinks, traversal, unrelated dependencies
and development tools are rejected. Registry integrity is separate from runtime
artifact integrity; neither replaces the other.

The exact unpacked artifact runs in a fresh, read-only namespace without access to
the source checkout or development dependencies. Acceptance exercises compiled
startup, GET/HEAD probes, readiness failure/recovery, read-only API policy,
repeated-signal draining, connection saturation/recovery and restart. A private
network namespace runs real Nginx with an ephemeral synthetic TLS certificate;
static files, the worker, exact metadata and API routes are checked over IPv4 and
IPv6 with certificate verification. It repeats after copying the tree and tests
a deliberately missing runtime module. Promotion fault tests run the actual
administrative helper with synthetic root and fake external services; they do
not touch a host service, provider or real configuration.

For browser acceptance, verify and unpack the same archive, start
`node scripts/preview-artifact.mjs <unpacked-tree>` on its local test port, and run
`npm run a11y -- --external-server`. Stop that test server afterward. This serves
only manifest-listed static files for the real browser tests; it is not a
production adapter. The separate Nginx acceptance above verifies the edge/API
configuration. Browser tests cover all four modes, a complete game, undo/replay,
the real bot worker, and recovery after worker creation, messaging and deadline
failures.

## Finalize and promote on the compatibility host

The operator downloads the four reviewed release assets into protected storage
and independently verifies their exact tag, commit and archive digest. Use the
versioned, root-installed verifier, never one supplied by the candidate tree.
Create a new empty root-owned release directory beneath the existing release root.

```bash
/usr/bin/python3 -I /usr/local/libexec/chess-release/<version>/scripts/runtime-artifact.py \
  unpack /srv/chess.jacobdanderson.net/releases/<new-release> \
  --archive <protected-archive> --sha256 <reviewed-sha256> --commit <reviewed-commit>
```

The archive must be root-owned, non-writable by other accounts and beneath
protected ancestors. Keep the extracted tree root-owned and read-only to the
application account. Preserve the installed API and Nginx read access. The
promoter checks all ancestors and all candidate files, and verifies the complete
staged tree against the independently supplied archive, hash and commit again.

```bash
PUBLIC_HOST=chess.jacobdanderson.net NODE_BIN_DIR=/opt/node-24.18.1/bin \
  /usr/local/libexec/chess-release/<version>/deploy/systemd/promote-release.sh \
  /srv/chess.jacobdanderson.net/releases/<new-release> \
  <protected-archive> <reviewed-sha256> <reviewed-commit>
```

These are root administrative operations, not a request for broad sudo rights.
Promotion takes an exclusive lock, atomically selects the release, restarts only
the Chess API, reloads Nginx and verifies exact release identity, headers, denied
mutations and unknown API routes through both local IPv4 and IPv6 TLS. New
artifacts must also pass backend readiness. An old retained v1.0.1 rollback uses
its existing health contract.

Any unsuccessful exit after mutation, including HUP/INT/TERM, restores the prior
pointer and checks the prior service. First-deployment failure removes only the
new pointer and stops the newly started Chess service. Rollback failure returns
failure and retains a mode0600 record in the protected mode0700
`.deployment-recovery/` directory for operator recovery. Never delete the retained
release, its approved archive or durable state while it may be needed for rollback.

The helper does not change DNS, certificates, firewall/routing rules or Nginx
configuration. First-host setup of the supplied Nginx snippet is separately
reviewed; keep every existing A/AAAA record and both edge address families intact.

## Minimal probes

The Express API supports GET/HEAD `/healthz`, `/readyz`, `/api/healthz`,
`/api/readyz` and the existing `/api/health`. Healthy responses are `200` with
`{"ok":true}`; HEAD has no body. Readiness is `503` during shutdown or dependency
failure. Every response is `Cache-Control: no-store`, without authentication,
cookies, redirects or internal details. Chess has no external readiness dependency.
The existing static `/healthz` remains a static hosting contract. No new public
proxy location or monitoring-only service is required.
