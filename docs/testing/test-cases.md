# Cocos AI Toolkit v2 - Test cases

Cập nhật: 2026-10-26. Tổng cộng **212 test case nền tảng**, chia 20 nhóm. **120 case đã PASS trong phạm vi bằng chứng ghi rõ; 92 case còn lại NOT_RUN.** P1 có 38 case core contract/integration trên macOS. P2 có 34 case offline/exact engine-fixture PASS; MAP-009 và PREF-002..004 giữ NOT_RUN ở cấp live runtime/Editor, dù kiểm tra offline tương ứng đã qua. P3 thêm 12 case với bằng chứng read-only Creator 3.7.3/contract giới hạn, 319 class và component kế thừa thực; lifecycle/nested-prefab đầy đủ vẫn chưa nghiệm thu. P4 thêm14 case static source/controlled integration: aliases/inheritance, UI bindings, references/source-map points, stale guards và actual MCP. P5 thêm 8 case trong phạm vi property/ref/rename và approval/recovery, 147 executable tests; broad structural/prefab/asset/source/array mutation và fault injection native vẫn chưa nghiệm thu. P6 thêm 14 case scoped runtime/domain reads, 162 executable tests; actual Creator 3.7.3 preview reference/tall/restore có screenshots và geometry; actions/native/release artifact vẫn NOT_RUN. Windows chưa chạy. Xem [báo cáo P1](evidence/p1/report.json) và [báo cáo P2](evidence/p2/report.json) và [báo cáo P3](evidence/p3/report.json) và [báo cáo P4](evidence/p4/report.json) và [báo cáo P5](evidence/p5/report.json) và [báo cáo P6](evidence/p6/report.json); số case khác số executable tests.

[Kế hoạch phase/task](../plans/2026-10-23-implementation-v2.md) · [CSV để lọc/cập nhật](test-cases.csv) · [JSON cho automation](test-cases.json)

## Cấp bằng chứng

| Cấp | Ý nghĩa | Không được suy thành |
| --- | --- | --- |
| unit/contract | Logic, schema và protocol trong môi trường kiểm soát | Cocos Editor/native đã chạy đúng |
| integration | Các module/transport thật phối hợp; fake backend phải được ghi rõ | Backend/device thật đã pass |
| editor | Chạy trong Creator, đối chiếu Inspector/deserialize/save/reload | Gameplay hoặc thiết bị native đúng |
| runtime | Quan sát preview/native runtime được chỉ định | Preview tương đương mọi native backend |
| platform/manual | Toolchain, device, OS lifecycle hoặc thao tác thực có evidence | Mock hoặc source inspection là đã thực hiện |
| benchmark | Đo trên fixture/version/máy cụ thể | Cam kết tốc độ/token cho mọi project |

## Cách triển khai và ghi kết quả

- Mỗi case chuyển thành executable assertions hoặc checklist engine/manual rõ theo task. Test phải fail đúng nguyên nhân trước khi code tương ứng được thêm. Không tạo test chỉ lặp lại implementation.
- Ghi PASS/FAIL/BLOCKED/NOT_RUN/N/A; BLOCKED không tính là PASS. N/A cần capability bị loại khỏi release scope và lý do.
- evidence tối thiểu: kit commit/version, engine fingerprint, project/fixture hash, command, timestamps, platform/device/session, output/log/artifact và người/runner thực hiện.
- Với mutation: lưu before/after semantic diff, revision/identity graph, read-back và checksum file không liên quan; không dùng game production làm fixture ghi.
- Với crash/reconnect/timeout: assert cả kết quả trả về, side effect thực tế và khả năng recovery; không chỉ assert error string.
- Case dạng discover-all hoặc value-matrix phải sinh test theo actual registry/schema và field/value kind. Một dòng catalog có thể sinh hàng trăm assertions; 212 dòng không có nghĩa đã bao quát mọi class ở mọi engine.
- Prototype từng có 11 tests qua; các tests đó cần review/migrate vào contract v2, không tự đánh dấu case catalog PASS.
- Policy P0/P1: không phát hành capability writable nếu case mất dữ liệu/sửa nhầm/stale/authorization còn FAIL hoặc chưa đủ evidence. Có thể phát hành phạm vi hẹp hơn với capability excluded rõ.

## Fixture inventory

| Fixture | Nội dung |
| --- | --- |
| F01 | Minimal generic Cocos project, registry/protocol malformed inputs, two canonical roots. |
| F02 | 130-node and 5000-node graphs; fake clock; source/dependency revisions; snapshot eviction. |
| F03 | Duplicate/escaped names, shared records/cycles, dangling refs and business IDs. |
| F04 | Texture/atlas/font/audio/material/animation sub-assets, builtin refs and metadata faults. |
| F05 | Byte-preservation source corpus, scalar/ref edits, opaque types and stale files. |
| F06 | Base/nested prefab with overrides, mounted/removed components and missing source. |
| F07 | Two Editor sessions, dirty scene, prefab stage, compile/import/reconnect. |
| F08 | Generated custom/inherited/package classes with enum/null/array/readonly/serialization attributes. |
| F09 | Project/package/engine source roots, aliases/reexports/.d.ts/source maps/dynamic refs. |
| F10 | Editable synthetic scene with callbacks, required components, concurrent edits and recovery checkpoints. |
| F11 | Preview/native dev bridge, runtime-only nodes and frame capture telemetry. |
| F12 | Generic short/long UI panels with controls/masks/fonts/layout; reference 720x1280 plus tall viewport. |
| F13 | Minimal controlled animation/render/physics/audio/input scenes; optional package availability matrix. |
| F14 | Owned worker process groups, protocol fault injection, interrupted jobs and large artifacts. |
| F15 | Isolated Web/Android/iOS build projects, explicit toolchain and optional selected devices. |
| F16 | Bounded log/profiler captures and stack/source-map corruption/absence cases. |
| F17 | Temporary user state, stale registries, service template and approved OS lifecycle checks. |
| F18 | Release archive, old config/schema, unrelated user files and fake credentials for package scans. |
| F19 | Pinned five-task tokenizer benchmark and cold/warm/idle reproducibility datasets. |

Fixture engine/asset production chỉ dùng read-only hoặc bản copy riêng được cho phép; không đưa source game/private media vào package.

## Parametrized component/field matrix

Với mỗi registered component: inventory; source/schema resolution; inherited/default/nullable/readonly/serializable behavior; round-trip từng value kind mà type thật sự có; valid and invalid mutations chỉ khi capability writable; Inspector + save/reload parity. Kiểu abstract, editor-only/native-only hoặc cần dependency được report reason, không bị bỏ khỏi denominator âm thầm.

Giá trị biên: min/inside/max/out-of-range; zero/negative/non-finite theo type; empty/non-empty arrays; null/compatible/incompatible refs; same-name and same-type repeated components; inactive/disabled/destroyed targets; schema/session/revision changes giữa hai thao tác. Không set ngẫu nhiên mọi property vào runtime đang chạy.

## Release gates

| Gate | Điều kiện |
| --- | --- |
| Read-only alpha | P1/P2 read invariants pass; warnings/unknown coverage trung thực; không advertise writes. |
| Editor read | Live inventory/schema parity và session/dirty/prefab checks pass. |
| Source navigation | Definition/ref/version/range hashes đúng; dynamic/unavailable được báo. |
| Mutation beta | Correct-target/no-loss/authorization/race/recovery tests pass trong Editor; writer-qualified coverage explicit. |
| Runtime/build | Từng backend/domain có evidence phù hợp; không gộp preview/native/device. |
| User release | Install/recovery/qualification report đầy đủ; token/performance mục tiêu có số đo thực, không tự nhận đạt. |

## REG - Registry/schema (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| REG-001 | P1 / contract | Operation discovery | Query registry without selecting an operation | Names and availability returned; no full engine schemas loaded |
| REG-002 | P1 / contract | Invalid request version | Send unsupported formatVersion | SCHEMA_MISMATCH; no dispatcher side effect |
| REG-003 | P1 / contract | Unimplemented operation | Request capability not installed | UNAVAILABLE_CAPABILITY; no fallback execution |
| REG-004 | P1 / contract | Type validation | Send string for numeric property parameter | Validation fails before adapter call |
| REG-005 | P1 / contract | Process ownership | Send scene operation to offline process | Capability/precondition error; never silently changes process |
| REG-006 | P1 / contract | Version compatibility | Register unqualified Creator version | Experimental/unavailable status; no claim of compatibility |
| REG-007 | P1 / contract | Side-effect classification | Send client readOnly=true for write capability | Server registry classification prevails; authorization required |
| REG-008 | P1 / contract | Canonical project roots | Register real path and symlink alias of one project | One canonical project identity; no duplicate routing |
| REG-009 | P1 / contract | Project isolation | Use entity handle from another registered project | FOREIGN_PROJECT error; no read/write target crossover |
| REG-010 | P1 / contract | Containment | Request path traversal and symlink escaping root | Access refused unless separate library root explicitly registered |

## API - MCP/CLI/API (14 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| API-001 | P1 / contract | Small tool surface | List MCP tools on fresh session | Only six compact facade schemas; missing implementations marked unavailable |
| API-002 | P1 / contract | Schema discovery on demand | Describe one known operation | Only relevant input/output/process/preconditions returned |
| API-003 | P1 / contract | Unknown operation error | Call non-existent operation | Typed error with recovery; no shell/eval fallback |
| API-004 | P1 / contract | Client approval spoof | Send approved=true or authorization text in params | Cannot create trusted authorization |
| API-005 | P1 / contract | Default tree budget | Query tree with defaults | Depth 2 and at most 50 nodes; omissions/cursor explicit |
| API-006 | P1 / contract | Text budget overflow | Inspect property exceeding 6000 characters | Bounded chunks reconstruct complete result; no silent truncation |
| API-007 | P1 / contract | Lossless pagination | Fetch all pages of 130-node fixture | Every entity exactly once; no loss or duplicates |
| API-008 | P1 / contract | Batch read parity | Run independent reads singly and batched | Same semantic outputs and individual error statuses |
| API-009 | P1 / contract | No duplicated payload | Inspect large component through MCP | Full payload not repeated in text and structured content |
| API-010 | P1 / contract | Transport parity | Replay equivalent request over CLI/MCP/RPC | Identical normalized result and error contract |
| API-011 | P1 / contract | Authentication | Call RPC without token and with wrong token | 403; no project data or secret returned |
| API-012 | P1 / contract | Loopback/Origin | Send cross-origin request or attempt non-loopback access | Rejected; default listen only loopback |
| API-013 | P1 / contract | Malformed/oversize input | Send malformed JSON and input above configured limit | Bounded error; daemon remains responsive |
| API-014 | P1 / contract | MCP stdout hygiene | Run MCP with routine logs and worker stderr | stdout contains only MCP protocol messages |

## SNAP - Snapshot/revision (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| SNAP-001 | P1 / integration | Immutable page snapshot | Edit document after fetching first page then fetch next | Pages remain on original snapshot; new query has new revision |
| SNAP-002 | P1 / integration | Cursor query binding | Reuse cursor with changed filter/depth/source | CURSOR_MISMATCH |
| SNAP-003 | P1 / integration | Handle expiration | Use handle after snapshot eviction | STALE_HANDLE or SNAPSHOT_EXPIRED; never resolve by same path automatically |
| SNAP-004 | P1 / integration | TTL | Advance controlled clock 5 minutes after last access | Expired snapshot rejected; access refresh follows contract |
| SNAP-005 | P1 / integration | Count eviction | Create 11 unpinned snapshots | LRU keeps at most 10; evicted cursor explicitly expires |
| SNAP-006 | P1 / integration | Memory budget | Capture payload crossing 128 MiB budget | Page-to-disk or explicit refusal/eviction; no unbounded memory growth |
| SNAP-007 | P1 / integration | Content freshness | Change bytes while keeping mtime/size constant | Freshness check detects revision change before write |
| SNAP-008 | P1 / integration | Missed watcher event | Modify dependency without delivering watch event | Read refresh/write check detects change; stale data not authoritative |
| SNAP-009 | P1 / integration | Revision vector | Change schema or engine but leave scene bytes unchanged | Dependent snapshot/proposal invalidated |
| SNAP-010 | P1 / integration | Runtime capture window | Capture state across multiple frames | Frame/time window recorded; consistentFrame=false unless same-frame proven |

## MAP - Graph identity/path (14 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| MAP-001 | P2 / unit | Node references | Convert nested __id__ references to node paths | Correct target entities; no storage IDs in default view |
| MAP-002 | P2 / unit | Component references | Convert reference to component on another node | Component type and ordinal resolve exactly |
| MAP-003 | P2 / unit | Duplicate siblings | Map two same-name siblings | Distinct paths/handles; ambiguous short name rejected |
| MAP-004 | P2 / unit | Escaped names | Map names containing slash tilde brackets and hash | Encode/decode round-trip; no path collision |
| MAP-005 | P2 / unit | Shared record | Two components reference same serialized record | Graph retains one shared identity after round-trip |
| MAP-006 | P2 / unit | Cyclic references | A points to B and B points to A | Finite traversal; references remain cyclic after decode/encode |
| MAP-007 | P2 / unit | Dangling object ref | Point reference to absent array slot | Unresolved marker plus coverage count; no guessed target |
| MAP-008 | P2 / unit | Dangling asset ref | Reference missing UUID | Unresolved asset marker; original payload retained |
| MAP-009 | P2 / unit | Runtime-only object | Inspect node created after scene load | Runtime identity; no invented source asset ID |
| MAP-010 | P2 / unit | Rename/reparent | Rename and move node after snapshot | Old handle/path not rebound to a different node |
| MAP-011 | P2 / unit | Business ID data | Store numeric IDs and UUID-like strings in custom fields | Unchanged user values; only typed storage refs converted |
| MAP-012 | P2 / unit | Orphan record | Include serialized record not reached by primary tree | Inventory reports orphan/record; payload not dropped |
| MAP-013 | P2 / unit | Malformed hierarchy | Supply cycle or invalid parent link | Explicit integrity issue; bounded traversal |
| MAP-014 | P2 / unit | Multiple roots | Read scene with multiple root nodes | All roots accounted for with document namespace |

## ASSET - Asset reference (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| ASSET-001 | P2 / integration | Compressed UUID | Resolve plain and supported compressed class/asset UUIDs | Same canonical asset identity; exact source spelling preserved on no-edit |
| ASSET-002 | P2 / integration | Sub-assets | Resolve multiple sprite frames within one texture/atlas | Distinct typed sub-asset refs; not collapsed to parent texture |
| ASSET-003 | P2 / integration | Importer identity | Bind ref to asset with mismatched importer/type | Validation rejected before apply |
| ASSET-004 | P2 / integration | Dependencies | Traverse material texture font audio and clip references | Correct dependency edges with cycle protection |
| ASSET-005 | P2 / integration | Asset path rename | Move asset in Asset DB then refresh mapping | New URI resolves same asset identity; dependent revisions invalidated |
| ASSET-006 | P2 / integration | Duplicate UUID | Index conflicting metadata UUIDs | Ambiguity/integrity warning; no arbitrary first match for write |
| ASSET-007 | P2 / integration | Malformed metadata | Index invalid or missing meta content | Error location/reason; rest of inventory not silently labeled complete |
| ASSET-008 | P2 / integration | Built-in resources | Resolve internal engine/builtin asset without project path | Canonical builtin identity or explicit unresolved; never fabricated db path |
| ASSET-009 | P2 / integration | Asset move mutation | Move fixture asset with dependent serialized refs through adapter | Asset DB move succeeds; dependents reload without broken refs |
| ASSET-010 | P2 / integration | Asset/source revision | Change importer or sub-asset generation after proposal | Stale proposal rejected; re-resolve required |

## SER - Serialization round-trip (12 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| SER-001 | P2 / integration | No-edit bytes | Export path view then restore without edits | Exact SHA-256 and bytes equal original |
| SER-002 | P2 / integration | Scalar value edit | Change one numeric/boolean/string field | Only intended semantic value changes; identities/refs retained |
| SER-003 | P2 / integration | Reference edit | Rebind existing node/component reference to compatible target | Restored native ID points to selected target |
| SER-004 | P2 / integration | Unknown payload preservation | Round-trip missing/custom opaque serialized class without edits | Payload and raw metadata retained byte-for-byte |
| SER-005 | P2 / integration | Unknown write | Attempt modifying opaque field without qualified schema | Unsupported error; no source write |
| SER-006 | P2 / integration | Structural unsupported | Try add/delete/reorder without available structural adapter | Explicit rejection; no guessed index regeneration |
| SER-007 | P2 / integration | Wrong map | Restore using another snapshot identity map | Snapshot/map mismatch before write |
| SER-008 | P2 / integration | Stale source | Edit source file after exporting view then restore in place | STALE_REVISION; current file unchanged |
| SER-009 | P2 / integration | Type/null validation | Change value to incompatible type or invalid null | SCHEMA_MISMATCH with property location |
| SER-010 | P2 / integration | Special values | Round-trip curves vectors colors and non-JSON native values | Typed codec or opaque preservation; no coercion/loss |
| SER-011 | P2 / integration | Engine deserialize | Load restored fixture in Creator then inspect effective values | No deserialize/binding error; original identities remain valid |
| SER-012 | P2 / integration | Engine save/reload | Save and reopen restored fixture after one edit | Intended value persists; unrelated refs and prefab links preserved |

## PREF - Prefab/override (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| PREF-001 | P2/P3/P5 / editor | Base prefab no-edit | Export/restore ordinary prefab asset | Same structure identities and original raw payload |
| PREF-002 | P2/P3/P5 / editor | Nested graph inventory | Capture nested prefab tree and dependency links | All reachable nodes and nesting layers represented |
| PREF-003 | P2/P3/P5 / editor | Missing source prefab | Inspect instance whose source asset is absent | Unresolved provenance; no complete/write claim |
| PREF-004 | P2/P3/P5 / editor | Unsupported override | Read override format without qualified adapter | Preserved raw metadata; mutation unavailable |
| PREF-005 | P2/P3/P5 / editor | Effective value origin | Override field on instance and inspect base/effective | Correct value plus ordered provenance chain |
| PREF-006 | P2/P3/P5 / editor | Prefab editing stage | Open prefab stage while another scene exists | Query explicitly targets stage/document; no scene confusion |
| PREF-007 | P2/P3/P5 / editor | Two same-name instances | Inspect duplicated prefab instances | Distinct instanceChain and target identities |
| PREF-008 | P2/P3/P5 / editor | Mounted/removed components | Inspect added/removed component override state | Inventory reflects effective and override states separately |
| PREF-009 | P2/P3/P5 / editor | Nested mutation scope | Edit scene instance vs containing prefab vs source prefab | Three distinct proposals; correct owning asset and override owner |
| PREF-010 | P2/P3/P5 / editor | Engine restrictions | Request prohibited hierarchy change within prefab instance | Explicit precondition error; no implicit unpack or source rewrite |

## ED - Editor bridge (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| ED-001 | P3 / editor | Handshake identity | Connect extension with project engine version and session | Correct registry entry and capability probes |
| ED-002 | P3 / editor | Two sessions | Open two Creator sessions and target one explicitly | No cross-session query/mutation |
| ED-003 | P3 / editor | Dirty scene | Modify Inspector value without saving; query disk/editor | Different explicit sources and revisions; editor reflects unsaved value |
| ED-004 | P3 / editor | Scene switch | Switch scene during query/proposal | Stale document/session rejected; no handle reuse |
| ED-005 | P3 / editor | Domain/script reload | Recompile project scripts while bridge connected | Session/schema refresh and bounded retry guidance |
| ED-006 | P3 / editor | Disconnect | Close Editor during pending read | Disconnected/error response; daemon survives |
| ED-007 | P3 / editor | Reconnect | Reopen Editor after disconnect | New session identity; old handles expired |
| ED-008 | P3 / editor | Import state | Query asset/component while import in progress | Pending/unavailable/consistent result; no half-import complete claim |
| ED-009 | P3 / editor | Inventory parity | Compare bridge component/node inventory with Inspector/engine registry | Counts and identities match; exclusions explicit |
| ED-010 | P3 / editor | Read-only introspection | Read state while UI has inactive nodes and callbacks | No activation arbitrary method invocation or script mutation introduced |

## CMP - Generic component schema (12 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| CMP-001 | P3 / editor | Built-in schemas | Discover all registered builtin component classes | Inventory complete relative to actual registry; capability levels separate |
| CMP-002 | P3 / editor | Custom component | Add project @ccclass without kit-specific adapter | Class and declared serialized fields discoverable |
| CMP-003 | P3 / editor | Inherited properties | Inspect subclass with inherited and overridden fields | Correct merged schema and owner class |
| CMP-004 | P3 / editor | Package component | Load custom class from registered package | Correct package/type/source identity |
| CMP-005 | P3 / editor | Missing script | Inspect serialized component with absent script | Opaque/missing state; preserved payload; no write claim |
| CMP-006 | P3 / editor | Enums and bitmasks | Inspect typed enum and mask fields | Numeric values and labels preserve exact semantics |
| CMP-007 | P3 / editor | Null typed reference | Inspect null field declared Node/Asset/Component subtype | Nullable type retained; compatible binding possible only via schema |
| CMP-008 | P3 / editor | Arrays/nested data | Inspect arrays of values and references with shared records | Element types order and identity preserved |
| CMP-009 | P3 / editor | Serialization flags | Inspect hidden editorOnly and serializable:false fields | Persistence/visibility/runtime distinctions correct |
| CMP-010 | P3 / editor | Readonly/getter | Discover readonly and potentially side-effectful getters | Not advertised as writable; unsafe getter not eagerly evaluated |
| CMP-011 | P3 / editor | Renamed serialized field | Load formerlySerializedAs migration fixture | Backing/legacy names resolved without data loss |
| CMP-012 | P3 / editor | Schema invalidation | Change class decorator/type then compile | Schema revision changes; dependent proposals invalidated |

## SRC - Source/library navigation (14 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| SRC-001 | P4 / integration | Component to project source | Resolve selected custom component | Exact source URI class and declaration range |
| SRC-002 | P4 / integration | Component to engine source | Resolve builtin class using selected Creator install | Correct engine version/path; no accidental other install |
| SRC-003 | P4 / integration | Package source | Resolve component exported by package/submodule | Source owner and package revision recorded |
| SRC-004 | P4 / integration | Declaration only | Resolve library with .d.ts but no implementation | Declaration-only label; no invented function body |
| SRC-005 | P4 / integration | Inheritance | Navigate subclass method to base implementation | Correct symbol/type chain and definition location |
| SRC-006 | P4 / integration | Aliases/reexports | Resolve tsconfig path alias and barrel export | Actual declaration found with import provenance |
| SRC-007 | P4 / integration | Minified/source maps | Resolve compiled script with valid/missing source map | Mapped source when available; compiled/unknown label otherwise |
| SRC-008 | P4 / integration | Root permissions | Navigate source outside registered roots | Refused until explicitly registered; no arbitrary filesystem read |
| SRC-009 | P4 / integration | UI event handler | Follow ClickEvent target/component/handler | Correct receiver method and serialized binding location |
| SRC-010 | P4 / integration | Symbol references | Find imported inherited and local symbol references | Relevant typed matches; text matches not mislabeled semantic refs |
| SRC-011 | P4 / integration | Dynamic edges | Inspect computed event names/reflection calls | Unknown/dynamic edges explicit; no complete call graph claim |
| SRC-012 | P4 / integration | Bounded method body | Read long method using paged source slices | All requested lines recoverable once; no full-library dump |
| SRC-013 | P4 / integration | Source changed | Change fixture source after earlier range query | Hash/range invalidated; no stale line-number evidence |
| SRC-014 | P4 / integration | Source edit boundary | Read engine/vendor library then request unrelated write | Read permission not interpreted as write authorization |

## MUT - Mutation/approval/recovery (20 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| MUT-001 | P5 / editor | Propose has no writes | Create property/ref proposal | Source/editor state unchanged; before/after and scope reported |
| MUT-002 | P5 / editor | Trusted authorization | Apply without trusted task/user approval or with spoofed flag | Rejected before side effect |
| MUT-003 | P5 / editor | Expected-before mismatch | Change target value after proposal | STALE_REVISION/expected mismatch; no overwrite |
| MUT-004 | P5 / editor | Owner compare-and-apply | Inject edit between daemon preflight and owner command | Owner rejects mismatch within command |
| MUT-005 | P5 / editor | Range/enum/type | Apply invalid range enum bitmask/reference subtype | Validation fails with exact field; state unchanged |
| MUT-006 | P5 / editor | Null reference binding | Bind declared nullable reference to compatible node/component | Correct live binding and restored serialization |
| MUT-007 | P5 / editor | Setter semantics | Set public property with engine lifecycle/backing field behavior | Engine command/setter used; effective read-back matches |
| MUT-008 | P5 / editor | Undo/redo | Apply one edit then use verified Editor undo/redo | State returns/advances correctly; identities retained |
| MUT-009 | P5 / editor | Explicit save intent | Apply to dirty scene with save=false | Unsaved editor change only; disk not overwritten or saved implicitly |
| MUT-010 | P5 / editor | Idempotency replay | Repeat same apply requestId/idempotency key | Single effect; original outcome replayed or reconciled |
| MUT-011 | P5 / editor | Timeout after write | Lose acknowledgment after owner committed | Indeterminate until read-back; no blind duplicate create |
| MUT-012 | P5 / editor | Partial batch | Fail step 2 after step 1 committed | Per-step results and checkpoint; no atomic-success claim |
| MUT-013 | P5 / editor | Batch interleaving | User edits between batch steps | Revision chain detects conflict; subsequent steps stop |
| MUT-014 | P5 / editor | Rollback conflict | User changes state after checkpoint then request old rollback | Conflict; new user changes not overwritten |
| MUT-015 | P5 / editor | Reentrant callbacks | Setter triggers lifecycle callback changing target state | Postcondition conflict/partial explicit; no false success |
| MUT-016 | P5 / editor | Node structure | Create rename reparent/delete fixture node via qualified adapter | Graph paths refreshed; refs remain correct or blocked impact explicit |
| MUT-017 | P5 / editor | Component dependencies | Add/remove component with requiredComponent constraints | Engine restriction honored; dependent edits in proposal |
| MUT-018 | P5 / editor | Array operations | Set/insert/remove/move array item after stale reorder | Index pinned to revision; stale request rejected |
| MUT-019 | P5 / editor | Cross-document change | Edit linked assets requiring multiple owners | Affected resources and per-file status; no fake all-or-nothing |
| MUT-020 | P5 / editor | Forbidden blanket execution | Request arbitrary eval/shell/method not in capability registry | Rejected; typed registered operations remain usable |

## RUN - Runtime connection (8 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| RUN-001 | P6 / runtime | Opt-in bridge | Build development with bridge disabled/enabled | Bridge present only when explicitly enabled |
| RUN-002 | P6 / runtime | Release exclusion | Build release with default profile | No debug bridge injection/control endpoint |
| RUN-003 | P6 / runtime | Runtime/source identity | Inspect runtime-created object and source-backed object | Correct runtime-only or evidenced counterpart labeling |
| RUN-004 | P6 / runtime | Frame consistency | Capture physics/UI state across frames | Observed time window/consistentFrame truthfully reported |
| RUN-005 | P6 / runtime | Pause/step | Request supported pause/step operation | Authorization/state preconditions honored; step observed |
| RUN-006 | P6 / runtime | Runtime reconnect | Restart preview/native session | New session handles; stale runtime refs rejected |
| RUN-007 | P6 / runtime | Web/native split | Call native-only capability from preview | Unavailable with platform reason; no simulated-native claim |
| RUN-008 | P6 / runtime | No implicit gameplay action | Inspect disabled node or live component | No activation/start/stop/timeScale change caused by read |

## UI - UI geometry/behavior (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| UI-001 | P6 / runtime | Active hierarchy | Read active child below inactive parent | activeSelf true activeInHierarchy false; no forced activation |
| UI-002 | P6 / runtime | Transform/anchor | Inspect UITransform under scaled/rotated parents | Local/world geometry with correct coordinate space |
| UI-003 | P6 / runtime | Widget target | Inspect/safely edit Widget pointing to another node | Correct target path; final alignment read after layout |
| UI-004 | P6 / runtime | Layout scheduling | Set Layout property and capture geometry | Wait observable layout completion; no fixed-delay success inference |
| UI-005 | P6 / runtime | ScrollView bindings | Inspect content/view/scrollbar links | All references map correctly; content offset preserved on read |
| UI-006 | P6 / runtime | Mask/render ordering | Inspect nested masks and sibling order | Hierarchy/render relationships reported without moving nodes |
| UI-007 | P6 / runtime | Label/font/sprite | Map font atlas/spriteFrame/RichText resources | Exact typed sub-assets; no parent-texture collapse |
| UI-008 | P6 / runtime | Control events | Bind Button/Toggle/Slider/EditBox handler via qualified adapter | Receiver signature and reference valid; expected event observed once |
| UI-009 | P6 / runtime | Reference viewport | Compare UI before/after no-op at 720x1280 fixture | Geometry and approved screenshots equivalent; no resize drift |
| UI-010 | P6 / runtime | Tall viewport | Resize short/long popup fixture then return to reference | Desired anchors/hidden bottom preserved; reference geometry restored |

## DOM - Engine domains (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| DOM-001 | P6 / runtime | Animation state | Read clip/controller and currently playing track | Typed source/runtime states separated |
| DOM-002 | P6 / runtime | Animation cancel | Play/stop/scrub supported animation then cancel | Owner state/read-back correct; no orphan callbacks |
| DOM-003 | P6 / runtime | Spine availability | Call Spine adapter with/without compatible package | Capability/version state accurate; no assumed integration |
| DOM-004 | P6 / runtime | Render material | Change permitted material property/texture in fixture | Correct typed material binding and observed render output |
| DOM-005 | P6 / runtime | Camera/render capture | Capture chosen camera/viewport screenshot | Correct target resolution/scene; artifact linked to revision/time |
| DOM-006 | P6 / runtime | Physics query | Inspect 2D/3D rigidbody/collider state | Correct world units and backend/source label |
| DOM-007 | P6 / runtime | Physics mutation | Apply qualified collider/rigidbody config during permitted state | Engine constraints honored; runtime read-back measured |
| DOM-008 | P6 / runtime | Audio state/action | Play/stop controlled fixture AudioSource | Selected source and observed state; no total-native-voice claim without telemetry |
| DOM-009 | P6 / runtime | Input simulation | Send bounded supported input to selected runtime | Expected event on correct target; no input in unrelated app/session |
| DOM-010 | P6 / runtime | Unsupported backend counters | Request native memory/voice/profiler metric absent from backend | Unavailable/partial with reason; never fabricated zero/pass |

## JOB - Jobs/worker protocol (8 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| JOB-001 | P7 / integration | Write job policy | Start deploy/build job directly without required authorization | Same policy gate as apply; no bypass |
| JOB-002 | P7 / integration | Owned cancellation | Cancel job while unrelated process also runs | Only owned process group terminated |
| JOB-003 | P7 / integration | Crash recovery | Daemon/worker exits during running build | Interrupted/indeterminate recorded; no silent replay |
| JOB-004 | P7 / integration | Locks | Start conflicting jobs on same output/worker/project | Serialize or reject; independent ownership tracked |
| JOB-005 | P7 / integration | Worker stdout protocol | Mix malformed JSON line/log into worker output | Protocol error and bounded diagnostics; no parsed false success |
| JOB-006 | P7 / integration | Worker language parity | Replay contract through JS/Python and optional Go/C++ adapter | Same schema/error/cancel/artifact semantics for implemented adapter |
| JOB-007 | P7 / integration | Artifacts instead of binary | Worker emits large capture or build output | Artifact handle/chunks; no unbounded base64 in control channel |
| JOB-008 | P7 / integration | Timeout and late response | Expire job/request then deliver old result | No result attached to new job/session; explicit stale response |

## BLD - Build/platform (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| BLD-001 | P7 / platform | Doctor toolchain | Run profile with missing Creator/SDK/compiler | Unavailable actionable reason; no automatic unrequested install |
| BLD-002 | P7 / platform | Web Mobile build | Build isolated synthetic scene using Creator 3.7.3 | Expected output/exit/log/manifest recorded; build evidence only |
| BLD-003 | P7 / platform | Input changed during build | Modify fixture input after export start | Artifact stale; cache not promoted as current |
| BLD-004 | P7 / platform | Cache inputs | Change engine config adapter or toolchain version | Cache invalidated even if scene bytes unchanged |
| BLD-005 | P7 / platform | Missing output | Delete cached output then request reuse | Cache miss/rebuild or explicit failure; no bogus cache hit |
| BLD-006 | P7 / platform | Build/launch separation | Complete build without installing or opening app | Report build pass only; launch/visual/device NOT_RUN |
| BLD-007 | P7 / platform | Android explicit target | Install APK with multiple devices connected | Only selected serial affected; no first-device default |
| BLD-008 | P7 / platform | Native iOS launch | Build/install/launch on selected supported device/simulator | Record exact target/runtime; simulator not physical-device evidence |
| BLD-009 | P7 / platform | Cancelled build artifact | Cancel during package stage | Partial artifact not advertised as release-ready |
| BLD-010 | P7 / platform | Paths/args | Build project/output paths with spaces and metacharacters | Argument arrays used; no shell interpolation or path corruption |

## DIAG - Diagnostics/profiler (6 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| DIAG-001 | P7 / integration | Console deduplication | Capture repeated warning/error burst with budget | Counts and first/last context retained; loss summary explicit |
| DIAG-002 | P7 / integration | Stack to source | Map stack frames using current source map/index | Correct ranges/hash or explicit unmapped frames |
| DIAG-003 | P7 / integration | Stack to component | Resolve class/method stack frame to live instances | Candidate instances and confidence; no arbitrary single culprit |
| DIAG-004 | P7 / integration | Profiler counter absent | Read counter unsupported by current runtime | Unavailable not zero; source/backend indicated |
| DIAG-005 | P7 / integration | Capture cancellation | Cancel profiler/log capture mid-stream | Capture stops; partial artifact and interval recorded |
| DIAG-006 | P7 / integration | Crash inference boundary | Analyze static malformed asset warning without native execution | No fabricated crash probability or native reproduction claim |

## SVC - Background/service (10 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| SVC-001 | P1/P8 / integration | Start idempotently | Start same daemon twice | Reuse authenticated live instance; no address-in-use failure |
| SVC-002 | P1/P8 / integration | Port collision | Occupied candidate port while starting | OS-assigned free loopback port; registry correct |
| SVC-003 | P1/P8 / integration | Stale PID registry | Registry points to PID reused by unrelated process | No kill or adopt without identity validation |
| SVC-004 | P1/P8 / integration | Graceful stop | Stop idle daemon and daemon with pending reads | Requests close explicitly; owned resources released |
| SVC-005 | P1/P8 / manual | LaunchAgent lifecycle | Install/start/stop/uninstall user service in isolated config | Only toolkit service changed; no root/global unrelated edits |
| SVC-006 | P1/P8 / manual | Login/reboot | Reboot/login with approved auto-start installed | Daemon starts after login; no build/mutation replay |
| SVC-007 | P1/P8 / manual | Sleep/wake | Sleep during session then wake | Reconnect/refresh; stale handles invalidated; no availability claim during sleep |
| SVC-008 | P1/P8 / integration | Log rotation | Emit logs beyond 5x5 MiB budget | Bounded retention and no token/secret leakage |
| SVC-009 | P1/P8 / integration | Cache pruning | Reach snapshot/artifact retention limit | Expired artifacts explicit; no live ownership corruption |
| SVC-010 | P1/P8 / benchmark | Idle usage | Leave daemon connected but unused | No home-wide scans/busy-loop; measured CPU/memory within declared release budget |

## PKG - Package/docs/qualification (6 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| PKG-001 | P8 / integration | Clean install | Install archive into user path with spaces | CLI/daemon/extension assets found; doctor reports dependencies truthfully |
| PKG-002 | P8 / integration | Upgrade config | Upgrade from previous config/schema fixture | Migration or explicit incompatibility; recoverable previous config |
| PKG-003 | P8 / integration | Uninstall boundary | Uninstall kit while unrelated project/cache exists | Only tool-owned files/service removed; game unchanged |
| PKG-004 | P8 / integration | Archive content | Scan release package for tokens/game assets/sources/cache | No private game source/audio/token bundled |
| PKG-005 | P8 / integration | Skill/schema parity | Compare skill commands/examples against live capability registry | All documented commands valid or availability-qualified |
| PKG-006 | P8 / integration | Coverage honesty | Generate report with mixed pass/fail/blocked/unavailable types | Inventory/read/roundtrip/write separate; no 100% whole-engine claim |

## PERF - Performance/context (8 cases)

| ID | Phase / evidence | Tình huống | Thực hiện | Kết quả bắt buộc |
| --- | --- | --- | --- | --- |
| PERF-001 | P8 / benchmark | Fixed context benchmark | Replay five fixed tasks with/without kit using pinned tokenizer | Input/output/tokenizer versions recorded; comparable token counts |
| PERF-002 | P8 / benchmark | Context target | Compare median context footprint of fixed tasks | Target >=70% reduction; actual value reported even when target missed |
| PERF-003 | P8 / benchmark | Warm query latency | Measure cached reads on <=5000-node fixture after warmup | p50/p95 and environment recorded; target p95<=300ms |
| PERF-004 | P8 / benchmark | Cold/warm separation | Measure initial index and cached reads separately | No cold-index/build time hidden inside warm-only claim |
| PERF-005 | P8 / benchmark | Full finding preservation | Compare compact/paged and full query outputs | Same semantic findings and warnings; compaction not used to hide errors |
| PERF-006 | P8 / benchmark | Large graph budgets | Index large scene with cycles/shared refs within budgets | Bounded memory/time or explicit partial/limit; no hang |
| PERF-007 | P8 / benchmark | Schema overhead | Compare facade schema vs expanded operation schemas | Actual serialized bytes/tokens measured; no upstream Unity savings copied |
| PERF-008 | P8 / benchmark | Reproducibility | Repeat benchmark with same fixture and changed runtime version | Runs versioned; drift visible; not compare incompatible environments silently |

