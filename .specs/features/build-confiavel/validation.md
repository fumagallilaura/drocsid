# Validation build-confiavel: FAIL

**Date**: 2026-10-24  
**Spec**: `.specs/features/build-confiavel/spec.md`  
**Diff range**: `dc8d7a1..e8e89d3`  
**Verifier**: independent sub-agent, author != verifier

Os 11 comandos de gate passaram. A entrega ainda precisa de dois testes de regressão: encerramento único da seleção de captura e conclusão determinística do teste de prazo do teardown. Nenhum defeito funcional foi observado na execução baseline. O sensor encontrou uma regressão de captura que os testes aceitam e um teste de prazo que fica pendente até o watchdog externo.

## Task completion and scope

Não há `tasks.md` nesta feature. O plano de execução na spec contém três passos concluídos. Revalidei esses passos pelo diff e pelas execuções abaixo, sem usar `evidence.md` como prova.

| Step | Implementation | Independent validation |
| --- | --- | --- |
| Desktop/profile integration | `5190489` | Gates passam; falta prova exata de settlement único no edge case de captura. |
| Packaging/staging/manifest | `3fb3ac7` | Gates e comparações de bytes/hash passam. |
| Source diagnostic/harness cleanup | `e8e89d3` | Gates passam; teste do limite de 5 s não termina deterministicamente sob a mutação M9. |

Escopo revisto: os 19 arquivos do diff. Não há alterações em autenticação, TURN, SFU ou publicação. Nenhuma conclusão aqui aprova os 68 requisitos STAB, qualidade física de áudio, ruído/eco, assinatura, instalador, Device Guard em outras máquinas ou publicação.

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
| BUILD-08: failed launch/cleanup | All remaining resources cleaned; terminal result within 5 s, including WS waits | `tests/harness.test.js:24`: `assert.rejects(closeResources([...]), AggregateError)`; `:25`: `assert.equal(killed, true); assert.equal(server.listening, false)`; `:26`: refused connection `{ code: 'ECONNREFUSED' }`; `:41`: `await assert.rejects(waiting, /WS closed/)`; `:55`: launch failure `error.code === 1`, `error.killed === false`, stderr ENOENT/launch failure; `:56`: `assert.ok(performance.now() - started < 5000)`. However, `:32`/`:33` only ticks the mocked clock 5000 and awaits rejection. M9 shows this test itself remains pending beyond the required deadline. | GAP: deterministic deadline proof (G2) |
| BUILD-09: boolean test flags | 0=false, 1=true, all other supplied values rejected | `tests/harness.test.js:12`: `assert.equal(readFlag('FLAG', false, { FLAG: '0' }), false)`; `:13`: `assert.equal(readFlag('FLAG', false, { FLAG: '1' }), true)`; `:15`: `assert.throws(() => readFlag('FLAG', false, { FLAG }), /must be 0 or 1/)` for empty, false, yes and 2; `:17`: CHECK_SOURCE=0 selects provided executable. `scripts/desktop-smoke.mjs:45` and `scripts/startup-audio-check.mjs:7` use the shared reader. | PASS |
| BUILD-10: desktop smoke | Messages, bidirectional audio RTP, screen select/stop, call exit; no renderer errors | `scripts/desktop-smoke.mjs:164`: second user sees exact sent message; `:205`/`:207`/`:208`: each of first/second observes `inbound-rtp`, `kind === 'audio'`, `bytesReceived > 0`, poll `.toBe(true)`; `:218`: choose unique capture title; `:225`: remote videoWidth > 0 `.toBe(true)`; `:246`: remote screen label `.toHaveCount(0)` after stop; `:251`: `expect.poll(firstMuted).toBe(true)`; `:252`: remaining participant text visible; `:253`: `if (errors.length) throw new Error(...)`. Passed source and win-unpacked, internal and external service. The separate capture edge case has G1. | PASS functional AC; edge case blocked by G1 |
| BUILD-11: actual Windows artifact manifest | Current version, portable SHA-256, executable and actual artifact path | `scripts/build-windows.mjs:16`: copy actual staging artifact to portable path; `:22`/`:23`: write `{ version, sha256: digest.digest('hex'), portable, executable: resolve(staging, 'win-unpacked/Conversa.exe') }`. `scripts/check-package.mjs:9`: `assert.equal(manifest.version, metadata.version)`; `:10`/`:11`: both paths exist; `:14`: `assert.equal(digest.digest('hex'), manifest.sha256)`; `:31`: ASAR version equals manifest; `:35`: bundle bytes equal current dist. `scripts/portable-startup-check.mjs:28`/`:32`/`:35`: actual wrapper opens preload/local service and commits exactly one message. | PASS |

**Coverage**: 10/11 ACs have adequate outcome checks; BUILD-08 has a deadline-test gap. All 11 have file:line evidence and baseline outcomes. No spec-precision gap. Capture's explicit edge case additionally lacks an exact outcome assertion.

## Gate check

All runs below were sequential for Electron/global capture. No dist:win rerun was needed: check-package compared the current source and newly rebuilt dist against the ASAR, then recomputed the portable hash.

| Command / target | Exit | Observed outcome |
| --- | --- | --- |
| `npm test` | 0 | 50 passed, 0 failed, 0 skipped, 0 cancelled. |
| `npm run build` | 0 | Vite 7.3.7, 1582 modules, current dist produced. |
| `node scripts/check-package.mjs` | 0 | Current module/bundle bytes, version and SHA-256 match. |
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

Every new test maps to an AC or listed edge case. The two gaps below concern strength of assertions, not weakened pre-existing tests.

## Discrimination sensor

Nine semantic faults were injected one at a time into a detached worktree at e8e89d3 under `%TEMP%`. Files were restored between attempts. The shared node_modules was a read-only junction for the sensor. No mutation touched real implementation/tests; no git stash was used.

| Mutant | File:line | Semantic fault | Relevant command and observation | Classification |
| --- | --- | --- | --- | --- |
| M1 | `electron/policy.js:15` | Allow video in mediaTypes request. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:13`, true !== false. | Killed by assertion |
| M2 | `electron/policy.js:18` | Remove privileged IPC senderFrame===mainFrame requirement. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:25`, true !== false. | Killed by assertion |
| M3 | `electron/policy.js:22` | Remove display securityOrigin requirement. | Node desktop-policy, exit 1; `tests/desktop-policy.test.js:34`, true !== false. | Killed by assertion |
| M4 | `electron/main.js:24` | Parse persisted preferences but do not restore them. | Source profile checker, exit 1; `scripts/desktop-profile-check.mjs:59`, expected Perfil persistente, actual empty. | Killed by assertion |
| M5 | `electron/main.js:18` | Duplicate profile exits 0 instead of 1. | Source profile checker, exit 1; `scripts/desktop-profile-check.mjs:52`, expected 1, actual 0. | Killed by assertion |
| M6 | `scripts/prepare-electron.mjs:9` | Keep previous staging inventory. | Node packaging, exit 1; `tests/packaging.test.js:20`, obsolete file true !== false. | Killed by assertion |
| M7 | `scripts/test-runtime.mjs:8` | Interpret flag 0 as true. | Node harness, exit 1; `tests/harness.test.js:12`, true !== false. | Killed by assertion |
| M8 | `electron/main.js:53` | Remove `pending.delete(requestId)` from settleCapture. Settled requests remain available for a second callback on reload/close and late inventory. | Node suite: 50/50, exit 0; source profile checker: exit 0; source smoke: exit 0. | SURVIVED, G1 |
| M9 | `scripts/test-runtime.mjs:27` | Extend cleanup deadline from 4500 to 6000 ms. | Node harness stayed pending after its first two tests. External runner killed it at 45024 ms, ETIMEDOUT/SIGTERM. No deadline assertion failure was produced. | External timeout only, G2; not counted as an assertion kill |

**Sensor result**: 9 injected; 7 assertion kills; 1 surviving mutant; 1 external timeout. Sensor FAIL. M8 was also run against the full Node gate, not only a selected unit test.

Raw sensor summaries/logs were saved outside the repository as `%TEMP%/conversa-verifier-sensor-results.json` and `%TEMP%/conversa-verifier-M*.log`.

Isolation was checked **after cleanup and before writing this report**. The node_modules junction was removed as a link, then the verified absolute TEMP worktree was removed. Real node_modules remains present. No sensor process remained. The exact real-tree porcelain before/after was identical:

```text
 M .specs/STATE.md
 M .specs/features/estabilizacao/spec.md
```

These two pre-existing documentary modifications were preserved. `git status` in the scratch was clean after restoration. No implementation fix or commit was made by the Verifier.

## Edge cases

| Edge case | Evidence and result |
| --- | --- |
| Invalid profile preserves existing file and starts safe defaults | `scripts/desktop-profile-check.mjs:26`: `.toEqual({ name: '', server: '', quality: '1080' })`; `:27`: file `.toBe('{invalid preferences')`. PASS. |
| Cancel, reload or close during source inventory settles selection once | Current main.js removes the pending entry before callback (`electron/main.js:53`/`:54`). The checker exercises inventory failure, delayed inventory+reload and later picker cancellation (`scripts/desktop-profile-check.mjs:70` through `:88`) but does not count callback invocations or assert the pending state. Removing the required deletion survives. GAP G1. |
| Rejected close cannot prevent external server closure | `tests/harness.test.js:24`/`:25`/`:26` assert AggregateError, server not listening and ECONNREFUSED. PASS. |
| Synthetic smoke does not approve physical noise/quality | No such approval claimed. Physical diagnosis remains outside this evidence. |

## Code quality

Reviewed against the skill's complete coding-principles.md plus the repository's existing style. No repository AGENTS.md or additional quality guideline was found in the inspected project/ancestor paths.

| Check | Result |
| --- | --- |
| No features outside the request | PASS, changes close desktop/build/harness integration. |
| No single-use abstraction or unnecessary configurability | PASS, policy and runtime helper are shared across tests/checkers. |
| Surgical files and matching patterns | PASS, only the specified integration/build surface plus its documentation/tests. |
| Existing test integrity | PASS, +11 tests and no modified old test files. |
| Domain outcome coverage and payload conjunction | PASS for policy/preferences/package data; G1 for capture callback cardinality. |
| Happy, edge and failure paths | Partial: invalid profile, permission, launch, teardown, WS and inventory errors exercised; exact capture-settlement and deterministic deadline proof need fixes. |
| Every new test maps to requirement/edge | PASS, matrix above. |
| Ready for independent approval | FAIL until G1/G2 are closed. |

## Ranked fix tasks

### G1, Major: prove capture settles exactly once

- **Grounding**: M8 survived; explicit capture edge case. `electron/main.js:53`, `scripts/desktop-profile-check.mjs:70`, `scripts/desktop-profile-check.mjs:89`.
- **Root cause**: The E2E asserts UI recovery and `nativeErrors` empty, but observes only UnhandledPromiseRejection/uncaughtException. Settlement exceptions are caught/logged as MEDIA_FAILED, and callback cardinality/pending-entry removal are not asserted.
- **Fix task**: Add a focused bootstrap/fixture or equivalent isolated test that controls the inventory promise and records the display-request callback result/count. Exercise cancellation, reload and window close while inventory is pending, then release the late inventory.
- **Done when**: Each request produces one null cancellation callback, no late source delivery, no pending request, and no second callback after late resolution or another cleanup. The exact M8 deletion mutation must fail the test. Keep production free of test-only hooks if the public Electron registration surface can be intercepted by a fixture.
- **Verify**: Node/full build gate, source profile/smoke, and repeat M8 in TEMP. Do not change the required outcome to accept duplicate callbacks.

### G2, Major: make the 5 s deadline test fail deterministically

- **Grounding**: BUILD-08; M9 external watchdog timeout. `tests/harness.test.js:29`, `tests/harness.test.js:32`, `tests/harness.test.js:33`.
- **Root cause**: Ticking a mocked clock by 5000 then awaiting the same still-pending rejection leaves the test suspended when the implementation deadline drifts beyond the limit. The regression is only detected by the Verifier's 45 s process watchdog.
- **Fix task**: Add an observable settlement/checkpoint around the fake clock advance, or another bounded assertion that checks completion at the 5 s boundary. Guarantee cleanup of any test resources even if that check fails.
- **Done when**: Current 4500 ms deadline passes. A 6000 ms deadline produces a specific assertion failure promptly, without hanging the test process or depending on an external timeout. Remaining teardown/WS tests still pass.
- **Verify**: Targeted harness and full Node suite; repeat M9 in TEMP with a short process watchdog.

## Requirement traceability recommendation

The Verifier did not edit spec.md or implementation. Retain feature as incomplete. BUILD-08 needs a fix for deadline proof. BUILD-01/02/03/04/05/06/07/09/10/11 have passing functional evidence, while the capture edge case associated with BUILD-10 must also be closed before feature approval.

## Closing gate and lessons

Closing gate executed: `validate_state.py build-confiavel` returned exit 1 and exactly one error: validation.md verdict is FAIL. The implementation is not independently approved. Project-local lessons for the surviving capture mutant and the deadline-test gap are recorded using the skill script. Route G1/G2 to the author and re-verify.

