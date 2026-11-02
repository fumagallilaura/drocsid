# captura-midia-saida proofs

**HEAD**: ec874ec
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 93 pass, 2 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `node scripts/startup-audio-check.mjs` | pass |
| C2 | `run node / ✔ MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic actio` | pass |
| C2 | `run node / ✔ MEDIA-02/09/10/28: one selection per operation, audio requires consent and old display cannot rep` | pass |
| C3 | `run node / ✔ MEDIA-03/28: permissions resolved in either order release every old track and preserve the new at` | pass |
| C4 | `run node / ✔ MEDIA-04/28: a stale generation allocator fails before any capture and close rejects capture acti` | pass |
| C5 | `run node / ✔ MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic actio` | pass |
| C5 | `run node / ✔ MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media` | pass |
| C5 | `run node / ✔ MEDIA-05/21/28: cancellation keeps the original context while admission and leave replies are del` | pass |
| C5 | `run node / ✔ MEDIA-05/24/25/28: v2 requires bounded positive generations in every call event and rejects v1` | pass |
| C5 | `run node / ✔ MEDIA-05/24/28: v1 requests cannot enter a v2 service or occupy its call` | pass |
| C5 | `run node / ✔ MEDIA-05/24/28: successive Call owners share a Session generation and stale epochs fail before ac` | pass |
| C5 | `run node / ✔ MEDIA-05/28: ack action, callId and generation must match the pending operation` | pass |
| C6 | `run node / ✔ MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media` | pass |
| C6 | `run node / ✔ MEDIA-06/31: the actual 8s admission deadline releases the provisional stream and identifies the ` | pass |
| C7 | `node scripts/desktop-smoke.mjs` | pass |
| C8 | `run node / ✔ MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic actio` | pass |
| C9 | `run node / ✔ MEDIA-02/09/10/28: one selection per operation, audio requires consent and old display cannot rep` | pass |
| C9 | `run node / ✔ MEDIA-09/11/28: capture keys are bounded and identify exactly one call operation` | pass |
| C9 | `node scripts/desktop-capture-check.mjs` | pass |
| C10 | `run node / ✔ MEDIA-02/09/10/28: one selection per operation, audio requires consent and old display cannot rep` | pass |
| C10 | `node scripts/desktop-capture-check.mjs` | pass |
| C11 | `run node / ✔ MEDIA-09/11/28: capture keys are bounded and identify exactly one call operation` | pass |
| C11 | `node scripts/desktop-capture-check.mjs` | pass |
| C12 | `node scripts/desktop-capture-check.mjs` | pass |
| C13 | `node scripts/desktop-capture-check.mjs` | pass |
| C14 | `run node / ✔ MEDIA-14/15/19/20: provisional screen, late peer and stalled sender all roll back without disturb` | pass |
| C14 | `run node / ✔ MEDIA-14/17/18: publication and acknowledgement share an absolute 8s budget` | pass |
| C15 | `run node / ✔ MEDIA-14/15/19/20: provisional screen, late peer and stalled sender all roll back without disturb` | pass |
| C16 | `run node / ✔ MEDIA-16/17/19: repeated stop shares its original cleanup deadline and preserves mute` | pass |
| C16 | `run node / ✔ MEDIA-16/17/21/24: stop and leave overlap without losing tracks, extending cleanup or changing re` | pass |
| C17 | `run node / ✔ MEDIA-14/17/18: publication and acknowledgement share an absolute 8s budget` | pass |
| C17 | `run node / ✔ MEDIA-16/17/19: repeated stop shares its original cleanup deadline and preserves mute` | pass |
| C17 | `run node / ✔ MEDIA-16/17/21/24: stop and leave overlap without losing tracks, extending cleanup or changing re` | pass |
| C17 | `run node / ✔ MEDIA-17/19/31: failed terminal notification preserves local cleanup and identifies the screen op` | pass |
| C17 | `run node / ✔ MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after un` | pass |
| C17 | `run node / ✔ MEDIA-17/28: local stop settles within 1s without its ack and an old failure cannot affect the ne` | pass |
| C17 | `run node / ✔ MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same ca` | pass |
| C18 | `run node / ✔ MEDIA-14/17/18: publication and acknowledgement share an absolute 8s budget` | pass |
| C19 | `run node / ✔ MEDIA-14/15/19/20: provisional screen, late peer and stalled sender all roll back without disturb` | pass |
| C19 | `run node / ✔ MEDIA-16/17/19: repeated stop shares its original cleanup deadline and preserves mute` | pass |
| C19 | `run node / ✔ MEDIA-17/19/31: failed terminal notification preserves local cleanup and identifies the screen op` | pass |
| C20 | `run node / ✔ MEDIA-14/15/19/20: provisional screen, late peer and stalled sender all roll back without disturb` | pass |
| C21 | `run node / ✔ MEDIA-05/21/28: cancellation keeps the original context while admission and leave replies are del` | pass |
| C21 | `run node / ✔ MEDIA-16/17/21/24: stop and leave overlap without losing tracks, extending cleanup or changing re` | pass |
| C21 | `run node / ✔ MEDIA-21/26/31: terminal timeout closes transport after local resources have already ended` | pass |
| C21 | `node scripts/desktop-lifecycle-check.mjs` | pass |
| C22 | `node scripts/desktop-lifecycle-check.mjs` | pass |
| C23 | `node scripts/desktop-lifecycle-check.mjs` | pass |
| C24 | `run node / ✔ MEDIA-05/24/25/28: v2 requires bounded positive generations in every call event and rejects v1` | pass |
| C24 | `run node / ✔ MEDIA-05/24/28: v1 requests cannot enter a v2 service or occupy its call` | pass |
| C24 | `run node / ✔ MEDIA-05/24/28: successive Call owners share a Session generation and stale epochs fail before ac` | pass |
| C24 | `run node / ✔ MEDIA-16/17/21/24: stop and leave overlap without losing tracks, extending cleanup or changing re` | pass |
| C24 | `run node / ✔ MEDIA-24/28/31: cancelling a pending call rejects it immediately and consumes late ack/error with` | pass |
| C24 | `run node / ✔ MEDIA-24/28: leave delivered before a held join makes that generation terminal without touching a` | pass |
| C25 | `run node / ✔ MEDIA-05/24/25/28: v2 requires bounded positive generations in every call event and rejects v1` | pass |
| C25 | `run node / ✔ MEDIA-25/26: saturated message, media and signaling budgets still allow stop and replacement at c` | pass |
| C26 | `run node / ✔ MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after un` | pass |
| C26 | `run node / ✔ MEDIA-21/26/31: terminal timeout closes transport after local resources have already ended` | pass |
| C26 | `run node / ✔ MEDIA-25/26: saturated message, media and signaling budgets still allow stop and replacement at c` | pass |
| C26 | `run node / ✔ MEDIA-26/28: v2 requires positive ack generations and presence revisions` | pass |
| C27 | `run node / ✔ MEDIA-27: heartbeat deadline follows an off-tick pong and clears timers on close` | pass |
| C28 | `run node / ✔ MEDIA-02/09/10/28: one selection per operation, audio requires consent and old display cannot rep` | pass |
| C28 | `run node / ✔ MEDIA-03/28: permissions resolved in either order release every old track and preserve the new at` | pass |
| C28 | `run node / ✔ MEDIA-04/28: a stale generation allocator fails before any capture and close rejects capture acti` | pass |
| C28 | `run node / ✔ MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media` | pass |
| C28 | `run node / ✔ MEDIA-05/21/28: cancellation keeps the original context while admission and leave replies are del` | pass |
| C28 | `run node / ✔ MEDIA-05/24/25/28: v2 requires bounded positive generations in every call event and rejects v1` | pass |
| C28 | `run node / ✔ MEDIA-05/24/28: v1 requests cannot enter a v2 service or occupy its call` | pass |
| C28 | `run node / ✔ MEDIA-05/24/28: successive Call owners share a Session generation and stale epochs fail before ac` | pass |
| C28 | `run node / ✔ MEDIA-05/28: ack action, callId and generation must match the pending operation` | pass |
| C28 | `run node / ✔ MEDIA-09/11/28: capture keys are bounded and identify exactly one call operation` | pass |
| C28 | `run node / ✔ MEDIA-17/28: local stop settles within 1s without its ack and an old failure cannot affect the ne` | pass |
| C28 | `run node / ✔ MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same ca` | pass |
| C28 | `run node / ✔ MEDIA-24/28/31: cancelling a pending call rejects it immediately and consumes late ack/error with` | pass |
| C28 | `run node / ✔ MEDIA-24/28: leave delivered before a held join makes that generation terminal without touching a` | pass |
| C28 | `run node / ✔ MEDIA-26/28: v2 requires positive ack generations and presence revisions` | pass |
| C28 | `run node / ✔ MEDIA-28: signaling from a terminal remote call cannot mutate the new peer or its microphone` | pass |
| C28 | `run node / ✔ MEDIA-28: presence applies only increasing revisions in the current room context` | pass |
| C28 | `run node / ✔ MEDIA-28: an old terminal deadline cannot disconnect a newer admitted attempt` | pass |
| C28 | `run node / ✔ MEDIA-28: signaling addressed to a terminal local attempt never reaches the new Call owner` | pass |
| C29 | `node scripts/desktop-smoke.mjs` | pass |
| C30 | `run node / ✔ MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic actio` | pass |
| C31 | `run node / ✔ MEDIA-02/05/08/30/31: allocated context covers all sends, listen-only needs an explicit mic actio` | pass |
| C31 | `run node / ✔ MEDIA-06/31: the actual 8s admission deadline releases the provisional stream and identifies the ` | pass |
| C31 | `run node / ✔ MEDIA-17/19/31: failed terminal notification preserves local cleanup and identifies the screen op` | pass |
| C31 | `run node / ✔ MEDIA-21/26/31: terminal timeout closes transport after local resources have already ended` | pass |
| C31 | `run node / ✔ MEDIA-24/28/31: cancelling a pending call rejects it immediately and consumes late ack/error with` | pass |
| C31 | `node scripts/desktop-smoke.mjs` | pass |
| C32 | `run node / ✔ MEDIA-32: media diagnostics exclude sensitive error properties and untrusted cause names` | pass |
| C32 | `node scripts/desktop-smoke.mjs` | pass |
| C33 | `node -e "process.stderr.write('T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis'); proc` | **fail** |
| C34 | `node -e "process.stderr.write('T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis'); proc` | **fail** |
| Build | `npm.cmd test` | pass |
| Build | `npm.cmd run build` | pass |
| Build | `node scripts/desktop-smoke.mjs` | pass |

## Output

`Run node` - exit 0

```
✔ MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media (0.4335ms)
✔ MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same call (0.5695ms)
✔ MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after unrelated mute (0.4286ms)
✔ MEDIA-28: signaling addressed to a terminal local attempt never reaches the new Call owner (0.5246ms)
✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect (0.8594ms)
✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition (0.6727ms)
✔ STAB-38: every A1 phase ends at 8s and permits a manual retry (4.7713ms)
ℹ tests 94
ℹ suites 0
ℹ pass 94
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1537.2626
```

`node scripts/startup-audio-check.mjs` - exit 0

```
{"startupAudible":false,"samples":16,"audioElements":0,"videoElements":0,"mediaElements":[]}
```

`node scripts/desktop-smoke.mjs` - exit 0

```
PASS: Windows desktop, two users, group chat, voice RTP, mute, screen video, stop capture, room creation and call cleanup.
```

`node scripts/desktop-capture-check.mjs` - exit 0

```
PASS: reload/close during pending inventory and Escape each cancel exactly once; no late delivery or second callback after cleanup.
PASS: native gesture, guard across Call owners, cancellation before handler, duplicate handler, 60s boundary, invalid source/key and old-document IPC.
```

`node scripts/desktop-lifecycle-check.mjs` - exit 0

```
PASS: all acquired mic, display and system-audio tracks ended within 1s on reload, disconnect, React Root.unmount and window close; playback blocked.
```

`node -e "process.stderr.write('T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis'); proc` - exit 1

```
T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis
```
