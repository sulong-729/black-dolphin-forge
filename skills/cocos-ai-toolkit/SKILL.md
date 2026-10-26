---
name: cocos-ai-toolkit
description: Choose focused scripts or Black Dolphin Forge for Cocos work. Use the toolkit for node/reference mapping, binding analysis, repeated graph queries, live Editor/runtime operations and managed Web Mobile builds; use direct reads for small known targets.
---

Choose the least expensive reliable way to answer the current question. Toolkit use is selective; direct `rg`, source reads and focused JSON scripts are normal options, not exceptional fallbacks. Follow the user's requested tool when specified.

## Choose before connecting

| Need | Preferred route |
| --- | --- |
| Known file, text/symbol search, small source excerpt | `rg` or a bounded file read |
| A few known serialized properties, such as Loading settings or a History bottom-bar Widget | A focused JSON script returning just those fields; resolve local references if needed |
| Unknown node paths, ambiguous names, component/asset references, cross-node bindings | Toolkit graph/source queries when the mapping adds useful context |
| Several related questions on a large scene/prefab, especially with an existing valid snapshot | Reuse toolkit snapshot and a persistent MCP connection |
| Live Editor state, supported Editor changes, runtime UI observations, managed build jobs | Toolkit workflow below, subject to actual capabilities |

Do not start the daemon, register a project, enumerate capabilities or capture a snapshot for a simple direct read. A large file alone does not require the toolkit if a short script can reliably extract the exact answer. Escalate when reference resolution or ambiguity makes the direct result unreliable; do not build a second general graph engine in an ad hoc script. A toolkit snapshot is not a prerequisite to direct inspection.

For either route, return the requested facts with enough path/provenance and relevant warnings to establish correctness. Avoid dumping complete scene JSON, unrelated component properties or repeating full response envelopes. Do not omit unresolved references or coverage limits to make results appear smaller. Direct reads need no routine fallback justification.

## Use the toolkit efficiently

Once the toolkit route is selected, describe the specific operation when its live schema or availability is unknown; use `cocos_describe {}` for broader discovery only when needed. Registered availability does not establish that the chosen project/session/version satisfies its preconditions. Read [capabilities.json](references/capabilities.json) only when choosing among operations.

Prefer a persistent MCP connection over launching a fresh Node CLI process for each query. Capture only the relevant file/source scope, retain snapshot IDs and revisions, and reuse them for related questions while inputs remain unchanged. Recapture affected snapshots after file/Editor changes; never reuse stale results. Inspect only requested fields and page further only when needed to answer the question accurately.

Do not assume the toolkit always uses fewer tokens or is faster than an optimized script. Compare equivalent result scope, account for initial capture and process/connection startup separately, and retain relevant warnings.

## Connect and read

Start the user daemon using the installed CLI, then run its `mcp` command through your MCP client. Core requires Node22.16+; Python is needed only for build workers. Local token/endpoint files are private; never paste them into browser bootstrap or prompts. Web preview has a separate short-lived scoped permit.

Register a project through local CLI `project register <absolute-root>`; choose its returned ID. MCP tools accept a request wrapper:

```json
{"request":{"formatVersion":1,"requestId":"capture-1","operation":"graph.capture","projectId":"<registered-id>","source":"disk","params":{"path":"assets/UI.prefab"}}}
```

Use `cocos_query` for this read. Retain snapshot IDs and full refs. `graph.query` starts compact, `graph.resolve` resolves a canonical path or ref, and `graph.inspect` requests only needed fields. Follow ambiguous-name errors rather than choosing the first match. Storage IDs/UUIDs are retained internally; user/business IDs remain data.

Paged `text` is sometimes a JSON fragment. Append chunks while `offset` increases. When the next response resets `offset` to zero, parse the preceding complete page and start a new page. Follow `nextCursor` without changing other params; do not JSON-parse every chunk individually or concatenate separate JSON pages as one array. Preserve warnings/coverage and omitted counts; use `artifact.read` warning chunks if needed.

Use Source Navigator when definitions, references, schema or bindings need its mapping; use direct source reads for already known methods. Source locations may be stale/unmapped; serialized values are not live layout or gameplay proof.

## Change through the owner

Disk, Editor and runtime namespaces are separate. A disk graph handle cannot authorize an Editor mutation. Discover live Editor sessions, select the exact project/session and current revision, then use the Editor read operations before proposing changes.

`cocos_propose` supports qualified `editor.propose` and rollback proposals; `cocos_apply` supports `editor.apply`. The kit enforces exact local hash approval (`approve <proposal-id> <reviewed-hash>`). A client `approved:true` flag grants nothing. Respect the user's actual task authorization when using the local host channel. Preserve returned checkpoints and explicit indeterminate outcomes; never blindly replay uncertain writes.

Only the documented plain-scene property/reference/rename adapters are qualified. Broader structural, nested-prefab, array, asset and source mutation adapters remain unavailable. `graph.restore` is a dry-run round-trip result, not permission to write a running project's files. For authorized direct edits, establish the actual target/ownership and recapture any affected toolkit snapshots afterward. Toolkit mutation approvals are still required for toolkit apply operations; direct access is not an implicit grant to change files.

## Runtime and builds

`runtime.capture` requires an opted-in web preview session and `source: "runtime"`. `runtime.query`/`ui.diagnose` inspect retained frames; inactive nodes stay inactive. Frame/window and viewport metadata establish observation scope. Native counters, automatic source correspondence and unqualified runtime actions remain unavailable.

For builds: local `build configure <project-id> <profile.json>`, `build.doctor`, `build.propose`, exact hash approval, then `cocos_job` → `job.start/status/cancel`. Only the qualified Creator3.7.3 Web Mobile pipeline is available. Use `cocos_artifact` → `job.artifact.read` for bounded logs/manifests. Build success, browser launch, visuals, gameplay and native-device success are separate checks.

After restart, interrupted jobs do not replay. Inspect old workers/output before local `job reconcile <job-id> <reconciliation-hash>`. A new proposal is needed for changed source/engine/profile. The toolkit does not reuse build outputs; Creator may use internal caches.

## Scope and setup

Current Windows support consists of portable paths/contracts and service plan generation; actual Windows installation, login/reboot and native execution are unqualified. OS service installation is a separate explicit local command, not an automatic effect of reading a project or using this skill. Preserve user state during package upgrade/uninstall.

Consult the bundled [operations](references/docs/operations.md), [compatibility](references/docs/compatibility.md), [runtime](references/docs/runtime.md) or [build](references/docs/build.md) only for the workflow you need. Do not claim whole-engine write coverage, 100% ID elimination, guaranteed crash prevention or universal token/performance savings.
