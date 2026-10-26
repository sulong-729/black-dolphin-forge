# Compatibility and supported scope — 0.8

Black Dolphin Forge is a standalone kit. Prefer its MCP/CLI interfaces for AI workflows; direct file/CLI/engine access is allowed when genuinely needed and authorized. This is a workflow preference, not a mandatory filesystem sandbox.

| Layer | Supported scope | Evidence/exclusions |
| --- | --- | --- |
| Core | Node22.16+, loopback authenticated RPC, CLI/MCP, project registry, bounded immutable snapshots | macOS tests; Windows path/contract tests only |
| Disk UI | Creator3.7.3 JSON scene/prefab identity/path mapping and dry-run round-trip | Qualified fixtures; no universal schema/writable guarantee |
| Editor | Experimental read/reflection/source mapping; plain scene property/reference/rename proposal/approval/apply | Actual Creator3.7.3/macOS qualification; structural/nested-prefab/array/asset/source mutations pending |
| Runtime | Opt-in3.7.3 web preview UI/component observations and diagnostics | Actual reference/tall/restore fixture; actions/native telemetry/source correspondence pending |
| Build | Python3 worker + explicit Creator3.7.3 Web Mobile engine/profile, persistent owned jobs/log/artifacts | Actual macOS build/browser smoke; native SDK/device/capture unavailable, no toolkit output-cache reuse |
| Packaging | Versioned portable directory, checksum verification, compatible install/rollback/uninstall | Isolated actual macOS install and daemon/CLI smoke; no signed/notarized installer or bundled Node runtime |
| Auto-start | User LaunchAgent and Windows Task Scheduler plans plus explicit local commands | Template/argument contracts; actual OS registration/login/reboot/sleep-wake NOT_RUN |
| Metrics | Five synthetic tasks,5000-node graph, named tokenizer and measured warm/cold/idle scopes | Targets are measured per fixture; not a promise for every game, client, OS or AI model |

Installed Node is required. Python/Creator/SDKs are capability dependencies and are never silently downloaded. Production dependencies are vendored from the lockfile. Go/C++ remain optional; no measured bottleneck currently justifies a native worker.

Read reports under `docs/testing/evidence/p*/report.json` for the precise coverage behind each result. Source-controlled summary reports reference raw local evidence that is not bundled with releases. No read inventory or generic round-trip result establishes whole-engine write acceptance.
