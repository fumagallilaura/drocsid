# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Assert callback cardinality and pending-state removal when Electron capture is cancelled before inventory resolves.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `electron/capture` · harmful: 0
- features: build-confiavel
- evidence: validation.md M8; electron/main.js:53 (electron/capture)
- last seen: 2026-10-25T02:45:07Z

### L-002 - Assert that mocked-clock cleanup promises are terminal at the deadline before awaiting their result.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/harness` · harmful: 0
- features: build-confiavel
- evidence: BUILD-08; tests/harness.test.js:33; validation.md M9 (tests/harness)
- last seen: 2026-10-25T02:45:13Z

### L-003 - Separate local screen cleanup completion from remote acknowledgements and discard effects from superseded screen operations.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/rtc;src/main` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-17 (src/rtc;src/main)
- last seen: 2026-10-25T21:09:53Z

### L-004 - Assert the correlated acknowledgement or error value before waiting for subsequent WebSocket events.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests/service` · harmful: 0
- features: captura-midia-saida
- evidence: M4 (tests/service) (+1 more)
- last seen: 2026-10-25T21:09:53Z

### L-005 - Instrument every media acquisition API before renderer startup and reload when asserting zero unsolicited capture.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/startup` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-01 (desktop/startup)
- last seen: 2026-10-25T21:09:54Z

### L-006 - Exercise keyboard cancellation during both acquisition and admission and assert terminal state within one second.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/call` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-07 (desktop/call)
- last seen: 2026-10-25T21:09:54Z

### L-007 - Test screen sharing after microphone denial without retrying microphone acquisition.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `rtc/listen-only` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-08 (rtc/listen-only)
- last seen: 2026-10-25T21:09:54Z

### L-008 - Assert the visible global system audio warning alongside per-operation consent and default-off state.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/capture` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-10 (desktop/capture)
- last seen: 2026-10-25T21:09:54Z

### L-009 - Assert every acquired microphone, display and system-audio track ends within one second on window close and component teardown.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/cleanup` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-23 (desktop/cleanup)
- last seen: 2026-10-25T21:09:54Z

### L-010 - Inject obsolete signaling and playback events after leave or reentry and assert the current attempt and playback block remain unchanged.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/stale-events` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-28 (desktop/stale-events) (+1 more)
- last seen: 2026-10-25T21:09:54Z

### L-011 - Assert structured cancellation category, phase and operation identity separately from native callback cardinality.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `desktop/capture` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-31 (desktop/capture)
- last seen: 2026-10-25T21:09:54Z

### L-012 - Require versioned two-PC Windows hardware evidence for physical voice, loopback and noise acceptance.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `media/hardware` · harmful: 0
- features: captura-midia-saida
- evidence: MEDIA-33 (media/hardware) (+1 more)
- last seen: 2026-10-25T21:09:54Z

### L-013 - Exercise leave while screen stop is still pending and assert every acquired track and peer reaches the same terminal deadline.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `rtc/lifecycle` · harmful: 0
- features: captura-midia-saida
- evidence: validation.md: Edge Cases stop+leave; MEDIA-16/17/21/24; tests/rtc.test.js:241 (rtc/lifecycle)
- last seen: 2026-10-26T03:19:07Z

### L-014 - Valide e teste limites de nomes depois da normalização exigida pelo contrato.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `shared/protocol.js` · harmful: 0
- features: estabilizacao
- evidence: verification.md:F1/C40 (shared/protocol.js)
- last seen: 2026-10-31T21:43:30Z

### L-015 - Registre recusas de protocolo no proprietário da resposta, com correlação e sem conteúdo recebido.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `server/service.js` · harmful: 0
- features: estabilizacao
- evidence: verification.md:F2/C67 (server/service.js)
- last seen: 2026-10-31T21:43:31Z

### L-016 - Teste a expiração por item mantendo o contêiner ativo, antes e exatamente no limite de idade.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `src/rtc.js` · harmful: 0
- features: estabilizacao
- evidence: verification.md:F3/C43 (src/rtc.js)
- last seen: 2026-10-31T21:43:32Z

### L-017 - Compare toda a sequência da página ordenada e seu isolamento por sala, incluindo elementos intermediários.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `server/service.js` · harmful: 0
- features: estabilizacao
- evidence: verification.md:F4/C53 (server/service.js)
- last seen: 2026-10-31T21:43:32Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
