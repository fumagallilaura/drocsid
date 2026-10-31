# Estabilização Tasks

**Approved**: 2026-10-26 - user: "Prossiga autonomamente pelas tarefas autorizadas, com testes de resultado e gates antes de marcar conclusão."


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

**Fix F1 / T1:** nomes de sala/exibição validados em1–32 UTF16 após trim nos dois receptores. Strings em branco recusadas;32 úteis com padding aceitas sem coagir/alterar payload. Teste novo reproduziu Missing expected exception antes do fix;92/92 + build e protocol co-localizado PASS em `test-results/stab-f1`.

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

**Fix F3 / T2:** prova própria de idade dos candidatos, recebidos em instantes distintos: preservados14999/removidos15000 cada um, peer mantido e só candidato fresco entregue à descrição posterior. RTC/Full 94/94 + Vite PASS em `test-results/stab-f3`; sem mudança de produto.

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

**Retomada T3 / R5:** incompatibilidade por versão de banco futura ou coluna obrigatória ausente recusa a abertura com INVALID_INPUT; salas/mensagens/versão anteriores permanecem iguais após reabrir. Full 90/90, zero falhas/skips; `test-results/stab-r5`. Sem mudança de produto.

**Retomada T3 / R6 (bootstrap):** erro ao abrir banco retorna BOOTSTRAP_FAILED com causa SQLite, não deixa handlers e permite nova inicialização/fechamento. Build PASS, 91/91 + Vite + smoke source, logs `test-results/stab-r6`.

**Fix F2 / T3:** toda recusa terminal do serviço registra metadados no proprietário error antes de responder, com causa disponível; catch de persistência/handler não duplica o diagnóstico. Wire phase/códigos preservados. Novo teste reproduziu warnings0 versus1 antes do fix;93/93 + build/co-localizado PASS em `test-results/stab-f2`.

**Fix F4 / T3:** comparação completa dos200 IDs/textos/salas/timestamps legados em ordem; registro real adicional em café e nova consulta provam ausência em geral. Asserções antigas, plano indexado e count10000 mantidos antes da escrita extra. Service/Full 94/94 + Vite PASS em `test-results/stab-f4`, sem mudança de produto.

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
- [x] Retomada R3: falha de playback tem callId/geração da tentativa capturados e diagnóstico sem sentinelas sensíveis. Falhou por valor antes da correção; 89/89 + build/smokes interno e externo/captura/perfil source PASS. [Adequação](execution.md#r3--t6--correlação-de-diagnóstico-de-reprodução), no commit que contém esta marca.
**Tests**: e2e em scripts/desktop-smoke.mjs, incluindo falhas controladas e teclado.
**Gate**: full

**Retomada T6 / R7:** mensagens válidas legadas com authorId=null não agrupam e ambas mostram autoria; smoke source interno/externo PASS, 91/91 + build. A primeira execução externa passou as asserções e falhou no teardown; não foi contada como PASS. Nenhum processo remanescente foi encontrado; repetição completa externa passou, sem relaxar deadline/asserts. Logs `test-results/stab-r7`.

### T7: Restringir permissões e persistir perfil desktop

**What**: Host Electron guarda preferências por perfil e valida o frame de cada capacidade.
**Where**: `electron/main.js`
**Depends on**: T6
**Reuses**: Preload estreito, picker, bloqueio de playback e janelas do host; ajustar electron/preload.cjs e embalagem dos módulos necessários em package.json.
**Requirement**: STAB-01, STAB-05, STAB-10–11, STAB-31, STAB-36–37, STAB-45, STAB-48–50, STAB-56, STAB-67.
**Tools**: MCP Agent Skills; tlc-spec-driven; shell/Playwright.
**Done when**:
- [x] Reinício com outra porta preserva preferências; outro host do perfil é recusado. Asserções de valor em perfil source reexecutadas na retomada; [adequação R4](execution.md#r4--t7--perfil-permissões-e-ice-efetiva).
- [x] Frame alheio/câmera/IPC inválido não obtém capacidade e fechamento cancela picker. Políticas/IPC/captura e resultados de perfil atual conferidos; evidência não representa autenticação de convidados.
- [x] Retomada: configuração ICE efetiva desktop/servidor equivalente por comparação de respostas reais; 89/89 + build/smoke/perfil source PASS. Diagnóstico de playback pertence ao componente Media, tratado em R3/T6 `8955755`, sem duplicação no host. Commit de T7 correspondente é o que contém estas marcas; sem Verified integral STAB.
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
- [x] Source funciona sem manifesto; launch/close/WS falhando não deixam recursos de teste e flags 0/1 são corretas. Harness e matriz 16 atuais aprovados, ver [evidência atual](evidence-current.md).
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

## Checks

Uma claim por AC, sem alterar seu texto. As provas Node compartilham uma execução e exigem a linha de aprovação de cada teste selecionado. Os checkers desktop exercitam controles e resultados da integração. Mais de uma camada pode ser necessária.

**Build**: npm.cmd test; npm.cmd run build; node scripts/desktop-smoke.mjs
**Run node**: node --test --test-reporter=spec tests/*.test.js
**Discrimination sensor**: sete regressões STAB R01–R07 e quatro sondas dos fixes permanecem obrigatórias. A revisão MCP 0.17.18 (`eec8e8fe8151`) substituiu o utilitário mutate.py por julgamento das provas; isso não reduz STAB-63. Os sensores isolados continuam evidência separada, sem fabricar linhas da ferramenta antiga. O primeiro Verifier STAB válido e os dois pareceres MEDIA já retornaram; não há novo despacho. Sem captura visual vinculante; UI exercitada pelos checkers. Não há lint/typecheck no repositório e TypeScript não começa agora.

**C1** - WHEN o aplicativo abrir ou recarregar fora de uma chamada THEN o Conversa SHALL permanecer sem iniciar captura de microfone, tela ou áudio do sistema. (STAB-01)
Proof: run node | ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close
Proof: node scripts/startup-audio-check.mjs

**C2** - WHILE houver uma aquisição de mídia de um tipo pendente na mesma tentativa o Conversa SHALL impedir outra aquisição concorrente desse tipo. (STAB-02)
Proof: run node | ✔ STAB-02/03: simultaneous microphone activation acquires once; cancel stops late track
Proof: run node | ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works

**C3** - IF uma aquisição retornar depois de cancelamento, saída, substituição de tentativa ou fechamento THEN o Conversa SHALL encerrar todas as tracks retornadas dentro de A2, sem incorporá-las à tentativa atual. (STAB-03)
Proof: run node | ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close
Proof: run node | ✔ STAB-02/03: simultaneous microphone activation acquires once; cancel stops late track

**C4** - WHILE o controlador de chamada estiver definitivamente fechado o Conversa SHALL rejeitar ações que iniciem captura antes de chamar APIs de mídia. (STAB-04)
Proof: run node | ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close

**C5** - WHEN ocorrer saída, desconexão, troca de sala, desmontagem ou fechamento da janela THEN o Conversa SHALL encerrar todas as tracks já adquiridas por essa chamada dentro de A2. (STAB-05)
Proof: run node | ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close
Proof: node scripts/desktop-lifecycle-check.mjs

**C6** - WHEN chegar confirmação de admissão da tentativa vigente THEN o Conversa SHALL representar a participação admitida dessa tentativa, sem inferir admissão de respostas de outra tentativa. (STAB-06)
Proof: run node | ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works

**C7** - IF a admissão for recusada por qualquer motivo ou exceder A1 THEN o Conversa SHALL desfazer toda captura provisória dessa tentativa dentro de A2, independentemente do texto localizado do erro. (STAB-07)
Proof: run node | ✔ STAB-07: every admission rejection releases provisional microphone

**C8** - WHILE houver captura ou admissão pendente o Conversa SHALL oferecer uma ação de cancelamento acessível que encerre a tentativa. (STAB-08)
Proof: run node | ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works
Proof: node scripts/desktop-smoke.mjs

**C9** - IF o microfone for negado ou indisponível THEN o Conversa SHALL permitir admissão em modo de escuta e compartilhamento sem track de microfone. (STAB-09)
Proof: run node | ✔ STAB-02/06/08/09: acquisition is exclusive, pending is observable, listen-only admission works

**C10** - WHEN o usuário iniciar compartilhamento THEN o Conversa SHALL exigir seleção explícita da fonte para aquela tentativa, com áudio do sistema somente se solicitado nessa execução conforme A9. (STAB-10)
Proof: run node | ✔ STAB-10/11: screen capture is explicit and late picker result is released
Proof: node scripts/desktop-capture-check.mjs

**C11** - IF o seletor for cancelado, expirar em 60 s ou retornar após a tentativa terminar THEN o Conversa SHALL terminar essa operação sem conservar captura de tela ou áudio do sistema. (STAB-11)
Proof: run node | ✔ STAB-10/11: screen capture is explicit and late picker result is released
Proof: node scripts/desktop-capture-check.mjs

**C12** - IF a publicação para qualquer peer falhar ou não concluir em 8 s após obter a captura THEN o Conversa SHALL encerrar todas as tracks do novo compartilhamento dentro de A2. (STAB-12)
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone
Proof: run node | ✔ STAB-12/13: one stalled sender cannot delay rollback after another sender fails

**C13** - IF uma publicação parcial for abortada THEN o Conversa SHALL cessar o envio dessa captura por todos os peers locais dentro de A2, inclusive quando a remoção de um sender falhar. (STAB-13)
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone
Proof: run node | ✔ STAB-12/13: one stalled sender cannot delay rollback after another sender fails

**C14** - WHEN ocorrer parada pelo aplicativo ou encerramento da fonte pelo sistema THEN o Conversa SHALL encerrar localmente todas as tracks de tela e áudio do sistema dentro de A2. (STAB-14)
Proof: run node | ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects

**C15** - WHEN o compartilhamento terminar por parada, cancelamento ou erro THEN o Conversa SHALL convergir para estado local sem compartilhamento em até 1 s, mesmo se a notificação de rede ou um sender falhar. (STAB-15)
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone
Proof: run node | ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects

**C16** - IF iniciar ou parar tela falhar THEN o Conversa SHALL preservar a admissão e o estado anterior do microfone nos peers saudáveis. (STAB-16)
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone

**C17** - WHILE uma troca de sala aguardar confirmação o Conversa SHALL impedir submissão de mensagens, mantendo a sala confirmada como contexto visível da composição. (STAB-17)
Proof: run node | ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts
Proof: node scripts/desktop-smoke.mjs

**C18** - WHEN um envio for submetido THEN o Conversa SHALL fixar sua sala explícita e seu identificador de operação, que não mudam em resposta a navegação ou reenvio. (STAB-18)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition
Proof: run node | ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect
Proof: run node | ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message
Proof: run node | ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination

**C19** - IF um envio ainda não persistido indicar sala diferente da sala confirmada no servidor THEN o serviço SHALL rejeitá-lo sem persistir mensagem em qualquer sala. (STAB-19)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history

**C20** - WHEN uma troca de sala, desconexão ou reconexão ocorrer na mesma execução THEN o Conversa SHALL preservar separadamente o texto recuperável de cada sala, incluindo envios ainda sem confirmação. (STAB-20)
Proof: run node | ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts
Proof: run node | ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition
Proof: run node | ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect
Proof: run node | ✔ STAB-20/22: connection loss preserves pending text across manual reconnect

**C21** - WHEN o servidor aceitar um envio THEN o serviço SHALL confirmar somente após persistência, com recibo que identifique operação, mensagem, sala e ordem de inserção. (STAB-21)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition
Proof: run node | ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message
Proof: run node | ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination
Proof: run node | ✔ STAB-21/27: rejected text creates no record and 2000 UTF-16 units commit after trim

**C22** - IF o transporte não aceitar o envio, o servidor recusá-lo ou a confirmação exceder A1 THEN o Conversa SHALL manter o texto integral recuperável na sala original como rascunho ou envio pendente/falho, sem apresentá-lo como confirmado. (STAB-22)
Proof: run node | ✔ STAB-18/20/22: a transport refusal preserves full text and both room drafts across reconnect
Proof: run node | ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message
Proof: run node | ✔ STAB-20/22: connection loss preserves pending text across manual reconnect
Proof: run node | ✔ STAB-22/23: lost confirmation retains text until committed history reconciles it

**C23** - WHEN uma operação já persistida for reenviada com a mesma sala e conteúdo normalizado de A6 THEN o Conversa SHALL apresentar o mesmo resultado persistido, com uma única mensagem no banco e na lista da sala original, mesmo após reconexão. (STAB-23)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition
Proof: run node | ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message
Proof: run node | ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history
Proof: run node | ✔ STAB-22/23: lost confirmation retains text until committed history reconciles it

**C24** - IF um identificador de operação já usado for apresentado com outra sala ou conteúdo THEN o serviço SHALL rejeitar o conflito sem alterar o registro original. (STAB-24)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-19/23/24: a receipt stays in its original room and conflicts never alter either history

**C25** - IF a entrega ou o broadcast falhar depois do commit THEN o serviço SHALL conservar o resultado persistido consultável pelo reenvio da mesma operação, sem declarar que o commit foi desfeito. (STAB-25)
Proof: run node | ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed

**C26** - WHEN o serviço reiniciar com o mesmo banco THEN o serviço SHALL conservar mensagens confirmadas e os resultados de deduplicação de A6. (STAB-26)
Proof: run node | ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed

**C27** - IF o texto após trim estiver vazio ou exceder 2000 unidades UTF-16 THEN o serviço SHALL rejeitar o envio sem gravar mensagem. (STAB-27)
Proof: run node | ✔ STAB-21/27: rejected text creates no record and 2000 UTF-16 units commit after trim
Proof: run node | ✔ STAB-27: trimmed message bounds accept 1 and 2000 UTF-16 units

**C28** - WHEN chegar uma saída válida da tentativa vigente THEN o serviço SHALL processá-la mesmo com o orçamento de mensagens ou sinalização esgotado. (STAB-28)
Proof: run node | ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets

**C29** - WHEN essa saída for processada THEN o serviço SHALL convergir em até 1 s para participante fora da chamada, sem compartilhamento e sem vaga ocupada, com confirmação correlacionada. (STAB-29)
Proof: run node | ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets

**C30** - WHEN a saída da mesma tentativa for repetida THEN o serviço SHALL devolver o mesmo estado terminal sem nova admissão ou erro de recurso já encerrado. (STAB-30)
Proof: run node | ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets

**C31** - WHILE o usuário estiver fora de chamada admitida ou com áudio recebido silenciado o desktop SHALL manter reprodução de mídia bloqueada, inclusive após recarga e eventos tardios. (STAB-31)
Proof: node scripts/desktop-smoke.mjs

**C32** - IF o transporte for perdido sem saída confirmada THEN o serviço SHALL remover a participação em chamada dentro de A11, sem condicionar a liberação à reconexão. (STAB-32)
Proof: run node | ✔ STAB-32: heartbeat releases silent participant within 60 seconds

**C33** - WHEN um Upgrade sem consumidor registrado chegar em modo de produção THEN o serviço SHALL rejeitá-lo com HTTP 404 e finalizar o socket em até 1 s. (STAB-33)
Proof: run node | ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes
Proof: run node | ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s

**C34** - WHEN um Upgrade pertencente ao HMR registrado chegar em desenvolvimento THEN o serviço SHALL permitir que o consumidor de desenvolvimento o processe. (STAB-34)
Proof: run node | ✔ STAB-34: registered Vite HMR upgrade works while unknown paths are rejected

**C35** - WHILE o serviço estiver encerrando o serviço SHALL recusar novas admissões HTTP/WS com HTTP 503 em conexões ainda atendíveis. (STAB-35)
Proof: run node | ✔ STAB-35/37: pending shutdown refuses HTTP and WS with one terminal result

**C36** - WHEN ocorrer fechamento do serviço, saída do desktop, SIGINT ou SIGTERM THEN o sistema SHALL liberar listeners, sockets HTTP/WS/Upgrade, temporizadores e banco dentro de A4. (STAB-36)
Proof: run node | ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes
Proof: run node | ✔ STAB-36/37: both signal handlers close a separate process inside five seconds
Proof: run node | ✔ STAB-36/37: repeated close does not extend a stalled cleanup deadline
Proof: node scripts/desktop-lifecycle-check.mjs

**C37** - IF houver pedidos repetidos de encerramento ou falha em uma etapa de limpeza THEN o sistema SHALL executar a limpeza restante dentro do prazo original, com resultado terminal único e sem rejeições assíncronas não tratadas. (STAB-37)
Proof: run node | ✔ STAB-33/36/37: unknown upgrades are rejected and concurrent shutdown completes
Proof: run node | ✔ STAB-35/37: pending shutdown refuses HTTP and WS with one terminal result
Proof: run node | ✔ STAB-36/37: both signal handlers close a separate process inside five seconds
Proof: run node | ✔ STAB-36/37: repeated close does not extend a stalled cleanup deadline
Proof: run node | ✔ STAB-37/67: failed cleanup still closes remaining resources and diagnostic omits secret payloads

**C38** - IF qualquer fase de A1 exceder seu prazo THEN o Conversa SHALL terminar essa espera com erro identificável e permitir uma nova tentativa manual. (STAB-38)
Proof: run node | ✔ STAB-38: opening WS does not cancel the hello deadline; next attempt can succeed
Proof: run node | ✔ STAB-38: every A1 phase ends at 8s and permits a manual retry

**C39** - IF uma resposta HTTP, evento WS, callback ou sinal pertencer a conexão, sala ou tentativa de chamada substituída THEN o Conversa SHALL descartá-lo sem modificar o estado vigente. (STAB-39)
Proof: run node | ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts
Proof: run node | ✔ STAB-18/20/21/23/39: a late receipt reconciles its original room without changing the new composition
Proof: run node | ✔ STAB-18/21/39: real client/server contract keeps the first presence and the committed destination
Proof: run node | ✔ STAB-39: old fetch/socket callbacks cannot overwrite a newer connection

**C40** - IF um evento recebido tiver versão incompatível, tipo desconhecido ou campos com tipo/limite inválido THEN o receptor SHALL recusá-lo sem aplicar estado nem encaminhar sinalização inválida. (STAB-40)
Proof: run node | ✔ STAB-40/41: version and malformed client events have stable distinct outcomes
Proof: run node | ✔ STAB-40/41: malformed signals never reach a peer and errors keep correlation
Proof: run node | ✔ STAB-40/41: invalid server shape terminates connection without rendering invalid data
Proof: run node | ✔ STAB-40: server data is validated before rendering or signaling
Proof: run node | ✔ STAB-40: received display and room names have 1 to 32 UTF-16 units after trim

**C41** - WHEN uma operação com resposta terminal falhar THEN o protocolo SHALL identificar código estável, operação e fase, independentemente do texto apresentado ao usuário. (STAB-41)
Proof: run node | ✔ STAB-40/41: version and malformed client events have stable distinct outcomes
Proof: run node | ✔ STAB-40/41: malformed signals never reach a peer and errors keep correlation
Proof: run node | ✔ STAB-40/41: invalid server shape terminates connection without rendering invalid data

**C42** - IF um peer falhar ou não alcançar mídia pronta em 15 s desde o início da negociação THEN o Conversa SHALL terminar essa negociação como falha recuperável por ação manual, sem manter indicação indefinida de conexão em curso. (STAB-42)
Proof: run node | ✔ STAB-42/43: stalled peers terminate at 15s; candidates are bounded and expire

**C43** - WHILE candidatos aguardarem descrição remota o Conversa SHALL limitar sua pendência e validade conforme A7, sem reutilizá-los em outra tentativa. (STAB-43)
Proof: run node | ✔ STAB-42/43: stalled peers terminate at 15s; candidates are bounded and expire
Proof: run node | ✔ STAB-43: each queued candidate expires by its own age without closing the ready peer

**C44** - WHILE não houver mídia remota pronta o Conversa SHALL distinguir presença/admissão de mídia conectada, oferecendo entrada para assistir quando o usuário estiver fora da chamada em vez de apresentar vídeo inexistente como AO VIVO. (STAB-44)
Proof: node scripts/desktop-smoke.mjs

**C45** - WHEN o desktop reiniciar com o mesmo userData e outra porta local THEN o Conversa SHALL restaurar nome, endereço e qualidade conforme A9, mantendo áudio do sistema desligado no início da execução. (STAB-45)
Proof: run node | ✔ STAB-45: preference contract persists only bounded supported profile fields
Proof: node scripts/desktop-profile-check.mjs

**C46** - WHEN um endereço válido com room=cafe for colado em Servidor do grupo THEN o Conversa SHALL usar a origem indicada e selecionar cafe após confirmação dessa sala. (STAB-46)
Proof: run node | ✔ STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back

**C47** - IF o endereço usar esquema não HTTP/HTTPS, embutir credenciais ou indicar sala inexistente THEN o Conversa SHALL apresentar erro específico sem ingressar silenciosamente em outra sala. (STAB-47)
Proof: run node | ✔ STAB-46/47: pasted invite preserves room and invalid destinations never silently fall back

**C48** - IF uma permissão ou IPC privilegiado vier de frame/origem não confiável, ou solicitar câmera fora do caso de uso THEN o desktop SHALL negá-lo sem conceder captura ou controle de reprodução. (STAB-48)
Proof: run node | ✔ STAB-48: only main local frame may request audio, never camera
Proof: run node | ✔ STAB-48: privileged IPC checks the actual sender frame, not only window URL
Proof: node scripts/desktop-profile-check.mjs

**C49** - IF PORT ou qualquer entrada ICE configurada tiver formato inválido, ou o bootstrap falhar ao abrir banco/listener THEN o sistema SHALL recusar a inicialização com causa identificável e liberar os recursos já abertos. (STAB-49)
Proof: run node | ✔ STAB-49/50: separate server serves validated ICE config and closes idempotently
Proof: run node | ✔ STAB-49/50: ICE config and ports use the same explicit validation
Proof: run node | ✔ STAB-49: invalid configuration and occupied port fail without signal/listener leaks
Proof: run node | ✔ STAB-49: a database open failure retains its cause and leaves bootstrap retryable
Proof: run node | ✔ STAB-49/55: incompatible stored data is refused without changing prior rows
Proof: run node | ✔ STAB-49: a database open failure retains its cause and leaves bootstrap retryable

**C50** - WHEN desktop e servidor separado receberem a mesma configuração ICE válida THEN o sistema SHALL expor a mesma configuração efetiva de mídia para testes, respeitando os limites de acesso de C1 e A13. (STAB-50)
Proof: run node | ✔ STAB-49/50: separate server serves validated ICE config and closes idempotently
Proof: run node | ✔ STAB-49/50: ICE config and ports use the same explicit validation
Proof: node scripts/desktop-profile-check.mjs

**C51** - WHEN uma nova conexão ou criação de sala exceder os tetos de A8 THEN o serviço SHALL recusá-la sem expulsar participantes já admitidos ou criar registros excedentes. (STAB-51)
Proof: run node | ✔ STAB-51/52: connection cap refuses 25th and slow consumer cannot block healthy delivery
Proof: run node | ✔ STAB-51: 100th room is accepted and 101st is refused without deleting rooms

**C52** - IF a fila de saída de um socket exceder 1 MiB THEN o serviço SHALL encerrar esse consumidor lento sem bloquear confirmações destinadas aos clientes saudáveis. (STAB-52)
Proof: run node | ✔ STAB-51/52: connection cap refuses 25th and slow consumer cannot block healthy delivery

**C53** - WHEN o histórico de uma sala for solicitado THEN o serviço SHALL devolver os últimos 200 registros em ordem de inserção, estável para timestamps iguais e sem registros de outra sala. (STAB-53)
Proof: run node | ✔ STAB-18/19/21/23/24/53: destination is explicit and commit receipt is idempotent
Proof: run node | ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page

**C54** - WHEN a seleção dos últimos 200 registros for analisada em uma sala com 10000 mensagens THEN o serviço SHALL evitar ordenação temporária de todo o histórico da sala antes do limite. (STAB-54)
Proof: run node | ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page

**C55** - IF houver erro de escrita, contenda de banco ou incompatibilidade de dados existentes THEN o sistema SHALL preservar os registros anteriores sem confirmação falsa ou exclusão automática de mensagens. (STAB-55)
Proof: run node | ✔ STAB-25/26/55: failed delivery after commit survives restart; locked write is not confirmed
Proof: run node | ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page
Proof: run node | ✔ STAB-49/55: incompatible stored data is refused without changing prior rows

**C56** - WHEN um segundo host desktop tentar abrir o mesmo userData ativo THEN o desktop SHALL recusar esse host adicional de forma identificável, preservando as janelas do host original. (STAB-56)
Proof: node scripts/desktop-profile-check.mjs

**C57** - WHILE um modal estiver aberto o Conversa SHALL manter o foco dentro dele desde a abertura, com ciclo Tab/Shift+Tab e fundo sem interação. (STAB-57)
Proof: node scripts/desktop-smoke.mjs

**C58** - WHEN Escape ou a ação de fechar encerrar um modal THEN o Conversa SHALL restaurar o foco ao acionador ainda disponível ou a um controle equivalente do contexto atual. (STAB-58)
Proof: node scripts/desktop-smoke.mjs

**C59** - WHERE houver texto normal nos três seletores de R19 o Conversa SHALL apresentar contraste de pelo menos 4,5:1 contra o fundo efetivo. (STAB-59)
Proof: node scripts/desktop-smoke.mjs

**C60** - WHEN uma mensagem chegar durante leitura distante mais de 100 px do fim THEN o Conversa SHALL preservar a posição de leitura. (STAB-60)
Proof: node scripts/desktop-smoke.mjs

**C61** - WHEN mensagens de convidados distintos tiverem o mesmo nome THEN o Conversa SHALL agrupá-las somente se houver a mesma identidade de autoria registrada, nunca inferida do nome, conforme A10. (STAB-61)
Proof: run node | ✔ STAB-53/54/55/61: legacy history keeps stable insertion order with an indexed page
Proof: node scripts/desktop-smoke.mjs

**C62** - WHILE houver captura de tela ativa e a qualidade selecionada mudar o Conversa SHALL indicar que a preferência vale para a próxima captura, sem prometer a resolução efetiva da atual. (STAB-62)
Proof: node scripts/desktop-smoke.mjs

**C63** - WHEN a suíte de aprovação da estabilização for executada contra os comportamentos defeituosos R01–R07 THEN a suíte SHALL reprovar cada um por violação dos resultados definidos nesta spec. (STAB-63)
Proof: run node | ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s
Proof: run node | ✔ STAB-01/03/04/05: no startup capture; old permission cannot attach after leave/rejoin or close
Proof: run node | ✔ STAB-07: every admission rejection releases provisional microphone
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone
Proof: run node | ✔ STAB-17/20/39: room transition blocks sending and preserves separate drafts
Proof: run node | ✔ STAB-18/21/22/23: rejected text is recoverable and retry reconciles one persisted message
Proof: run node | ✔ MEDIA-25/26: saturated message, media and signaling budgets still allow stop and replacement at capacity
Proof: run node | ✔ STAB-33/63/R07: an unknown Upgrade returns 404 and closes within 1s

**C64** - WHEN o diagnóstico de áudio for solicitado pelo código sem artifacts/build.json THEN o diagnóstico SHALL executar nesse modo com dados isolados, sem depender de manifesto de release. (STAB-64)
Proof: node scripts/startup-audio-check.mjs

**C65** - IF launch, fechamento do desktop ou uma espera WS de teste falhar THEN o harness SHALL finalizar seus próprios recursos e esperas dentro de 5 s, sem processos/listeners de teste abandonados. (STAB-65)
Proof: run node | ✔ BUILD-07/09: source never reads a release manifest and flags distinguish 0/1
Proof: run node | ✔ BUILD-08: failed desktop cleanup still closes a listening test server
Proof: run node | ✔ BUILD-08: a stalled cleanup has a terminal result within five seconds
Proof: run node | ✔ BUILD-08: WS closure rejects a pending event instead of waiting for its timeout
Proof: run node | ✔ BUILD-08: only an isolated temporary test profile may be removed
Proof: run node | ✔ BUILD-08: a real launch failure exits without leaving the external test server alive

**C66** - WHERE flags booleanas de teste forem fornecidas o harness SHALL interpretar 0 como falso e 1 como verdadeiro, rejeitando valores não reconhecidos. (STAB-66)
Proof: run node | ✔ BUILD-07/09: source never reads a release manifest and flags distinguish 0/1
Proof: run node | ✔ BUILD-08: failed desktop cleanup still closes a listening test server
Proof: run node | ✔ BUILD-08: a stalled cleanup has a terminal result within five seconds
Proof: run node | ✔ BUILD-08: WS closure rejects a pending event instead of waiting for its timeout
Proof: run node | ✔ BUILD-08: only an isolated temporary test profile may be removed
Proof: run node | ✔ BUILD-08: a real launch failure exits without leaving the external test server alive

**C67** - WHEN ocorrer erro de captura, reprodução, protocolo, persistência ou encerramento THEN o sistema SHALL registrar localmente fase, código, correlação e versão/ambiente suficientes para identificar a operação, excluindo texto de mensagens, credenciais, tokens, thumbnails e mídia capturada. (STAB-67)
Proof: run node | ✔ STAB-37/67: failed cleanup still closes remaining resources and diagnostic omits secret payloads
Proof: node scripts/desktop-smoke.mjs
Proof: run node | ✔ STAB-67: validation and state refusals log correlated metadata without payloads

**C68** - WHEN o compartilhamento terminar com transporte saudável THEN o Conversa SHALL confirmar aos participantes da sala o estado sem compartilhamento em até 8 s, inclusive após erro parcial ou cota esgotada. (STAB-68)
Proof: run node | ✔ STAB-12/13/15/16/68: partial publication rolls back screen and preserves healthy microphone
Proof: run node | ✔ STAB-14/15/68: source ending stops every display track even when detaching rejects
Proof: run node | ✔ STAB-28/29/30/68: leave and stop-screen bypass exhausted action budgets

## Handoff

**Settled mid-build:** 2026-10-26, user: "Executar nesta sessão; Verifier independente no fechamento". Recursos físicos indisponíveis: "Não estão disponíveis agora; manter T9 pendente".

**Resume, 2026-10-31:** user: "Então pode continuar trabalhando". MCP 0.17.18 (`eec8e8fe8151`), sem mudança de produto/testes desde `699d4ed`. Gate de entrada `validate_tasks --execute` PASS. Os 112 comandos Node anteriores foram expandidos sem perda para 134 linhas de testes nomeados, copiadas da execução real 94/94, zero falhas/skips/cancelled/todo. Auditoria em test-results/closure-20261031/estabilizacao-proof-migration.json. ACs e asserções preservados; nenhuma certificação física.

**Walked:** US1 entrada/cancelamento por teclado/escuta; US2 seleção/consentimento/tela/parada; US3 composição bloqueada na troca/retry; US4 mute/saída/cota; US5 shutdown via service/bootstrap e fechamento de janela; US6 falha/reentrada manual/estado de peer; US7 preferências/frame/câmera/ICE; US8 limites/legado por testes de serviço; US9 modal Tab/Escape, contraste, scroll, homônimos/legados e qualidade próxima captura; US10 startup/harness por checkers e Node. Gestos desktop executados em perfis isolados dos checkers; estados sem captura de design vinculante. Fontes/packaged aprovados em `699d4ed`, logs stabilizacao-postfix. Mídia sintética não é aceitação física.

**Dispatched:** 2026-10-26, primeiro despacho /root/stab_verifier invalidado e interrompido antes de parecer/sensor por leitura acidental do Handoff; confirmou nenhum arquivo/processo/scratch criado. Substituição fresca /root/stab_independent_verifier, HEAD573491e, range63810f4..573491e, após proofs87/87 PASS; recortes de matriz/Checks preparados sem Handoff. Retornado em `573491e`: verification.md FAIL, quatro achados F1–F4 e sensor7/7 por asserção. Provas sem alternância134pass; ferramenta mutate.py incompatível comSIGHUP Windows, fechamento sem aprovação. Author ≠ verifier.

**Report continuation, 2026-10-31:** o mesmo `/root/stab_independent_verifier` confirmou seu contexto de `573491e`. Retornado: 68 linhas C1–C68 em `verification.md`, com 64 yes no alcance original e quatro no históricos F1–F4, citando Closed do autor sem reavaliar os fixes. Somente indexação no formato `## Checks` da revisão MCP 0.17.18, sem novo Verifier, rodada ou julgamento do HEAD atual. Todo o conteúdo fora da tabela preservado byte a byte; nenhum produto/teste alterado.

**Fix pass do Verifier:** F1 `1c1bdbd`, F2 `0345015`, F3 `070dd2f`, F4 `9048e70`;94/94, sem Verified. Repetir matriz/provas e sete mutantes independentes, mais quatro sondas específicas dos fixes. Gate de fechamento da ferramenta continua pendente; T9 física ausente.

**Fechamento automatizado em `699d4ed`:**94/94,16 gates,136 provas funcionais e7+4 sensores por asserção. F1–F4 fechados nos commits dos proprietários. T8 permanece formalmente aberta: validate_verification exit1 pela ausência de linhas emitidas por mutate.py (SIGHUP indisponível); não confundir sensor próprio com execução da ferramenta. Sucesso físico e T9 pendentes.
