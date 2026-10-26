---
name: cocos-ai-toolkit
description: Use Black Dolphin Forge to inspect Cocos Creator scene/prefab paths, component schemas/source, scoped Editor changes, runtime UI observations and Web Mobile build jobs through MCP or local CLI.
---

Prefer the toolkit for Cocos work: AI → MCP/CLI → kit → owning Cocos process. Direct file/CLI/engine access is allowed when genuinely necessary within the user's authorized task. Explain the reason and verification boundary, then recapture snapshots affected by external changes. This preference is not a filesystem sandbox or a claim that every engine operation is supported.

Start with `cocos_describe {}` or describe one operation. Registered availability does not establish that the chosen project/session/version satisfies its preconditions. Read [capabilities.json](references/capabilities.json) only when choosing among operations. Use the installed version's live schema when arguments or availability differ.

## Connect and read

Start the user daemon using the installed CLI, then run its `mcp` command through your MCP client. Core requires Node22.16+; Python is needed only for build workers. Local token/endpoint files are private; never paste them into browser bootstrap or prompts. Web preview has a separate short-lived scoped permit.

Register a project through local CLI `project register <absolute-root>`; choose its returned ID. MCP tools accept a request wrapper:

```json
{"request":{"formatVersion":1,"requestId":"capture-1","operation":"graph.capture","projectId":"<registered-id>","source":"disk","params":{"path":"assets/UI.prefab"}}}
```

Use `cocos_query` for this read. Retain snapshot IDs and full refs. `graph.query` starts compact, `graph.resolve` resolves a canonical path or ref, and `graph.inspect` requests only needed fields. Follow ambiguous-name errors rather than choosing the first match. Storage IDs/UUIDs are retained internally; user/business IDs remain data.

Paged `text` is sometimes a JSON fragment. Append chunks while `offset` increases. When the next response resets `offset` to zero, parse the preceding complete page and start a new page. Follow `nextCursor` without changing other params; do not JSON-parse every chunk individually or concatenate separate JSON pages as one array. Preserve warnings/coverage and omitted counts; use `artifact.read` warning chunks if needed.

Use Source Navigator operations for definitions, references, method bodies, schema and bindings. Source locations may be stale/unmapped; serialized values are not live layout or gameplay proof.

## Change through the owner

Disk, Editor and runtime namespaces are separate. A disk graph handle cannot authorize an Editor mutation. Discover live Editor sessions, select the exact project/session and current revision, then use the Editor read operations before proposing changes.

`cocos_propose` supports qualified `editor.propose` and rollback proposals; `cocos_apply` supports `editor.apply`. The kit enforces exact local hash approval (`approve <proposal-id> <reviewed-hash>`). A client `approved:true` flag grants nothing. Respect the user's actual task authorization when using the local host channel. Preserve returned checkpoints and explicit indeterminate outcomes; never blindly replay uncertain writes.

Only the documented plain-scene property/reference/rename adapters are qualified. Broader structural, nested-prefab, array, asset and source mutation adapters remain unavailable. `graph.restore` is a dry-run round-trip result, not permission to write a running project's files. If a direct fallback is necessary, establish the actual target/ownership and recapture afterward.

## Runtime and builds

`runtime.capture` requires an opted-in web preview session and `source: "runtime"`. `runtime.query`/`ui.diagnose` inspect retained frames; inactive nodes stay inactive. Frame/window and viewport metadata establish observation scope. Native counters, automatic source correspondence and unqualified runtime actions remain unavailable.

For builds: local `build configure <project-id> <profile.json>`, `build.doctor`, `build.propose`, exact hash approval, then `cocos_job` → `job.start/status/cancel`. Only the qualified Creator3.7.3 Web Mobile pipeline is available. Use `cocos_artifact` → `job.artifact.read` for bounded logs/manifests. Build success, browser launch, visuals, gameplay and native-device success are separate checks.

After restart, interrupted jobs do not replay. Inspect old workers/output before local `job reconcile <job-id> <reconciliation-hash>`. A new proposal is needed for changed source/engine/profile. The toolkit does not reuse build outputs; Creator may use internal caches.

## Scope and setup

Current Windows support consists of portable paths/contracts and service plan generation; actual Windows installation, login/reboot and native execution are unqualified. OS service installation is a separate explicit local command, not an automatic effect of reading a project or using this skill. Preserve user state during package upgrade/uninstall.

Consult the bundled `docs/operations.md`, `docs/compatibility.md`, `docs/runtime.md` or `docs/build.md` only for the workflow you need. Do not claim whole-engine write coverage, 100% ID elimination, guaranteed crash prevention or universal token/performance savings.
