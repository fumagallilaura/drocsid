# Estabilização Tasks

## Execution Protocol

Usar tlc-spec-driven pelo MCP Agent Skills e seu ciclo de Execute: teste derivado da spec, implementação mínima, gate, revisão de adequação e commit atômico. Este protocolo pertence ao plano histórico de oito entregáveis; não é prova de autorização daquela execução nem de atendimento integral da spec. Verificador independente obrigatório para o fechamento funcional.

**Design:** [design.md](design.md). **Status:** In Progress, retomada autorizada em 2026-10-26, sem certificação integral STAB. Oito entregáveis, execução inline; preservar os resultados históricos e validar o que falta, sem reimplementar capacidades já presentes.

**Reconciliação em 2026-10-25:** T1–T6 abaixo preservam as marcas e gates relatados pelo autor, nos commits `5c1a05a`, `ae07a55`, `7d24f4b`, `5626a06`, `d456168` e `dc8d7a1`, respectivamente. A spec corrigiu a atribuição original de autorização; nenhuma marca equivale a Verified dos 68 STAB. T7/T8 continuam incompletas neste plano: BUILD verificou parte de seus resultados em escopo próprio, sem fechar automaticamente seus requisitos transversais. Não refazer integrações já verificadas nem marcar esses itens completos apenas por essa sobreposição.

A autorização atual é revisão documental seguida de estabilização pela sessão nova, conforme C6 da [spec](spec.md) e [Handoff](../../STATE.md). O recorte posterior de captura/saída está nas nove [tarefas MEDIA](../captura-midia-saida/tasks.md): T1–T7 e R1–R5 foram executadas; a rodada independente 2 repetiu 80 testes e 16 gates, com sensor 6/6 por asserção e relatório em fechamento. T9 permanece pendente por indisponibilidade explícita de hardware/operadores. Isso não certifica os 68 STAB nem fecha automaticamente T7/T8 abaixo. Gates e contagens históricos continuam vinculados aos respectivos commits.

**Retomada STAB:** reutilizar os testes existentes e a evidência MEDIA somente onde a asserção comprovar o AC. Primeiro completar as conjunções de mensagens e encerramento nos proprietários T3/T5; depois fechar a evidência desktop T7 e a avaliação transversal T8. Sem dependências novas, refatoração geral ou TypeScript. Correções de adequação retornam ao proprietário e têm teste/gate/commit próprios. O Verifier final deriva os 68 ACs e injeta os sete comportamentos R01–R07 para STAB-63; não conta erro de import, timeout de helper ou reprodução histórica como aprovação.

## Test Coverage Matrix

Origem: README.md (Verificação), package.json, tests/server.test.js, scripts/desktop-smoke.mjs e spec.md. Sem lint ou formatter configurado; não adicionar ferramentas só para preencher gate. Aplicar cobertura dos ACs e casos limite, sem testes especulativos.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Contrato, Call e Session | unit | ACs correspondentes e falhas/concorrência da spec | tests/*.test.js | npm.cmd test |
| Serviço e banco | integration | Entrada válida, limites, erros, persistência e shutdown | tests/*.test.js | npm.cmd test |
| Bootstrap e Electron | integration/e2e | Falha de launch, permissões, perfil e saída | tests/*.test.js; scripts/desktop-smoke.mjs | npm.cmd test; node scripts/desktop-smoke.mjs |
| Interface | e2e | Fluxos e falhas da spec, teclado e estado real | scripts/desktop-smoke.mjs | node scripts/desktop-smoke.mjs |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Domínio/contrato | npm.cmd test |
| Full | Serviço/banco/bootstrap | npm.cmd test |
| Build | Fim de fase e integração desktop | npm.cmd test; npm.cmd run build; node scripts/desktop-smoke.mjs após integração T7 |

Os comandos são os existentes. Os scripts desktop serão atualizados na própria entrega que altera seu contrato. Durante T1–T5 o gate Build roda testes Node + build; o gate desktop passa a obrigatório após T7 e no fechamento T8.

## Execution Plan

### Phase 1: Domínio e serviço

```text
T1 -> T2 -> T3 -> T4
```

### Phase 2: Sessão e desktop

```text
T4 -> T5
T5 -> T6 -> T7 -> T8
```

## Task Breakdown

### T1: Definir o contrato compartilhado v1

**What**: Validadores e limites explícitos do protocolo/configuração.
**Where**: `shared/protocol.js`
**Depends on**: None
**Reuses**: Eventos existentes e valores A1–A14.
**Requirement**: STAB-27, STAB-40, STAB-41, STAB-49, STAB-50.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Node.
**Done when**:
- [x] Eventos inválidos, versão e ICE/PORT são discriminados pelos testes da spec.
- [x] npm.cmd test e build passam; 7 testes, incluindo os 3 anteriores. Adequação em evidence.md, T1.
**Tests**: unit em tests/protocol.test.js.
**Gate**: quick

### T2: Corrigir o proprietário de captura e negociação Call

**What**: Uma geração de chamada controla aquisição, publicação de tela e peers até o término.
**Where**: `src/rtc.js`
**Depends on**: T1
**Reuses**: Call e seus três transceivers.
**Requirement**: STAB-01–09, STAB-10–16, STAB-42, STAB-43, STAB-68.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Node.
**Done when**:
- [x] Corridas e falhas parciais terminam todas as tracks esperadas sem capturas obsoletas.
- [x] Negociação e candidatos respeitam os limites; nova tentativa funciona. Gate: 16/16 testes e build; T2 em evidence.md.
**Tests**: unit em tests/rtc.test.js, incluindo promises de permissão/sender controladas.
**Gate**: quick

### T3: Estabilizar o componente createService

**What**: Serviço confirma operações, deduplica mensagens e encerra recursos com prazo.
**Where**: `server/service.js`
**Depends on**: T2
**Reuses**: Factory, SQLite/WAL, WS e heartbeat existentes.
**Requirement**: STAB-18–19, STAB-21, STAB-23–30, STAB-32–37, STAB-40–41, STAB-51–55, STAB-61, STAB-68.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Node.
**Done when**:
- [x] Destino, recibos/deduplicação, limite de chamada, saída com cota esgotada e histórico legado passam.
- [x] Upgrade desconhecido e close concorrente não bloqueiam encerramento; falhas de entrega não perdem commit. Gate: 26/26 testes e build; T3 em evidence.md.
- [x] Retomada: resultados explícitos de conflito em outra sala, texto recusado sem gravação, HTTP/WS 503 durante fechamento atendível, deadline original de 5 s sob limpeza suspensa e 404/socket encerrado em 1 s. Full 85/85 PASS, cinco testes novos sem mudança de produto; [adequação R1](execution.md#r1--t3--mensagens-persistidas-e-encerramento-do-serviço). Asserções de resultado antes de qualquer espera que esconderia R07 por watchdog. Commit correspondente é o que contém esta atualização.
**Tests**: integration em tests/server.test.js e tests/service.test.js; adaptar somente o helper de protocolo dos três testes existentes.
**Gate**: full

### T4: Validar o ciclo de bootstrap do servidor separado

**What**: Inicialização e sinais usam configuração validada e limpeza comum.
**Where**: `server/index.js`
**Depends on**: T3
**Reuses**: Serviço e middleware Vite atuais.
**Requirement**: STAB-34–37, STAB-49, STAB-50.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Node.
**Done when**:
- [x] Porta inválida/ocupada e ICE inválido encerram com causa identificável e sem listener abandonado.
- [x] SIGINT e SIGTERM fecham o processo; HMR continua funcional. Gate: 30/30 testes e build; T4 em evidence.md.
**Tests**: integration em tests/bootstrap.test.js.
**Gate**: build

### T5: Encapsular pedidos e estado da sessão

**What**: Session mantém geração, prazos, sala e texto recuperável durante reconexão manual.
**Where**: `src/session.js`
**Depends on**: T4
**Reuses**: Fetch/WS e eventos atuais, sem nova biblioteca de estado.
**Requirement**: STAB-17–26, STAB-38–41, STAB-46–47.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Node.
**Done when**:
- [x] Nenhuma resposta antiga altera a sessão atual; handshake sem hello termina em timeout.
- [x] Texto e operação sobrevivem à troca/reconexão na execução; reenvio reconcilia pelo recibo. Gate: 39/39 testes e build; T5 em evidence.md.
- [x] Retomada: falha de transporte preserva texto integral; recibo atrasado não muda a sala atual; todas as fases A1 terminam no limite e permitem nova tentativa. Três testes novos, produto inalterado, Quick 89/89 PASS; [adequação R2](execution.md#r2--t5--composição-transporte-e-prazos-da-session). Fixture/asserção de R04/R05 fortalecidas; sensor independente ainda pendente. Commit correspondente é o que contém esta atualização.
**Tests**: unit em tests/session.test.js com transporte controlado.
**Gate**: quick

### T6: Integrar a interface com os controladores estabilizados

**What**: App apresenta estados reais, composição segura e modal acessível.
**Where**: `src/main.jsx`
**Depends on**: T5
**Reuses**: Layout e componentes atuais; src/style.css somente para os três contrastes.
**Requirement**: STAB-08, STAB-17, STAB-20, STAB-22, STAB-31, STAB-44, STAB-46–47, STAB-57–62, STAB-67.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Playwright.
**Done when**:
- [x] UI conecta Call/Session sem depender de texto de erro; pending tem cancelamento e texto falho é recuperável.
- [x] Keyboard modal, agrupamento por ID, leitura e qualidade correspondem aos ACs. Gate: 39 testes Node, build e smoke desktop ampliado; T6 em evidence.md.
**Tests**: e2e em scripts/desktop-smoke.mjs, incluindo falhas controladas e teclado.
**Gate**: full

### T7: Restringir permissões e persistir perfil desktop

**What**: Host Electron guarda preferências por perfil e valida o frame de cada capacidade.
**Where**: `electron/main.js`
**Depends on**: T6
**Reuses**: Preload estreito, picker, bloqueio de playback e janelas do host; ajustar electron/preload.cjs e embalagem dos módulos necessários em package.json.
**Requirement**: STAB-01, STAB-05, STAB-10–11, STAB-31, STAB-36–37, STAB-45, STAB-48–50, STAB-56, STAB-67.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Playwright.
**Done when**:
- [ ] Reinício com outra porta preserva preferências; outro host do perfil é recusado.
- [ ] Frame alheio/câmera/IPC inválido não obtém capacidade e fechamento cancela picker.
- [ ] Retomada: configuração ICE efetiva desktop/servidor equivalente e diagnóstico de falha de playback com correlação disponível e sem conteúdo sensível, além dos resultados já reutilizáveis de perfil/permissão.
**Tests**: integration/e2e em tests/desktop-policy.test.js e scripts/desktop-smoke.mjs.
**Gate**: build

### T8: Tornar o harness de verificação independente e terminar a evidência

**What**: Diagnóstico source e teardown confiáveis com flags explícitas.
**Where**: `scripts/startup-audio-check.mjs`
**Depends on**: T7
**Reuses**: Diagnóstico e smoke existentes; limpeza compartilhada somente se os dois scripts precisarem da mesma operação.
**Requirement**: STAB-63–67 e verificação transversal dos 68 ACs.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Playwright; Verifier independente.
**Done when**:
- [ ] Source funciona sem manifesto; launch/close/WS falhando não deixam recursos de teste e flags 0/1 são corretas.
- [ ] Todos os gates automatizáveis passam; relatório independente registra hardware real como não demonstrado, sem inventar aprovação.
**Tests**: integration em tests/harness.test.js e scripts/desktop-smoke.mjs.
**Gate**: build

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | Match |
| T2 | T1 | T1 | Match |
| T3 | T2 | T2 | Match |
| T4 | T3 | T3 | Match |
| T5 | T4 | Phase 1 complete | Match: predecessor phase |
| T6 | T5 | T5 | Match |
| T7 | T6 | T6 | Match |
| T8 | T7 | T7 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Contrato | unit | unit | Match |
| T2 | Call | unit | unit | Match |
| T3 | Serviço | integration | integration | Match |
| T4 | Bootstrap | integration | integration | Match |
| T5 | Session | unit | unit | Match |
| T6 | Interface | e2e | e2e | Match |
| T7 | Electron | integration/e2e | integration/e2e | Match |
| T8 | Harness | integration | integration | Match |

## Task Granularity Check

Cada tarefa entrega um componente proprietário existente ou o único controlador/contrato que ele exige, junto com seus testes. T3 preserva a factory existente como unidade; não cria arquitetura de serviços genéricos. A adequação de cada commit será registrada em evidence.md com file:line e expressão de asserção; nenhuma conclusão se baseia somente no nome do teste.
