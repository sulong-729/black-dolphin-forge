# Black Dolphin Forge — Cocos AI Toolkit

A standalone foundation for AI ↔ toolkit ↔ Cocos. Core language: TypeScript/Node.js. Python workers and optional Go/C++ workers share versioned contracts; no native worker is needed to run the current core.

**Platform target: macOS and Windows.** Core tests have been run on macOS. A Windows CI job is provided but has not been run or qualified here. Creator 3.7.3 has experimental Editor and opt-in web preview bridges. Version0.8 adds portable packaging and explicit user-service plans; actual OS login/reboot qualification remains pending.

## Install and run

Install Node.js 22.16+ and run these commands in this repository, in Terminal, PowerShell or CMD:

```text
npm ci
npm run check
node dist/cli/main.js daemon start
node dist/cli/main.js project register "<absolute project folder>"
node dist/cli/main.js project list
node dist/cli/main.js describe
node dist/cli/main.js daemon status
node dist/cli/main.js daemon stop
```

`daemon start` detaches a local process; it does not install an OS service. Start it again after reboot. Start/status output omits credentials. macOS state lives in `~/Library/Application Support/Cocos AI Toolkit`; Windows state in `%APPDATA%\Cocos AI Toolkit`. Set `COCOS_AI_STATE_DIR` for an isolated instance. State files contain a private local token; keep the directory within your user profile. Unix permissions are enforced; Windows inherited profile ACLs need verification on an actual Windows runner.

## MCP

Start the daemon first. Configure your MCP client to launch Node with absolute paths:

```json
{
  "mcpServers": {
    "cocos-ai": {
      "command": "node",
      "args": ["<absolute toolkit folder>/dist/cli/main.js", "mcp"]
    }
  }
}
```

Use Windows-style paths escaped as JSON on Windows, for example `C:\\Tools\\cocos-ai-toolkit\\dist\\cli\\main.js`. The six facade names are `cocos_describe`, `cocos_query`, `cocos_propose`, `cocos_apply`, `cocos_job` and `cocos_artifact`. Describe/query/artifact reads are available. Phase 5 adds scoped Editor proposals and apply after exact local approval; the job facade adds the qualified Web Mobile pipeline described below. `project.register` is a local configuration action available through CLI/authenticated RPC, not the query facade.

All MCP facade policy is evaluated by the same daemon dispatcher. HTTP callers can supply `X-Cocos-Tool: cocos_query` for the same read-only facade restrictions; `node dist/cli/main.js query "<JSON envelope>"` uses that restriction too. Raw authenticated RPC/CLI `rpc` also supports local project registration and daemon lifecycle.

`cocos_describe` accepts `{}` or `{"operation":"snapshot.query"}`. Read tools accept a request envelope:

```json
{
  "request": {
    "formatVersion": 1,
    "requestId": "read-1",
    "operation": "project.list",
    "source": "disk",
    "params": {}
  }
}
```

Use `describe <operation>` for its runtime-validated input schema and result-envelope schema. RPC uses the same envelope at `POST /v1/rpc`, loopback only, with the local endpoint's Bearer token. Browser Origins are refused. There is no arbitrary shell/eval endpoint.

## Read a JSON document

1. Register a project; retain its `id`.
2. Call `document.capture` with that `projectId` and `params: {"path":"assets/UI.prefab"}`.
3. Call `snapshot.query` with `params: {"snapshot":"<returned id>"}` and the same project.
4. Follow `nextCursor` without changing the query. JSON fragments are reconstructed by concatenating `text` while `offset` increases; a reset to zero starts the next page. Parse complete pages, not individual fragments.
5. `artifact.read` with `{snapshot,kind:"data",offset:0}` retrieves the full original captured JSON, or `kind:"warnings"` retrieves warnings. Follow `nextOffset` to reconstruct the artifact.

Capture is raw JSON only, **not a qualified Cocos graph reader**. `snapshot.query` defaults to records, max 50 per page. Optional `mode:"tree"` accepts synthetic normalized `{children:[...]}` trees, default depth 2; omitted children remain available through the data artifact. For Cocos source graph mapping, use the Phase 2 operations below.

Snapshots are immutable with sliding 5-minute TTL, LRU 10 entries and 128 MiB stored-payload budget. Cursor/handle expiry is explicit. Fresh captures hash actual read bytes; old pages keep their old revision. Qualification is scoped to documented fixtures; compare-and-apply remains unavailable.

## Plans and evidence

- [Design](docs/design.md)
- [Implementation plan](docs/plans/2026-10-23-implementation-v2.md)
- [Execution ledger](docs/progress.md)
- [Test catalog](docs/testing/test-cases.md)

`npm run schemas` regenerates JSON Schema artifacts. `npm run check` typechecks, builds and tests using portable Node commands. CI targets macOS and Windows; a configuration file does not establish a passing Windows run.


## Phase 2: Cocos source graphs

`graph.capture` reads Creator **3.7.3 source** `.prefab`/`.scene` files. Native storage identities stay inside a server-owned session. The AI view uses paths, snapshot-scoped handles, typed properties and asset references; user data such as `id`, `uuid` and `fileId` stays unchanged. Compiled/build serialization and live runtime snapshots are excluded.

Discover schemas without dumping engine metadata:

```text
node dist/cli/main.js describe graph.capture
node dist/cli/main.js describe graph.query
node dist/cli/main.js describe graph.inspect
```

Send these through the same RPC envelope, CLI `rpc`/`query`, or MCP `cocos_query`:

| Operation | Params | Result |
| --- | --- | --- |
| `graph.capture` | `{path:"assets/UI.prefab"}` | Snapshot, source/dependency revision and coverage |
| `graph.query` | `{snapshot}` | Compact node summaries, default depth 2/max 50 |
| `graph.query` | `{snapshot,kind:"components"}` | Component summaries |
| `graph.query` | `{snapshot,kind:"all",projection:"full"}` | Paged typed entity inventory, including orphan/storage records |
| `graph.resolve` | `{snapshot,target:"/Root/Child"}` | Exact reference tuple and summary; ambiguous names fail |
| `graph.inspect` | `{snapshot,target,fields:["_top"]}` | Selected serialized fields, bounded JSON fragments |
| `graph.restore` | `{snapshot,patches:[]}` | Original native serialization, first bounded chunk |
| `graph.original` | `{snapshot,offset:6000}` | Continuation of original raw bytes as UTF-8 text |

Always include the registered `projectId` in the envelope. Node paths escape slash/tilde/bracket/hash; duplicate siblings have explicit ordinals. Paths are labels: retain the returned full `EntityRef` when applying a library patch. A ref from another capture/project is rejected, even if the path matches.

Fragments follow the same reassembly rules as `snapshot.query`: concatenate chunks until `offset` resets for a new page; inspect `nextCursor`. Full records are not duplicated in structured/text content. `graph.query` includes omitted counts, while explicit full projection and raw operations provide recovery.

### Offline restore library

`decode()` returns an immutable `GraphDocument`. `dryRunRestore(document, patches)` accepts only `property.set` and `reference.bind` against **trusted field schemas supplied by kit code**. Selectors are arrays of `{field}` / `{index}` segments. Type, subtype, nullable, scope, expected-before and overlap checks run before output. Unknown/opaque writes, malformed hierarchy, unresolved refs, prefab overrides and structural operations are refused.

`writeSeparate()` rechecks source, inventory additions/removals and immutable captured dependency fingerprints and creates an exclusive new file; it never overwrites existing output/source. No-edit restore returns the original UTF-8 serialization exactly. Edited restores replace only selected JSON value-token ranges, preserving untouched bytes, including opaque numeric spellings. `applyInPlace()` and public `graph.apply` stay unavailable. Public graph capture does not accept schema injection and supplies no write schemas, so modified public restores cannot grant themselves write access. This prevents a client-provided schema or approval flag from bypassing qualification.

The offline `inventoryPrefabs()` library traverses source prefab dependencies with cycle/document/byte budgets. It returns separate document namespaces and explicitly does not compute effective nested-instance overrides. Live class schemas and prefab editing stages belong to P3.

### Qualification and limits

The standalone Creator **3.7.3/macOS** experiment generated a Node/UITransform/Button prefab using the Editor serializer, changed `Node._lpos.x` from 1 to 99 through the kit, then engine-deserialized, Editor-serialized and disk-reloaded it. Native node IDs and `Button.target` binding remained intact. This qualifies that exact fixture flow, **not every component**, Asset DB/Inspector stages, Windows, runtime or native gameplay.

Two synthetic projects plus the real BetHistory9689 prefab (160 nodes/1,071 records) also passed no-edit byte equality; the game asset was read-only, with unresolved classes/assets reported explicitly. The generic writer continues to report `engineQualified:false`.

- [P2 report and coverage](docs/testing/evidence/p2/report.json)
- [Creator fixture evidence](docs/testing/evidence/p2/creator-report.json)
- [Read-only verification](docs/testing/evidence/p2/read-only.json)

The qualification-only extension lives in a generated synthetic project, not the game. `scripts/prepare-creator-qualification.mjs` prepares that project; launching Creator is an explicit manual qualification step and is excluded from ordinary CI tests. Engine-generated fixtures are preserved in `tests/fixtures/roundtrip/creator`.


P2 review resolved five Important findings with eight failing-then-passing regression tests. One minor continuation issue remains: `graph.restore.nextOffset` is consumed through `graph.original`, rather than by calling `graph.restore` with an offset. Production modified restores remain unavailable; a future qualified restore artifact will unify this continuation.

The P2 catalog report separates passing offline assertions from pending live runtime/nested prefab-stage cases. A passing source dependency inventory does not certify effective Editor overrides.


## Phase 3: read-only Editor bridge

The bridge in `extensions/cocos-ai-bridge` runs only with explicit local `config.json`. It is tested in a standalone synthetic project; it has not been installed into a game. See [Editor bridge](docs/editor-bridge.md) for the wire contract, setup, qualification and limits.

- `editor.sessions` (disk source) discovers live sessions for a registered `projectId`.
- `editor.query` (editor source) accepts `scene.capture`, `schema.list` or `schema.describe`. Set the returned `session`; ambiguous multiple sessions are refused.
- Results return a bounded snapshot. Read it through `snapshot.query` or `artifact.read`, keeping the same project/source/session scope.
- Schema inventory uses registered constructors and inherited Cocos metadata, without instantiating classes. Reads use data descriptors; arbitrary getters, proxies and missing-script payloads are unavailable. Unknown shapes remain explicit.
- A session/stage/schema/revision change expires dependent Editor snapshots. Disk snapshots remain independent. Polling is an observation, not a mutation transaction or native/runtime guarantee.
- The Phase 3 read adapter does not itself grant writes. Phase 5 adds separate qualified mutation operations below. Build jobs, Windows execution and complete nested-prefab acceptance remain pending.


## Phase 4: Source Navigator

AI uses the same MCP facade and authenticated local RPC for source navigation. Start with `source.capture`, select a matching engine root when needed, then keep its snapshot for class/member/reference/body queries. The compiler reads captured files only; it does not execute project modules or plugins.

The current adapter connects normal `import ... from 'cc'` to the selected engine, follows aliases/barrel exports/inheritance, links serialized ClickEvent receivers, and pages source bodies with file hashes. Declaration-only, compiled/minified, missing source-map originals and dynamic edges are explicit. Source read access does not enable any mutation capability.

See [Source Navigator](docs/source-navigator.md) and [P4 evidence](docs/testing/evidence/p4/report.json). Actual selected Creator3.7.3 source tests are static compiler evidence; Windows execution and native-language adapters remain unqualified.


## Phase 5: reviewed Editor mutations

Version 0.5 adds a proposal → local approval → owner compare-and-apply → read-back flow. See [mutation guide](docs/mutations.md). The feature branch qualifies a small public-property adapter set on Creator 3.7.3 plain scene instances. This is not blanket write support for all components or the full structural/prefab/asset/source scope of Task 5.2. Those operations remain refused. No implicit save, source rewrite, auto-unpack or arbitrary method execution is available.

`npm run qualify:mutations` creates an isolated synthetic project and checks live setter behavior, Undo/redo, references, inverse proposals and explicit save/reload. It never targets a registered game project. macOS evidence and Windows coverage must be reported separately.

## Phase 6: runtime observations

Version 0.6 adds opt-in Creator 3.7.3 web preview capture, session-scoped handles, frame windows and UI diagnostics. Animation, render, physics, audio and input adapters expose qualified read-only component state. See [runtime guide](docs/runtime.md) for scoped credentials, bootstrap and domain limits.

Runtime actions, native profiling and automatic Editor/source correspondence remain unavailable. Captures never force Widget/Layout updates or activate inactive nodes. Actual preview qualification uses an isolated fixture; it does not qualify native devices or Windows.

## Phase 7: build jobs and diagnostics

Version 0.7 adds locally configured Creator 3.7.3 Web Mobile jobs using a Python 3 worker. Build proposals share exact local hash approval with Editor mutations. Jobs persist state, provide owned cancellation/timeout, reject stale inputs and expose bounded logs/output manifests. Interrupted projects require explicit local reconciliation. See [build guide](docs/build.md).

Actual synthetic Web Mobile build and a separate browser smoke check are qualified on macOS. Toolkit output-cache reuse, Android/iOS build/install/launch, profiler capture, full diagnostic component correspondence and Windows execution remain unavailable or unqualified. No native-device claim follows from the Web build.

## Phase 8: distribution and measured scope

Version0.8 adds checksummed portable packaging, versioned install/upgrade/rollback/uninstall, explicit macOS/Windows user-service plans, startup daemon-log rotation, terminal artifact pruning and a distributable AI skill. Choose tools per task: use `rg`/focused scripts for small known targets; use the kit for graph/reference mapping, related queries on reusable snapshots, live Editor/runtime access and managed builds. Direct access is a normal option within the user’s authorized scope.

See [operations](docs/operations.md), [compatibility](docs/compatibility.md), [acceptance boundaries](docs/acceptance.md) and [AI skill](skills/cocos-ai-toolkit/SKILL.md). `npm run package:portable` creates a runtime directory with vendored dependencies. No persistent OS service is installed by packaging or normal daemon start.

P8 measurements use a fixed5000-node synthetic prefab and five tasks with a named tokenizer. Context baseline is the full raw prefab; warm latency is in-process. Native/Windows/login/reboot acceptance and broader earlier-phase exclusions remain separate. Reports record actual numbers rather than promising universal savings.
