# Build jobs and diagnostics (0.10)

Creator 3.7.3 and 3.6.3 have actual **Web Mobile** pipeline qualification on macOS. Legacy 2.1.3/2.4.15 build adapters are experimental: 2.4.15 export failed in the installed Creator worker; 2.1.3 is not installed for testing. See [compatibility](compatibility.md). TypeScript owns authorization, lifecycle and artifacts; a Python 3 worker runs closed doctor/validate/export tasks over version-1 JSON Lines. No Python package installation is required. Android/iOS install/launch, SDK compilation, profiler capture and native stack/component correspondence remain unavailable. Windows paths and cancellation branches are implemented but not qualified on Windows.

## Local configuration

Register the project first. Creator version comes from current project metadata; the exact installed executable and engine are discovered when paths are omitted. Missing versions do not fall back. Explicit creator/engineRoot paths are optional; an explicit creatorVersion must match metadata. Save a profile JSON outside the project and configure it through the local CLI:

```json
{
  "version": 1,
  "python": "<absolute Python 3 executable>",
  "target": "web-mobile",
  "scene": "<scene asset UUID>",
  "debug": true,
  "timeoutMs": 300000
}
```

```text
node dist/cli/main.js build configure <project-id> <profile-json-file>
```

The CLI is the trusted host configuration channel. Profiles cannot be written through MCP/RPC or supplied inside `job.start`. All executable paths must be absolute and name local files. `engineRoot` is passed to Creator through `--engine`, and its source tree is fingerprinted. Use the engine root containing `package.json` and `cocos/`, not the `cocos/` subdirectory. The generated Editor preview cache `bin/.cache` is excluded; it changes independently of Web Mobile build sources. This does not fingerprint every library in the installed Creator application. Toolchain selection is an explicit local responsibility; a file existing does not prove its advertised vendor/version.

Keep daemon state outside the registered project. Do not run builds against a project another Creator instance is actively modifying. Kit locks serialize its own jobs, not every external editor. Creator may execute project extensions/hooks and update asset metadata, settings, library and temp. Output is isolated; engine import side effects are not transactional. The exact proposal lists these effects.

## Request flow

Use the standard request envelope with `source: "disk"` and the registered `projectId`:

1. `build.doctor {}` checks the configured files/inputs without installing dependencies or spawning Creator. Missing/inaccessible/unqualified inputs return actionable reasons.
2. `build.propose {}` returns an immutable proposal/hash and affected scope. Inspect the full preview.
3. Approve the exact hash through `node dist/cli/main.js approve <proposal-id> <hash>`.
4. `job.start {"proposal":"<id>","idempotencyKey":"<stable-key>"}` starts once. The same proposal/key replays the original job ID; another key is refused. A missing acknowledgment is indeterminate and must be reconciled, not blindly replayed.
5. `job.status {"job":"<id>"}` reads stages/status. `job.cancel` with the same input stops only the live owned worker group.
6. `job.artifact.read {"job":"<id>","kind":"log","offset":0}` returns at most 6000 characters; follow `nextOffset`. `kind: "manifest"` reads checksums and stale/source provenance. No binary/base64 build output is embedded in the control channel. Output files live in the private job directory.

MCP: `cocos_propose` accepts `build.propose`; `cocos_job` accepts start/status/cancel; `cocos_artifact` accepts job artifact reads. `cocos_query` cannot build, cancel or create proposals. RPC, CLI and MCP all use the same dispatcher/policy. There is no RPC approval, arbitrary shell/eval command, device default or auto-install.

## State and recovery

Jobs are persisted before spawning. One active job per project, at most two active jobs and 200 retained records per runner. A worker has a bounded timeout, 1 MiB stdout protocol budget and 256 KiB stderr budget per stage. Protocol noise, wrong version/id, duplicate results, process failure and incomplete output are failures. UTF-8 split across stdout chunks is retained. Creator success codes alone do not establish build success: the expected output and manifest must also exist.

Cancellation/timeout terminate the POSIX process group created by the kit, including descendants after the worker leader exits. Windows uses a live owned PID with `taskkill /T /F`; Windows process-tree behavior remains NOT_RUN. No historical PID is killed after restart.

Restart marks queued/running jobs `interrupted` without replay. The project remains blocked for new jobs until a local operator inspects and stops/reconciles any old worker. `job.status` includes `reconciliationHash`; after that inspection run:

```text
node dist/cli/main.js job reconcile <job-id> <reviewed-reconciliation-hash>
```

Reconciliation is a local attestation, not an automatic process detector. An unrestricted AI shell already has the host user's authority; host policy must restrict this trusted channel if needed. Retained results still replay their old identity; reconciliation never reruns a job.

The toolkit does not reuse previous build outputs. Creator may still use its own internal compiler caches. Pre/post fingerprints cover project contents (including installed dependency files), profile, selected engine tree, configured executables and worker script. Root generated `.git/library/temp/build/profiles/.superpowers` directories are excluded; similarly named asset subdirectories remain inputs. Symlinks are refused rather than silently missing external dependencies. The project fingerprint budget is 50,000 files/512 MiB; the selected engine tree budget is 100,000 files/4 GiB, streamed rather than loaded together; larger projects require a future qualified dependency adapter.

If Creator's first import changes metadata, the artifact is stale and the job fails verification. Recapture/review/approve a fresh proposal; the kit never silently updates an approved baseline. Missing output, changed inputs and cancelled/interrupted jobs are never release-ready. A successful Web Mobile build proves output generation only. Launch, visuals, gameplay, release suitability and native-device behavior have separate evidence.

## Diagnostics

`diagnostics.analyze {"text":"<log text>"}` deduplicates up to 50 messages with counts and first/last line context. It parses at most 50 stack frames and reports dropped messages. Locations from log text remain unverified; no crash probability, source-map match or guilty component is inferred.

`diagnostics.source {"path":"assets/Hero.ts","line":12,"column":3,"hash":"<optional sha256>"}` confines the path to the project, verifies the exact current file/range and returns a bounded source snippet/hash. A stale supplied hash fails. This verifies a source location; it does not prove the stack came from this revision or identify a runtime component. Existing Source Navigator operations can separately inspect symbols and bindings.

## Qualification

`npm run check` exercises real runner processes, the Python worker with a controlled fake Creator, policy/transport and bounded diagnostics. Controlled export tests are not actual engine qualification.

`npm run qualify:build` creates a fresh isolated project from `tests/fixtures/build`, runs actual Creator 3.7.3 and writes local evidence under `docs/testing/evidence/p7`. The harness explicitly approves only its own synthetic build scope. The first import may invalidate that build; a second fresh explicit proposal is tested. No registered game project or existing Creator window is targeted. Environment variables `COCOS_CREATOR_EXECUTABLE`, `COCOS_PYTHON_EXECUTABLE`, `COCOS_ENGINE_ROOT` override harness defaults; shipped core has no machine-specific executable path.
