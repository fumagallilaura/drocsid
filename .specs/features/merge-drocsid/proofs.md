# merge-drocsid proofs

**HEAD**: 160a116
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
| C7 | `run integration / ✔ MERGE-07: logout closes every owned media connection while another session remains usable` | pass |
| C8 | `run integration / ✔ MERGE-08: network access and websocket tickets require authentication` | pass |
| C9 | `run integration / ✔ MERGE-09: known foreign group identifiers never grant access` | pass |
| C10 | `run identity / ✔ MERGE-10: group creation and owner administration are atomic` | pass |
| C11 | `run identity / ✔ MERGE-11: invites expire and are consumed once atomically` | pass |
| C12 | `run integration / ✔ MERGE-12: message receipts belong to their authenticated author` | pass |
| C13 | `run accounts / PASS: registration, login, logout, private groups and one-use invites work through controls wit` | pass |
| C14 | `run release / PASS: MERGE-14 source and packaged media ownership, deadlines, playback and camera denial regres` | pass |
| C15 | `run release / PASS: MERGE-15 current emitted modules and bundles match the ASAR and portable SHA256.` | pass |
| C16 | `run release / PASS: MERGE-16 negative authorization and session tests and dependency audits passed; independen` | pass |
| C17 | `run release / PASS: MERGE-17 physical acceptance remains pending and the current candidate is identified by SH` | pass |
| C18 | `run release / PASS: MERGE-18 one PostgreSQL backend serves the unified source, packaged and portable product.` | pass |
| C19 | `run postgres / ✔ MERGE-19: PostgreSQL commits, survives reconnect and rolls back incomplete work` | pass |
| C20 | `run migration / ✔ MERGE-20: legacy SQLite imports preserve data and source bytes atomically` | pass |
| C21 | `run release / PASS: MERGE-21 verified database TLS and credential isolation tests passed, including the defaul` | pass |
| Build | `npm.cmd test` | pass |
| Build | `npm.cmd run build` | pass |

## Output

`Run integration` - exit 0

```
✔ MERGE-14: asynchronous room changes keep request order and end the current call (671.5197ms)
✔ MERGE-07: concurrent logout and ticket consumption never leave a reusable session (2373.5238ms)
✔ MERGE-19: service shutdown interrupts PostgreSQL work and closes its pool (486.7773ms)
✔ MERGE-01: integration history retains both source commits (47.5097ms)
✔ MERGE-03: every maintained source is covered by strict TypeScript (1156.008ms)
✔ MERGE-02: Drocsid is the single application metadata (0.5267ms)
✔ MERGE-18: the unified product has no parallel unused backend (27.0753ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13746.813
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
✔ MERGE-09: known foreign group identifiers never grant access (270.3548ms)
✔ MERGE-10: group creation and owner administration are atomic (278.0122ms)
✔ MERGE-11: invites expire and are consumed once atomically (424.4503ms)
✔ MERGE-11: failed membership rolls back invitation consumption (275.6647ms)
✔ MERGE-07: session inspection never extends idle expiry and shutdown drains pending hashing (1189.6161ms)
✔ MERGE-05: failed initial session rolls back the new identity (601.9671ms)
✔ MERGE-19: identity migration upgrades a version-one database without changing legacy data (359.5692ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12193.7834
```

`Run accounts` - exit 0

```
PostgreSQL real de teste: 127.0.0.1:53612, SCRAM, cluster isolado.
PASS: registration, login, logout, private groups and one-use invites work through controls without persistent credentials.
{"phase":"http","code":"NOT_FOUND","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
{"phase":"http","code":"NOT_FOUND","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
{"phase":"http","code":"UNAUTHENTICATED","requestId":null,"version":"0.1.1","runtime":"24.21.0","cause":"Error","causeCode":null,"sqliteCode":null}
```

`Run postgres` - exit 0

```
✔ MERGE-19/12: concurrent writers return one immutable receipt only to its owner (412.7793ms)
✔ MERGE-19: history returns the last 200 messages in their insertion sequence (522.3863ms)
✔ MERGE-19: concurrent migrations apply once and reject unknown or altered versions (496.0645ms)
✔ MERGE-19: closing interrupts active queries and refuses later work without pool leaks (366.1782ms)
✔ MERGE-19: failed DDL rolls back every table and its migration record (348.7608ms)
✔ MERGE-19: shutting down one pool preserves another owner on the same database (684.0937ms)
✔ MERGE-21: PostgreSQL never falls back to plaintext when verified TLS was required (293.1221ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3565.0933
```

`Run migration` - exit 0

```
✔ MERGE-20: legacy SQLite imports preserve data and source bytes atomically (1425.123ms)
✔ MERGE-20/12: concurrent imports consume one snapshot without crediting guests to accounts (317.7973ms)
✔ MERGE-20: conflicting room, message, operation or sequence never overwrites the target (2158.0108ms)
✔ MERGE-20: a previous import fingerprint never hides a later target conflict (423.5371ms)
✔ MERGE-20: a database failure after room insertion rolls back the whole import (412.341ms)
✔ MERGE-20: future schema, unsafe integers and corrupt input are rejected without partial data (1355.933ms)
✔ MERGE-20/21: the explicit import CLI reports counts without printing credentials (530.8585ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6717.8481
```
