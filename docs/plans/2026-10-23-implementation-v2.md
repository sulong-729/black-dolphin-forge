# Cocos AI Toolkit v2 Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement task-by-task after execution approval. Use subagents only if authorized by the user or an applicable review skill. Track steps with checkboxes.

**Goal:** Bộ kit dùng chung giúp AI giao tiếp với Cocos qua MCP/CLI, ánh xạ graph hai chiều, đọc source và thực hiện thao tác engine có kiểm chứng.

**Architecture:** AI -> compact facade -> daemon/protocol registry -> Editor/runtime/build/source adapters. Graph codec và identity map giữ serialization Cocos; view cho AI dùng đường dẫn và typed reference.

**Tech stack:** JS/TypeScript + Python; C++ hoặc Go cho adapter/worker, gồm giao tiếp nặng khi benchmark chứng minh cần. Kit phải cài/chạy trên macOS và Windows; Cocos Creator 3.7.3 là engine qualification đầu tiên. Báo riêng kết quả thực trên mỗi OS.

**Spec:** [Thiết kế v2](../design.md). **Test catalog:** [Danh mục và quy trình](../testing/test-cases.md), [CSV](../testing/test-cases.csv).

**Status:** P1/P2 offline core đã triển khai và kiểm tra trên macOS; P2 có qualification Creator 3.7.3 cho fixture Node/UITransform/Button cụ thể. Xem report từng phase để biết exclusions; Windows CI chưa chạy, P3 có experimental read-only bridge/schema với Inspector, dirty state, prefab stage và custom inheritance trên Creator 3.7.3; lifecycle/nested-prefab đầy đủ, Windows và P8 chưa nghiệm thu; P7 có scoped Web Mobile/Python job core, native platform/profiler còn pending; P6 có scoped read-only web-preview core, actions/native và source correspondence chưa nghiệm thu; P5 có scoped property/reference/rename + approval/recovery qualification trên macOS, Task5.2 structural/prefab/asset/source/array đầy đủ còn pending. P4 static Source Navigator đã kiểm chứng project/package/selected engine3.7.3 và MCP; source-map coverage giới hạn ở điểm ánh xạ. Prototype không thay thế qualification engine.

## Global constraints

- Không game-specific defaults; sample/fixture phải tổng quát, asset game thực chỉ đọc/copy vào vùng thử nghiệm có ủy quyền.
- Inventory/read/roundtrip/write là bốn cấp coverage khác nhau; không lấy số case pass thay cho coverage toàn engine.
- Scene/prefab gốc không bị xóa ID; chỉ presentation đổi sang path, native serialization được khôi phục trước Cocos load.
- DataSource/process/version/schema/revision phải explicit; không trộn disk/Editor/runtime.
- Byte-identical no-edit round-trip; không sửa unknown/opaque data khi chưa có schema/adapter.
- Main thread compare-and-apply ở process sở hữu state; daemon lock không khóa được toàn engine.
- Default depth 2, 50 node, 6.000 ký tự text; chunk/cursor có snapshot cố định, không cắt findings âm thầm.
- Snapshot TTL 5 phút kể từ access cuối, LRU 10 snapshot hoặc 128 MiB payload; handle/cursor lỗi có mã rõ.
- Loopback user daemon; auto-start sau login chỉ cài riêng. Build/deploy/write jobs dùng cùng policy authorization.
- Core không phụ thuộc shell POSIX; đường dẫn/state/process và package có kiểm chứng macOS/Windows. Go/C++ dùng chung versioned contract, bounded queue/cancel/crash isolation; benchmark CPU/RSS/latency/copy cost trước khi thay implementation.
- Source edit, asset edit và gameplay edit phải đúng scope được duyệt; không thực hiện chỉ vì query.
- Không tự commit/push, cài auto-start hoặc phát hành trong tác vụ lập kế hoạch.

## Review focus

1. Opaque/missing/custom component: bảo toàn raw, báo đúng coverage, không silently drop field — P2/P3.
2. Duplicate path, nested-prefab ownership và stale IDs: không sửa nhầm target — P2/P3/P5.
3. User/edit/import/reconnect chen giữa query và apply: từ chối stale hoặc báo partial/indeterminate — P1/P3/P5.
4. Context compaction/pagination/source slicing: không thiếu dữ liệu hoặc dùng line number cũ — P1/P4/P8.
5. Native/runtime/build evidence không đồng nhất với mock/unit results — P6/P7/P8.

## Tóm tắt 8 phase

| Phase | Sản phẩm nghiệm thu | Phụ thuộc | Cổng ra |
| --- | --- | --- | --- |
| P1 | Protocol, schema, daemon/MCP tối thiểu | Thiết kế v2 | Typed requests; lifecycle và pagination có contract tests. |
| P2 | Graph mapping và codec hai chiều | P1 | Reference đúng, no-edit byte-identical; mutation unsupported bị chặn. |
| P3 | Editor bridge + generic component registry | P1/P2 | Đối chiếu live với Inspector, dirty-state và prefab stage đúng. |
| P4 | Source Navigator | P1/P2/P3 class identities | Component -> source/symbol/ref đúng version và line/hash. |
| P5 | Proposal/authorization/mutation/verify | P1/P2/P3 | Editor reload xác nhận thay đổi đúng; không corrupt hoặc stale write. |
| P6 | Runtime + UI/animation/render/physics/audio/input | P3/P5 | Mỗi domain có manifest, runtime tests và explicit unsupported states. |
| P7 | Build/debug/profiler/platform adapters | P1/P3/P5; telemetry từ P6 khi dùng | Stage/job/cache/device evidence tách riêng. |
| P8 | Package/service/benchmark/qualification | Các phase muốn phát hành | Clean install/recovery; coverage và kết quả đo trung thực. |

**Lát cắt đầu tiên:** P1 -> P2 -> phần đọc của P3 -> P4. Khi đó AI đã đọc scene/component/source qua kit. P5 mới cho mutation; không cần chờ toàn bộ runtime/build để có sản phẩm hữu ích.

## Shared interfaces cần pin trước implementation

`src/contracts/` là nguồn schema chuẩn và generator bindings cho Python/C++/Go khi có; không để từng worker định nghĩa protocol riêng.

- `dispatch(request: RequestEnvelope): Promise<ResultEnvelope>`; request có operation/project/source/session/revision/params/requestId.
- `capabilities.describe(operation?: string): Capability[]`; trạng thái availability/phạm vi process/side effect được schema xác nhận.
- `snapshots.capture(context: CaptureContext): Promise<Snapshot>`; `snapshots.get(id: string): Snapshot` từ snapshot immutable.
- `graphs.decode(input: SerializedInput, context: ResolveContext): TypedGraph`; `graphs.encode(graph: TypedGraph, base: Snapshot): SerializedOutput`.
- `schemas.describeType(type: TypeIdentity): Promise<ComponentSchema>`; schema không chỉ dựa Object.keys.
- `editor.request(session: EditorSession, command: TypedCommand): Promise<CommandResult>`.
- `source.resolve(component: EntityRef): Promise<SourceLocation[]>`; `source.query(query: SymbolQuery): Promise<PagedSourceResult>`.
- `mutations.propose(patch: PatchPlan): Promise<Proposal>`; `authorize(proposal, TrustedAuthorization)`; `apply(proposalId, idempotencyKey): Promise<ApplyResult>`.
- `jobs.start(operation: CapabilityOperation, authorization: Authorization): Promise<JobRef>`; `status/cancel(jobId)`.

Các type trên được định nghĩa bằng JSON Schema v1 + TypeScript types trong Task 1.1; Payload `Value`, EntityRef, AssetRef và PropertySelector theo mục 6 của spec. `TrustedAuthorization` là server-owned policy result, không phải boolean client tự điền.

## Quy trình dùng cho mọi task

1. Viết executable assertions cho test IDs được giao, tạo fixture tối thiểu.
2. Chạy đúng test target, thấy FAIL vì capability thiếu hoặc invariant bị vi phạm; ghi evidence.
3. Implement một thay đổi nhỏ trong file/module task, không sửa game thật để test xanh.
4. Chạy targeted tests + full suite hiện có + typecheck/build phù hợp.
5. Review diff, ghi test/version/artifact/status, đánh dấu task; commit chỉ khi được phép.

Dưới đây là task boundaries và test cases làm hợp đồng. Chi tiết test đã nằm trong CSV: prerequisites, steps, expected và cấp evidence. Không viết case chỉ kiểm tra tên hàm hay copy lại implementation.

## Phase P1 — Contract và kết nối nền

### Task 1.1: Protocol/capability registry

**Create:** `src/contracts/{envelopes,values,entities,errors,capabilities}.ts`, `src/contracts/schema/*.json`, `tests/contracts/protocol.test.ts`.
**Interface:** RequestEnvelope/ResultEnvelope/Value/EntityRef/Capability/ErrorCode; `validateEnvelope(value): RequestEnvelope`, `describe(operation?)`.
**Tests:** REG-001..REG-007, API-001..API-004.
- [x] Assert schema version/type mismatches/unknown op rejected; availability do adapter quyết định; write/job policy không bị bypass.
- [x] Run target RED -> implement registry/validator -> GREEN.
- [x] Full suite/typecheck; artifact lưu advertised schema và error examples.

### Task 1.2: Registry project, snapshot và query budget

**Create:** `src/projects/registry.ts`, `src/snapshots/{store,revisions,cursors}.ts`, `src/query/formatter.ts`, `tests/contracts/snapshot.test.ts`.
**Interface:** registerProject(root), capture/get/expireSnapshot, page(query,snapshot,cursor).
**Tests:** REG-008..REG-010, SNAP-001..SNAP-010, API-005..API-009.
- [x] Assert canonical project isolation, immutable paging, cursor mismatch, TTL/LRU, no field/warning loss khi chunk.
- [x] RED -> implement bounded store, revision vector, formatter -> GREEN.
- [x] Full suite/typecheck; report pagination completeness, không chỉ thời gian nhanh.

### Task 1.3: Daemon và façade

**Create:** `src/daemon/{server,client,lifecycle}.ts`, `src/cli/main.ts`, `src/mcp/server.ts`, `tests/integration/transports.test.ts`.
**Interface:** local authenticated RPC; six MCP tool names theo spec; chỉ advertise implemented operations.
**Tests:** API-010..API-014, SVC-001..SVC-004.
- [x] Assert cùng query CLI/MCP/RPC giống nhau; start lặp/reconnect/token/Origin/PID ownership.
- [x] RED -> implement core transport/lifecycle -> GREEN.
- [x] Kiểm tra MCP client thực và process lifecycle thủ công; chưa cài auto-start ở phase này.

## Phase P2 — Mapping UI/reference hai chiều

### Task 2.1: Identity graph và asset/class resolver

**Create:** `src/graph/{decode,identities,paths,resolve,opaque}.ts`, `src/assets/{index,subassets}.ts`, `tests/unit/graph.test.ts`.
**Interface:** decode/resolve/encode path view, graph inventory coverage counters.
**Tests:** MAP-001..MAP-014, ASSET-001..ASSET-008.
- [x] Assert nodes/component/shared/cyclic refs, escaped/duplicate paths, UUID compressed/plain, sub-asset importer và business IDs.
- [x] RED -> implement generic graph; opaque types được bảo toàn -> GREEN.
- [x] Đọc ít nhất hai synthetic projects và một asset thực read-only; kiểm tra input bytes không đổi.

### Task 2.2: Round-trip writer và qualification

**Create:** `src/graph/{encode,patch,integrity}.ts`, `tests/integration/roundtrip.test.ts`, `tests/fixtures/roundtrip/`.
**Interface:** restore graph theo base snapshot; `dryRunRestore`, separate output; native-in-place capability gated.
**Tests:** SER-001..SER-012, PREF-001..PREF-004.
- [x] Assert no-edit hash equality; property/ref changes giữ IDs; unknown no-edit preserved; structural unsupported/stale/type mismatch reject.
- [x] RED -> implement preservation/validation -> GREEN.
- [x] Qualification bằng Creator deserialize/save/reload ở fixture project; JSON.parse pass không đủ. Kết quả engine chưa có thì writer vẫn chưa advertise engine-qualified.

## Phase P3 — Editor và component schemas

### Task 3.1: Cocos bridge/session/version adapter

**Create:** `extensions/cocos-ai-bridge/{package.json,main.js,scene.js}`, `src/editor/{session,transport,version-adapter}.ts`, `tests/integration/editor-session.test.ts`.
**Interface:** handshake(project/version/engine/session/stage/capabilities), query scene through owner process.
**Tests:** ED-001..ED-008, PREF-005..PREF-008.
- [ ] Assert two-session routing, dirty scene, reload, edit prefab stage, nested provenance and unsupported version behavior.
- [x] RED -> implement bridge with feature probes -> GREEN contract tests.
- [x] Install chỉ vào synthetic project được chọn; compare tree/fields với Inspector và record Editor logs. Native nested provenance/lifecycle matrix remains NOT_RUN beyond documented fixtures.

### Task 3.2: Generic schema/class inventory

**Create:** `src/schema/{registry,reflection,ast,merge,coverage}.ts`, `tests/integration/component-schema.test.ts`.
**Interface:** describeType/readProperties; schema hash và inventory/read/roundtrip/write levels.
**Tests:** CMP-001..CMP-012, ED-009..ED-010.
- [ ] Assert inherited/custom/package/missing types, null typed refs, enum, arrays, serializable flags, readonly/getter, formerlySerializedAs.
- [x] RED -> implement generic discovery và exact backing-field names -> GREEN. Computed accessors stay unavailable; no guessed underscore aliases.
- [x] Generate report cho registry thật; 319 unique constructors / 102 Component constructors, including compiled custom inheritance. Full package/source identity is P4; generic roundtrip/write disabled.

## Phase P4 — Source Navigator

### Task 4.1: Source roots và symbol/type index

**Create:** `src/source/{roots,typescript-index,locations,invalidation}.ts`, `tests/integration/source-index.test.ts`.
**Interface:** resolve component/class -> project/package/engine implementation/declaration with version/hash/range.
**Tests:** SRC-001..SRC-008.
- [x] Assert correct engine source version, tsconfig aliases/reexports/inheritance, declaration-only/minified/source map states và path permissions.
- [x] RED -> implement compiler/type-checker index, không execute source để discover -> GREEN.
- [x] Query class/method ở project, package và engine 3.7.3 thực; lưu source revision và range evidence.

### Task 4.2: UI bindings và source references

**Create:** `src/source/{references,bindings,slices}.ts`, `tests/integration/source-references.test.ts`.
**Interface:** symbol.references, method.body, event.bindings, serializedProperty references.
**Tests:** SRC-009..SRC-014.
- [x] Assert event handler liên kết đúng component; dynamic references marked unknown; code slice budget/cursor không mất dòng.
- [x] RED -> implement references/source snippets -> GREEN.
- [x] Sửa fixture source giữa hai query: không reuse range/hash cũ.

## Phase P5 — Mutation đáng tin cậy

### Task 5.1: Property/ref proposals và authorization

**Create:** `src/mutation/{propose,policy,preflight,apply,idempotency}.ts`, `extensions/cocos-ai-bridge/approval/*`, `tests/integration/mutations.test.ts`.
**Interface:** propose/authorize/apply; trusted task authorization scoped target/operation; target/field expected-before.
**Tests:** MUT-001..MUT-010.
- [ ] Assert propose không ghi; untrusted approval bị reject; stale check tại owner; type/nullability/range trước side effect; read-back đúng.
- [ ] RED -> implement main-thread compare-and-apply và revision updates -> GREEN.
- [x] Cocos thật sửa property/ref trong phạm vi adapter được ghi ở P5 report, Undo/save/reload xác nhận replacement owner; output có diff và evidence loại editor.

### Task 5.2: Structural/prefab/asset/source edits và recovery

**Create:** `src/mutation/{structure,prefab-scope,checkpoints,rollback}.ts`, domain adapters, `tests/integration/mutation-recovery.test.ts`.
**Interface:** typed node/component/array/asset/source capability handlers; per-step results and checkpoint revisions.
**Tests:** MUT-011..MUT-020, PREF-009..PREF-010, ASSET-009..ASSET-010.
- [ ] Assert nested instance target ownership, requirement dependencies, partial batch, timeout-after-write, idempotent retry và rollback conflicts.
- [ ] RED -> implement từng capability riêng; không expose method/eval blanket -> GREEN.
- [ ] Engine roundtrip và reference integrity sau rename/move/remove; unsupported operation không được tự unpack hay repair ngầm.

## Phase P6 — Runtime và các miền engine

### Task 6.1: Runtime identity/transport và UI diagnostics

**Create:** `runtime/{bridge,identity,snapshot}.ts`, `src/runtime/client.ts`, `src/domains/ui.ts`, `tests/runtime/ui.test.ts`.
**Interface:** read-only runtime capture, frame/time window, editor/source correspondence và explicit runtime-only entities.
**Tests:** RUN-001..RUN-006, UI-001..UI-010.
- [ ] Assert release không chèn bridge, session/frame consistency, inactive nodes và deferred layout không bị sửa khi inspect.
- [x] RED -> implement opt-in preview transport/UI adapter -> GREEN unit/contract.
- [ ] Preview thực: screenshots + geometry ở reference/tall screens; visual không được suy từ serialized Widget values.

### Task 6.2: Animation/render/physics/audio/input adapters

**Create:** `src/domains/{animation,render,physics,audio,input}.ts`, `runtime/domains/*`, `tests/runtime/domains.test.ts`.
**Interface:** registry-discovered read/call capabilities; typed domain-specific commands and side effect classification.
**Tests:** DOM-001..DOM-010, RUN-007..RUN-008.
- [ ] Assert typed target/state preconditions, unavailable packages/platforms rõ, cancel/lifecycle của preview action.
- [x] RED -> read-only domain observations -> GREEN; action adapters chưa triển khai.
- [ ] UI animation observed, physics/audio/native evidence chỉ ghi khi thật sự đo được; không gọi ordinary fields là profiler toàn backend.

P6 scope: xem `docs/runtime.md` và `docs/testing/evidence/p6/report.json`. Release guard có contract test; release artifact chưa build. Frame/lifecycle reads có test; native actions, pause/step và đầy đủ source correspondence chưa nghiệm thu.

## Phase P7 — Build, jobs và diagnostics

### Task 7.1: Job runner, profiles và worker protocol

**Create:** `src/jobs/{runner,locks,cancel,recovery}.ts`, `src/build/{profiles,creator,fingerprints,artifacts}.ts`, `adapters/python/protocol.py`, `tests/integration/jobs.test.ts`.
**Interface:** job.start/status/cancel qua cùng authorization; JSON Lines worker protocol, artifacts thay payload binary.
**Tests:** JOB-001..JOB-008, BLD-001..BLD-006.
- [x] Scoped core: owned POSIX groups, interrupted reconciliation, worker protocol failures, stale input/no cache reuse và idempotency; Windows execution NOT_RUN.
- [x] RED -> doctor/validate/export/artifact stages -> GREEN; native compile/package adapters chưa triển khai.
- [x] Actual Creator3.7.3 Web Mobile synthetic build + separate browser smoke; manifest/log/screenshot recorded on macOS.

### Task 7.2: Platform/debug/profiler adapters

**Create:** `src/build/{python-backend,android,ios}.ts`, `src/diagnostics/{console,stacks,profiler}.ts`, `tests/integration/platform.test.ts`.
**Interface:** adapter revisions, toolchain/device capability, selected target install/launch, source-linked diagnostics.
**Tests:** BLD-007..BLD-010, DIAG-001..DIAG-006.
- [ ] Assert no SDK/dependency -> unavailable; no arbitrary device selection; native stack/sourcemap uncertainty explicit.
- [x] RED -> Python Web build worker, bounded diagnostics/source locations và explicit native/profiler unavailability -> GREEN. Full platform wrappers/capture remain pending.
- [ ] Khi toolchain/device có sẵn: build/install/launch thật và record serial/runtime/version; mock không thay thế.

P7 supported/excluded scope: `docs/build.md` and `docs/testing/evidence/p7/report.json`. Task7.1 Web core is scoped; cache reuse and separate native SDK compile/package remain pending. Task7.2 diagnostic reads are scoped; actual device adapters/profiler/capture and full stack-to-component mapping remain pending.

## Phase P8 — Đóng gói, service và đo hiệu quả

### Task 8.1: Service/installer/upgrade

**Create:** `service/{macos,windows}/*`, `scripts/{package,install,uninstall}.mjs`, `tests/integration/install.test.ts`, `docs/operations.md`.
**Interface:** user service install/uninstall/start/status/stop; version/config migration and rollback.
**Tests:** SVC-005..SVC-010, PKG-001..PKG-004.
- [ ] Assert clean paths with spaces, user-only permissions, stale PID, restart, rotation và không bundle game secrets/assets.
- [ ] RED -> implement package/service actions -> GREEN.
- [ ] Login/reboot/sleep-wake thật trên macOS và Windows sau khi được phép cài; chưa chạy phải ghi NOT_RUN.

### Task 8.2: Benchmark/qualification và skill

**Create:** `benchmarks/{cases,context,latency,idle}.*`, `skills/cocos-ai-toolkit/*`, `docs/{compatibility,acceptance}.md`.
**Interface:** fixed benchmark dataset/tool/tokenizer versions, replayable qualification report.
**Tests:** PERF-001..PERF-008, PKG-005..PKG-006.
- [ ] Assert compaction giữ đủ findings; generated skill/docs khớp capability schemas; no claim vượt evidence.
- [ ] Chạy context benchmark 5 tác vụ và cached latency <=5.000 nodes; mục tiêu median context giảm >=70%, warm p95 <=300 ms là target, chưa phải kết quả đã đạt.
- [ ] Full tests/typecheck/build/security-sensitive data scan + Editor/runtime/platform acceptance; blockers P0/P1 phải resolved hoặc capability excluded rõ.
- [ ] Bàn giao supported/excluded manifest; phát hành/push chỉ khi người dùng yêu cầu.

## Quy tắc pass/fail và bàn giao

- `PASS`: đúng assertions và đủ evidence level của case trên môi trường ghi rõ.
- `FAIL`: vi phạm invariant, sai kết quả, mất dữ liệu, hoặc claim vượt evidence.
- `BLOCKED`: thiếu engine/package/device/environment cần cho case; không tính vào pass.
- `NOT_RUN`: đã có case nhưng chưa chạy. `N/A` chỉ khi capability không thuộc release scope và có lý do.
- Mỗi phase bàn giao demo, test report, coverage manifest, limitations và phần thay đổi; không chỉ thông báo số tests pass.
- V1 release không bắt buộc mọi domain đã writable; nhưng phạm vi đã advertise phải đạt tests và không che phần chưa hỗ trợ.
