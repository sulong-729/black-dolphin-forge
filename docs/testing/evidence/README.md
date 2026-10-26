# Qualification evidence

Phase summary reports are included in source control. Raw Editor captures, local source reports and console logs stay on the qualification machine and are excluded from Git. References to those artifacts in phase summaries identify local evidence; they are not bundled downloads.

Run `npm ci` and `npm run check` for portable core checks. `npm run qualify:editor` and `npm run qualify:source` additionally require a local compatible Cocos Creator installation. See the execution ledger for qualification scope and platform limitations.

P6 browser qualification: run `npm run build` then `node scripts/qualify-runtime.mjs`; use its owned preview URL and command file as documented in the script. Capture reference/tall/restored screenshots through browser tools, stop the harness, then run `node scripts/report-p6.mjs`. This requires Creator 3.7.3 and an interactive browser; raw artifacts/manifest remain local. Never publish the generated preview credential/config or `.superpowers` fixture.
