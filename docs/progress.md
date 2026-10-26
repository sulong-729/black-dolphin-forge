# Execution ledger: Cocos AI Toolkit

Plan: /Users/fe-ducphu/cc30-new-all-in-one/docs/superpowers/plans/2026-10-23-cocos-ai-toolkit-plan.md

- User steering: general-purpose Cocos kit. UI IDs -> paths -> editable values -> Cocos IDs is the first deliverable.
- Ruling: prioritize reversible offline UI codec before Editor/build tasks; user explicitly asked for two-way values. Cocos receives restored native serialization.
- Ruling: standalone directory is isolated from game repo; no worktree needed in a new project. No commits/pushes unless requested.
- Ruling: built-in Node test runner replaces Vitest to reduce dependencies. Public implementation remains TypeScript.
- Ruling: offline round-trip of existing nodes/components/records and property/reference edits first. Reject unsupported structural add/delete/rename/reparent rather than corrupt prefab identities.
- Pending: reader/roundtrip tests RED, implementation, CLI/daemon, real-project verification.

## Design steering — implementation paused

- User requested a careful, engine-wide design before continuing implementation.
- Added docs/design.md v2: AI -> kit -> Editor/runtime/build; generic component registry/schema; full reference graph; reversible serialization; source/library navigation; coverage qualification.
- Prototype status: 11 tests passed before pausing. Real BetHistory prefab read-only export: 160 nodes, no-edit byte-identical; unresolved/override warnings block edits. No engine/Editor roundtrip certification.
- Remaining prototype code is not a completed milestone and must not be presented as an engine-wide toolkit.
- Next: design review; user approves v2 before implementation plan update/code resumes.

## Phase/test planning v2

- Added docs/plans/2026-10-23-implementation-v2.md: 8 phases, 17 tasks, owner interfaces and gates.
- Added docs/testing/test-cases.md/.csv/.json: 212 cases, 20 groups, 19 fixture families; every ID referenced by implementation tasks.
- Catalog statuses all NOT_RUN. Prototype test results do not qualify v2 cases.
- Planning-document consistency checks passed; no product/game code changed in this planning step.

## Phase P1 started — explicit user authorization

- Scope: Phase 1 only, tasks 1.1–1.3; no game writes or Editor install.
- User requirement supersedes macOS-only plan: kit must install/run on macOS and Windows. Core transports and paths must be portable; macOS/Windows service installers remain P8. Windows actual execution must not be claimed from path simulation.
- Baseline: build and 11 prototype tests pass.
- Ruling: existing standalone directory is the isolated workspace; no Git commits or push were requested.
- Ruling: retain Node test runner with .mjs tests and compiled TS. Replace the legacy prototype daemon endpoint rather than expose its unqualified editor mutation RPCs in Phase 1.
- Preflight 1.1 -> 1.2: common Envelope/EntityRef/Value schemas and structured errors define registry/snapshot boundaries.
- Preflight 1.2 -> 1.3: dispatcher owns project/snapshot state; CLI/MCP/HTTP all call same dispatcher. Captures pin revision vectors; cursors bind immutable snapshot/query.
- Ruling: P1 tree/formatter tests operate on synthetic normalized payloads, not a Cocos-qualified reader. Production UI mapping is P2; live Editor schema is P3.
- User steering: heavy communication stages may use Go/C++; preserve language-neutral contracts and cross-platform worker boundary. Select by measured latency/throughput/RSS/copy cost, not presumed language speed. Native workers remain optional; no extra daemon or C++ addon required in P1.
- Task 1.1 protocol target: RED observed for missing contract implementation, then 12/12 assertions GREEN (11 catalog cases plus recursive Value validation). Schema artifacts/full-suite gate still pending.

## P1 pre-review implementation evidence

- Task 1.1: versioned envelope/value/entity schemas, server-owned capability policy and on-demand schema discovery; protocol tests RED -> GREEN. JSON schemas generated under src/contracts/schema.
- Task 1.2: canonical project registry, containment, immutable snapshots, signed query cursors, sliding TTL/count/byte budget, bounded text/artifact reads; tests RED -> GREEN. Synthetic tree depth and raw-record paging are separate, explicitly labelled.
- Task 1.3: authenticated loopback RPC, common dispatcher, CLI, six MCP facades, detached daemon lifecycle; real MCP client and CLI processes tested. Legacy prototype Editor mutation endpoints retired; historical codec tests retained offline only.
- Pre-review full check: TypeScript typecheck/build + 42 Node tests PASS on macOS (Node 22.16.0). npm run schemas PASS. Windows CI configuration exists; no Windows execution evidence yet.
- Test harness corrections: canonical temp paths on macOS use /private/var; Host rejection uses native http.request because Node fetch normalizes the supplied Host header.
- Ruling: raw JSON capture is the P1 read foundation; it does not advertise Cocos UI/component/engine qualification. Tree contract uses synthetic normalized children; real UI mapping is P2.
- Ruling: no installer/service installation in P1; portable npm/Node startup provided, OS login auto-start remains P8. Go/C++ acceleration remains optional, benchmark-gated; contracts are shared JSON Schema.
- Final review in progress via fresh-context reviewer; identified error-parity issue will receive a regression test before fix.

## P1 final review and handoff

- Fresh-context reviewer found three Important issues, no Critical issues or deferred minors. No second review was dispatched.
- Final: fixed MCP error parity — actual MCP/CLI/HTTP tests for unknown/malformed/unavailable/forbidden queries RED -> GREEN. All facade policy now executes inside the daemon's shared dispatcher; no second metadata RPC required per MCP query.
- Final: fixed Windows-incompatible Unix fixture — portable real outside-file fixture and nonexistent-outside exact-error regression RED -> GREEN; canonical aliases continue to work. Canonical/escape symlink fixtures use directory junctions on Windows, rather than silently omit those assertions.
- Final: fixed FIFO capture hang — actual macOS FIFO regression RED -> GREEN; only regular files accepted, bounded reads cap growth beyond the byte budget and POSIX nonblocking/no-follow open avoids FIFO/symlink final-target swaps. FIFO-specific test is skipped on Windows; all generic tests remain in its CI job.
- Additional integration verifies actual disk edit/fresh capture, immutable old cursor, batch success/error results and missing-token refusal.
- Final verification after clean dependency install: npm ci --ignore-scripts PASS; npm run check (typecheck/build + 46/46 tests) PASS; npm run schemas PASS. Environment: macOS arm64, Node 22.16.0. Evidence and source fingerprints: docs/testing/evidence/p1/.
- Catalog: 38 P1-scoped cases PASS for their documented core contract/integration scope on macOS; other 174 cases NOT_RUN. Windows execution, Windows ACL verification, live Cocos Editor/runtime, OS service installers and Go/C++ workers remain unqualified/not run or later-phase scope.
- Final: Ruling: reviewer declined live Cocos/native qualification, installers and optional native workers — retain explicit unavailable/later-phase scope; these are not claimed by P1. Cost if wrong: calling this a full engine toolkit would mislead consumers; capability manifest and README explicitly prevent that claim.
- Final: Ruling: Windows implementation/CI target is required but actual Windows qualification remains pending — this Mac cannot establish Windows execution/ACL evidence. Cost if wrong: OS-specific failures may remain until that CI/runner executes; do not advertise a verified Windows release yet.
- No game files changed, no bridge/service installed, no commit, push or publication performed. Work remains in the standalone toolkit folder for review/use.

## Phase P2 started — user authorization

- Scope: tasks 2.1 and 2.2 only. Continue in standalone toolkit directory; no Git repository/branch exists, no game writes or publication requested.
- Preflight 2.1 -> 2.2: immutable graph session owns raw bytes/native identities; patch selectors and typed refs consume that same session, never a client-editable map.
- Preflight P1 -> P2: normalized graph snapshots use the existing bounded SnapshotStore/formatter and shared dispatcher. Runtime-only captures and live component schemas remain unavailable until P3/P6.
- Ruling: Node test runner/.mjs remains the approved alternative to .ts/Vitest filenames in the plan. Existing prototype codec remains compatibility-only; P2 uses new typed graph rather than treating prototype tests as qualification.
- Ruling: unknown/custom serialized classes are inventoried and preserved; editing requires an explicit trusted field schema. P2 fixture schemas qualify only their exact cases, not every component or engine.
- Ruling: engine qualification may write only a standalone synthetic fixture project; original game assets are read-only. In-place write stays unavailable until exact engine/schema qualification. Windows checks remain pending actual Windows execution.

## P2 implementation before final review

- Task 2.1: typed graph/ref table, escaped paths, duplicate names, orphan inventory, bounded malformed hierarchy traversal, unresolved/opaque payloads, business-ID preservation; asset UUID/class/sub-asset resolver and cycle-safe dependency traversal. RED -> GREEN unit/integration assertions.
- Task 2.2: server-owned immutable graph session; typed property.set/reference.bind with expected-before/type/schema/target checks; exact no-edit raw bytes; exclusive separate output; unqualified in-place capability refused. RED -> GREEN assertions.
- Shared graph service is accessible through authenticated CLI/RPC/MCP dispatcher. Default graph.query is compact node summary; component/record/full projections and bounded graph.inspect are explicit. Raw artifacts/native serialization are opt-in operations.
- Snapshot budget now accounts for private graph resource payloads and releases them with the owning snapshot, rather than an unbounded identity-map cache.
- Read-only verification: two synthetic projects and real BetHistory9689 prefab (160 nodes, 1,071 records), no-edit byte-identical; original input hashes unchanged. Real asset was decoded without a full project asset index, with unresolved class/asset findings explicit.
- Live Creator 3.7.3 qualification in isolated .superpowers/p2-creator-project: native Node/UITransform/Button fixture -> native serialization -> toolkit leaf edit x=1 to99 -> engine deserialize -> Editor serializer save -> disk reload. IDs and Button.target retained. Evidence: docs/testing/evidence/p2/creator-report.json. This is Editor engine serializer evidence, not Inspector/prefab-stage/Asset DB qualification for all classes.
- Ruling: engine experiment uses a qualification-only extension in a disposable synthetic project, not installation of the P3 bridge into any game. Cost if wrong: engine fixture evidence would be overgeneralized; generic writer remains engineQualified=false and in-place unavailable.
- Ruling: nested prefabs are represented as serialized source-document/dependency graphs with distinct namespaces; effective instance override computation remains P3. Cost if wrong: treating base serialized values as live effective values would target the wrong owner; output explicitly labels effectiveValuesQualified=false.

## P2 final review, fixes and evidence

- Fresh-context final reviewer (gpt-6-astra): 5 Important findings, no Critical. One fix pass; no re-review dispatched.
- Final: fixed opaque data loss on edited restore — source token-range splicing replaces whole-document JSON stringify; unrelated 1e400 and 9007199254740993 lexemes remain exact. Regression RED -> GREEN.
- Final: fixed native asset expectedType weakening — original concrete tag cannot be dropped/weakened through a generic asset schema. Regression RED -> GREEN.
- Final: fixed mutable/incomplete freshness baseline — graph freezes captured dependency fingerprints and inventory revision; separate output rescans inventory so metadata additions/removals/conflicts invalidate it. Canonical index roots avoid /var vs /private/var false staleness. Two regressions RED -> GREEN.
- Final: fixed hidden structural references — raw reference validation runs independently of opaque projection; invalid Prefab.data, Node._prefab and malformed parents produce findings and block edits, while no-edit bytes remain preserved. Regression RED -> GREEN.
- Final: fixed unsafe traversal/work — loop-based wide-array traversal; indexed sibling/child/active relations; path, value-count and expanded projection budgets. Wide arrays, 6,000-node parent-read bounds and deep-path limit regressions RED -> GREEN.
- Final full verification: npm run check => typecheck/build and 89/89 tests PASS on macOS arm64/Node22.16.0. npm run schemas PASS. Two synthetic read-only fixtures + real160-node prefab still byte-identical. Actual MCP SDK client capture/query/resolve/inspect demonstration PASS.
- Re-ran the live Creator3.7.3 experiment after writer fixes: native IDs and Button.target survived toolkit x=99 edit, engine deserialize, Editor serialization, disk reload. Owned Editor process stopped afterward; only synthetic project/kit files were written.
- Final: minor (deferred): graph.restore returns nextOffset but continuation is via graph.original; public modified restores unavailable. A qualified restore-artifact continuation is deferred; README states the current route.
- Final: Ruling: MAP-009 runtime-only identity cannot be qualified by the offline decoder — P2 explicitly refuses runtime input; actual runtime identity remains P6. Cost if wrong: a fake disk identity could be mistaken for a live object; no such mapping is advertised.
- Final: Ruling: PREF-002..004 Editor acceptance remains unqualified despite passing serialized nesting/source/override preservation assertions — P3 must verify prefab stages/effective owners. Cost if wrong: base-source inventory could be mistaken for an effective instance; current output labels this limitation.
- Final: Ruling: reviewer declined Windows, generic component/Inspector/prefab-stage/Asset DB acceptance — retain NOT_RUN beyond the exact macOS fixture evidence. Cost if wrong: consumers could overestimate portability or writer scope; these are excluded explicitly.
- Final: Ruling: reviewer declined live edit/import/reconnect, runtime/native/build, and source-range navigation qualification — retain unavailable/later P3–P8 scope. Cost if wrong: offline safety might be mistaken for owner-process atomicity or live source accuracy; no such claim is made.
- P2 delivered as v0.2.0 offline core with exact fixture qualification, not a generic writable engine adapter. No game writes, Git commit/push, OS service installation or publication.

## Phase P3 started — user authorization

- Scope: tasks 3.1/3.2, read-only live Editor sessions and generic component reflection. Baseline: 89/89 tests PASS.
- Preflight P1/P2 -> P3: preserve authenticated shared dispatcher and bounded snapshots; live Editor data must never masquerade as offline serialization.
- Preflight 3.1 -> 3.2: session/stage/schema revision binds all requests and invalidates snapshots; schema discovery does not grant mutation permission.
- Ruling: continue in existing standalone non-Git toolkit, with Node .mjs tests. No game edits, commits, pushes or OS service installation. Cost if wrong: no branch-based rollback; all changes remain in this isolated folder.
- Ruling: only Creator 3.7.3 plus explicit feature probes is supported initially; other versions fail closed. Windows remains a target, not a tested platform on this Mac.
- Ruling: bridge accepts an allowlist of read commands, bounded payloads, explicit sessions and server-issued leases; no eval or arbitrary method forwarding. Large captures fail with RESOURCE_LIMIT instead of silently truncating.
- Ruling: actual engine reflection, Editor stage/Inspector parity and nested prefab provenance require separate evidence; contract tests alone cannot qualify them.

## P3 implementation and live qualification in progress

- Session contracts: two-session/foreign-project routing, version/probe gates, leases, allowlisted reads, revision/schema/stage invalidation, disconnect/reconnect, import gate, queue/result/time limits and daemon shutdown.
- Shared RPC/MCP query policy: bridge control operations are local authenticated configuration actions, rejected through query facade. Editor snapshots expire with their session/state; mutation operations remain unavailable.
- Generic reflection uses the actual engine constructor maps, inherited attribute metadata and own data descriptors. No arbitrary constructors/getters/source execution. Shared objects/arrays retain local identity; known native metadata omitted, business IDs retained.
- Actual Creator probes found compatibility and safety issues: Object.hasOwn unavailable in Electron; namespace registry differs from deprecated js.js; engine getClassName calls user toString and crashed on DragonBones base. Regression tests cover the fixes.
- Schema array factories are syntax-inspected only for empty array factories; arbitrary factories are never invoked and unsupported shapes remain unknown. AST inventory is supplemental syntax evidence, not authoritative binding/source resolution.
- Ruling: read-only observation does not authorize mutation or certify generic roundtrip. Unavailable getters/opaque/external references/budget omissions are explicit. Cost if wrong: schema coverage could be mistaken for writable compatibility; all P3 coverage keeps write/roundtrip false.

## P3 final review — one fix pass

- Fresh-context final reviewer (gpt-6-astra): three Important findings, no Critical. No re-review dispatched.
- Fixed stale node revisions: rotation/scale/layer and generic declared node fields now contribute to captures; Editor change broadcasts and private observed object identities contribute to revision changes. Already-dirty edit regression RED -> GREEN.
- Fixed reflection side effects: metadata arrays use own-data descriptors (no custom map/iterator); util.types.isProxy guards constructor/prototype/metadata/property traversal before traps. Getter/proxy/iterator regression RED -> GREEN.
- Fixed real MissingScript leakage: registered cc.MissingScript fallback is opaque, _$erialized is omitted, native IDs remain engine-private. Regression RED -> GREEN.
- Additional real-engine finding: director scene contains Editor helper trees; DontSave subtrees are explicitly excluded/countable and inactive document nodes retained. Inspector parity regression RED -> GREEN.
- Active prefab stage uses the Editor's queried tree root and EditorExtends.Node.getNodesInScene rather than assuming an asset UUID is the director Scene ID. Stage changes during context queries/read requests fail closed with STALE_REVISION.
- Qualification harness now waits for successful fixture/script creation, commits Inspector undo snapshot so dirty state is meaningful, uses one exclusive fixture lock, and terminates only its own synthetic Creator child after a graceful timeout. No game Editor is targeted.
- Actual Creator 3.7.3 compiled custom/inherited TypeScript fixtures: 319 unique registered constructors, 102 Component constructors, typed nullable Node and Node arrays, flags/former name/enum metadata observed. Scene has 3 document nodes; Inspector x=0 ->99, dirty true, inactive child retained; prefab editing stage observed separately. Final rerun/evidence manifest follows.
- Ruling: full nested-prefab override evaluation/package source provenance, actual two-Editor/reload/reconnect/import-transition and Windows acceptance remain NOT_RUN beyond their contract fixtures. Cost if wrong: passing local read-only fixtures could be mistaken for complete engine qualification; catalog and coverage retain explicit limits. Source navigation remains P4; all mutation/roundtrip/build/runtime capabilities stay unavailable.

## P3 final verification — v0.3.0 experimental read adapter

- Final full check: typecheck/build and 113/113 executable tests PASS, macOS arm64, Node22.16.0. Includes actual MCP SDK -> authenticated HTTP -> explicit Editor owner queue, CLI snapshot reads, query-facade control refusal and disconnect expiry (controlled owner fixture).
- Final npm run qualify:editor PASS on actual Creator3.7.3. 319 unique registered constructors /102 Component constructors; compiled KitFixtureBase/KitFixture inheritance. Actual Inspector edit x=0 ->99, dirty true, original disk bytes unchanged, old snapshot expired; actual scene -> prefab editing stage invalidates prior scene snapshot. Creator log and detailed native dumps are separate evidence artifacts.
- npm run schemas PASS. Evidence/source fingerprints at docs/testing/evidence/p3/manifest.json; scoped report at report.json. Catalog now 84 PASS /128 NOT_RUN across212 cases, distinct from113 executable tests.
- P3 read slice is implemented and independently reviewed; full lifecycle/nested-prefab/package-origin/Windows matrix remains unqualified. Next planned implementation is P4 Source Navigator, not mutation.
- Only standalone toolkit/synthetic fixture files were edited. No game source/assets, commit, push, OS service, login auto-start or publication. Owned synthetic Creator/daemon stopped after qualification; no endpoint credentials retained in report.

## P4 started — Source Navigator

- User authorized next phase. Scope tasks4.1/4.2, standalone non-Git toolkit; no game/engine writes, publication or OS-service installation.
- Baseline: typecheck/build +113/113 tests PASS on this Mac. Existing .mjs/Node test-runner convention continues.
- Preflight P3 ->4.1: registered class names map to static declarations; ambiguous/missing matches must remain explicit. Live schema is not permission to edit vendor/project code.
- Preflight4.1 ->4.2: immutable captured source contents, compiler symbols and hashes own all ranges, references and paged slices; refresh checks inventory/content before reuse.
- Ruling: TypeScript compiler host reads only bounded, canonical captured project/package/selected matching-version engine roots; no project modules/plugins are executed. Cost if wrong: unusual custom module resolution may remain unresolved, rather than escaping read permissions.
- Ruling: Node snapshots retain source index privately and charge a conservative memory estimate; large projects fail budget checks. Full Windows execution remains unqualified here.

## P4 implementation before final review

- Task4.1: bounded canonical project/package/explicit engine source inventory, selected-version fingerprint, sealed TypeScript compiler host (no fallback disk reads/plugin execution), registered class names, aliases/reexports/inheritance, owner/version/hash/ranges and declaration-only/compiled labels. RED -> GREEN.
- Task4.2: semantic symbol references (including renamed imports and compiler root symbols), explicit dynamic-edge findings, bounded 6000-character lossless source slices, restricted source-map original points, serialized ClickEvent receiver/handler linkage, graph-selected component -> source. RED -> GREEN.
- Every source navigation query rechecks inventory/content; graph bindings verify disk graph and dependency fingerprints. Source read permissions never grant source/vendor mutation permissions.
- Actual selected Creator3.7.3 source index:1077 files/~10.4MB,1229 static class declarations, project KitFixture inheritance, package-owned fixture and cc.Button/cc.UITransform method/class locations. This is static compiler/source evidence, distinct from319 live registered constructors in P3.
- Ruling: source maps qualify mapped points into captured source only; external/embedded maps and absent originals remain unavailable. No original method range is invented. Cost if wrong: compiled and original bodies could be confused; output retains compiled location/kind and mapping precision.
- Ruling: Windows source path implementation remains target-only until an actual Windows run. No C++/Java/native binary source adapter is advertised.

## P4 final review — one fix pass

- Fresh reviewer gpt-6-astra:6 Important findings, no Critical;2 Minor findings. No re-review dispatched.
- Six regression cases observed RED -> GREEN: selected-engine cc import/ancestor/member resolution; stale graph when new asset metadata changes inventory; nonempty ClickEvent componentId precedence; source-map unmapped-span boundaries; literal element semantic references; dynamic component-name findings.
- Minor callable fixes also included: static methods and arrow-property bodies are navigable; accessor bodies are not treated as callable ClickEvent handlers.
- Permission regression RED -> GREEN: engine version source containment checked before reading through directory symlinks. Captured project Creator version is checked against selection; source.capture reads current project metadata rather than stale registration metadata.
- Actual measured bottleneck: compiler directory existence scanned all files for every resolution probe. Canonical directory Set + TypeScript module-resolution cache reduced this engine fixture's index construction from~17.9s to~1.3s; no Go/C++ worker justified by the resulting measurement. This is a fixture measurement, not a global performance guarantee.
- Final actual engine-source qualification additionally follows KitFixture -> cc.Component and inherited getComponent through the selected cc module. Static source evidence remains separate from running Editor/gameplay evidence.

## P4 final verification — v0.4.0 Source Navigator

- Final npm run check PASS: typecheck/build and131/131 tests on macOS arm64/Node22.16.0. No test skips/failures.
- Final npm run qualify:source PASS: installed Creator3.7.3 static source,1077 files/~10.4MB/1229 class declarations, selected-engine cc module, real project/package source and inherited engine method locations. Actual source index construction~1.28s in this run.
- Actual MCP SDK -> authenticated HTTP daemon source capture/class/member/reference queries PASS. Final measured capture~1.87s; class/method lookups~0.25s; references~0.49s for this fixture. Timings are per-run observations, not guarantees.
- npm run schemas PASS; evidence and fingerprints in docs/testing/evidence/p4/. Catalog98 PASS/114 NOT_RUN across212 cases, distinct from131 executable tests. P4 catalog scope is static compiler/controlled integration; no runtime/Windows qualification implied.
- P4 tasks4.1/4.2 completed for documented source scope. Source-map output maps captured original points only; custom generators, external package roots and native-language adapters remain unavailable. All source/engine mutation capabilities remain disabled; P5 is next.
- No game or engine files written. Synthetic fixture package and standalone toolkit only. No commit/push/publication/service installation; MCP verification client/daemon closed and temporary state removed.

## P5 execution — 2026-10-26

- Base: fa7e569; branch codex/phase5-mutations, existing standalone checkout. Ruling: retain the existing working directory and isolate changes on a feature branch rather than creating an unsolicited worktree. No main edits or automatic push.
- Skills: executing-plans and test-driven-development. Spec: docs/design.md sections 9, 12, 13. Tasks 5.1/5.2.
- Pre-flight: proposal/policy -> owner transport must carry pinned session, document, schema and before revision. Read responses cannot acknowledge a revision-changing command using the read-only response rules.
- Ruling: P5 enables only individually qualified scene property/reference/rename adapters, with closed capability contracts. Nested prefab, add/remove/reparent, array, asset and source mutation remain explicitly unavailable until their own engine qualification; a recovery framework is not full-engine write coverage.
- Ruling: approval is a local CLI action on the exact immutable proposal hash; no RPC/MCP authorize endpoint and no caller `approved` flags. A model with arbitrary local shell already has the user's OS authority; sandbox/host policy must restrict that separately.
- Ruling: current phase never implicitly saves. Save/Undo/reload are tested by the isolated qualification harness, while public proposals have save=false. Owner writes are synchronous, setter-based and recorded through Creator's current scene facade.
- Ruling: Python remains preferred for workers with materially stronger libraries; no Python/Go/C++ worker is needed for Editor mutation ownership/serialization, which must execute inside Creator JavaScript.

- Native debugging: actual Creator Electron lacks Object.hasOwn and crypto.randomUUID; compatibility regression now covers both. Button.target null uses public-setter behavior but verifies the explicit serialized _target alias, because the public getter falls back to the owner node.
- Ruling: rename is a separate single-step proposal; callers recapture paths before later edits. This avoids reusing path labels across a structural change within one qualified batch.
- Review: the requested fresh reviewer failed before examining code due to account usage limit. No independent review verdict exists. Continue a separate author review and report that limitation; do not imply an independent pass.

- Task 5.1: implemented for the documented adapter set. RED/GREEN logs include protocol schema/approval gates, stale owner/type/range checks, Electron compatibility, Button serialized-null behavior, rename inverse, reentrant hierarchy and unsupported rename batches. Actual MCP/HTTP/local CLI approval and durable replay tested with controlled owner.
- Task 5.2: recovery/idempotency/checkpoint foundation and qualified node.rename implemented. Full node create/remove/reparent, component/dependency, array, nested-prefab, asset and source edit adapters are NOT COMPLETE and remain unavailable. Do not advance the full-write acceptance claim from this scoped core result.
- Native qualification: PASS_SCOPED on Creator 3.7.3/macOS arm64. Node.position/active/name; Button.target/interactable; UITransform.width/height; UIOpacity.opacity; proposal does not alter Editor/disk; unapproved apply refused; duplicate apply replays result; Undo/redo; reference inverse; explicit save and actual replacement-owner reload with preserved reference. No game project touched.
- Native finding: deferred engine callbacks after a UI batch can invalidate the full checkpoint fingerprint. This correctly blocks inverse recovery. Harness restores that batch via a new exact, explicitly approved proposal; it does not refresh old checkpoints or weaken conflict detection.
- Final review: author self-review after independent reviewer failed before examining code (account usage limit). Findings fixed with regression checks: Electron API compatibility, Button getter fallback, rename path identity, reentrant hierarchy and batch scope. This is not an independent review pass.
- Verification: npm run check -> 147/147 PASS; npm run schemas -> PASS; npm run qualify:mutations -> PASS_SCOPED; git diff --check -> PASS. Catalog 212 cases: 106 scoped PASS / 106 NOT_RUN. Windows, native fault injection and the remaining Task5.2 adapters are not qualified.
- Source retained on codex/phase5-mutations in the standalone checkout; no automatic merge or push.

## P6 execution — 2026-10-26

- Base 21a4991 (P5 core preserved as local commit), branch codex/phase6-runtime in existing standalone checkout. User explicitly requested the next phase. P5.2 write exclusions remain enforced; P6 observes runtime independently of those unavailable write adapters.
- Skills continuing: executing-plans, test-driven-development and verification-before-completion; spec docs/design.md runtime/domain requirements; Tasks6.1/6.2.
- Pre-flight: runtime snapshots reuse immutable SnapshotStore but need their own preview namespace/session leases, scene epoch and frame/time window. Runtime frame advancement must not masquerade as Editor revision changes; reconnect/scene change must invalidate identities.
- Ruling: web preview gets a separate, opt-in, project/origin-scoped credential. Never place the daemon's root credential in a browser or widen the general RPC Origin policy. Preview route permits only runtime reads/control exchange, no asset/source/Editor mutations.
- Ruling: no automatic project/release injection. A browser-only adapter is explicitly attached with Cocos environment guards. Actual Windows/native/device execution and unqualified runtime actions remain unavailable and are not inferred from web preview.
- Ruling: observations do not call Widget.updateAlignment, Layout.updateLayout, activate nodes, play audio/animation, synthesize input or pause/step. These actions require their own qualified typed authorization path.
- Final P6 review: fresh independent reviewer returned three Important findings, no Critical/Minor. Reproduced all three RED: A→B→same-A epoch/handle alias, stop during a two-job batch, and no-op/uninitialized physics zero velocity. One fix pass now allocates a new epoch on every root transition, guards all post-await/frame/send paths after cancellation, and verifies a real initialized wrapper plus finite sentinel output before reporting physics velocity. Targeted runtime suite 15/15 GREEN.
- Final-review rulings: screenshots/viewport parity remain actual-browser qualification; native/device/Windows/release-artifact exclusion are NOT_RUN unless separately executed. Source correspondence remains unresolved, actions/Spine/controller/native counters remain unavailable, custom getter overrides/other engine versions are not qualified. Existing suite is verified separately, not inferred from the reviewer.

- Verification: npm run schemas PASS; npm run check 162/162 PASS (0 skip); git diff --check PASS. Catalog 212 cases: 120 scoped PASS / 92 NOT_RUN. P6 report includes explicit per-case limits.
- Actual Creator3.7.3/macOS web preview: owned synthetic project, render canvas 720x1280 -> 720x1920 -> 720x1280; long panel height1080 ->1720 ->1080; short controls remain200 high; footer330 ->650 ->330 and hidden40px. Reference/restored geometry equal. Fixture alone updates its canvas/camera on resize; observer never forces alignment/layout.
- P6 read-only core qualified; Task6.2 action adapters, native/Windows/release-artifact qualification and source correspondence remain incomplete/unavailable. No game files changed, no automatic merge/push.
- User requested pause after this phase. Owned preview Creator child/server stopped, browser viewport reset and ephemeral tab closed. P7 has not started.

## P7 execution — 2026-10-26

- Base a0cc2d0: P6 retained as local commit; branch codex/phase7-build-jobs, standalone checkout. User resumed after pause and requested next phase. No game files or shared branches touched.
- Skills: executing-plans and test-driven-development. Spec docs/design.md sections13-15, Tasks7.1/7.2.
- Pre-flight: P5 MutationPolicy exact local hash approval is reused by build.propose/job.start; job facade cannot become an authorization bypass. No client shell/executable/output fields accepted in job.start. Python worker owns closed doctor/validate/export protocol tasks; Creator logs on stderr.
- Ruling: unique private output and content fingerprints; no cache reuse in P7. Changes to project, configured engine tree, executables, profile or worker invalidate approval/output. Generated project import/cache may change on first Creator run, requiring a fresh exact proposal; never silently refresh a baseline.
- Ruling: native device build/install/launch and profiler adapters remain explicitly unavailable until exact SDK/device qualification. No first-device selection, arbitrary backend command, fabricated counter or native crash inference.
- Ruling: Python handles closed build tasks and actual Creator invocation, while TypeScript owns persistent lifecycle/authorization/locks/artifacts. Process tree cancellation uses owned live child groups (POSIX); Windows taskkill branch is implemented but not qualified on Windows. Restart marks active jobs interrupted; no PID registry killing or automatic replay.
- Final independent P7 reviewer found one P1 (log append rejection crashes daemon) and three P2 (engineRoot not selecting actual engine; symlinked output root; pre-start refusal misreported/consuming proposal). All reproduced in /tmp/cocos-p7-review-red.log plus envelope regression. Fix pass handles log rejection immediately and terminates owned job, passes --engine with fingerprinted root, validates canonical output root, preserves known refusal/error/retry and uses an indeterminate envelope only for uncertain starts.
- Additional lifecycle regression reproduced: cancel during asynchronous stage-journal persistence could launch a late worker. Pre-spawn cancellation guard now prevents this. POSIX group test also covers leader exit before descendant shutdown; UTF-8 stream test covers chunk splits.
- Actual engine qualification finding: engine bin/.cache/dev and bin/.cache/logs are generated Editor preview state, rewritten during Creator startup even when Web sources are stable. Ruling: fingerprint full explicitly selected engine root, with only bin/.cache excluded in addition to root generated state; preserve code/export/dependency hashing. Actual Web builder receives --engine; no output cache reuse is claimed. Initial full-cache-inclusive attempts correctly produced stale failures; they are not passing evidence.

- Final verification: npm run schemas PASS; npm run check 185/185 PASS, zero skipped; 23 focused P7 tests PASS. Whole branch review findings reproduced RED then corrected; no second independent review claimed. git diff --check and local manifest integrity verified.
- Actual final Creator3.7.3/Python3.9.6 Web Mobile pipeline with explicit --engine: first import correctly marked output stale; second freshly reviewed proposal succeeded with unchanged source/engine fingerprint. Built output opened in browser, expected fixture text visible, no observed warning/error console entries. Browser smoke is separate from build; no native/gameplay/performance acceptance.
- Catalog212:139 scoped PASS/73 NOT_RUN. Task7.1 Web/Python job core delivered; cache reuse/separate native compile-package still pending. Task7.2 diagnostic reads delivered; native install/launch/capture/profiler and complete source-to-runtime correspondence pending/unavailable. Windows NOT_RUN.
- Owned build workers/Creator child and ephemeral browser server/tab closed. No game project changed; no shared push/merge; source retained on codex/phase7-build-jobs. P8 not started.
