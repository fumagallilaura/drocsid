# estabilizacao proofs

**HEAD**: ec874ec
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 158 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run node / ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close` | pass |
| C1 | `node scripts/startup-audio-check.mjs` | pass |
| C2 | `run node / ✔ STAB-02/03: simultaneous microphone activation acquires once; cancel stops late track` | pass |
| C2 | `run node / ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works` | pass |
| C3 | `run node / ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close` | pass |
| C3 | `run node / ✔ STAB-02/03: simultaneous microphone activation acquires once; cancel stops late track` | pass |
| C4 | `run node / ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close` | pass |
| C5 | `run node / ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close` | pass |
| C5 | `node scripts/desktop-lifecycle-check.mjs` | pass |
| C6 | `run node / ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works` | pass |
| C7 | `run node / ✔ STAB-07: every admission rejection releases provisional microphone` | pass |
| C8 | `run node / ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works` | pass |
| C8 | `node scripts/desktop-smoke.mjs` | pass |
| C9 | `run node / ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works` | pass |
| C10 | `run node / ✔ STAB-10/11: screen capture is explicit and late picker result is released` | pass |
| C10 | `node scripts/desktop-capture-check.mjs` | pass |
| C11 | `run node / ✔ STAB-10/11: screen capture is explicit and late picker result is released` | pass |
| C11 | `node scripts/desktop-capture-check.mjs` | pass |
| C12 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C12 | `run node / ✔ STAB-12/13: one stalled sender cannot delay rollback after another sender fails` | pass |
| C13 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C13 | `run node / ✔ STAB-12/13: one stalled sender cannot delay rollback after another sender fails` | pass |
| C14 | `run node / ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects` | pass |
| C15 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C15 | `run node / ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects` | pass |
| C16 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C17 | `run node / ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts` | pass |
| C17 | `node scripts/desktop-smoke.mjs` | pass |
| C18 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C18 | `run node / ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composi` | pass |
| C18 | `run node / ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect` | pass |
| C18 | `run node / ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message` | pass |
| C18 | `run node / ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination` | pass |
| C19 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C19 | `run node / ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history` | pass |
| C20 | `run node / ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts` | pass |
| C20 | `run node / ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composi` | pass |
| C20 | `run node / ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect` | pass |
| C20 | `run node / ✔ STAB-20/22: connection loss preserves pending text across manual reconnect` | pass |
| C21 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C21 | `run node / ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composi` | pass |
| C21 | `run node / ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message` | pass |
| C21 | `run node / ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination` | pass |
| C21 | `run node / ✔ STAB-21/27: rejected text creates no record and 2000 UTF-16 units commit after trim` | pass |
| C22 | `run node / ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect` | pass |
| C22 | `run node / ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message` | pass |
| C22 | `run node / ✔ STAB-20/22: connection loss preserves pending text across manual reconnect` | pass |
| C22 | `run node / ✔ STAB-22/23: lost confirmation retains text until committed history reconciles it` | pass |
| C23 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C23 | `run node / ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composi` | pass |
| C23 | `run node / ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message` | pass |
| C23 | `run node / ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history` | pass |
| C23 | `run node / ✔ STAB-22/23: lost confirmation retains text until committed history reconciles it` | pass |
| C24 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C24 | `run node / ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history` | pass |
| C25 | `run node / ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed` | pass |
| C26 | `run node / ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed` | pass |
| C27 | `run node / ✔ STAB-21/27: rejected text creates no record and 2000 UTF-16 units commit after trim` | pass |
| C27 | `run node / ✔ STAB-27: trimmed message bounds accept 1 and 2000 UTF-16 units` | pass |
| C28 | `run node / ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets` | pass |
| C29 | `run node / ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets` | pass |
| C30 | `run node / ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets` | pass |
| C31 | `node scripts/desktop-smoke.mjs` | pass |
| C32 | `run node / ✔ STAB-32: heartbeat releases silent participant within 60 seconds` | pass |
| C33 | `run node / ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes` | pass |
| C33 | `run node / ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s` | pass |
| C34 | `run node / ✔ STAB-34: registered Vite HMR upgrade works while unknown paths are rejected` | pass |
| C35 | `run node / ✔ STAB-35/37: pending shutdown refuses HTTP and WS with one terminal result` | pass |
| C36 | `run node / ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes` | pass |
| C36 | `run node / ✔ STAB-36/37: both signal handlers close a separate process inside five seconds` | pass |
| C36 | `run node / ✔ STAB-36/37: repeated close does not extend a stalled cleanup deadline` | pass |
| C36 | `node scripts/desktop-lifecycle-check.mjs` | pass |
| C37 | `run node / ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes` | pass |
| C37 | `run node / ✔ STAB-35/37: pending shutdown refuses HTTP and WS with one terminal result` | pass |
| C37 | `run node / ✔ STAB-36/37: both signal handlers close a separate process inside five seconds` | pass |
| C37 | `run node / ✔ STAB-36/37: repeated close does not extend a stalled cleanup deadline` | pass |
| C37 | `run node / ✔ STAB-37/67: failed cleanup still closes remaining resources and diagnostic omits secret payloads` | pass |
| C38 | `run node / ✔ STAB-38: opening WS does not cancel the hello deadline; next attempt can succeed` | pass |
| C38 | `run node / ✔ STAB-38: every A1 phase ends at 8s and permits a manual retry` | pass |
| C39 | `run node / ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts` | pass |
| C39 | `run node / ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composi` | pass |
| C39 | `run node / ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination` | pass |
| C39 | `run node / ✔ STAB-39: old fetch/socket callbacks cannot overwrite a newer connection` | pass |
| C40 | `run node / ✔ STAB-40/41: version and malformed client events have stable distinct outcomes` | pass |
| C40 | `run node / ✔ STAB-40/41: malformed signals never reach a peer and errors keep correlation` | pass |
| C40 | `run node / ✔ STAB-40/41: invalid server shape terminates connection without rendering invalid data` | pass |
| C40 | `run node / ✔ STAB-40: server data is validated before rendering or signaling` | pass |
| C40 | `run node / ✔ STAB-40: received display and room names have 1 to 32 UTF-16 units after trim` | pass |
| C41 | `run node / ✔ STAB-40/41: version and malformed client events have stable distinct outcomes` | pass |
| C41 | `run node / ✔ STAB-40/41: malformed signals never reach a peer and errors keep correlation` | pass |
| C41 | `run node / ✔ STAB-40/41: invalid server shape terminates connection without rendering invalid data` | pass |
| C42 | `run node / ✔ STAB-42/43: stalled peers terminate at 15s; candidates are bounded and expire` | pass |
| C43 | `run node / ✔ STAB-42/43: stalled peers terminate at 15s; candidates are bounded and expire` | pass |
| C43 | `run node / ✔ STAB-43: each queued candidate expires by its own age without closing the ready peer` | pass |
| C44 | `node scripts/desktop-smoke.mjs` | pass |
| C45 | `run node / ✔ STAB-45: preference contract persists only bounded supported profile fields` | pass |
| C45 | `node scripts/desktop-profile-check.mjs` | pass |
| C46 | `run node / ✔ STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back` | pass |
| C47 | `run node / ✔ STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back` | pass |
| C48 | `run node / ✔ STAB-48: only main local frame may request audio, never camera` | pass |
| C48 | `run node / ✔ STAB-48: privileged IPC checks the actual sender frame, not only window URL` | pass |
| C48 | `node scripts/desktop-profile-check.mjs` | pass |
| C49 | `run node / ✔ STAB-49/50: separate server serves validated ICE config and closes idempotently` | pass |
| C49 | `run node / ✔ STAB-49/50: ICE config and ports use the same explicit validation` | pass |
| C49 | `run node / ✔ STAB-49: invalid configuration and occupied port fail without signal/listener leaks` | pass |
| C49 | `run node / ✔ STAB-49: a database open failure retains its cause and leaves bootstrap retryable` | pass |
| C49 | `run node / ✔ STAB-49/55: incompatible stored data is refused without changing prior rows` | pass |
| C49 | `run node / ✔ STAB-49: a database open failure retains its cause and leaves bootstrap retryable` | pass |
| C50 | `run node / ✔ STAB-49/50: separate server serves validated ICE config and closes idempotently` | pass |
| C50 | `run node / ✔ STAB-49/50: ICE config and ports use the same explicit validation` | pass |
| C50 | `node scripts/desktop-profile-check.mjs` | pass |
| C51 | `run node / ✔ STAB-51/52: connection cap refuses 25th and slow consumer cannot block healthy delivery` | pass |
| C51 | `run node / ✔ STAB-51: 100th room is accepted and 101st is refused without deleting rooms` | pass |
| C52 | `run node / ✔ STAB-51/52: connection cap refuses 25th and slow consumer cannot block healthy delivery` | pass |
| C53 | `run node / ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent` | pass |
| C53 | `run node / ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page` | pass |
| C54 | `run node / ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page` | pass |
| C55 | `run node / ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed` | pass |
| C55 | `run node / ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page` | pass |
| C55 | `run node / ✔ STAB-49/55: incompatible stored data is refused without changing prior rows` | pass |
| C56 | `node scripts/desktop-profile-check.mjs` | pass |
| C57 | `node scripts/desktop-smoke.mjs` | pass |
| C58 | `node scripts/desktop-smoke.mjs` | pass |
| C59 | `node scripts/desktop-smoke.mjs` | pass |
| C60 | `node scripts/desktop-smoke.mjs` | pass |
| C61 | `run node / ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page` | pass |
| C61 | `node scripts/desktop-smoke.mjs` | pass |
| C62 | `node scripts/desktop-smoke.mjs` | pass |
| C63 | `run node / ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s` | pass |
| C63 | `run node / ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close` | pass |
| C63 | `run node / ✔ STAB-07: every admission rejection releases provisional microphone` | pass |
| C63 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C63 | `run node / ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts` | pass |
| C63 | `run node / ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message` | pass |
| C63 | `run node / ✔ MEDIA-25/26: saturated message, media and signaling budgets still allow stop and replacement at c` | pass |
| C63 | `run node / ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s` | pass |
| C64 | `node scripts/startup-audio-check.mjs` | pass |
| C65 | `run node / ✔ BUILD-07/09: source never reads a release manifest and flags distinguish 0/1` | pass |
| C65 | `run node / ✔ BUILD-08: failed desktop cleanup still closes a listening test server` | pass |
| C65 | `run node / ✔ BUILD-08: a stalled cleanup has a terminal result within five seconds` | pass |
| C65 | `run node / ✔ BUILD-08: WS closure rejects a pending event instead of waiting for its timeout` | pass |
| C65 | `run node / ✔ BUILD-08: only an isolated temporary test profile may be removed` | pass |
| C65 | `run node / ✔ BUILD-08: a real launch failure exits without leaving the external test server alive` | pass |
| C66 | `run node / ✔ BUILD-07/09: source never reads a release manifest and flags distinguish 0/1` | pass |
| C66 | `run node / ✔ BUILD-08: failed desktop cleanup still closes a listening test server` | pass |
| C66 | `run node / ✔ BUILD-08: a stalled cleanup has a terminal result within five seconds` | pass |
| C66 | `run node / ✔ BUILD-08: WS closure rejects a pending event instead of waiting for its timeout` | pass |
| C66 | `run node / ✔ BUILD-08: only an isolated temporary test profile may be removed` | pass |
| C66 | `run node / ✔ BUILD-08: a real launch failure exits without leaving the external test server alive` | pass |
| C67 | `run node / ✔ STAB-37/67: failed cleanup still closes remaining resources and diagnostic omits secret payloads` | pass |
| C67 | `node scripts/desktop-smoke.mjs` | pass |
| C67 | `run node / ✔ STAB-67: validation and state refusals log correlated metadata without payloads` | pass |
| C68 | `run node / ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone` | pass |
| C68 | `run node / ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects` | pass |
| C68 | `run node / ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets` | pass |
| Build | `npm.cmd test` | pass |
| Build | `npm.cmd run build` | pass |
| Build | `node scripts/desktop-smoke.mjs` | pass |

## Output

`Run node` - exit 0

```
✔ MEDIA-05/06/28: v2 client rejects v1 config before opening WS or acquiring media (0.4024ms)
✔ MEDIA-17/28: an old screen-stop deadline cannot disconnect a newer confirmed share in the same call (0.7798ms)
✔ MEDIA-17/26: the current screen-stop deadline still terminates an unresponsive transport after unrelated mute (0.3244ms)
✔ MEDIA-28: signaling addressed to a terminal local attempt never reaches the new Call owner (0.3883ms)
✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect (0.4698ms)
✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition (0.6282ms)
✔ STAB-38: every A1 phase ends at 8s and permits a manual retry (4.494ms)
ℹ tests 94
ℹ suites 0
ℹ pass 94
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1561.2947
```

`node scripts/startup-audio-check.mjs` - exit 0

```
{"startupAudible":false,"samples":16,"audioElements":0,"videoElements":0,"mediaElements":[]}
```

`node scripts/desktop-lifecycle-check.mjs` - exit 0

```
PASS: all acquired mic, display and system-audio tracks ended within 1s on reload, disconnect, React Root.unmount and window close; playback blocked.
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

`node scripts/desktop-profile-check.mjs` - exit 0

```
Conversa disponível em http://127.0.0.1:61804
PASS: profile survives a forced port change; camera/subframe denied; duplicate host exits 1; system audio starts off.
```
