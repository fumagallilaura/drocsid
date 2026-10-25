# Validation build-confiavel: PASS

**Date**: 2026-10-24
**Spec**: `.specs/features/build-confiavel/spec.md`
**Diff range**: `dc8d7a1..58be3ed`
**Verifier**: independent sub-agent, author != verifier
**Fix/re-verify iteration**: 1 of at most 3

Os 12 gates passaram, os 11 critérios têm evidência compatível com a spec e as dez mutações foram mortas por asserções. G1/G2 da primeira revisão estão fechados. Nenhum gap permanece neste escopo.

## Task completion and scope

Não há `tasks.md` nesta feature. Os quatro passos do plano na spec foram conferidos pelo diff e pelos resultados independentes: integração desktop/perfil, empacotamento/staging/manifesto, diagnóstico/teardown e fortalecimento de captura/prazo. Todos estão concluídos.

Revisei a superfície completa `dc8d7a1..58be3ed`, incluindo o refinamento `e8e89d3..58be3ed`. O refinamento altera testes, fixture, checker e documentação. O diff de produção/runtime é vazio. Nenhuma conclusão depende do `evidence.md` do autor.

Este PASS aprova os 11 BUILD ACs locais. Não aprova todos os 68 requisitos STAB, qualidade física de áudio, causa de ruído/eco, assinatura, publicação, instalador ou execução em outras configurações de Device Guard. Autenticação, TURN e SFU continuam fora do escopo.

## Spec-anchored acceptance criteria

Cada evidência abaixo foi inspecionada no código e executada nesta verificação. As expressões são asserções reais, não apenas nomes de teste.

| Criterion | Spec-defined outcome | File:line + exact assertion/outcome | Result |
| --- | --- | --- | --- |
| BUILD-01: Node suite and compilation | Exit 0, zero failed/skipped tests, existing assertions preserved | `package.json:13`: `node --test tests/*.test.js`; execução: `tests 50`, `pass 50`, `fail 0`, `skipped 0`, exit 0. `package.json:11`: `vite build`, exit 0. O diff em testes existentes é vazio. | PASS |
| BUILD-02: media/privileged IPC trust | Camera, subframe and foreign origin denied; local main-frame audio permitted | `tests/desktop-policy.test.js:11`: `assert.equal(allowPermissionCheck(contents,'media',origin,{...details,mediaType:'audio'},origin),true)`; `:12`: `assert.equal(allowPermissionRequest(contents,'media',{...details,mediaTypes:['audio']},origin),true)`; `:13`: video/mixed/empty requests equal `false`; `:16`/`:17`: subframe/foreign requesting URL/security origin equal `false`; `:19`: foreign requesting origin equals `false`; `:25`: `assert.equal(trustedIpc({sender:contents,senderFrame:{url:origin+'/'}},origin),false)`; `:27`: foreign sender equals `false`; `:32`/`:34`: subframe/foreign display capture equals `false`. Runtime: `scripts/desktop-profile-check.mjs:31`/`:39`, camera and subframe audio results `.toBe('NotAllowedError')`. | PASS |
| BUILD-03: same profile, changed local port | Restore name, server and quality; system audio off | `scripts/desktop-profile-check.mjs:57` reserves old port; `:59`/`:60`: name/server `.toHaveValue(saved.name)` / `.toHaveValue(saved.server)`; `:61`: `expect(Number(new URL(page.url()).port)).not.toBe(oldPort)`; `:62`: `expect(await page.evaluate(() => window.desktop.preferences)).toEqual(saved)`; `:66`: quality `.toHaveValue('720')`; `:67`: system audio checkbox `.not.toBeChecked()`. Passed source and win-unpacked. | PASS |
| BUILD-04: duplicate active profile | Second host exit 1, ALREADY_RUNNING, original host preserved | `scripts/desktop-profile-check.mjs:52`: `expect(code).toBe(1); expect(stderr).toContain('ALREADY_RUNNING')`; `:53`: `expect((await desktop.windows()).length).toBe(before.length)`. Original host remains connected and is then closed/restarted in the same test. Passed source and win-unpacked. | PASS |
| BUILD-05: packaged local modules | All local imports reachable from entrypoint, including shared/protocol.js | `scripts/check-package.mjs:20`: `assert.equal(entries.has(path), true, ...)`; `:24`: packaged/source SHA-256 equality for each JS/CJS module; `:25`/`:27`: recursively follow local imports; `:30`: `assert.equal(checked.has('shared/protocol.js'), true)`. Observed inventory: electron/main.js, electron/policy.js, electron/preload.cjs, server/service.js, shared/protocol.js, package.json. | PASS |
| BUILD-06: reused runtime staging | Only current inventory; no default_app.asar or obsolete files | `tests/packaging.test.js:18`/`:19`: exact current runtime/data; `:20`: `assert.equal(existsSync(join(destination, 'obsolete.dll')), false)`; `:21`: `assert.equal(existsSync(join(destination, 'resources/default_app.asar')), false)`; `:23`: `assert.equal(readFileSync(join(destination, 'electron.exe'), 'utf8'), 'next runtime')`. | PASS |
| BUILD-07: source diagnostic without release manifest | Source launches; zero media elements; no audible playback on entry | `tests/harness.test.js:16`: `assert.deepEqual(desktopTarget({ CONVERSA_CHECK_SOURCE: '1', CONVERSA_BUILD_MANIFEST: 'nonexistent-manifest.json' }), { args: [resolve('.')] })`. Actual source run with nonexistent manifest: `scripts/startup-audio-check.mjs:23`: `expect(samples.flat().some(s => s.audible)).toBe(false)`; `:24`/`:25`: audio/video counts `.toBe(0)`; `:26`: all samples muted `.toBe(true)`. Observed 8 samples, zero audio/video elements. | PASS |
| BUILD-08: failed launch/cleanup | All remaining resources cleaned; terminal result within 5 s, including WS waits | `tests/harness.test.js:24`: `assert.rejects(closeResources([...]), AggregateError)`; `:25`: `assert.equal(killed, true); assert.equal(server.listening, false)`; `:26`: refused connection `{ code: 'ECONNREFUSED' }`. `:33`: AggregateError contains a timed-out cause; `:34`: `t.mock.timers.tick(5000); await new Promise(setImmediate)`; `:35`: `assert.equal(settled, true); await result`. Desktop stalled close: `:38` asserts timed-out rejection; `:39` advances 5000; `:40`: `assert.equal(killed, true); await desktopResult`. `:48`: `await assert.rejects(waiting, /WS closed/)`. Real failed launch: `:62` checks exit 1, killed=false and launch error; `:63`: `assert.ok(performance.now() - started < 5000)`. M9/M10 now fail exact checkpoint assertions. | PASS |
| BUILD-09: boolean test flags | 0=false, 1=true, all other supplied values rejected | `tests/harness.test.js:12`: `assert.equal(readFlag('FLAG', false, { FLAG: '0' }), false)`; `:13`: `assert.equal(readFlag('FLAG', false, { FLAG: '1' }), true)`; `:15`: `assert.throws(() => readFlag('FLAG', false, { FLAG }), /must be 0 or 1/)` for empty, false, yes and 2; `:17`: CHECK_SOURCE=0 selects provided executable. `scripts/desktop-smoke.mjs:45` and `scripts/startup-audio-check.mjs:7` use the shared reader. | PASS |
| BUILD-10: desktop smoke | Messages, bidirectional audio RTP, screen select/stop, call exit; no renderer errors | `scripts/desktop-smoke.mjs:164`: second user sees exact sent message; `:205`/`:207`/`:208`: each of first/second observes `inbound-rtp`, `kind === 'audio'`, `bytesReceived > 0`, poll `.toBe(true)`; `:218`: choose unique capture title; `:225`: remote videoWidth > 0 `.toBe(true)`; `:246`: remote screen label `.toHaveCount(0)` after stop; `:251`: `expect.poll(firstMuted).toBe(true)`; `:252`: remaining participant text visible; `:253`: `if (errors.length) throw new Error(...)`. Passed source and win-unpacked, internal and external service. The separate capture edge case is also proved by desktop-capture-check, below. | PASS |
| BUILD-11: actual Windows artifact manifest | Current version, portable SHA-256, executable and actual artifact path | `scripts/build-windows.mjs:16`: copy actual staging artifact to portable path; `:22`/`:23`: write `{ version, sha256: digest.digest('hex'), portable, executable: resolve(staging, 'win-unpacked/Conversa.exe') }`. `scripts/check-package.mjs:9`: `assert.equal(manifest.version, metadata.version)`; `:10`/`:11`: both paths exist; `:14`: `assert.equal(digest.digest('hex'), manifest.sha256)`; `:31`: ASAR version equals manifest; `:35`: bundle bytes equal current dist. `scripts/portable-startup-check.mjs:28`/`:32`/`:35`: actual wrapper opens preload/local service and commits exactly one message. | PASS |

**Coverage**: 11/11 ACs match their spec-defined outcomes with file:line evidence and executed assertions. No spec-precision gap. All listed edge cases have evidence or an explicit scope limit.


## Gate check

All 12 commands below were re-executed at 58be3ed. Electron/global capture runs were sequential. No dist:win rerun was needed: check-package compared the current source and newly rebuilt dist against the ASAR, then recomputed the portable hash.

| Command / target | Exit | Observed outcome |
| --- | --- | --- |
| `npm test` | 0 | 50 passed, 0 failed, 0 skipped, 0 cancelled. |
| `npm run build` | 0 | Vite 7.3.7, 1582 modules, current dist produced. |
| `node scripts/check-package.mjs` | 0 | Current module/bundle bytes, version and SHA-256 match. |
| `node scripts/desktop-capture-check.mjs`, source fixture | 0 | Exactly one null callback for reload, close and Escape; no late deliveries for obsolete requests. |
| `node scripts/desktop-profile-check.mjs`, source | 0 | Forced port change, restore, camera/subframe denial, duplicate host exit, inventory error/reload path. |
| `node scripts/desktop-smoke.mjs`, source, EXTERNAL=0 | 0 | Message, RTP, capture, stop and call cleanup. |
| Same, source, EXTERNAL=1 | 0 | Above plus separate service, cross-origin connection and third participant on active screen. |
| `node scripts/startup-audio-check.mjs`, source, missing manifest, CHECK_MUTED=1 | 0 | startupAudible=false; samples=8; audioElements=0; videoElements=0. |
| `node scripts/desktop-profile-check.mjs`, win-unpacked | 0 | Same profile assertions as source. |
| `node scripts/desktop-smoke.mjs`, win-unpacked, EXTERNAL=0 | 0 | Full smoke passes. |
| Same, win-unpacked, EXTERNAL=1 | 0 | External service/third participant passes. |
| `node scripts/portable-startup-check.mjs` | 0 | Actual portable wrapper opens renderer/preload/service, sends one committed message, no startup media. |

Source runs removed CONVERSA_TEST_EXECUTABLE and set CONVERSA_CHECK_SOURCE=1. The startup run set CONVERSA_BUILD_MANIFEST to `%TEMP%\conversa-verifier-nonexistent-manifest.json`. Packaged runs set CONVERSA_TEST_EXECUTABLE to the current manifest's executable. Each launch used a newly created temporary profile.

Manifest checked: version 0.1.1, Node 24.21.0, Electron 45.0.0. Portable SHA-256: `cedb8048fedec3463e529401a4b71364e0d571eb65b376dd75042d4226b4f9c4`. Portable: `release-windows/Conversa-0.1.1-Windows.exe`. Executable: `.packaging/builds/1792894774961-cc7e0a83-ddab-45ff-8ba2-e8d922693bc1/win-unpacked/Conversa.exe`.

## Test integrity and mapping

Baseline `dc8d7a1` contains 39 Node tests. Current suite contains 50, a delta of +11. The diff adds three test files and does not modify/remove any existing test or assertion. No skip/disable was introduced. Existing smoke assertions remain; selecting the specific uniquely titled window strengthens capture target selection.

| New tests/checks | Mapped requirement |
| --- | --- |
| desktop-policy: audio/camera, IPC sender frame, display origin/frame | BUILD-02 |
| desktop-policy: bounded supported preference payload | BUILD-03 and invalid-preferences edge case |
| packaging staging inventory | BUILD-06 |
| harness flags/source target | BUILD-07/09 |
| harness failed cleanup, stalled cleanup, WS closure, safe profile cleanup, real failed launch | BUILD-08 |
| profile checker | BUILD-02/03/04 and inventory/invalid-profile edge cases |
| check-package and portable-startup | BUILD-05/11 |
| startup diagnostic | BUILD-07 |
| modified desktop smoke | BUILD-08/09/10 |

Every new test maps to an AC or listed edge case. The refinement strengthens the feature's deadline test without weakening any assertion. The new capture script/fixture maps to BUILD-10 and the explicit capture edge case. It observes the real main entrypoint through public Electron registrations and does not add test-only production hooks.

## Discrimination sensor

Dez falhas semânticas foram reinjetadas individualmente em uma worktree detached de 58be3ed sob `%TEMP%`. Todas foram mortas por asserções, com exit 1 e sem sinal ou timeout externo. Os arquivos foram restaurados entre tentativas. Não usei git stash e nenhuma mutação tocou a árvore real.

| Mutant | File:line | Semantic fault | Relevant command and observation | Classification |
| --- | --- | --- | --- | --- |
| M1 | `electron/policy.js:15` | Allow video in mediaTypes request. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:13`, true !== false. | Killed by assertion |
| M2 | `electron/policy.js:18` | Remove privileged IPC senderFrame===mainFrame requirement. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:25`, true !== false. | Killed by assertion |
| M3 | `electron/policy.js:22` | Remove display securityOrigin requirement. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:34`, true !== false. | Killed by assertion |
| M4 | `electron/main.js:24` | Parse persisted preferences but do not restore them. | Source profile checker, exit 1; `scripts/desktop-profile-check.mjs:59`, expected Perfil persistente, actual empty. | Killed by assertion |
| M5 | `electron/main.js:18` | Duplicate profile exits 0 instead of 1. | Source profile checker, exit 1; `scripts/desktop-profile-check.mjs:52`, expected 1, actual 0. | Killed by assertion |
| M6 | `scripts/prepare-electron.mjs:9` | Keep previous staging inventory. | Node packaging, exit 1; `tests/packaging.test.js:20`, obsolete file true !== false. | Killed by assertion |
| M7 | `scripts/test-runtime.mjs:8` | Interpret flag 0 as true. | Node harness, exit 1; `tests/harness.test.js:12`, true !== false. | Killed by assertion |
| M8 | `electron/main.js:53` | Remove `pending.delete(requestId)` from settleCapture. | `node scripts/desktop-capture-check.mjs`, exit 1 in 2101 ms; `scripts/desktop-capture-check.mjs:39` expects one callback and zero deliveries; observed calls=2, results=['cancelled','cancelled'], deliveries=1. | Killed by assertion |
| M9 | `scripts/test-runtime.mjs:27` | Extend cleanup deadline from 4500 to 6000 ms. | Node harness, exit 1 in 1037 ms; `tests/harness.test.js:35`, `assert.equal(settled, true)`, observed false. | Killed by assertion |
| M10 | `scripts/test-runtime.mjs:23` | Extend stalled desktop close deadline from 4000 to 6000 ms. | Node harness, exit 1 in 1023 ms; `tests/harness.test.js:40`, `assert.equal(killed, true)`, observed false. | Killed by assertion |

**Sensor depth**: expanded, focused on permissions, privileged frame/origin boundaries, profile integrity and teardown/capture races. **Result**: 10 injected, 10 killed by assertions, 0 survived, 0 watchdog timeouts. M1-M7 were repeated against the final commit, not merely retained from the first review.

Logs and mutation definitions are outside the repository: `%TEMP%/conversa-verifier-r1-sensor-results.json` and `%TEMP%/conversa-verifier-r1-M*.log`.

After restoring scratch files, scratch porcelain was clean and no matching sensor process remained. The absolute cleanup target was verified to be a direct child of TEMP with the expected prefix. The dependency junction was removed as a link before worktree removal, and the real node_modules remains present.

Real-tree porcelain was compared after cleanup and **before this report was updated**. It was exactly identical before/after:

```text
 M .specs/STATE.md
 M .specs/features/estabilizacao/spec.md
```

The two pre-existing documentary modifications were preserved. The Verifier changed no implementation or test and made no commit.

## Edge cases and closed gaps

| Edge case / previous gap | Exact evidence and result |
| --- | --- |
| Invalid profile preserves existing file and starts safe defaults | `scripts/desktop-profile-check.mjs:26`: `.toEqual({ name: '', server: '', quality: '1080' })`; `:27`: file `.toBe('{invalid preferences')`. PASS source and win-unpacked. |
| Reload during pending inventory, then late resolution and close (G1) | `scripts/desktop-capture-check.mjs:33` expects `{ calls: 0, results: [], finished: false }` while inventory is pending. `:39`: `expect(await snapshot()).toEqual({ requests: [{ calls: 1, results: ['cancelled'], finished: true }], deliveries: 0 })`. PASS. M8 now fails this exact assertion. |
| Close during pending inventory, then late resolution (G1) | `scripts/desktop-capture-check.mjs:45` closes the requesting page before release; `:49`/`:50`/`:51` assert both obsolete requests have calls=1, results=['cancelled'], finished=true, deliveries=0. PASS. |
| Escape from actual picker, followed by reload (G1) | `scripts/desktop-capture-check.mjs:57` shows picker and cancels by Escape; `:60` through `:63` assert three requests each cancelled exactly once and exactly one source delivery total. PASS. |
| Callback result and real boundary observation | `tests/fixtures/desktop-main.mjs:14`: increment callback count and classify only `result === null` as cancelled; `:15`: invoke original native callback; `:16`: mark real handler completion; `:21`: count actual capture-sources sends; `:23`: import real production entrypoint. No replacement capture policy. |
| Five-second terminal teardown proof (G2) | `tests/harness.test.js:35`: settlement must already be true after fake-clock tick 5000 and real setImmediate flush; `:40`: stalled desktop must already be killed. Both retain rejection assertions. PASS baseline; M9/M10 fail promptly by assertion. |
| Rejected close cannot prevent external server closure | `tests/harness.test.js:24`/`:25`/`:26` assert AggregateError, server not listening and ECONNREFUSED. PASS. |
| Synthetic smoke cannot approve physical noise/quality | No such approval claimed. Physical diagnosis remains outside this evidence. |

## Code quality

Reviewed against the skill's complete coding-principles.md. No repository AGENTS.md or additional quality guideline was found in the inspected project/ancestor paths.

| Check | Result |
| --- | --- |
| No features beyond the authorized build/integration work | PASS |
| No single-use production abstraction or unnecessary flexibility | PASS, policy/runtime helpers have multiple consumers. |
| Surgical file scope and existing patterns | PASS |
| Existing test assertions preserved; none removed, skipped or weakened | PASS, 39 pre-feature tests retained, 11 added; correction adds stronger checkpoints. |
| Exact payload/state conjunction, not merely call occurrence | PASS, preferences/package bytes and capture calls/results/finished/deliveries checked on value. |
| Domain mapping and happy, edge, failure paths | PASS for the defined BUILD surface and edge cases. |
| Every new test maps to an AC or edge case | PASS |
| Independent approval | PASS |

## Review history and traceability

First review at e8e89d3 found two Major test gaps: duplicate capture settlement survived the tests, and the mocked deadline test only stopped under the external watchdog. Commit 58be3ed strengthens tests without changing production. The final gate and mutation results above close both gaps.

All BUILD-01 through BUILD-11 are verified. The Verifier updated only this report in the real tree during this re-verification; the orchestrator can update spec traceability from its pending statuses.

No interactive UAT was used: this feature is a local build/integration validation. Tests use temporary profiles and synthetic media. They do not substitute for a physical audio/device trial.

## Closing gate and lessons

The two grounded first-review lessons remain recorded by lessons.py as L-001 and L-002, both candidates. The final review has no new surviving mutant, AC gap, spec-precision gap or deviation, so no additional lesson was written.


Closing gate executed: portable Python ran the skill's validate_state.py build-confiavel from the project root. Exit 0; output: validate_state: 0 error(s) across [build-confiavel].
