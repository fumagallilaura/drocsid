# Drocsid Integration Tasks

## Execution Protocol

Usar tlc-spec-driven carregada pelo MCP. Execução local e decisões técnicas foram autorizadas diretamente no pedido e na resposta registrada em context.md; não são autorização de publicação.

**Approved**: 2026-10-31 - user: "Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante"
**Amended**: 2026-10-31 - user: "Prefiro postgresql". AD-003 substitui a escolha SQLite. Somente as tarefas futuras foram renumeradas: antigasT3–T10 tornam-seT5–T12; T1/T2 não são refeitas.
**Design**: [design.md](design.md)
**Status**: In Progress
**Build**: npm.cmd test; npm.cmd run build
**Run integration**: node scripts/with-test-postgres.mjs -- node --test --test-reporter=spec tests/merge.test.js tests/authorization.test.js
**Run postgres**: node scripts/with-test-postgres.mjs -- node --test --test-reporter=spec tests/database.test.js
**Run migration**: node scripts/with-test-postgres.mjs -- node --test --test-reporter=spec tests/import-sqlite.test.js
**Run identity**: node scripts/with-test-postgres.mjs -- node --test --test-reporter=spec tests/identity.test.js
**Run client**: node scripts/desktop-client-check.mjs

O Build usa os comandos próprios existentes e passará a incluir strict/emissão conforme T2 os habilitar. A configuração não excluirá fontes migradas para contornar erro. A aprovação é o mandato de execução com decisões delegadas, não uma palavra inventada em nome do usuário.

## Test Coverage Matrix

Guidelines: README/Verificação, package.json e matrizes STAB/MEDIA; nenhum AGENTS/CONTRIBUTING encontrado. Baseline94 testes e asserções históricas são o piso, com novos testes por resultado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Protocolo, RTC e Session | unit/integration | Todos os ACs correspondentes e fronteiras históricas, sem supressões | tests/*.test.ts | npm.cmd test |
| Identidade e autorização | integration | Entrada válida, limites, negativo entre contas/grupos, expiração, revogação e concorrência | tests/identity.test.ts e tests/merge.test.ts | npm.cmd test |
| Banco e serviço | integration | PostgreSQL real: rollback, dois escritores, migração concorrente, recibos, ordem e shutdown; importação SQLite readOnly preserva bytes | tests/database.test.ts, tests/import-sqlite.test.ts e tests/service.test.ts | npm.cmd test |
| React e Electron | e2e | Controles reais, origem/frame, fluxo de conta/grupo e mídia | scripts/desktop-*.mts | npm.cmd run build; node scripts/desktop-smoke.mjs |
| Tipos/emissão/pacote | build/integration | Inventário completo, strict, bytes/ASAR e hash | tsconfig*.json, tests/packaging.test.ts | npm.cmd run build; npm.cmd run dist:win |
| Áudio físico | manual | Não executado por recurso indisponível; não é gate substituível por mocks | MEDIA/uat.md | Protocolo A7/T9 quando disponível |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Contrato/domínio | npm.cmd test |
| Full | Identidade e serviço | npm.cmd test; npm.cmd run build |
| Build | Componente/fase/desktop | npm.cmd test; npm.cmd run build; node scripts/desktop-smoke.mjs; checkers específicos de cada proprietário |
| Release | T12 | Build + npm.cmd run dist:win; node scripts/check-package.mjs; checkers source/packaged e portátil; npm.cmd audit --omit=dev |

Não instalar CI/linter novo para preencher campo. Typecheck será parte obrigatória do build. Gates Electron rodam sequencialmente, em perfis isolados. Não repetir sondagens históricas como testes de saúde.

## Execution Plan

### Phase 1: History, PostgreSQL and typed core
```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6
```
### Phase 2: Identity and product
```text
T7 -> T8 -> T9 -> T10
```
### Phase 3: Tooling and release
```text
T11 -> T12
```

## Phase Execution Map

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12
```

## Task Breakdown

### T1: Mesclar os históricos e resolver os manifests

**What**: Raiz executável com ambos os pais, ignores unidos e lock regenerado; baseline94/94 e build preservados.
**Where**: `package.json`
**Depends on**: None
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-01

**Done when**:

- [x] Raiz executável com ambos os pais, ignores unidos e lock regenerado; baseline94/94 e build preservados.
- [x] Gate build aprovado:95/95 (94 originais+1 ancestralidade), zero falha/skip/cancelled/todo; Vite e desktop-smoke aprovados. Logs `test-results/drocsid-merge-t1-{node,build,desktop}.log`; auditoria produção0 vulnerabilidades. Commit merge desta tarefa, com ambos os pais; ver `git log --merges integration/drocsid`.

**Tests**: integration — ancestrais/manifest e baseline existente, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T2: Habilitar TypeScript estrito e tipar o contrato

**What**: Emissão/types por ambiente e contrato de protocolo tipado, com validação externa preservada e testes de protocolo verdes.
**Where**: `shared/protocol.ts`
**Depends on**: T1
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03

**Done when**:

- [x] Emissão/types Node e contrato de protocolo tipado, com validação externa preservada e sete testes de protocolo verdes. `tsconfig.json` strict/noEmitOnError; configs DOM/host acompanham seus proprietários. Fontes ainda não convertidas permanecem explicitamente pendentes em T5–T11.
- [x] Gate build aprovado:95/95, zero falha/skip/cancelled/todo; tsc, Vite e desktop-smoke PASS. Evidências `test-results/drocsid-merge-t2-*`. Commit desta tarefa: `feat(types): compile the protocol with strict runtime validation`.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T3: Implementar persistência PostgreSQL transacional

**What**: Pool tipado, configuração segura, migrações versionadas e persistência de salas/mensagens/recibos com concorrência e rollback reais; runtime PostgreSQL isolado de testes.
**Where**: `server/database.ts`
**Depends on**: T2
**Reuses**: SQL/contrato do serviço Conversa, driver pg do upstream e testes Node existentes; não reutilizar senha padrão nem schema público incompatível.
**Requirement**: MERGE-19, MERGE-21

**Done when**:

- [x] PostgreSQL17.11 real preserva todos os campos de salas/mensagens, sequência após reabrir, recibo idempotente por dono, rollback de dados/DDL, migrações concorrentes e encerramento confirmado das próprias sessões; outro pool permanece intacto.
- [x] Credenciais explícitas/TLS verificado, recusa de fallback plaintext e falta de binários com erro:106/106 (95+11), zero fail/skip/cancelled/todo; strict, Vite, desktop-smoke PASS, audit produção0. Sensores4/4 por AssertionError (dono, BEGIN, TLS e shutdown), bytes originais intactos. Evidências `test-results/drocsid-postgres-t3-*` e `postgres-t3-sensors.json`; commit desta tarefa `feat(database): add transactional postgresql persistence`.

**Tests**: integration — `tests/database.test.ts` e fixture isolada com PostgreSQL real; negativo de configuração/migração/dono e disputa de escritores, conforme matriz.
**Gate**: build

### T4: Importar SQLite legado sem alterar a origem

**What**: Importação explícita e transacional para PostgreSQL, preservando dados e recibos, repetível e com conflitos recusados.
**Where**: `scripts/import-sqlite.mts`
**Depends on**: T3
**Reuses**: Fixtures/schema SQLite históricos, DatabaseSync readOnly e transação PostgreSQL de T3; nenhuma inferência de conta por nome.
**Requirement**: MERGE-04, MERGE-20

**Done when**:

- [x] Schema antigo/atual são importados com todos os campos/ordem e origem/preferências byte-idênticas; repetição/concorrência não duplicam, conflito não sobrescreve e versão futura/inteiro inseguro/corrupção são recusados. Falha SQL após salas inseridas reverte tudo; um contador externo confirma que o ponto de falha foi atingido.
- [x] 113/113 (106+7), zero fail/skip/cancelled/todo; strict/Vite/desktop PASS. Sensores3/3 por AssertionError (autoria perdida, ausência de BEGIN e fingerprint encobrindo conflito), bytes originais intactos; suite pós-sensor113/113. Evidências `test-results/drocsid-postgres-t4-*`/`postgres-t4-sensors.json`. Commit desta tarefa `feat(migration): import legacy sqlite into postgresql atomically`. Nenhum dado do usuário tocado; sem certificação física.

**Tests**: integration — `tests/import-sqlite.test.ts`, PostgreSQL real e SQLite somente como fixture de entrada; repetição, concorrência, falha e hashes da origem.
**Gate**: build

### T5: Converter o controlador de mídia

**What**: Call em TS com dependências tipadas e todas as asserções de aquisição, inventário, compensação e prazos preservadas.
**Where**: `src/rtc.ts`
**Depends on**: T4
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-14

**Done when**:

- [x] Call em TS com portas das operações consumidas e adaptação de browser verificada pelo compilador, sem casts/supressões; APIs reais e doubles mantêm aquisição, inventário, compensação e prazos. Testes existentes intactos (`git diff HEAD -- tests` vazio nesta tarefa); migração do harness JS para TS permanece em T11, sem adiamento de execução dos testes.
- [x] 113/113, zero fail/skip/cancelled/todo; strict Node/browser, Vite, desktop-smoke, capture e lifecycle PASS. Três sensores por AssertionError (mic tardio, tela tardia, idade de candidate), bytes originais intactos. Evidências `test-results/drocsid-merge-t5-*`/`merge-t5-sensors.json`. Commit desta tarefa `refactor(media): type call ownership and browser dependencies`. Hardware físico não certificado.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T6: Converter o controlador de sessão

**What**: Session em TS mantém handshake, correlação, drafts, outbox e deadlines, com seus testes co-localizados.
**Where**: `src/session.ts`
**Depends on**: T5
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-12, MERGE-14

**Done when**:

- [x] Session em TS mantém handshake, correlação, drafts, outbox e deadlines; respostas e dependências têm tipos validados. Asserções anteriores preservadas; STAB-39 ganhou frame inválido tardio e duas asserções de conexão saudável/sem erro porque o sensor mostrou que hello sozinho era pouco discriminante.
- [x] 113/113, zero fail/skip/cancelled/todo; strict Node/browser, Vite, desktop-smoke e lifecycle PASS. Sensores4/4 por AssertionError (epoch, geração do ack, operação de tela e revisão de presença), bytes originais intactos; pós-sensor113/113. Evidências `test-results/drocsid-merge-t6-*`/`merge-t6-sensors.json`. Commit desta tarefa `refactor(session): type correlated requests and transport ownership`; nenhuma certificação física.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T7: Implementar identidade e grupos transacionais

**What**: Cadastro, login, limites, sessões, tickets e grupos/convites no pool PostgreSQL cumprem os valores da spec com testes negativos, expiração e concorrência reais.
**Where**: `server/identity.ts`
**Depends on**: T6
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-05–11

**Done when**:

- [x] Identidade no pool PostgreSQL de T3, sem fechar esse proprietário. Scrypt N131072/r8/p1, sal16bytes/hash64bytes; token/ticket/convite32bytes somente por hash no banco. Limites de cinco falhas por IP e usuário/60s, mapa limitado e duas derivações nativas por processo, verificadas por async_hooks. Sessões24h/idle30min, tickets30s e convites24h de uso único; expiração/revogação, dono/membro, IDs alheios, rollback e concorrência reais. Migração2 preserva dados/recibos legados; a asserção de quantidade de migrações passou de1 para2 e ganhou ordem/checksum da nova versão, mantendo as demais asserções.
- [x] Gate full PASS:126/126 (113+13), zero fail/skip/cancelled/todo; strict Node/browser e Vite PASS. Nove sensores por AssertionError (custo scrypt, orçamento KDF, expiração absoluta/idle, ticket, sala alheia, dono, convite repetido e rollback), fontes/emitidos intactos. Logs `test-results/drocsid-merge-t7-*` e `merge-t7-sensors.json`. Commit desta tarefa `feat(identity): secure accounts sessions and private groups`. HTTP/WS, fechamento de conexões após revogação e interface permanecem em T8/T10; não declarar MERGE-07–09 integralmente aprovados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: full

### T8: Autorizar o serviço e preservar dados

**What**: Bootstrap/serviço em TS usam PostgreSQL, exigem autenticação na rede, bloqueiam acesso cruzado antes de consultar dados e preservam ordenação/contexto após awaits e shutdown.
**Where**: `server/service.ts`
**Depends on**: T7
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-04, MERGE-07–12, MERGE-18

**Done when**:

- [x] Bootstrap/serviço em TS usam o mesmo pool PostgreSQL e exigem sessão na rede; ICE, dados, administração e upgrade são autorizados. Convidado só no modo explícito com listener/endereço/Host reais de loopback. Tickets descartáveis, revogação de todos os sockets da sessão, inspeção de expiração, autor estável/recibo por dono e broadcast único concorrente. Session usa Bearer/ticket em memória, aceita conta sem salas e isola/limpa o contexto ao trocar conta/sair. Fila por conexão mantém ordem após awaits; shutdown interrompe trabalho PG e fecha o pool. Corrigido bloqueio entre logout e consumo de ticket, reproduzido pelo novo teste: ambos agora bloqueiam sessão antes de ticket.
- [x] Gate build PASS:141/141 (126+12 autorização+3 Session), zero fail/skip/cancelled/todo; strict Node/browser, Vite, desktop-smoke, perfil, capture e lifecycle PASS. Doze sensores por AssertionError com bytes originais intactos; o teste de broadcast ganhou uma barreira real de leitura para assegurar disputa dos dois escritores antes do commit. Produção audit0. Evidências `test-results/drocsid-merge-t8-*`/`merge-t8-sensors.json`. Integridade AST:126 casos anteriores presentes,774/779 assert idênticos e5 adaptados ao PostgreSQL/importador (fixture da porta ocupada, causa de conexão, plano sem Sort/com Index Scan, contagem10000 e recusa assíncrona do legado);113 ACs e Decisions intactos. Commit desta tarefa `feat(server): authorize postgresql service and websocket sessions`. Host/client default, marca, UI e pacote final ainda T9–T12.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T9: Converter e renomear o host Electron

**What**: Host, política e preload tipados; Drocsid visível, userData legado preservado, cliente API sem segredo PostgreSQL nem banco instalado no PC; isolamento/frame/câmera/seletor continuam verificados.
**Where**: `electron/main.ts`
**Depends on**: T8
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-02–04, MERGE-14–15

**Done when**:

- [x] Main/policy/preload em TS, bridge com entradas desconhecidas validadas e compilação própria de host/CJS sandbox. Cliente abre UI local sem ler configuração PostgreSQL; host exige `DROCSID_HOST=1` e configuração explícita. App/menu/título/metadados e nomes do build Windows passam a Drocsid. userData padrão continua `appData/conversa` antes do lock, e overrides de teste são preservados. Logger Node separado do serviço evita carregar PostgreSQL no cliente padrão. A configuração do pacote seleciona JS/CJS emitidos dos proprietários; ASAR/candidata final ainda T12.
- [x] Gate build PASS:141/141, zero fail/skip/cancelled/todo; strict Node/browser/Electron/tools, Vite, client sem PostgreSQL, desktop-smoke/profile/capture/lifecycle PASS. Cliente nativo mantém bytes das preferências/SQLite legados após abertura/reload/saída, com PostgreSQL propositalmente indisponível. Seis sensores por AssertionError (perfil, host implícito, câmera, frame, geração e whitelist de preferências), fontes intactas. AST confirma141 casos/921 assert anteriores e113 ACs intactos. `test-runtime.mts` foi convertido aqui como dependência do checker tipado; restante do harness continua T11. Logs `test-results/drocsid-merge-t9-*`, `merge-t9-sensors.json`; skill selftest24 killed/0 survived após corrigir caminho de import do Python isolado. Commit desta tarefa `feat(desktop): type the drocsid client and preserve legacy profiles`. UI de contas/marca interna T10 e candidata/ASAR/hash finais T12; sem aprovação MEDIA/T9 física.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T10: Integrar contas e grupos na interface principal

**What**: React em TS com cadastro/login/logout e criação/convite de grupos por gestos; token/senha só em memória, autorização sempre no serviço.
**Where**: `src/main.tsx`
**Depends on**: T9
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-02, MERGE-09–14

**Done when**:

- [ ] React em TS com cadastro/login/logout e criação/convite de grupos por gestos; token/senha só em memória, autorização sempre no serviço.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T11: Converter ferramentas e testes próprios

**What**: Converter o restante de scripts, testes, helpers, fixtures e sete ferramentas históricas; strict e asserções sem supressões, hardware não inferido. `test-runtime.mts` e o novo checker client já foram convertidos com T9; não refazer esse trabalho.
**Where**: `scripts/desktop-smoke.mts`
**Depends on**: T10
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-14–16

**Done when**:

- [ ] Inventário de fontes inclui scripts, testes, helpers, fixtures e sete ferramentas históricas; strict e asserções sem supressões, hardware não inferido.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T12: Fechar distribuição do produto unificado

**What**: Somente um aplicativo/runtime, dependências sem uso removidas, matriz source/packaged/portátil, hash e auditoria registrados; sem aprovação física.
**Where**: `scripts/build-windows.mts`
**Depends on**: T11
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-01–04, MERGE-15–18

**Done when**:

- [ ] Somente um aplicativo/runtime, dependências sem uso removidas, matriz source/packaged/portátil, hash e auditoria registrados; sem aprovação física.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

## Task Granularity Check

Cada item entrega um proprietário ou a infraestrutura de compilação consumida por ele. Emissão e testes acompanham a conversão; identidade/grupos constituem um único componente transacional. T11 converte o harness e seus consumidores, preservando artefatos históricos.

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | Match |
| T2 | T1 | T1 | Match |
| T3 | T2 | T2 | Match |
| T4 | T3 | T3 | Match |
| T5 | T4 | T4 | Match |
| T6 | T5 | T5 | Match |
| T7 | T6 | T6 | Match |
| T8 | T7 | T7 | Match |
| T9 | T8 | T8 | Match |
| T10 | T9 | T9 | Match |
| T11 | T10 | T10 | Match |
| T12 | T11 | T11 | Match |

## Test Co-location Validation

Todos os proprietários de comportamento têm testes nesta tarefa; nenhuma conversão autoriza remover ou afrouxar assert. A baseline de50 e a ampliação até94 serão conferidas por AST e nomes, com diferenças somente quando o novo requisito alterar um valor como a marca. Nenhuma evidência antiga certifica a candidata nova.

## Checks

**C1** - O produto SHALL cumprir MERGE-01, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-01: integration history retains both source commits

**C2** - O produto SHALL cumprir MERGE-02, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-02: Drocsid is the single application metadata

**C3** - O produto SHALL cumprir MERGE-03, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-03: every maintained source is covered by strict TypeScript

**C4** - O produto SHALL cumprir MERGE-04, conforme valor e condição da spec.
Proof: run client | PASS: Drocsid client opens without PostgreSQL, keeps credentials outside renderer and preserves the legacy default profile and database bytes.

**C5** - O produto SHALL cumprir MERGE-05, conforme valor e condição da spec.
Proof: run identity | ✔ MERGE-05: registration stores salted scrypt hashes and unique identities

**C6** - O produto SHALL cumprir MERGE-06, conforme valor e condição da spec.
Proof: run identity | ✔ MERGE-06: authentication failures and concurrency are bounded

**C7** - O produto SHALL cumprir MERGE-07, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-07: logout closes every owned media connection while another session remains usable

**C8** - O produto SHALL cumprir MERGE-08, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-08: network access and websocket tickets require authentication

**C9** - O produto SHALL cumprir MERGE-09, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-09: known foreign group identifiers never grant access

**C10** - O produto SHALL cumprir MERGE-10, conforme valor e condição da spec.
Proof: run identity | ✔ MERGE-10: group creation and owner administration are atomic

**C11** - O produto SHALL cumprir MERGE-11, conforme valor e condição da spec.
Proof: run identity | ✔ MERGE-11: invites expire and are consumed once atomically

**C12** - O produto SHALL cumprir MERGE-12, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-12: message receipts belong to their authenticated author

**C13** - O produto SHALL cumprir MERGE-13, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-13: credentials never enter persistent renderer preferences

**C14** - O produto SHALL cumprir MERGE-14, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-14: media ownership and camera restrictions remain intact

**C15** - O produto SHALL cumprir MERGE-15, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-15: the portable package matches emitted runtime bytes

**C16** - O produto SHALL cumprir MERGE-16, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-16: security validation records negative cases and dependency findings

**C17** - O produto SHALL cumprir MERGE-17, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-17: physical acceptance remains explicitly pending

**C18** - O produto SHALL cumprir MERGE-18, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-18: the unified product has no parallel unused backend

**C19** - O PostgreSQL SHALL persistir dados, ordem e recibos após reconexão, reverter operações incompletas e fechar o pool (MERGE-19).
Proof: run postgres | ✔ MERGE-19: PostgreSQL commits, survives reconnect and rolls back incomplete work

**C20** - A importação SHALL preservar todos os campos/bytes da origem, ser repetível e recusar conflito sem importação parcial (MERGE-20).
Proof: run migration | ✔ MERGE-20: legacy SQLite imports preserve data and source bytes atomically

**C21** - A configuração SHALL manter credenciais só no servidor e verificar TLS remoto, sem segredos no renderer/pacote (MERGE-21).
Proof: run integration | ✔ MERGE-21: database credentials stay in the server with verified TLS

## Handoff

**Settled mid-build:** user: "Prefiro postgresql" (AD-003, substitui AD-002); user: "Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante". Preferência persistente: "Executar nesta sessão; Verifier independente no fechamento". Recursos MEDIA/T9: "Não estão disponíveis agora; manter T9 pendente".

**Dispatched:** nenhum. Plano12tarefas; manter execução inline conforme escolha persistente desta sessão, sem nova pergunta repetida. Após T12, Verifier fresco da feature MERGE, sem herdar Handoff; sem captura vinculante e sem screens sub-agent. Pareceres MEDIA/STAB não são parecer desta integração.

**Walked:** pendente da implementação; checkers atuais seguem como regressão, não aprovação automática da nova interface.

**Current:** T1–T9 de integração concluídas. T7 c11135e, T8 4fa053e; T9 neste commit entrega host/policy/preload tipados, cliente padrão sem PostgreSQL, perfil antigo preservado e marca nativa Drocsid.141/141, strict em quatro ambientes, Vite, client e desktop-smoke/profile/capture/lifecycle PASS; produção audit0 na T8. Sensores dos lotes41/41 (T3:4,T4:3,T5:3,T6:4,T7:9,T8:12,T9:6), por AssertionError em cópias isoladas; fontes intactas.141 casos/921 assert e113 ACs históricos intactos na T9. Próxima T10: React TSX com cadastro/login/logout, grupos e convites por gestos reais, mantendo Call/Session. T11 converte apenas harness restante; test-runtime/checker client já TS. T12 limpa apps/dependências, constrói pacote/candidata/hash e só depois provas/Verifier fresco. MEDIA/T9 física permanece indisponível. Sem push/deploy. Python314._pth no TEMP agora inclui scripts verificados da skill para subprocessos; selftest24 killed/0 survived. Audit completo anterior15 moderadas dev/0 altas/críticas, limpeza final pendente.
