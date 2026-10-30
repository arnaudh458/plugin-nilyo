# SDK migration contracts — HumanJuice Loop #3420

This mirrors only the five real-core compatibility/boundary tests from `unipile/uniconnect`, branch `hj/loop-3420-traiter-les-migrations-sdk-restantes-apr`. The full [source assessment](https://github.com/unipile/uniconnect/blob/hj/loop-3420-traiter-les-migrations-sdk-restantes-apr/docs/SDK_MIGRATION_ASSESSMENT_LOOP3420.md) records the artifact, source-rebuild, AI-provider and n8n experiments.

Tests cover state value precedence/unescaped text, template syntax retained as data, constructor access denied by prompt-wrapper defaults, benign AST rejection and small-model/XML contracts. They load the real SDK without SDK mocks; no model/provider calls, executable payloads or large allocations. An absolute `NILYO_AUDIT_CORE_ENTRY` can select an isolated local rebuilt JS entry.

Verified with Bun 1.4.4: frozen install with lifecycle scripts disabled, **19 tests**, TypeScript typecheck, then Bun bundle and declaration generation sequentially. The five added tests also pass against the source core-1.7.2 rebuild containing Handlebars 4.7.10. That rebuild retains elliptic and was not adopted or published. No complete SDK/host security clearance is claimed.

This branch preserves the mirror's additional connectors, context and tests. No manifests, locks, runtime or publishing workflows change. [PR #2](https://github.com/arnaudh458/plugin-nilyo/pull/2) / Loop #3423 independently owns the compatible dependency corrections from [source PR #72](https://github.com/unipile/uniconnect/pull/72); it remains unmerged and is not duplicated here. Remaining migrations require the Loop #3420 decision before a host SDK fork or coordinated majors. No merge, deployment or publication.
