# merge-drocsid proofs

**HEAD**: c10f4f3
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 23 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run integration / ✔ MERGE-01: integration history retains both source commits` | pass |
| C2 | `run release / PASS: MERGE-02 source, packaged and portable run the single Drocsid application.` | pass |
| C3 | `run integration / ✔ MERGE-03: every maintained source is covered by strict TypeScript` | pass |
| C4 | `run client / PASS: Drocsid client opens without PostgreSQL, keeps credentials outside renderer and preserves t` | pass |
| C5 | `run identity / ✔ MERGE-05: registration stores salted scrypt hashes and unique identities` | pass |
| C6 | `run identity / ✔ MERGE-06: authentication failures and concurrency are bounded` | pass |
| C7 | `run lifecycle / PASS: MERGE-07 every required lifecycle and failure case ran and passed.` | pass |
| C8 | `run lifecycle / PASS: MERGE-08 every required lifecycle and failure case ran and passed.` | pass |
| C9 | `run integration / ✔ MERGE-09: known foreign group identifiers never grant access` | pass |
| C10 | `run identity / ✔ MERGE-10: group creation and owner administration are atomic` | pass |
| C11 | `run lifecycle / PASS: MERGE-11 every required lifecycle and failure case ran and passed.` | pass |
| C12 | `run integration / ✔ MERGE-12: message receipts belong to their authenticated author` | pass |
| C13 | `run accounts / PASS: registration, login, logout, private groups and one-use invites work through controls wit` | pass |
| C14 | `run release / PASS: MERGE-14 source and packaged media ownership, deadlines, playback and camera denial regres` | pass |
| C15 | `run release / PASS: MERGE-15 current emitted modules and bundles match the ASAR and portable SHA256.` | pass |
| C16 | `run release / PASS: MERGE-16 negative authorization and session tests and dependency audits passed; independen` | pass |
| C17 | `run release / PASS: MERGE-17 physical acceptance remains pending and the current candidate is identified by SH` | pass |
| C18 | `run release / PASS: MERGE-18 one PostgreSQL backend serves the unified source, packaged and portable product.` | pass |
| C19 | `run lifecycle / PASS: MERGE-19 every required lifecycle and failure case ran and passed.` | pass |
| C20 | `run lifecycle / PASS: MERGE-20 every required lifecycle and failure case ran and passed.` | pass |
| C21 | `run release / PASS: MERGE-21 verified database TLS and credential isolation tests passed, including the defaul` | pass |
| Build | `npm.cmd test` | pass |
| Build | `npm.cmd run build` | pass |

## Output

`Run integration` - exit 0

```
✔ MERGE-14: asynchronous room changes keep request order and end the current call (654.9122ms)
✔ MERGE-07: concurrent logout and ticket consumption never leave a reusable session (2450.1478ms)
✔ MERGE-19: service shutdown interrupts PostgreSQL work and closes its pool (622.8929ms)
✔ MERGE-01: integration history retains both source commits (53.296ms)
✔ MERGE-03: every maintained source is covered by strict TypeScript (976.4777ms)
✔ MERGE-02: Drocsid is the single application metadata (0.5229ms)
✔ MERGE-18: the unified product has no parallel unused backend (24.5964ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13715.6582
```

`Run release` - exit 0

```
PASS release gate: portable
Running release gate: accounts
PASS release gate: accounts
Running release gate: client
PASS release gate: client
Running release gate: security
PASS release gate: security
PENDING: physical T9 requires two Windows PCs on a trusted LAN, real headsets/microphones and two operators; candidate SHA256 cd1b3b43bf4756c8d8b3e8821b8972873a87ac54d5265e4c14009588ead2ddd0. Noise, echo and loopback remain unapproved.
PASS: MERGE-02 source, packaged and portable run the single Drocsid application.
PASS: MERGE-14 source and packaged media ownership, deadlines, playback and camera denial regressions passed.
PASS: MERGE-15 current emitted modules and bundles match the ASAR and portable SHA256.
PASS: MERGE-16 negative authorization and session tests and dependency audits passed; independent review is a separate required gate.
PASS: MERGE-17 physical acceptance remains pending and the current candidate is identified by SHA256.
PASS: MERGE-18 one PostgreSQL backend serves the unified source, packaged and portable product.
PASS: MERGE-21 verified database TLS and credential isolation tests passed, including the default client without PostgreSQL.
```

`Run client` - exit 0

```
PASS: Drocsid client opens without PostgreSQL, keeps credentials outside renderer and preserves the legacy default profile and database bytes.
```

`Run identity` - exit 0

```
✔ MERGE-09: known foreign group identifiers never grant access (259.3712ms)
✔ MERGE-10: group creation and owner administration are atomic (286.6486ms)
✔ MERGE-11: invites expire and are consumed once atomically (283.3849ms)
✔ MERGE-11: failed membership rolls back invitation consumption (276.4318ms)
✔ MERGE-07: session inspection never extends idle expiry and shutdown drains pending hashing (944.0084ms)
✔ MERGE-05: failed initial session rolls back the new identity (589.1075ms)
✔ MERGE-19: identity migration upgrades a version-one database without changing legacy data (409.7871ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11901.6389
```

`Run lifecycle` - exit 0

```
✔ MERGE-20/12: concurrent imports consume one snapshot without crediting guests to accounts (422.2981ms)
✔ MERGE-20: conflicting room, message, operation or sequence never overwrites the target (1840.6338ms)
✔ MERGE-20: a previous import fingerprint never hides a later target conflict (432.776ms)
✔ MERGE-20: a database failure after room insertion rolls back the whole import (319.1102ms)
✔ MERGE-20: future schema, unsafe integers and corrupt input are rejected without partial data (1403.2692ms)
✔ MERGE-20/21: the explicit import CLI reports counts without printing credentials (646.651ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6090.0125
PASS: MERGE-20 every required lifecycle and failure case ran and passed.
```

`Run accounts` - exit 0

```
PostgreSQL real de teste: 127.0.0.1:49879, SCRAM, cluster isolado.
PASS: registration, login, logout, private groups and one-use invites work through controls without persistent credentials.
{"phase":"http","code":"NOT_FOUND","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
{"phase":"http","code":"NOT_FOUND","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
{"phase":"http","code":"UNAUTHENTICATED","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
```
