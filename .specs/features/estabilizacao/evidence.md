# Evidência incremental da estabilização

**Nota de reconciliação, 2026-10-25:** as seções T1–T6 abaixo são registros históricos de adequação do autor nos commits relacionados em [tasks.md](tasks.md). Seus PASS parciais e contagens não certificam os 68 STAB. A [validação BUILD](../build-confiavel/validation.md) é posterior e limitada aos 11 BUILD; os [34 MEDIA](../captura-midia-saida/spec.md) continuam sem Verified. A [revisão documental](../../../docs/revisao-coerencia-documental.md) não reexecutou estes ensaios nem alterou suas medições. Pendências descritas em cada passo pertencem àquele momento e precisam de reconciliação na retomada.

Esta é a revisão de adequação do autor por tarefa. As linhas de cada seção referem-se ao commit da respectiva entrega; se um teste for ampliado depois, a validação independente final resolve as referências novamente em HEAD. Nenhum teste usa o exit zero das sondagens históricas como aprovação.

## T1 — Contrato

Gate: `npm.cmd test` (7/7, zero skips) e `npm.cmd run build` aprovados. Os três testes anteriores permanecem. Antes da implementação, o novo teste reprovou por módulo inexistente. A expectativa de um escalar JSON foi corrigida durante a redação: número é estrutura inválida (INVALID_EVENT), não objeto de protocolo sem versão; nenhuma asserção foi relaxada.

| AC / critério da tarefa | Evidência e asserção | Resultado da spec | Coberto nesta unidade? |
| --- | --- | --- | --- |
| STAB-40/41, versão e estrutura | tests/protocol.test.js:14, `rejects(() => decode({ ...event('join'), v: 2 }), 'INCOMPATIBLE_PROTOCOL')`; :13, `rejects(() => parseClientEvent('{'), 'INVALID_EVENT')` | Categorias distintas | Sim; integração pendente |
| STAB-27, conteúdo | tests/protocol.test.js:30, `assert.equal(decode(...).text, text)`; :31, `rejects(..., 'INVALID_INPUT')` | Aceitar 1/2000, recusar vazio/2001 | Sim; persistência pendente |
| STAB-40, dados de servidor | tests/protocol.test.js:37, `rejects(() => parseServerEvent(...), 'INVALID_EVENT')` | Estrutura inválida não chega à UI | Sim; transporte pendente |
| STAB-49/50, configuração | tests/protocol.test.js:43, `assert.deepEqual(readIceServers(ice), ice)`; :46, `assert.equal(parsePort(value), Number(value))`; :47, `rejects(() => parsePort(value), 'INVALID_INPUT')` | ICE e PORT válidos/limites | Sim; bootstrap pendente |

Mapeamento reverso: as asserções das linhas 11–26 pertencem a STAB-40/41; 30–31 a STAB-27; 35–37 a STAB-40; 43–50 a STAB-49/50 e aos tetos A8. As quatro funções de teste não cobrem comportamento de bibliotecas ou requisitos externos. Litmus: aceitar versão 2, array como evento, texto de 2001 ou porta 65536 faria as asserções falharem. Padrão node:test/assert do repositório preservado. Adequação da unidade: PASS; não é validação integrada.

## T2 — Call

Gate: `npm.cmd test`, 16/16, zero skips; build aprovado. Nove testes novos com mídia/relógio controlados. Não é validação de microfone físico. Os testes reprovavam antes da implementação; o sensor final usará mutações comportamentais sobre a implementação já funcional.

| AC / caso | Evidência e asserção | Resultado esperado | Cobertura da unidade |
| --- | --- | --- | --- |
| STAB-01/03/04/05 | tests/rtc.test.js:44, `assert.equal(requests,0)`; :46, `ended(old)`; :48, `ended(current)`; :49, `assert.equal(requests,2)` após close | Nenhuma captura inicial/obsoleta/fechada | Sim |
| STAB-02/06/08/09 | tests/rtc.test.js:55, `assert.equal(requests,1)` e `pending,true`; :57, `admitted,true`, `microphone,null`, `muted,true`; :59, `active,false` | Aquisição única, admissão de escuta, cancelamento terminal | Sim; botão acessível será T6 |
| STAB-07 | tests/rtc.test.js:65, `assert.rejects(...,e=>e.code===code)`; :66, `ended(f.captures[0])`, `active,false` | Toda recusa libera captura, sem comparar texto | Sim |
| STAB-02/03 | tests/rtc.test.js:74, `assert.equal(requests,2)` e `ended(late)`; :75, `microphone,null` | Uma aquisição de ativação, resultado tardio descartado | Sim |
| STAB-10/11 | tests/rtc.test.js:82, `request.audio,false`, `height.ideal,720`; :83, `ended(late)` | Captura solicitada com opções explícitas e cancelável | Sim; seletor nativo será T7 |
| STAB-12/13/15/16/68 | tests/rtc.test.js:90–93, `ended(...)`, `display,null`, `healthy.video.sender.track,null`, `healthy.mic.sender.track,...`, `admitted,true`, `bad.pc.connectionState,'closed'`, `sharing,false` | Rollback total e microfone saudável preservado | Sim; presença remota será T3/T6 |
| STAB-14/15 | tests/rtc.test.js:101–102, `ended(display)`, `peer.pc.connectionState,'closed'`, `sharing,false` | onended limpa mesmo se remoção falhar | Sim |
| STAB-12/13, sender pendurado | tests/rtc.test.js:110, `ended(f.captures[1])` antes de resolver o sender | Falha de outro peer aborta sem esperar sender pendurado | Sim |
| STAB-42/43 | tests/rtc.test.js:119–122, `candidates.length,128`, depois `connectionState,'closed'`, `candidates.length,0`; nova tentativa cria peer | Limites de tempo/fila e retry manual | Sim |

Reverso: cada uma das nove funções de teste corresponde à linha acima, sem testes externos à spec. Asserções verificam tracks, sender, estado de admissão e conteúdo dos eventos, não só número de chamadas. Litmus: remover stop, aceitar geração antiga, esperar todos os senders para abortar ou permitir 129 candidatos quebra resultados. Sem novos frameworks. Adequação da unidade: PASS; integração ainda pendente.

## T3 — Serviço

Gate: `npm.cmd test`, 26/26, zero skips; build aprovado. Dez testes de integração novos. As asserções dos três testes anteriores foram preservadas; seu helper agora produz envelopes v1. Testes usam bancos temporários, não o banco pessoal. Falhas induzidas de entrega/escrita geram logs esperados, sem conteúdo. O fechamento dos bancos temporários precede a remoção de seus diretórios, inclusive no teardown.

| AC / caso | Evidência e asserção | Resultado esperado | Cobertura |
| --- | --- | --- | --- |
| STAB-18/19/21/23/24 | tests/service.test.js:21, valores de room/operationId/authorId/sequence; :23, `assert.deepEqual(repeat.message,accepted.message)`; :26/28, ROOM_MISMATCH e OPERATION_CONFLICT | Destino fixo e recibo único | Sim no servidor; UI pendente |
| STAB-23/53, isolamento negativo | tests/service.test.js:31–33, `history.messages.length,1`, uma entrega na mesma sala, `other.events.some(...),false` | Uma linha, uma entrega, zero entrega a outra sala | Sim |
| STAB-25/26/55 | tests/service.test.js:44/46, mesmo id após falha de broadcast e reinício; :49, PERSISTENCE_FAILED; :51, histórico exatamente ['Confirmada'] | Commit não é desfeito nem confirmado falsamente | Sim |
| STAB-28/29/30/68 | tests/service.test.js:59–64, sharing=false, inCall=false, repetição com mesmo callId e INVALID_EVENT para geração encerrada | Saída/parada vencem cota e não ressuscitam | Sim; controles UI pendentes |
| STAB-33/36/37 | tests/service.test.js:70, HTTP 404; :73, duração <5000 e listening=false | Upgrade recusado e shutdown finito/idempotente | Sim; sinais/HMR serão T4 |
| STAB-40/41 | tests/service.test.js:80–83, requestId exato, código/fase, zero signal no destinatário | Evento malformado não é encaminhado | Sim |
| STAB-53/54/55/61 | tests/service.test.js:94–97, 200 resultados 9800..9999, authorId=null, zero TEMP B-TREE antes do limite e 10000 linhas preservadas | Histórico legado estável/indexado | Sim; agrupamento UI será T6 |
| STAB-51/52 | tests/service.test.js:105/108, 25º recebe 503 e cliente saudável recebe o mesmo id confirmado | Teto e isolamento de consumidor lento | Sim |
| STAB-32 | tests/service.test.js:116, WS closed e zero clientes no instante virtual de 60 s | Vaga da conexão silenciosa liberada | Sim |
| STAB-51, salas | tests/service.test.js:122–123, INVALID_INPUT no excesso e 100 salas conservadas | Limite sem exclusão | Sim |
| STAB-37/67 | tests/service.test.js:131–133, SHUTDOWN_FAILED, listening=false, fase/versão exatas e segredo ausente | Limpeza restante e diagnóstico sem segredo | Sim |

Reverso: as dez funções de teste correspondem às linhas acima; o primeiro teste cobre também ausência de entrega na outra sala, sem depender apenas do nome do teste. Asserções de recibo cobrem valores de todos os campos exigidos pela spec. O controle do tempo espera o fechamento nos dois extremos antes de observar os conjuntos de sockets, sem reduzir o prazo exigido. Litmus: gravar em client.room ignorando room, gerar novo id em retry, aplicar cota a leave, omitir rejeição de Upgrade ou ordenar timestamps empatados faria as asserções falharem. Adequação da unidade: PASS. HMR, bootstrap, UI e evidência física seguem pendentes.

## T4 — Bootstrap

Gate: 30/30 testes, zero skips, build aprovado. Quatro testes novos; nenhuma asserção existente removida. O teste de Upgrade recebeu prazo e finally de limpeza para que também falhe de modo limitado contra uma regressão. Sinais são emitidos no processo filho, pois Windows não entrega SIGTERM de outro processo como um sinal Unix; isso testa o handler, sem alegar teste de políticas do sistema operacional.

| AC / critério | Evidência e asserção | Resultado esperado | Coberto? |
| --- | --- | --- | --- |
| STAB-49, configuração/porta | tests/bootstrap.test.js:16/20, `assert.rejects(..., e=>e.code==='INVALID_INPUT')` e BOOTSTRAP_FAILED; :21, listenerCount igual à referência | Falha tipada e sem handler abandonado | Sim |
| STAB-49/50 | tests/bootstrap.test.js:28, `assert.deepEqual(config.iceServers,[{urls:'stun:localhost:3478'}])` e protocolVersion=1; :29, listening=false | Configuração efetiva e fechamento idempotente | Sim no servidor separado |
| STAB-34 | tests/bootstrap.test.js:36, close HMR=1000 após open; :39, HTTP 404 em caminho desconhecido | Consumidor legítimo funciona, desconhecido recusado | Sim |
| STAB-36/37 | tests/bootstrap.test.js:50, `assert.equal(code,0,stderr)` e tempo<5000 para ambos os sinais | Processo filho encerra no prazo | Sim |

Reverso: cada uma das quatro funções corresponde a uma linha da tabela. O teste HMR realiza handshake real, não apenas presença de listener. O teste de sinal verifica código de saída e duração, não apenas envio do sinal. Sem framework/configurações adicionais. Adequação: PASS para bootstrap. Desktop e hardware real ainda pendentes.

## T5 — Session

Gate: 39/39 testes, zero skips; build aprovado. Nove testes novos: oito com transporte/relógio controlados e um com HTTP/WS/SQLite reais. Nenhuma asserção anterior removida. O prazo de hello começa no evento open, inclusive quando o relógio avança antes de rodarem os próximos microtasks.

| AC / caso | Evidência e asserção | Resultado esperado | Coberto? |
| --- | --- | --- | --- |
| STAB-38 | tests/session.test.js:35–37, rejeição TIMEOUT, connecting=false, socket=closed e nova conexão aceita | Hello não fica indefinido | Sim |
| STAB-39 | tests/session.test.js:46/49, um único socket e sessão final de third.example/me | Fetch/callback antigo não substitui atual | Sim |
| STAB-17/20/39 | tests/session.test.js:55–61, room antigo durante pending, zero message enviada, draft A restaurado e presença obsoleta ignorada | Intenção de sala e rascunho preservados | Sim |
| STAB-18/21/22/23 | tests/session.test.js:67–71, erro RATE_LIMITED, texto integral/room/status, mesmo operationId, uma mensagem e zero outbox após retry | Sem perda nem duplicação | Sim |
| STAB-20/22 | tests/session.test.js:76–79, texto/operationId/status failed permanecem após reconexão manual | Pendente recuperável na execução | Sim |
| STAB-40/41 | tests/session.test.js:84–85, connected=false, salas válidas preservadas e INVALID_EVENT | Dado inválido não entra na UI | Sim |
| STAB-46/47 | tests/session.test.js:89–94, origem/sala exatas, INVALID_INPUT nos inválidos e zero join quando sala não existe | Convite preservado, sem fallback silencioso | Sim |
| STAB-18/21/39, interoperabilidade | tests/session.test.js:101–103, primeira presença Ana, mensagem em geral e histórico vazio em cafe | Cliente e servidor reais usam mesmo contrato | Sim |
| STAB-22/23, confirmação perdida | tests/session.test.js:108–111, TIMEOUT na fase message, texto conservado e reconciliação por histórico | Uma mensagem confirmada, nenhum falso pendente | Sim |

Reverso: as nove funções correspondem às linhas acima. O teste real verifica ordem de aplicação do joined antes da presença, não só recepção de frames. Asserções conferem destino, texto original e identificador, sem inferir sucesso do send. Eventos de sala recebem contexto do destinatário para impedir reaplicação de presença antiga quando se retorna à mesma sala. Adequação: PASS para Session; UI e host desktop ainda precisam consumir esse controlador.

## T6 — Interface

Gate: 39/39 testes Node, build e smoke desktop ampliado aprovados, zero erros de renderer observados. Capturas em test-results/desktop, preservando artifacts/ da referência; tela compartilhada inspecionada visualmente. O smoke usa mídia sintética e --mute-audio: não aprova som físico ou redes distintas. A integração detectou e corrigiu o binding de fetch no Window; o teste Node não reproduzia essa exigência do runtime browser. O contraste antigo reprovou com 3,63:1 antes do ajuste.

| AC / caso | Evidência e asserção | Resultado da spec | Coberto? |
| --- | --- | --- | --- |
| STAB-47 | scripts/desktop-smoke.mjs:66, erro de endereço inválido visível antes da entrada correta | Sem falha silenciosa de entrada | Sim |
| STAB-57/58 | scripts/desktop-smoke.mjs:77–86, foco dentro, background.inert=true, ciclo Shift+Tab/Tab, Escape remove dialog e restaura foco | Modal efetivo por teclado | Sim |
| STAB-59 | scripts/desktop-smoke.mjs:98, `expect(contrast.ratio,...).toBeGreaterThanOrEqual(4.5)` nos três seletores | Contraste mínimo medido | Sim, amostragem da spec |
| STAB-17/20 | scripts/desktop-smoke.mjs:113–122, sala geral visível, composer/send desabilitados durante joined retido, draft A intacto antes/depois | Destino/composição coerentes na transição | Sim |
| STAB-22/23 | scripts/desktop-smoke.mjs:128–132, texto recuperável, mesmo operationId no retry, uma ocorrência e nenhum botão de reenvio após confirmação | Sem perda/duplicação | Sim |
| STAB-07/08 | scripts/desktop-smoke.mjs:136–147, recusa por código para todas as tracks ended; cancelamento enquanto gUM está retido, lateStream ended e saída bloqueada | Recusa/cancelamento compensam captura | Sim |
| STAB-31 | scripts/desktop-smoke.mjs:60/138/147/189–193, native webContents muted fora da chamada/deafened e liberado na admissão | Playback segue chamada real | Sim |
| STAB-60 | scripts/desktop-smoke.mjs:165–172, histórico excede 100 px e scrollTop permanece 0 após nova mensagem | Preservar leitura | Sim |
| STAB-61 | scripts/desktop-smoke.mjs:185, `expect(homonym).not.toHaveClass(/grouped/)` após mensagem de outra Ana | Nomes iguais não provam autoria | Sim |
| STAB-42/44 | scripts/desktop-smoke.mjs:197–201, falha indicada e reentrada manual conecta novo peer; :215–217, observador sem video/AO VIVO e botão Participar visível | Falha finita, admissão distinta de mídia | Sim |
| STAB-62 | scripts/desktop-smoke.mjs:223, indicação da próxima captura após mudar qualidade durante tela | Preferência não promete alterar captura atual | Sim |
| STAB-05, fluxo existente | scripts/desktop-smoke.mjs:245–247, nova sala Estúdio, playback bloqueado e outro participante observa saída | Troca de sala encerra chamada | Sim |

Reverso: cada bloco novo do smoke corresponde a uma linha acima. As verificações de RTP agora consultam somente peers conectados, evitando aprovação por estatísticas antigas após reconexão. O ensaio de falha injeta também o evento de mudança de estado; chamar close diretamente não produz esse evento no Chromium. As asserções do fluxo anterior permanecem, com observador adicional fora da chamada. Sem mudanças de layout gerais nem bibliotecas novas. Adequação: PASS para os fluxos UI medidos. Perfil estável, permissões de frame/câmera e diagnóstico source ficam para T7/T8.
