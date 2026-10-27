# Version adapter qualification — 2026-10-27

Release 0.10.0 retains the existing 3.7.3 qualification and adds automatic detection/adapters for 3.6.3, 2.1.3 and 2.4.15. No registered game project was changed. Tests and actual engine runs used isolated generated projects.

| Check | 3.6.3 | 2.4.15 | 2.1.3 |
| --- | --- | --- | --- |
| Metadata/format selection and mismatch handling | PASS | PASS | PASS fixture |
| Actual serialized graph integrity | PASS, 11 records / 2 nodes | PASS, 15 records / 6 nodes | NOT_RUN |
| No-edit restore | Byte-identical | Byte-identical | Fixture only |
| Actual Editor handshake and scene read | PASS on macOS | PASS on macOS | NOT_RUN, not installed |
| Web Mobile full job pipeline | PASS on macOS | FAILED in installed Creator exporter | NOT_RUN |
| Browser runtime UI | Contract/fixture only | Contract/fixture only | Contract/fixture only |
| Actual Windows execution | NOT_RUN | NOT_RUN | NOT_RUN |

3.6.3 export initially succeeded but artifacts were marked stale because the engine writes root local/logs/project.log. A focused regression demonstrated the issue. The final fingerprint excludes only root local/logs; local configuration and nested source remain inputs. A new explicitly approved build completed with unchanged inputs and a non-stale artifact manifest.

2.4.15 export failed with `TypeError: Cannot read property 'exportSimpleProject' of undefined` in Creator's build worker. A cached-project retry and an x86_64/Rosetta diagnostic also failed. These results do not establish successful 2.x build support; the adapter stays experimental. No installed engine files or global preferences were changed to mask the failure.

Independent review found stale live adapters after metadata changes. The issue was reproduced and corrected: Editor/runtime capture check project version before and after owner reads; mutation proposal/apply paths validate current project version; removal of metadata also refuses the operation. Reviewer confirmed all four focused correction regressions passed. New-version Editor sessions force mutationV1=false on the server. Only the prior 3.7.3 mutation qualification is retained.

Core/contract suite: 233 tests passed, zero skipped. Additional checks cover legacy cc.Class method lookup without factory execution, Node 8 HTTP/proxy contracts, exact installed-version discovery, .fire/.scene separation, inactive UI geometry, native ESM module delivery and isolation from unrelated project metadata. Node 8 contracts do not establish a real Creator 2.1.3 run.

Raw local evidence: output/compatibility/<version>/{editor-report.json,disk-report.json,build-report.json} and build logs. These ignored local files are not distributed as credentials or copied wholesale into the skill. Installed qualification Creator/worker processes were terminated; no native device, browser visual or gameplay proof is claimed.
