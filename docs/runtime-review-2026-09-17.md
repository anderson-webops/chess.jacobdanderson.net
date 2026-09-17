# Chess source and runtime review, 2026-09-17

The v1.0.2 correction preserves visible/headless and local-human/bot play, the
shared game state, chess.js notice, Netlify adapter and direct host contract.
Production activation is a separate operator action.

## Confirmed source changes

The original source at 5ea87762f856032939c6fe87604c3c8d9d3259d2 gave the build
account ownership of the deployment parent and releases, then documented running
its mutable promotion helper as root. A compromised build account could replace
that helper before the next administrative promotion. The source review rated
this medium because it requires a local build compromise and subsequent operator
action; no unauthenticated HTTP exploit or affected installed host was established.

The corrected runbook requires independently reviewed administrative source and
versioned root-controlled helpers. Candidates are verified only as data, using a
protected archive, independently supplied digest and source commit. Promotion
rejects writable paths and symlinks. Its lock, atomic pointer update and exit/signal
recovery preserve the prior release. Failed recovery retains a protected record.
Existing installations require an ownership/topology review before adopting it.
No installed-host migration or service change is performed by this source review.

The API now bounds identity storage to 10,000 individual windows and one strict
shared overflow bucket, caps connections at 256, supplies minimal uncached
GET/HEAD health/readiness, and drains repeated shutdown signals once. The bot
worker now cleans up on construction or messaging failure and a 15-second deadline;
Undo and New game remain available for recovery. There are no accounts, role
promotions/demotions, database, provider messages or server-side chess sessions.

Full/root-production and independent backend audits found no remaining advisories
after patching qs to 6.16.0 and SVGO to 4.1.0 in the source overrides and locks.
Freshness review also covered development dependencies. Unneeded major/pre-release
upgrades were not mixed into this correction.

## Measured resource effect

[Raw paired measurements](measurements/2026-09-17-rate-storage.json) contain three
runs per store on Node24.18.1 Darwin ARM64, using the same locked rate-limit
implementation. Each run warms 2,000 identities with ten requests each, then adds
100,000 unique synthetic identities. No forced garbage collection, HTTP traffic
or providers were used. Median peak process RSS was 102.88 MiB before and
73.11 MiB after (28.9% lower). Retained individual counters changed
from 102,000 to 10,000; overflow remains conservative until its window expires.
This is an in-process store comparison, not a live-server memory measurement or
proof that every possible application leak is absent. Input hashes are recorded.

## Verification and release gates

Local lint, types, 17 application tests, nine artifact regressions and the static
plus compiled-backend build passed on pinned Node24.18.1/npm12.0.2. Browser tests
passed four accessibility modes, game/bot behavior and three worker failure/recovery
cases. Seventeen isolated administrative fault cases cover success, interruption,
restart/health/Nginx/IPv6 failures, failed rollback, contention, invalid current,
mutable helper/parent/candidate, symlink module, tampering, wrong digest and first
deployment. They exercise the actual promoter with synthetic system commands,
not the installed host. The bootstrap installer was source-reviewed and is not
executed against an existing host by these tests.

Before publication, the exact committed/annotated source must pass the Linux
ARM64 release workflow, clean locked installation, audits/signatures, application
and packaging tests. Accept the exact unpacked archive without checkout or dev
dependencies, through real Nginx IPv4/IPv6 TLS, then repeat after copying it and
reject a deliberately missing module. Run browser acceptance against those exact
static bytes. Publish the archive, manifest, checksum and acceptance receipt
with source and harness hashes only after these gates pass. GitHub CI remains a
separate gate for this public repository. No production claim follows from it.

The completed native security scan 913a6ff4-440f-417a-b4b2-d58c097ef04b reviewed
78 text/lock files; seven static image/font binaries and external dependencies,
third-party action implementations and the live host were outside its review.
The independent baseline and parent source analysis completed; a separate
architecture worker was stopped without a result. The sealed pre-fix report is
retained in the local security workbench. This document records the source
correction and its practical limits; it is not an exhaustive security guarantee.
