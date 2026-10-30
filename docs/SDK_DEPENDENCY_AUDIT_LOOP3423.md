# Mirror SDK dependency audit — HumanJuice Loop #3423

Validated 2026-10-30 against mirror main `9dfcbb0`. Ports only the compatible
plugin changes from [Loop #3418 / source PR #72](https://github.com/unipile/uniconnect/pull/72)
(`24ed668819aec7740abdebe8f6acda08b79c2616`), including the Zod change shared
with [source PR #70 / Loop #3416](https://github.com/unipile/uniconnect/pull/70).
See the [source exposure audit](https://github.com/unipile/uniconnect/blob/24ed668819aec7740abdebe8f6acda08b79c2616/docs/SDK_DEPENDENCY_AUDIT_LOOP3418.md).
The mirror's additional connector implementations and existing tests are unchanged.

## Compatible changes

| Dependency | Before | After |
| --- | --- | --- |
| zod | 4.3.5 | 4.6.7 |
| handlebars | 4.7.9 | 4.7.10 |
| pbkdf2 | 3.1.6 | 3.1.7 |
| body-parser | 2.3.0 | 2.4.0 |
| ip-address | 10.7.2 | 10.7.5 |
| multer | 2.4.0 | 2.5.0 |
| qs | 6.16.0 | 6.17.1 |
| undici (7 only) | 7.29.1 | 7.30.1 |

The resulting manifest and lock match the source plugin exactly. Core/CLI remain
1.7.2; parent ranges are preserved. The existing Zod 4 resolution is advanced;
no new forced major override is added. AI, its Zod 3 peer requirements, undici 5
and simple-git migrations remain outside this change.

## Verification in this mirror

Bun 1.4.4, Node 24.12.0, TypeScript 5.9.3. Checks ran sequentially with default
memory limits. Bun was read from the existing local tool installation.

- `bun install --frozen-lockfile --ignore-scripts` passed before and after.
- The ported dependency regression file fails three security tests on the original
  lock: Handlebars exposes the Function constructor, preserves HTML script boundaries
  in precompiled output, and Zod visits both elements of an array capped at one.
  The real SDK prompt/XML test passes on both versions.
- `bun test`: **18 passed, 0 failed**, including the mirror's email, WhatsApp and
  LinkedIn connector tests and the four ported tests. Only the new test file was
  formatted to match the mirror's conventions.
- `bun node_modules/typescript/bin/tsc --noEmit --project tsconfig.json` passed.
- `Bun.build` with the exact options from `build.ts` passed, then
  `bun node_modules/typescript/bin/tsc --emitDeclarationOnly --incremental --project tsconfig.build.json`
  passed. The combined build script was not invoked because it runs these tasks
  in parallel. Core remains external in `dist/index.js`. Existing declaration
  output is under `dist/src/`; package entrypoint layout was not changed or
  validated for publication.
- `bun run format:check` reports existing formatting in four unchanged files:
  `src/__tests__/test-utils.ts`, `src/index.ts`, `src/nilyoClient.ts`, `src/plugin.ts`.
- `git diff --check` passed. No existing runtime or test file was modified.

## Remaining exposure

Full `bun audit --json` drops from **46 to 29 advisory records**, with critical
records **4 to 2**. Remaining severities: 2 critical, 10 high, 11 moderate, 6 low.
The audit intentionally exits 1; no findings are suppressed. These records do
not measure exploitable paths or establish a deployed host's security.

Remaining packages: simple-git (3), @simple-git/argv-parser (1), undici 5 (16),
@fastify/busboy (2), ai (1), @ai-sdk/provider-utils (1), jsondiffpatch (2),
pdfjs-dist (1), elliptic (1), esbuild (1). SDK/AI/Git migrations and embedded-code
remediation are tracked separately in **Loop #3420**, as detailed in the source audit.

**Core 1.7.2 embeds Handlebars 4.7.8**: confirmed locally at
`node_modules/@elizaos/core/dist/node/index.node.js` (`var VERSION = "4.7.8"`).
It also bundles crypto implementation code. Updating installed Handlebars/PBKDF2
does not replace these embedded copies. The regression tests exercise installed
Handlebars; the prompt test exercises real core with a mock model and provides
only synthetic compatibility evidence.

Core is a required runtime peer as well as a development dependency, supplied by
the consumer host. CLI/server/AI tooling can become active when starting a host.
Neither a production-only audit nor this lock clears those paths or the embedded
code. Consumers resolve their own graph; this lock does not patch existing hosts.
No live provider/host reproduction, npm publication, merge or deployment was performed.
