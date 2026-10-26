# Captura de mídia e saída da chamada Tasks

**Approved**: 2026-10-26 - user: "Prossiga autonomamente pelas tarefas autorizadas, com testes de resultado e gates antes de marcar conclusão."


## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Design**: [design.md](design.md). **Spec**: [spec.md](spec.md). **Status**: In Progress sob a autorização atual. **Base histórica**: `cd53044`; execução iniciada em `38062db`. T1–T7 executadas; T8 em revisão após a rodada independente 2 (16 gates e sensor 6/6 aprovados, uma conjunção automática a reverificar). T9 física não executada por indisponibilidade explícita de recursos. Ver [execução](execution.md) e [evidência](evidence.md).

O usuário solicitou design e tarefas juntos. Este plano concretiza a abordagem A recomendada; a geração do documento não marca essa arquitetura ou Execute como aprovados. Os padrões A1–A8 permanecem explícitos na spec.

**Atualização de investigação:** C6 confirma somente investigação e atualização documental. O compartilhamento de tela já existe; T4/T5/T7 reforçam seus proprietários e contratos. D10/D11 distinguem disponibilidade, consentimento, seleção e captura no código do Discord. U1 registra entrada/saída na UI, com câmera/tela indisponíveis, sem comprovar captura. Não adicionar câmera, gate de produto ou uma segunda implementação de compartilhamento por causa dessa limitação de referência.

**Reconciliação de 2026-10-25:** C7 da spec autoriza a sequência revisão documental → estabilização pela sessão nova. As limitações de não implementar acima descrevem as entregas históricas; esta revisão também é apenas documental e não inicia T1–T9. O status Draft e todos os itens abertos foram preservados. Antes da execução correspondente, reconciliar as escolhas técnicas do design, inclusive v2 versus STAB/A14 v1, com a spec e o código atual. Não promover propostas a decisões confirmadas nem alterar critérios para acomodar a implementação. Ver [relatório de coerência](../../../docs/revisao-coerencia-documental.md) e [Handoff](../../STATE.md).

## Test Coverage Matrix

> Gerada do código, documentação e spec. Guidelines: README, seção Verificação, e scripts de package.json. Não há AGENTS/CONTRIBUTING, configuração de cobertura, lint, format, typecheck ou workflow CI encontrados no projeto/ascendentes consultados. Aplicam-se os padrões fortes da skill. Amostras: protocol, rtc, service, server, session, desktop-policy e harness em tests; desktop-capture-check e desktop-smoke em scripts. Confirmar a matriz ao aprovar Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Call: microfone, tentativa e tela | unit | Cada MEDIA de domínio tem valor esperado; todos os ramos e edge cases do recorte, relógio, inventário completo de tracks e senders. | `tests/rtc.test.js` | `node --test tests/rtc.test.js` |
| Serviço: admissão, saída e heartbeat | integration | WS real em banco temporário; happy path, cancelamento anterior à admissão, duplicata, tentativa antiga, cota, capacidade e todos os limites de tempo. | `tests/service.test.js`, `tests/server.test.js` | `node --test tests/service.test.js tests/server.test.js` |
| Session: pedidos e presença | unit/integration | Falha, timeout, ack incompatível, presença antiga e contrato com servidor real; não regredir rascunhos/mensagens existentes. | `tests/session.test.js` | `node --test tests/session.test.js` |
| Protocolo | unit/integration | Valores/tipos/limites de todos os campos alterados; v1 incompatível após ativação, v2 válido; integração já ligada aos produtores/consumidores. Não é mera configuração sem comportamento. | `tests/protocol.test.js`, fixtures existentes | `node --test tests/protocol.test.js` e `npm.cmd test` |
| Host/preload/política de captura | unit/e2e | Frame/origem/remetente negados, chave inválida/antiga, callback único, cancelamento antes/durante inventário, timeout, erro e novo documento. | `tests/desktop-policy.test.js`, `scripts/desktop-capture-check.mjs`, fixture Electron existente | `node --test tests/desktop-policy.test.js`; `node scripts/desktop-capture-check.mjs` |
| App e integração de chamada | e2e | Controle por teclado, estado pendente/publicado, troca de sala, saída/reentrada, reprodução, erro tardio e diagnóstico sem conteúdo; inventário completo em reload/disconnect/unmount/close. | `scripts/desktop-smoke.mjs`, `scripts/desktop-profile-check.mjs`, `scripts/desktop-lifecycle-check.mjs` | `node scripts/desktop-smoke.mjs`; `node scripts/desktop-profile-check.mjs`; `node scripts/desktop-lifecycle-check.mjs` |
| Pacote e regressão BUILD | integration/e2e | Bytes/hash atuais, source sem manifesto, win-unpacked e wrapper portátil real. Nenhum resultado histórico substitui execução da candidata. | checkers existentes em `scripts/` | `node scripts/check-package.mjs`; `node scripts/portable-startup-check.mjs` |
| Áudio/dispositivo real | manual/integration | MEDIA-33/34 completos: três ciclos de 30 s, dois PCs, 10 min, 5/5 frases por sentido em duas medições e todas as etapas físicas. | `.specs/features/captura-midia-saida/uat.md` | Protocolo manual A7 da spec, sem flags de mídia sintética/silêncio. |
| Banco/mensagens | regression | Nenhuma alteração funcional ou de schema; manter asserções existentes no gate global. | testes atuais de servidor/sessão | `npm.cmd test` |

Não criar testes para copiar a implementação. Reutilizar asserção atual que já demonstre o resultado; acrescentar ou fortalecer apenas onde houver gap. Ajustar serialização de fixtures ao contrato aprovado preserva o resultado testado e acrescenta a rejeição do contrato antigo; não autoriza enfraquecer asserções.

## Gate Check Commands

> Comandos descobertos de package.json, README e scripts existentes. Nenhum comando de lint/format/typecheck foi inventado. A validação documental desta entrega não executa estes gates do aplicativo.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Domínio/unit e regressão Node | `npm.cmd test` |
| Full | Componente com integração/Electron | Quick + `npm.cmd run build` + `node scripts/desktop-smoke.mjs` em source/servidor interno; somar os checkers específicos do campo Gate da tarefa. |
| Build | Fim das fases de código e candidata de aceitação | Full + perfil/captura/ciclo/diagnóstico source, smoke externo, `npm.cmd run dist:win`, `node scripts/check-package.mjs`, perfil, ciclo e smoke internos/externos no win-unpacked, diagnóstico empacotado e `node scripts/portable-startup-check.mjs`. Ciclo: `node scripts/desktop-lifecycle-check.mjs`; matriz atual de 16 gates. |
| Physical | Aceitação de hardware | Build já aprovado para o mesmo hash + execução e registro integral de A7. Sem recurso/etapa executada não há PASS físico. |

Baseline observada no relatório BUILD: **50 testes Node, zero falhas/skips**. Antes de Execute, conferir o disco e reexecutar Quick. Cada tarefa exige `N = 50 + Δ` testes, com Δ acumulado documentado e não negativo, zero falhas/skips/cancelled. Registrar o total real e a integridade dos 50 existentes. O número não substitui cobertura: teste novo só é exigido para resultado ainda não demonstrado, sem quota artificial de testes.

Preparação source e smoke interno, com os comandos já suportados:

```powershell
Remove-Item Env:CONVERSA_TEST_EXECUTABLE -ErrorAction SilentlyContinue
$env:CONVERSA_CHECK_SOURCE = '1'
$env:CONVERSA_TEST_EXTERNAL = '0'
node scripts/desktop-smoke.mjs
```

Smoke externo: definir `CONVERSA_TEST_EXTERNAL=1` e repetir o mesmo script. Diagnóstico source: `CONVERSA_CHECK_SOURCE=1`, `CONVERSA_CHECK_MUTED=1` e `CONVERSA_BUILD_MANIFEST` apontando a um caminho temporário inexistente, depois `node scripts/startup-audio-check.mjs`. Após R5, esse diagnóstico observa seis segundos em nova janela e seis após reload, com contadores pré-App; não substitui MEDIA-33. Executar também `node scripts/desktop-lifecycle-check.mjs` nos dois targets. Sua fixture retém o Root somente na resposta HTTP para testar a API pública unmount; nenhuma mudança no fonte/ASAR. Áudio sintético completa o inventário quando loopback não retorna track; não certifica conteúdo físico.

Após o novo build local, usar o manifesto atual:

```powershell
$mediaBuild = Get-Content -Raw test-results/build.json | ConvertFrom-Json
$env:CONVERSA_TEST_EXECUTABLE = $mediaBuild.executable
$env:CONVERSA_CHECK_SOURCE = '0'
$env:CONVERSA_TEST_EXTERNAL = '0'
node scripts/desktop-profile-check.mjs
node scripts/desktop-smoke.mjs
$env:CONVERSA_TEST_EXTERNAL = '1'
node scripts/desktop-smoke.mjs
```

Diagnóstico empacotado usa `CONVERSA_CHECK_SOURCE=0` e `CONVERSA_TEST_EXECUTABLE` acima. O capture checker usa a fixture source do entrypoint real; não se apresenta esse resultado como execução da fixture dentro do ASAR. O portátil real tem seu checker separado. Restaure o ambiente de teste ao final; use apenas perfis/bancos temporários. Checkers com captura de tela rodam sequencialmente para não selecionar uma janela de outro teste.

## Execution Plan

Fases e tarefas são sequenciais. Campos aditivos entram primeiro; ativação obrigatória v2 ocorre somente depois de produtores e consumidores estarem ligados. Cada tarefa inclui seus testes e um commit atômico. Uma candidata só é gerada após todos os gates de código.

### Phase 1: Tentativa distribuída

```text
T1 -> T2 -> T3
```

### Phase 2: Tela, captura nativa e ativação do contrato

```text
T4 -> T5 -> T6 -> T7
```

### Phase 3: Aceitação

```text
T8 -> T9
```

## Task Breakdown

### Phase 1: Tentativa distribuída

#### T1: Fixar o contexto e o ciclo do microfone em Call

**What**: Entregar tentativa imutável e finalização local de microfone/peers sem esperar ack, mantendo aquisição exclusiva e escuta sem microfone.
**Where**: `src/rtc.js`
**Depends on**: None
**Reuses**: Call, generations, micPending, stop, deadline, leave/close e dublês atuais.
**Requirement**: MEDIA-01, MEDIA-02, MEDIA-03, MEDIA-04, MEDIA-05, MEDIA-06, MEDIA-07 (estado), MEDIA-08, MEDIA-21, MEDIA-23 (controlador), MEDIA-28, MEDIA-30, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node e Playwright existentes.

**Done when**:

- [x] Cada envio de chamada carrega callId/geração capturados; leave não lê a tentativa nova para responder à antiga. Os campos são aditivos nesta etapa, mantendo v1 até T6.
- [x] A guarda usa identidade/estado da tentativa; Call aceita a função alocadora de geração da Session, com padrão local para testes isolados, sem obter mídia depois de encerrado.
- [x] Permissões concorrentes/antigas, close definitivo, recusa genérica e timeout demonstram os resultados da spec; todas as tracks retornadas entram no inventário e terminam em A1 quando obsoletas.
- [x] Zero publicação provisória; escuta continua possível; mute não é confundido com stop. Leave local e nova entrada não dependem de ack antigo.
- [x] Testes do proprietário escritos/reutilizados no mesmo commit; Quick e Full aprovados. Total Node `50 + Δ` registrado, zero falhas/skips, asserções anteriores preservadas.

**Tests**: unit em `tests/rtc.test.js`, com relógio, streams e ordens de resolução controlados; integração pelo smoke existente. Incluir falha antiga depois de tentativa nova e deadline real do pedido, não só erro TIMEOUT já fabricado pelo dublê.
**Gate**: full; Quick + build + smoke source/interno.
**Commit**: `fix(rtc): bind microphone lifecycle to immutable call attempts`

**Execução T1 em 2026-10-25**: gate Full PASS, 55/55 Node (50 existentes + 5 novos), zero falhas/skips/cancelled. [Adequação e evidência](execution.md#t1--tentativa-e-microfone). Commit desta tarefa inclui código, testes e estes status. T2–T9 pendentes; nenhum MEDIA Verified.

#### T2: Tornar o participante terminal e expirar a vaga no prazo

**What**: Entregar a política de admissão/saída por geração e expiração por participante, com presença versionada e memória limitada.
**Where**: `server/service.js`
**Depends on**: T1
**Reuses**: Registro por WS, endCall, ack, presence, cotas, heartbeat, createService e cliente de teste.
**Requirement**: MEDIA-18, MEDIA-24, MEDIA-25, MEDIA-26, MEDIA-27, MEDIA-28, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node, WS e clock de teste.

**Done when**:

- [x] Cancelamento com geração recebido antes da admissão cria terminal; join antigo não ocupa vaga. Duplicatas e saídas antigas deixam a tentativa nova intacta.
- [x] Saída/parada válidas passam com cota esgotada, liberam estado em até 1 s e permitem substituir um dos seis participantes sem aceitar o sétimo simultâneo.
- [x] Cada presença emitida inclui revisão crescente; cada ack de chamada inclui geração. Durante a sequência local, preservar o caminho v1 existente apenas para chamadas antigas já admitidas; T6 remove essa tolerância, sem apresentá-la como certificada.
- [x] Heartbeat usa deadline monotônico por cliente; testes em pong alinhado e deslocado verificam estado em 59.999/60.000 ms e limpeza de timers ao fechar/rearmar.
- [x] Integração cobre todos os casos acima no mesmo commit; Full aprovado, total `50 + Δ` registrado e zero falhas/skips.

**Tests**: integration em `tests/service.test.js` e `tests/server.test.js`; ajustes de serialização no helper existente são parte dos testes, preservando suas asserções. Injetar entrega atrasada antes do handler, não apenas atrasar o ack depois de admitir.
**Gate**: full; Quick + build + smoke source/interno.
**Commit**: `fix(server): fence terminal calls and expire participants by deadline`

**Execução T2 em 2026-10-25**: Full PASS, 58/58 Node (50 + 8), zero falhas/skips/cancelled. [Adequação](execution.md#t2--terminal-do-participante-e-heartbeat). T1 em `be83426`; T2 neste commit, identificado pelo título acima. MEDIA ainda sem Verified.

#### T3: Rejeitar respostas e presenças antigas na Session

**What**: Entregar correlação de pedidos por contexto/geração e aplicação monotônica da presença na sala atual.
**Where**: `src/session.js`
**Depends on**: T2
**Reuses**: pending, epoch, roomContext, activeCallId, request/receive, lose e prazo terminal existentes.
**Requirement**: MEDIA-05, MEDIA-06, MEDIA-18, MEDIA-24, MEDIA-26, MEDIA-28, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node e transporte controlado/real existentes.

**Integration boundary**: A alocação por conexão precisa chegar ao produtor junto da Session. A ligação mínima em `src/main.jsx`, fornecendo a função vinculada ao epoch ao construir Call, acompanha T3 e seus testes; não fica para depois da ativação v2 em T6. Os controles e estados visuais continuam em T7. Essa ligação já prevista é antecipada para cumprir o gate de produtores/consumidores integrados, sem acrescentar comportamento de produto.

**Done when**:

- [x] Cancelamento rejeita pedidos da tentativa antiga; ack/error antigo não muda nem reporta falha da chamada nova.
- [x] Presença de revisão menor/igual e contexto antigo é descartada; nova conexão/sala reinicia somente o domínio correspondente.
- [x] A Session aloca geração por conexão e o App fornece essa função a Call neste commit: duas instâncias sucessivas recebem números crescentes; epoch antigo não aloca nem inicia captura. Nenhum produtor usa o padrão local de testes na integração desktop após T3.
- [x] Campos aditivos presentes já são conferidos; a exigência definitiva é ativada em T6. Timeout terminal preserva a limpeza local e termina o transporte conforme contrato.
- [x] Testes unitários e com serviço real entram no mesmo commit; Full aprovado, `50 + Δ` registrado e regressões de mensagens/rascunhos preservadas.

**Tests**: unit/integration em `tests/session.test.js`; respostas com ação/callId/geração divergentes, ack e presença após cancelamento/reentrada, contexto de sala antigo, reconexão e geração preservada ao substituir Call na mesma conexão. O smoke source observa também a ligação real App/Session/Call nessa substituição, no mesmo commit.
**Gate**: full; Quick + build + smoke source/interno.
**Commit**: `fix(session): reject stale call replies and presence snapshots`

**Execução T3 em 2026-10-25**: Full PASS, 64/64 Node (50 + 14), zero falhas/skips/cancelled. [Adequação](execution.md#t3--correlação-na-session-e-ligação-ao-app). T2 em `ca2ba07`; T3 neste commit. MEDIA sem Verified.

### Phase 2: Tela, captura nativa e ativação do contrato

#### T4: Finalizar a transação de tela sem envio residual

**What**: Entregar uma operação de tela com estado, inventário de peers afetados e compensação que resista a resolução tardia.
**Where**: `src/rtc.js`
**Depends on**: T3
**Reuses**: shareScreen, stopScreen, screenGeneration, filas/slots de peer e deadline já implementados. A dependência captureDisplay usa o padrão navegador até o adaptador nativo de T5; não substitui Electron/WebRTC por um engine reconstruído do Discord.
**Requirement**: MEDIA-02, MEDIA-03, MEDIA-09 (controlador), MEDIA-10, MEDIA-14, MEDIA-15, MEDIA-16, MEDIA-17, MEDIA-18, MEDIA-19, MEDIA-20, MEDIA-21, MEDIA-23, MEDIA-28, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node e Playwright existentes.

**Done when**:

- [x] Tela provisória não é publicada como sucesso; operação ativa exige commit dentro dos 8 s definidos no design.
- [x] Falha parcial para todas as tracks em A1; cleanup inclui peer que entrou durante a publicação e promessa de sender que resolve depois do aborto. Remoção travada fecha somente o peer incapaz de cessar o envio.
- [x] Voz dos peers saudáveis, admissão e mute anteriores permanecem íntegros; repetição de stop/onended/leave converge sem renovar deadline.
- [x] Testes do proprietário entram no mesmo commit; Full aprovado, `50 + Δ` registrado e zero falhas/skips. Nenhuma asserção é trocada por mera ocorrência de chamada.

**Tests**: unit em `tests/rtc.test.js`; três peers com aceite/rejeição/suspensão, peer tardio, fonte encerrada, áudio do sistema presente/ausente, resolução antiga e tentativa nova. Medir ended em todas as tracks e `(sender sem captura) ou (peer fechado)`, além da voz preservada. Smoke verifica integração.
**Gate**: full; Quick + build + smoke source/interno.
**Commit**: `fix(rtc): settle screen publication and rollback every affected peer`

**Execução T4 em 2026-10-25**: Full PASS, 69/69 Node (50 + 19), zero falhas/skips/cancelled. [Adequação](execution.md#t4--publicação-e-compensação-de-tela). T3 em `2006457`; T4 neste commit. MEDIA sem Verified.

#### T5: Correlacionar e encerrar a seleção nativa da janela

**What**: Entregar um único componente de seleção Electron, do registro da chave no bridge ao callback nativo, com seu adaptador mínimo no App.
**Where**: `electron/main.js`
**Depends on**: T4
**Reuses**: settleCapture, pending, trustedIpc, allowDisplayCapture, desktopCapturer, modal, eventos/fixture existentes e API de dependência de T4. A enumeração e a seleção já existem; acrescentar somente correlação e resultados ainda sem garantia.
**Requirement**: MEDIA-09, MEDIA-10, MEDIA-11, MEDIA-12, MEDIA-13, MEDIA-23 (seletor), MEDIA-28, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node/Playwright; documentação primária Electron quando necessário.

**Integration boundary**: O proprietário é a seleção nativa. `electron/preload.cjs` expõe sua API, `electron/policy.js` valida a chave e `src/main.jsx` fornece somente o adaptador de captura da janela. Essas ligações entram juntas para que a mudança do host seja testável sem quebrar o fluxo existente; não incluem a revisão geral da UI de T7. É a aplicação do merge de wiring previsto pela skill, com testes do componente no mesmo commit, sem criar uma tarefa intermediária não utilizável.

**Done when**:

- [x] Uma aquisição por documento permanece associada à mesma chave até a promessa real assentar. Reentrada não reassocia request antigo; documento/frame antigo não usa o registro novo.
- [x] Token de documento fica privado no preload; IPC e inventário antigos após reload não preparam, cancelam ou finalizam operação nova. Um handler nativo extra não substitui o callback já associado à chave.
- [x] prepare/finish síncronos só validam e alteram memória; inventário suspenso não bloqueia seu retorno. Gesto de usuário é preservado na chamada real ao Electron 45.
- [x] Cancelamento antes do handler, durante inventário e no seletor resolve cada callback uma única vez com null; timer de 60 s, erro e fonte inválida também têm resultado terminal sem fonte tardia.
- [x] Resultado estruturado diferencia cancelamento, TIMEOUT, MEDIA_FAILED e INVALID_EVENT, mesmo com AbortError nativo. Inverter a ordem de evento IPC/rejeição não perde nem duplica o relato técnico.
- [x] Chaves, fontes, frame/origem e IPC alheios não obtêm capacidade. Áudio é concedido só quando solicitado naquela operação; câmera continua negada.
- [x] Políticas unitárias e fixture Electron entram no mesmo commit. Full + captura/perfil aprovados, `50 + Δ` registrado e zero falhas/skips; guardas não dependem de hooks de teste na produção.

**Tests**: unit em `tests/desktop-policy.test.js`; e2e em `scripts/desktop-capture-check.mjs` e `scripts/desktop-profile-check.mjs`, com ajustes na fixture pública existente. Acrescentar cancelamento antes do request nativo, reentrada durante inventário, tentativa de chave nova antes do assentamento, IPC/documento antigos, segundo handler e timeout controlado. Preservar os testes BUILD de callback único.
**Gate**: full + `node scripts/desktop-capture-check.mjs` + `node scripts/desktop-profile-check.mjs`, todos source e sequenciais.
**Commit**: `fix(desktop): bind native capture selection to its call operation`

**Execução T5 em 2026-10-25**: Full + captura/perfil PASS, 70/70 Node (50 + 20), zero falhas/skips/cancelled. [Adequação](execution.md#t5--seleção-nativa-por-operaçãodocumento). T4 em `fdf6066`; T5 neste commit. MEDIA sem Verified.

#### T6: Ativar o contrato final v2 nos limites compartilhados

**What**: Ativar geração/revisão obrigatórias e recusa explícita de versão antiga, depois de todos os produtores e consumidores estarem ligados.
**Where**: `shared/protocol.js`
**Depends on**: T5
**Reuses**: PROTOCOL_VERSION, parsers, configuração anunciada pelo serviço e comparação de versão da Session.
**Requirement**: MEDIA-05, MEDIA-06, MEDIA-24, MEDIA-25, MEDIA-26, MEDIA-28, MEDIA-31.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node e Playwright existentes.

**Integration boundary**: Ativação de um contrato compartilhado. Retirar a tolerância transitória de T2/T3, atualizar fixtures de serialização e reconciliar a referência STAB/A14 à versão aprovada, preservando a origem histórica da revisão e os demais requisitos. Não reimplementar regras de servidor, sessão ou captura nesta tarefa. Nenhum switch de protocolo pode ser commitado sem produtores/consumidores e todos os gates verdes.

**Done when**:

- [x] v2 aceita campos corretos e rejeita geração/revisão ausentes, inválidas ou fora dos limites; mesmo número de geração com callId distinto não altera estado.
- [x] Cliente v2 diante de servidor v1 e cliente v1 diante de servidor v2 terminam a conexão por incompatibilidade antes de capturar mídia.
- [x] Nenhum caminho de tolerância v1 ou fixture apenas trocada para mascarar um erro permanece; a rejeição de v1 é uma asserção explícita. Contrato da spec anterior é reconciliado como mudança técnica aprovada, sem marcar os 68 STAB como Verified.
- [x] Testes de protocolo e integração ligados entram no mesmo commit; Build aprovado com `50 + Δ` testes, zero falhas/skips e bytes atuais no pacote.

**Tests**: unit/integration em `tests/protocol.test.js`, fixtures de `tests/session.test.js`, helper e scripts existentes que serializam eventos. Manter todas as asserções de mensagens, limites, persistência e terminal; atualização de formato acompanha a versão aprovada, sem reduzir casos.
**Gate**: build; executar toda a matriz source/empacotado, incluindo o wrapper real.
**Commit**: `feat(protocol)!: require call generations and presence revisions`

**Execução T6 em 2026-10-25**: 14/14 gates Build PASS e cliente v1 real recusado antes de WS/captura; 74/74 Node (50 + 24), zero falhas/skips/cancelled. [Adequação](execution.md#t6--contrato-v2-obrigatório). STAB/A14 reconciliada sem alterar ACs. T5 em `325c340`; T6 neste commit.

#### T7: Integrar estados, reprodução e diagnóstico no App

**What**: Entregar controles e relatos coerentes com a tentativa e operação atuais, usando o adaptador já ligado em T5.
**Where**: `src/main.jsx`
**Depends on**: T6
**Reuses**: Modal, callAttempt/callRef, estado React, cancelPicker, bloqueio de reprodução e diagnostic/report atuais.
**Requirement**: MEDIA-01, MEDIA-07, MEDIA-08, MEDIA-09, MEDIA-10, MEDIA-17, MEDIA-20, MEDIA-21, MEDIA-22, MEDIA-23, MEDIA-28, MEDIA-29, MEDIA-30, MEDIA-31, MEDIA-32.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node/Playwright existentes.

**Done when**:

- [x] Seleção/publicação/ativo/parada são distintos; callback/erro antigo não fecha ou altera a seleção nova. Cancelar e sair continuam acessíveis por teclado.
- [x] A ligação da alocadora feita em T3 permanece íntegra ao integrar os controles; substituir controlador na conexão atual não volta a usar uma geração terminal.
- [x] Troca de sala, desconexão, recarga e saída invalidam a tentativa e bloqueiam reprodução antes da confirmação remota. Efeito antigo não reabilita reprodução.
- [x] Mute e “Silenciar áudio” preservam o contrato da spec; consentimento de loopback informa abrangência global. Não se adiciona deafen ou sons de chamada.
- [x] Logs usam somente campos permitidos; a prova de sanitização contém valores sentinela sensíveis e verifica sua ausência no resultado inteiro.
- [x] E2E do proprietário entra no mesmo commit; Full + captura/perfil aprovados, `50 + Δ` registrado e zero falhas/skips. Layout não é redesenhado.

**Tests**: e2e em `scripts/desktop-smoke.mjs`, com observação dos estados e logs, cancelamento por teclado, sala com confirmação atrasada, saída/reentrada e erro de inventário antigo. Reusar checks de RTP, vídeo recebido e saída; não tratá-los como qualidade física.
**Gate**: full + captura/perfil source; repetir smoke source com `CONVERSA_TEST_EXTERNAL=1`.
**Commit**: `fix(ui): keep media controls bound to the current call operation`

**Execução T7 em 2026-10-25**: Full + captura/perfil + smoke externo PASS, 75/75 Node (50 + 25), zero falhas/skips/cancelled. [Adequação](execution.md#t7--controles-reprodução-e-diagnóstico). T6 em `5a8f657`; T7 neste commit.

### Phase 3: Aceitação

#### T8: Consolidar a evidência automatizada da candidata

**What**: Produzir um relatório único de resultados e limites por MEDIA automatizável, para a candidata source e Windows do mesmo commit.
**Where**: `.specs/features/captura-midia-saida/evidence.md`
**Depends on**: T7
**Reuses**: Testes e checkers ampliados junto de seus proprietários em T1–T7, manifesto atual e evidências D1–D11/U1 no [relatório de investigação](discord-investigation.md), com seus registros e hashes.
**Requirement**: MEDIA-01–32; critérios de sucesso e fronteiras de evidência de MEDIA-33/34.
**Tools**: MCP Agent Skills; skill `tlc-spec-driven`; shell/Node/Playwright; REA somente se uma conclusão sobre o artefato Discord exigir inspeção adicional autorizada.

**Done when**:

- [x] Build completo passa para a candidata final; versão, git SHA, SHA-256, executável e portátil real são identificados e correspondem ao disco. Build atual do autor em f85926e, 16/16 e 91/91; SHA-256 `cecd15829760e1aa0d30f14db23584016c525d9ffee988c5ec06178b4f14b46e`. A rodada2 independente e seu hash anterior permanecem históricos.
- [x] Cada MEDIA-01–32 tem arquivo:linha, asserção de valor, resultado e limite de evidência. Nenhum caso é aprovado só pelo nome do teste ou pela sondagem histórica.
- [x] D1/D2 continuam estáticos/parciais, D3–D5 documentais e D6–D11 com a autoridade/cobertura do relatório. U1 vale somente para UI/processo; controles indisponíveis não certificam captura ou sua causa. Renderer do cache não é atribuído à versão ativa e Browser não é presumido como engine Windows. As quatro dúvidas de runtime permanecem abertas sem prova correspondente; registrar diferenças deliberadas C2/A5.
- [x] O relatório mantém MEDIA-33/34 pendentes de T9. Total Node `50 + Δ`, zero falhas/skips/cancelled e integridade do histórico de asserções são registrados.

**Tests**: integration/e2e já co-localizados nas tarefas de código, reexecutados na candidata final. Esta tarefa consolida a aceitação e não recebe testes que deveriam ter acompanhado uma correção anterior. Gap encontrado volta à tarefa proprietária, com gate e commit próprios antes de repetir a aceitação.
**Gate**: build, incluindo source sem manifesto, internos/externos, win-unpacked e wrapper portátil real.
**Commit**: `docs(media): record automated acceptance of the Windows candidate`

**Execução T8 em 2026-10-25**: 75/75 Node (50 + 25), 14/14 gates Build PASS no código `018019c`; portátil SHA-256 `fe9ee1feab3765c210a8033a8b3b70789d22fcf7525af792b37d2b97a9f2202a`. [Resultados por MEDIA, integridade e limites](evidence.md). Nenhum MEDIA Verified pelo autor. Despachar Verifier do lote automatizado; T9 impede aprovação integral.

**Retorno do Verifier, rodada 1 (`f44d268`)**: MEDIA-17 falhou funcionalmente com ack de parada retido; controles ainda bloqueados em 1.100 ms. Sensor M4/M5 dependeu de timeout do helper, sem morte por asserção válida. Conjunções adicionais de evidência voltam aos proprietários T1/T5/T7 antes de repetir T8. Sem aprovação automatizada integral nesta rodada. Correção R1 (T4/T3/T7): parada local independente do ack e deadline de parada antigo incapaz de desconectar tela posterior na mesma chamada. Testes co-localizados e adequação em [execution.md](execution.md#r1--parada-local-sem-esperar-confirmação-remota).

**R2 (T2)**: testes do serviço recebem ack/error correlacionados e comparam tipo e estado, antes de aguardar presença; retorno de M4/M5 deixa de depender de timeout do helper. Full 78/78 + build + smoke source PASS. R1 em `01f3e1c`; [adequação e limite do sensor](execution.md#r2--respostas-terminais-discriminadas-pelo-valor). Reverify independente pendente.

**R3 (T1/T3)**: conjunções de escuta sem mic com tela e sinalização antiga contra tentativas locais/remotas novas demonstradas por valores em Call/Session, sem mudança de produto. Full 80/80 + build + smoke source PASS. R2 em `ce848a7`; [adequação](execution.md#r3--escuta-com-tela-e-sinalização-antiga).

**R4 (T5)**: cancelamento voluntário tem resultado inteiro CANCELLED/fase/requestId e chave atual assertados; avisos de áudio global visíveis nos dois pontos de consentimento. Full 80/80 + captura/perfil source PASS, sem mudança de produto. [Adequação](execution.md#r4--cancelamento-estruturado-e-consentimento-visível).

**R5 (T7)**: contadores pré-App na abertura/reload, teclado nas duas pendências e prazos A1, eventos antigos com reprodução silenciada, tela nova antes de ack antigo e inventário completo nos quatro terminais. Full 80/80 + ciclo/startup/externo/captura/perfil source PASS; Build final deve incluir ciclo source e win-unpacked (16 gates). [Adequação](execution.md#r5--fronteiras-de-integração-e-ciclo-da-janela).

**Reexecução T8 do autor em 25/10, histórica**: Node 80/80; matriz 16 com 11 PASS, 1 FAIL ao lançar win-unpacked bloqueado por Device Guard e quatro gates unpacked não executados. Wrapper portátil real PASS separadamente. SHA-256 daquela candidata `fc7c344e52717757f02700a5a3050164bc087433ff977ae66256fb64f330f993`. Naquele momento T8 foi reaberta, sem Build integral e sem Verified. A rodada independente 2 abaixo substitui esse estado da candidata; logs preservam a ocorrência sem contorno de política.

**Rodada independente 2 encerrada em 26/10:** [validation-round2.md](validation-round2.md), range `38062db..2c9d60e`. Build 16/16 e sensor 6/6 por valor passaram, 80/80 Node. A candidata nova acima superou o bloqueio histórico sem mudar política/launcher. FAIL global: 28 ACs automáticos integrais, quatro parciais pela conjunção stop+leave e dois físicos ausentes. A conjunção retorna a T4/T1 como R6 antes da rodada 3; não houve novo defeito funcional demonstrado.

**R6 (T4/T1), 26/10**: stop-first/leave-first, remoção e confirmação retidas, inventário antigo ended/peers closed em A1, prazo não renovado e reentrada preservada após conclusões antigas. Um teste novo, sem mudança de produto; Full 86/86 + build + smoke source PASS (inclui cinco testes do lote STAB). [Adequação](execution.md#r6--parar-tela-e-sair-com-operações-sobrepostas). A reexecução das provas e dos mutantes independentes deve reverificar a conjunção antes de aprovar o subconjunto automatizado; T9 mantém a feature globalmente incompleta.

#### T9: Registrar a aceitação física com dois PCs

**What**: Produzir o relatório do protocolo físico A7 para o mesmo portátil aprovado em T8.
**Where**: `.specs/features/captura-midia-saida/uat.md`
**Depends on**: T8
**Reuses**: Protocolo físico da spec, diagnóstico existente e artefato/hash da candidata.
**Requirement**: MEDIA-33, MEDIA-34; confirmação física dos fluxos MEDIA-10/16/21/29/30.
**Tools**: MCP Agent Skills e `tlc-spec-driven`; operadores em dois PCs Windows, fones/microfones e LAN confiável. `reverse-engineer-anything` somente para registrar evidência de referência Discord quando houver observação real disponível.

**Done when**:

- [ ] Ambos os PCs e seus dispositivos/runtime/hash são identificados; três ciclos de 30 s fora de chamada e sessão de 10 minutos são executados sem microfone sintético ou `--mute-audio`.
- [ ] Cada sentido tem 5/5 frases compreendidas no início e após parar a tela; mute/retorno, fonte visível, loopback desligado/ligado e saída/reentrada passam nos prazos especificados.
- [ ] Cada etapa recebe resultado e observação. Ausência de recursos, falha ou etapa inconclusiva mantém T9 incompleta e MEDIA-33/34 sem Verified; não se substitui hardware por um smoke local.
- [ ] Ruído não reproduzido é limitado à configuração ensaiada. Comparação com Discord só recebe rótulo observado se efetivamente realizada e versionada pelos operadores, seguindo o relatório e distinguindo X, desconectar voz e sair do app. Não automatizar convites ou comunicação com terceiros.
- [ ] Physical aprovado com referência ao Build e total Node `50 + Δ` já registrado em T8. Não há mudança de código nesta tarefa; uma correção necessária volta ao proprietário e invalida a candidata anterior.

**Tests**: manual/integration, todo o protocolo A7. Dois PCs e participantes disponíveis são pré-requisitos reais, ainda não demonstrados nesta entrega de planejamento.
**Preparação em 2026-10-25**: [uat.md](uat.md) contém identificação e todas as etapas marcadas NÃO EXECUTADAS. Recursos/operadores não confirmados; a preparação não cumpre nenhum Done when, não executa o gate Physical e não fecha T9.
**Gate**: physical; todas as etapas A7 aprovadas para o hash de T8, sem omitir etapas.
**Commit**: `docs(media): record physical call and capture acceptance`

## Phase Execution Map

```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9
```

Fases 1/2/3 contêm 3/4/2 tarefas. Nove tarefas ultrapassam o limiar de um lote da skill: antes de Execute, oferecer execução inline ou workers por lotes de fases inteiras, sem auto-spawn. Essa oferta não é necessária para gerar estes documentos. Os MCPs/skills por tarefa já estão especificados conforme o pedido persistente do usuário; confirmar somente ferramentas novas ou recursos realmente ausentes.

Depois do último commit de tarefa, o Verifier fresco obrigatório avalia os 34 ACs sem herdar a conclusão do autor. Injeta pelo menos seis falhas semânticas em scratch isolado, uma por categoria: captura obsoleta, compensação, callback/seleção, terminal anterior à admissão, cota e prazo. Confere detecção por asserção e restaura o scratch. Compara o porcelain real antes/depois, escreve `validation.md` e destila lições apenas por falha fundamentada. Registro histórico da revisão 7bed1026351b: até três iterações. A revisão atual não abre terceiro Verifier; reexecutar provas/mutantes e rodar `validate_verification.py captura-midia-saida` antes de declarar a feature concluída. Sem T9 aprovado não há PASS integral ou Verified de MEDIA-33/34.

## Task Granularity Check

| Task | Entrega atômica | Julgamento |
| --- | --- | --- |
| T1 | Ciclo de tentativa/microfone de Call | Um proprietário e seus testes. |
| T2 | Estado terminal do participante no serviço | Um componente; admissão, presença e expiração compartilham a participação que deve terminar. |
| T3 | Correlação e geração da Session, com ligação mínima ao produtor | Um componente e sua integração necessária, com unit/integration e smoke no mesmo commit. |
| T4 | Operação de tela de Call | Um ciclo de publicação/compensação e seus testes. |
| T5 | Seleção Electron, bridge e adaptador inseparável | Um componente de captura nativa; wiring entra junto para conservar teste de integração utilizável. Escopo adicional explicitado, sem tarefa sem teste. |
| T6 | Ativação do contrato compartilhado | Um limite de protocolo; integrações restringem-se à retirada da tolerância e atualização de formato, sem mudança adicional de negócio. |
| T7 | Estado e controles do App | Um componente e E2E no mesmo commit. |
| T8 | Relatório automatizado | Um artefato; não adia testes das correções. |
| T9 | Relatório físico | Um artefato de aceitação; não mistura implementação. |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | Match |
| T2 | T1 | T1 | Match |
| T3 | T2 | T2 | Match |
| T4 | T3 | T3, fase anterior | Match |
| T5 | T4 | T4 | Match |
| T6 | T5 | T5 | Match |
| T7 | T6 | T6 | Match |
| T8 | T7 | T7, fase anterior | Match |
| T9 | T8 | T8 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Call | unit + integração | rtc + smoke no mesmo commit | Match |
| T2 | Serviço | integration | service/server + smoke | Match |
| T3 | Session e ligação App/Call | unit/integration + e2e da ligação | session controlada/real + smoke da substituição | Match |
| T4 | Call/tela | unit + integração | rtc + smoke | Match |
| T5 | Host/preload/política | unit/e2e | desktop-policy + captura/perfil + smoke | Match |
| T6 | Protocolo | unit/integration | protocol + fixtures preservadas + Build | Match |
| T7 | App | e2e | smoke ampliado + captura/perfil | Match |
| T8 | Aceitação automatizada | integration/e2e | reexecução da candidata, sem testes adiados | Match |
| T9 | Aceitação física | manual/integration | protocolo A7 inteiro | Match |

## Requirement Coverage

| Requisitos | Tarefas proprietárias e integração | Fechamento |
| --- | --- | --- |
| MEDIA-01–08 | T1; T3 para confirmação, T7 para UI | T8; T9 complementa abertura física. |
| MEDIA-09–13 | T4 para pedido, T5 para host/bridge, T7 para UI | T8; T9 complementa consentimento/loopback. |
| MEDIA-14–20 | T4; T2/T3 para estado remoto, T7 para apresentação | T8; T9 complementa experiência real. |
| MEDIA-21–23 | T1/T4 liberam recursos, T5 seleção, T7 eventos da UI | T8/T9. |
| MEDIA-24–28 | T2/T3; T1 contexto, T5 fontes, T6 contrato final | T8. |
| MEDIA-29–30 | T1/T7 | T8/T9. |
| MEDIA-31–32 | T1/T2/T3/T4/T5/T7; T6 valida envelope de MEDIA-31 | T8. |
| MEDIA-33–34 | T9 | Relatório físico e Verifier. |

34/34 ACs mapeados; os dez edge cases da spec constam dos testes e resultados das tarefas proprietárias. Nenhum AC é marcado como implementado pelo planejamento. A validação estrutural obrigatória é `validate_tasks.py captura-midia-saida --strict`, seguida da conferência semântica das três tabelas acima e da spec.

**Validação documental em 2026-10-25:** spec/tasks --strict PASS, exit 0, zero erros/avisos. Nove tarefas com dependências consistentes, testes e gates; 34/34 ACs mapeados e intactos; nenhum item executado. Código, testes e artefatos BUILD permanecem inalterados.

## Checks

Uma claim por AC, sem alterar seu texto. Provas Node selecionam testes nomeados; checkers desktop exercitam controles e resultados da integração. Mais de uma camada pode ser necessária. Node não possui adapter agrupado nesta revisão; cada comando roda diretamente.

**Build**: npm.cmd test; npm.cmd run build; node scripts/desktop-smoke.mjs
**Mutations**: 5

MCP 0.17.14 (`f465b52756b8`) limita o campo Mutations a cinco. Os sensores adicionais do plano continuam obrigatórios: seis categorias MEDIA e sete regressões STAB R01–R07, sem reduzir os mínimos anteriores. MEDIA preserva os dois pareceres independentes; R6 retorna às provas e aos mutantes existentes, sem terceiro Verifier na revisão atual. STAB recebe seu primeiro Verifier depois das provas. Sem captura visual vinculante; UI exercitada pelos checkers. Não há lint/typecheck no repositório e TypeScript não começa agora.

**C1** - WHEN abrir ou recarregar fora de uma chamada THEN o Conversa SHALL permanecer sem iniciar captura de microfone, tela ou áudio do sistema. (MEDIA-01)
Proof: node scripts/startup-audio-check.mjs

**C2** - WHILE uma aquisição de um tipo estiver pendente na mesma tentativa o Conversa SHALL reutilizar ou recusar pedidos concorrentes desse tipo sem iniciar outra aquisição. (MEDIA-02)
Proof: node --test --test-name-pattern="MEDIA\-02/05/08/30/31:|MEDIA\-02/09/10/28:" tests/rtc.test.js

**C3** - IF uma aquisição resolver após o terminal de sua tentativa THEN o Conversa SHALL liberar todas as tracks retornadas dentro de A1, sem incorporá-las à tentativa nova. (MEDIA-03)
Proof: node --test --test-name-pattern="MEDIA\-03/28:" tests/rtc.test.js

**C4** - WHILE o controlador estiver definitivamente fechado o Conversa SHALL recusar ações de captura antes de invocar a API de mídia. (MEDIA-04)
Proof: node --test --test-name-pattern="MEDIA\-04/28:" tests/rtc.test.js

**C5** - WHILE não houver admissão confirmada da tentativa vigente o Conversa SHALL impedir publicação de sua captura provisória aos outros participantes. (MEDIA-05)
Proof: node --test --test-name-pattern="MEDIA\-02/05/08/30/31:|MEDIA\-05/06/28:|MEDIA\-05/21/28:|MEDIA\-05/24/25/28:|MEDIA\-05/24/28:|MEDIA\-05/28:" tests/protocol.test.js tests/rtc.test.js tests/service.test.js tests/session.test.js

**C6** - IF a admissão for recusada ou exceder os 8 s de A2 THEN o Conversa SHALL encerrar a tentativa e liberar sua captura provisória dentro de A1, qualquer que seja o código ou idioma do erro. (MEDIA-06)
Proof: node --test --test-name-pattern="MEDIA\-05/06/28:|MEDIA\-06/31:" tests/rtc.test.js tests/session.test.js

**C7** - WHILE aquisição ou admissão estiver pendente o Conversa SHALL oferecer cancelamento por teclado que torne a tentativa terminal dentro de A1 sem aguardar a permissão nativa. (MEDIA-07)
Proof: node scripts/desktop-smoke.mjs

**C8** - IF o microfone for negado ou indisponível THEN o Conversa SHALL permitir entrada em escuta e compartilhamento após admissão válida, sem track de microfone nem novas solicitações de microfone sem ação explícita. (MEDIA-08)
Proof: node --test --test-name-pattern="MEDIA\-02/05/08/30/31:" tests/rtc.test.js

**C9** - WHEN iniciar cada compartilhamento THEN o Conversa SHALL exigir escolha explícita de uma fonte pertencente à lista daquele pedido, sem reutilizar seleção antiga. (MEDIA-09)
Proof: node --test --test-name-pattern="MEDIA\-02/09/10/28:|MEDIA\-09/11/28:" tests/desktop-policy.test.js tests/rtc.test.js
Proof: node scripts/desktop-capture-check.mjs

**C10** - WHEN obter mídia de tela THEN o Conversa SHALL incluir áudio do sistema somente conforme o consentimento de A6, informando que o áudio pode abranger aplicativos além da janela selecionada. (MEDIA-10)
Proof: node --test --test-name-pattern="MEDIA\-02/09/10/28:" tests/rtc.test.js
Proof: node scripts/desktop-capture-check.mjs

**C11** - IF câmera, frame secundário, origem alheia ou remetente IPC não autorizado pedir uma capacidade de mídia privilegiada THEN o desktop SHALL negá-la, mantendo essas capacidades restritas ao frame principal local confiável. (MEDIA-11)
Proof: node --test --test-name-pattern="MEDIA\-09/11/28:" tests/desktop-policy.test.js
Proof: node scripts/desktop-capture-check.mjs

**C12** - WHEN um pedido nativo de seleção for concluído por escolha, cancelamento, timeout, recarga ou fechamento THEN o host SHALL resolvê-lo exatamente uma vez, com a fonte válida ou cancelamento. (MEDIA-12)
Proof: node scripts/desktop-capture-check.mjs

**C13** - IF o seletor for cancelado, falhar, expirar nos 60 s de A2 ou devolver fonte inválida THEN o Conversa SHALL terminar a operação sem conservar captura de tela ou áudio do sistema. (MEDIA-13)
Proof: node scripts/desktop-capture-check.mjs

**C14** - IF qualquer publicação falhar ou não concluir nos 8 s de A2 THEN o Conversa SHALL abortar o novo compartilhamento e liberar todas as suas tracks dentro de A1. (MEDIA-14)
Proof: node --test --test-name-pattern="MEDIA\-14/15/19/20:|MEDIA\-14/17/18:" tests/rtc.test.js

**C15** - WHEN abortar uma publicação parcial THEN o Conversa SHALL cessar o envio dessa captura por todos os peers locais dentro de A1, inclusive com remoção rejeitada ou publicação que resolva depois do aborto. (MEDIA-15)
Proof: node --test --test-name-pattern="MEDIA\-14/15/19/20:" tests/rtc.test.js

**C16** - WHEN o usuário parar a tela ou o sistema encerrar sua fonte THEN o Conversa SHALL encerrar todas as tracks de tela e áudio do sistema dessa operação dentro de A1. (MEDIA-16)
Proof: node --test --test-name-pattern="MEDIA\-16/17/19:|MEDIA\-16/17/21/24:" tests/rtc.test.js

**C17** - WHEN a tela terminar, inclusive por parada repetida ou falha de sender/notificação THEN o Conversa SHALL convergir dentro de A1 para estado local sem compartilhamento e controles utilizáveis. (MEDIA-17)
Proof: node --test --test-name-pattern="MEDIA\-14/17/18:|MEDIA\-16/17/19:|MEDIA\-16/17/21/24:|MEDIA\-17/19/31:|MEDIA\-17/26:|MEDIA\-17/28:" tests/rtc.test.js tests/session.test.js

**C18** - WHEN o compartilhamento terminar com transporte saudável THEN o Conversa SHALL confirmar aos participantes o estado sem compartilhamento em até 8 s de A2. (MEDIA-18)
Proof: node --test --test-name-pattern="MEDIA\-14/17/18:" tests/rtc.test.js

**C19** - IF iniciar ou parar tela falhar THEN o Conversa SHALL preservar a voz anterior nos peers saudáveis conforme o vocabulário, sem encerrar a chamada inteira. (MEDIA-19)
Proof: node --test --test-name-pattern="MEDIA\-14/15/19/20:|MEDIA\-16/17/19:|MEDIA\-17/19/31:" tests/rtc.test.js

**C20** - WHILE a seleção ou publicação estiver pendente o Conversa SHALL apresentar esse estado sem indicar publicação concluída ou mídia remota pronta apenas por presença de participantes. (MEDIA-20)
Proof: node --test --test-name-pattern="MEDIA\-14/15/19/20:" tests/rtc.test.js

**C21** - WHEN sair ou cancelar a chamada THEN o Conversa SHALL liberar todas as capturas já adquiridas e fechar os peers dessa tentativa dentro de A1, independentemente da confirmação da rede. (MEDIA-21)
Proof: node --test --test-name-pattern="MEDIA\-05/21/28:|MEDIA\-16/17/21/24:|MEDIA\-21/26/31:" tests/rtc.test.js tests/session.test.js
Proof: node scripts/desktop-lifecycle-check.mjs

**C22** - WHEN solicitar troca de sala de texto THEN o Conversa SHALL tornar a chamada anterior terminal sem aguardar a confirmação da nova sala. (MEDIA-22)
Proof: node scripts/desktop-lifecycle-check.mjs

**C23** - WHEN desconectar, desmontar, recarregar ou fechar a janela THEN o Conversa SHALL executar a liberação terminal de suas capturas e seleções pendentes conforme A1. (MEDIA-23)
Proof: node scripts/desktop-lifecycle-check.mjs

**C24** - WHEN repetir saída da mesma tentativa THEN o serviço SHALL devolver seu estado terminal sem erro de recurso já encerrado nem efeito sobre uma tentativa posterior. (MEDIA-24)
Proof: node --test --test-name-pattern="MEDIA\-05/24/25/28:|MEDIA\-05/24/28:|MEDIA\-16/17/21/24:|MEDIA\-24/28/31:|MEDIA\-24/28:" tests/protocol.test.js tests/rtc.test.js tests/service.test.js tests/session.test.js

**C25** - WHEN receber saída válida ou parada válida de tela da tentativa vigente THEN o serviço SHALL processá-la mesmo com a cota de mensagens ou sinalização esgotada. (MEDIA-25)
Proof: node --test --test-name-pattern="MEDIA\-05/24/25/28:|MEDIA\-25/26:" tests/protocol.test.js tests/service.test.js

**C26** - WHEN receber saída válida THEN o serviço SHALL liberar a vaga e representar o participante fora da chamada e sem compartilhamento em até 1 s de A4, com confirmação correlacionada. (MEDIA-26)
Proof: node --test --test-name-pattern="MEDIA\-17/26:|MEDIA\-21/26/31:|MEDIA\-25/26:|MEDIA\-26/28:" tests/protocol.test.js tests/service.test.js tests/session.test.js

**C27** - IF perder o transporte sem saída confirmada THEN o serviço SHALL liberar a participação em até 60 s de A4 sem exigir reconexão do cliente. (MEDIA-27)
Proof: node --test --test-name-pattern="MEDIA\-27:" tests/service.test.js

**C28** - IF confirmação, pedido de admissão, inventário de fontes, sinalização ou presença de uma tentativa terminal chegar atrasado THEN o receptor SHALL descartá-lo sem reativar captura, seletor, reprodução ou ocupação e sem alterar a tentativa nova. (MEDIA-28)
Proof: node --test --test-name-pattern="MEDIA\-02/09/10/28:|MEDIA\-03/28:|MEDIA\-04/28:|MEDIA\-05/06/28:|MEDIA\-05/21/28:|MEDIA\-05/24/25/28:|MEDIA\-05/24/28:|MEDIA\-05/28:|MEDIA\-09/11/28:|MEDIA\-17/28:|MEDIA\-24/28/31:|MEDIA\-24/28:|MEDIA\-26/28:|MEDIA\-28:" tests/desktop-policy.test.js tests/protocol.test.js tests/rtc.test.js tests/service.test.js tests/session.test.js

**C29** - WHILE estiver fora de chamada admitida ou com “Silenciar áudio” ativo o desktop SHALL bloquear a reprodução de mídia, inclusive depois de recarga e eventos tardios. (MEDIA-29)
Proof: node scripts/desktop-smoke.mjs

**C30** - WHILE o microfone estiver silenciado o Conversa SHALL impedir a transmissão de fala pela track de microfone, permitindo mantê-la capturada conforme A5 sem apresentar mute como liberação do dispositivo. (MEDIA-30)
Proof: node --test --test-name-pattern="MEDIA\-02/05/08/30/31:" tests/rtc.test.js

**C31** - WHEN uma operação de admissão, captura, publicação ou saída falhar THEN o Conversa SHALL expor categoria estável, fase e identificação da operação disponível, distinguindo cancelamento voluntário sem depender do texto traduzido. (MEDIA-31)
Proof: node --test --test-name-pattern="MEDIA\-02/05/08/30/31:|MEDIA\-06/31:|MEDIA\-17/19/31:|MEDIA\-21/26/31:|MEDIA\-24/28/31:" tests/rtc.test.js tests/session.test.js
Proof: node scripts/desktop-smoke.mjs

**C32** - WHEN registrar diagnóstico de mídia THEN o Conversa SHALL omitir áudio/vídeo, thumbnails, títulos de fontes, SDP, candidatos ICE, credenciais e conteúdo de mensagens, mantendo apenas metadados técnicos de correlação e versão. (MEDIA-32)
Proof: node --test --test-name-pattern="MEDIA\-32:" tests/service.test.js
Proof: node scripts/desktop-smoke.mjs

**C33** - WHEN executar os três ciclos físicos de abertura/recarga fora de chamada definidos em A7 THEN o Conversa SHALL permanecer sem captura ou reprodução de mídia não solicitada durante os 30 s de cada ciclo, com resultado de ruído registrado por ciclo. (MEDIA-33)
Proof: node -e "process.stderr.write('T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis'); process.exit(1)"

**C34** - WHEN executar a sessão física de 10 minutos de A7 THEN o Conversa SHALL completar o protocolo físico abaixo com 5/5 frases compreendidas em cada sentido nas duas medições e todos os passos aprovados dentro dos prazos A1/A2/A4. (MEDIA-34)
Proof: node -e "process.stderr.write('T9 NAO EXECUTADA: PCs Windows, hardware real e operadores indisponiveis'); process.exit(1)"

## Handoff

**Settled mid-build:** user: "Executar nesta sessão; Verifier independente no fechamento" e "Não estão disponíveis agora; manter T9 pendente".

**Walked:** US1 entrada/escuta/mute/cancelamento por teclado, US2 seletor e consentimento/stop/rollback, US3 troca de sala/desconexão/unmount/close e reentrada manual, US4 fronteiras de protocolo/cota/presença por testes e checkers, US5 startup sem manifesto e diagnóstico. Matriz16 final em f85926e, perfis/bancos de teste isolados, controles acionados na UI. Ensaio físico T9 ausente, sem captura de design vinculante.

**Dispatched:** MEDIA rodada1 e rodada2 retornadas, preservadas em validation-round1.md e validation-round2.md. Revisão atual da skill: reexecutar provas e mutantes desses pareceres; não despachar terceiro Verifier.
