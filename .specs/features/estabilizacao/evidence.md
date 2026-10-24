# Evidência incremental da estabilização

Esta é a revisão de adequação do autor por tarefa. A validação independente final é separada. Nenhum teste usa o exit zero das sondagens históricas como aprovação.

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
