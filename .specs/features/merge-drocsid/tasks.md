# Drocsid Integration Tasks

## Execution Protocol

Usar tlc-spec-driven carregada pelo MCP. Execução local e decisões técnicas foram autorizadas diretamente no pedido e na resposta registrada em context.md; não são autorização de publicação.

**Approved**: 2026-10-31 - user: "Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante"
**Design**: [design.md](design.md)
**Status**: In Progress
**Build**: npm.cmd test; npm.cmd run build
**Run integration**: node --test --test-reporter=spec tests/merge.test.js

O Build usa os comandos próprios existentes e passará a incluir strict/emissão conforme T2 os habilitar. A configuração não excluirá fontes migradas para contornar erro. A aprovação é o mandato de execução com decisões delegadas, não uma palavra inventada em nome do usuário.

## Test Coverage Matrix

Guidelines: README/Verificação, package.json e matrizes STAB/MEDIA; nenhum AGENTS/CONTRIBUTING encontrado. Baseline94 testes e asserções históricas são o piso, com novos testes por resultado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Protocolo, RTC e Session | unit/integration | Todos os ACs correspondentes e fronteiras históricas, sem supressões | tests/*.test.ts | npm.cmd test |
| Identidade e autorização | integration | Entrada válida, limites, negativo entre contas/grupos, expiração, revogação e concorrência | tests/identity.test.ts e tests/merge.test.ts | npm.cmd test |
| Banco e serviço | integration | Dados legados, transação, idempotência por dono e shutdown | tests/service.test.ts | npm.cmd test |
| React e Electron | e2e | Controles reais, origem/frame, fluxo de conta/grupo e mídia | scripts/desktop-*.mts | npm.cmd run build; node scripts/desktop-smoke.mjs |
| Tipos/emissão/pacote | build/integration | Inventário completo, strict, bytes/ASAR e hash | tsconfig*.json, tests/packaging.test.ts | npm.cmd run build; npm.cmd run dist:win |
| Áudio físico | manual | Não executado por recurso indisponível; não é gate substituível por mocks | MEDIA/uat.md | Protocolo A7/T9 quando disponível |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Contrato/domínio | npm.cmd test |
| Full | Identidade e serviço | npm.cmd test; npm.cmd run build |
| Build | Componente/fase/desktop | npm.cmd test; npm.cmd run build; node scripts/desktop-smoke.mjs; checkers específicos de cada proprietário |
| Release | T10 | Build + npm.cmd run dist:win; node scripts/check-package.mjs; checkers source/packaged e portátil; npm.cmd audit --omit=dev |

Não instalar CI/linter novo para preencher campo. Typecheck será parte obrigatória do build. Gates Electron rodam sequencialmente, em perfis isolados. Não repetir sondagens históricas como testes de saúde.

## Execution Plan

### Phase 1: History and typed core
```text
T1 -> T2 -> T3 -> T4
```
### Phase 2: Identity and product
```text
T5 -> T6 -> T7 -> T8
```
### Phase 3: Tooling and release
```text
T9 -> T10
```

## Phase Execution Map

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10
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

- [ ] Emissão/types por ambiente e contrato de protocolo tipado, com validação externa preservada e testes de protocolo verdes.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T3: Converter o controlador de mídia

**What**: Call em TS com dependências tipadas e todas as asserções de aquisição, inventário, compensação e prazos preservadas.
**Where**: `src/rtc.ts`
**Depends on**: T2
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-14

**Done when**:

- [ ] Call em TS com dependências tipadas e todas as asserções de aquisição, inventário, compensação e prazos preservadas.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T4: Converter o controlador de sessão

**What**: Session em TS mantém handshake, correlação, drafts, outbox e deadlines, com seus testes co-localizados.
**Where**: `src/session.ts`
**Depends on**: T3
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-12, MERGE-14

**Done when**:

- [ ] Session em TS mantém handshake, correlação, drafts, outbox e deadlines, com seus testes co-localizados.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T5: Implementar identidade e grupos transacionais

**What**: Cadastro, login, limites, sessões, tickets e grupos/convites cumprem os valores da spec com testes negativos, expiração e concorrência.
**Where**: `server/identity.ts`
**Depends on**: T4
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-05–11

**Done when**:

- [ ] Cadastro, login, limites, sessões, tickets e grupos/convites cumprem os valores da spec com testes negativos, expiração e concorrência.
- [ ] Gate full aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: full

### T6: Autorizar o serviço e preservar dados

**What**: Bootstrap/serviço em TS exigem autenticação na rede, bloqueiam acesso cruzado antes de consultar dados e preservam dados/shutdown.
**Where**: `server/service.ts`
**Depends on**: T5
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-04, MERGE-07–12, MERGE-18

**Done when**:

- [ ] Bootstrap/serviço em TS exigem autenticação na rede, bloqueiam acesso cruzado antes de consultar dados e preservam dados/shutdown.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T7: Converter e renomear o host Electron

**What**: Host, política e preload tipados; Drocsid visível, userData legado preservado, isolamento/frame/câmera/seletor continuam verificados.
**Where**: `electron/main.ts`
**Depends on**: T6
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-02–04, MERGE-14–15

**Done when**:

- [ ] Host, política e preload tipados; Drocsid visível, userData legado preservado, isolamento/frame/câmera/seletor continuam verificados.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T8: Integrar contas e grupos na interface principal

**What**: React em TS com cadastro/login/logout e criação/convite de grupos por gestos; token/senha só em memória, autorização sempre no serviço.
**Where**: `src/main.tsx`
**Depends on**: T7
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-02, MERGE-09–14

**Done when**:

- [ ] React em TS com cadastro/login/logout e criação/convite de grupos por gestos; token/senha só em memória, autorização sempre no serviço.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T9: Converter ferramentas e testes próprios

**What**: Inventário de fontes inclui scripts, testes, helpers, fixtures e sete ferramentas históricas; strict e asserções sem supressões, hardware não inferido.
**Where**: `scripts/test-runtime.mts`
**Depends on**: T8
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-03, MERGE-14–16

**Done when**:

- [ ] Inventário de fontes inclui scripts, testes, helpers, fixtures e sete ferramentas históricas; strict e asserções sem supressões, hardware não inferido.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: unit/integration, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

### T10: Fechar distribuição do produto unificado

**What**: Somente um aplicativo/runtime, dependências sem uso removidas, matriz source/packaged/portátil, hash e auditoria registrados; sem aprovação física.
**Where**: `scripts/build-windows.mts`
**Depends on**: T9
**Reuses**: Proprietário atual do Conversa e contratos citados em design.md; testes e fixtures acompanham o proprietário, sem testes adiados.
**Requirement**: MERGE-01–04, MERGE-15–18

**Done when**:

- [ ] Somente um aplicativo/runtime, dependências sem uso removidas, matriz source/packaged/portátil, hash e auditoria registrados; sem aprovação física.
- [ ] Gate build aprovado, contagem94 + delta, zero falha/skip/cancelled/todo; evidência e commit da tarefa registrados.

**Tests**: integration/e2e, conforme matriz e valores da spec; co-localizados nesta entrega.
**Gate**: build

## Task Granularity Check

Cada item entrega um proprietário ou a infraestrutura de compilação consumida por ele. Emissão e testes acompanham a conversão; identidade/grupos constituem um único componente transacional. T9 converte o harness e seus consumidores, preservando artefatos históricos.

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
Proof: run integration | ✔ MERGE-04: legacy data and preferences remain intact

**C5** - O produto SHALL cumprir MERGE-05, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-05: registration stores salted scrypt hashes and unique identities

**C6** - O produto SHALL cumprir MERGE-06, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-06: authentication failures and concurrency are bounded

**C7** - O produto SHALL cumprir MERGE-07, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-07: expired or revoked sessions cannot be reused

**C8** - O produto SHALL cumprir MERGE-08, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-08: network access and websocket tickets require authentication

**C9** - O produto SHALL cumprir MERGE-09, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-09: known foreign group identifiers never grant access

**C10** - O produto SHALL cumprir MERGE-10, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-10: group creation and owner administration are atomic

**C11** - O produto SHALL cumprir MERGE-11, conforme valor e condição da spec.
Proof: run integration | ✔ MERGE-11: invites expire and are consumed once atomically

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

## Handoff

**Settled mid-build:** user: "Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante". Preferência persistente: "Executar nesta sessão; Verifier independente no fechamento". Recursos T9: "Não estão disponíveis agora; manter T9 pendente".

**Dispatched:** nenhum. Plano10tarefas; manter execução inline conforme escolha persistente desta sessão, sem nova pergunta repetida. Após T10, Verifier fresco da feature MERGE, sem herdar Handoff; sem captura vinculante e sem screens sub-agent. Pareceres MEDIA/STAB não são parecer desta integração.

**Walked:** pendente da implementação; checkers atuais seguem como regressão, não aprovação automática da nova interface.

**Current:** T1 concluída: merge real, três add/add resolvidos, nenhum unmerged,95/95 Node + build + desktop-smoke. Main e backup em a2ae03c, segundo pai94d9b9a, branchintegration/drocsid. Próxima T2: infraestrutura strict e protocolo; contas/grupos e marca de UI ainda não integrados.
