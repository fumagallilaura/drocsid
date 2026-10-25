# Execução da estabilização de mídia

Registro incremental do autor, sem certificação independente. Base `38062db`, `main`, sem remoto, árvore limpa. Skill MCP `tlc-spec-driven`, catálogo 0.17.13, revisão preparada `7bed1026351b`. Python 3.14.0 portátil em `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Baseline reexecutada: 50/50 Node, zero falhas/skips/cancelled; spec/tasks --strict: zero erros/avisos. Nenhuma lição confirmada.

O usuário escolheu execução nesta sessão, com Verifier independente no fechamento. Tarefas e commits são sequenciais. MEDIA-33/34 exigem dois PCs Windows, fones/microfones reais e operadores. Nenhum smoke sintético substitui A7. STAB de mensagens e shutdown continuam abertos; TypeScript não começou.

## T1 — tentativa e microfone

Resultado: contexto capturado por operação; saída não espera ack para encerrar tracks/peers. Geração é alocável por conexão, com padrão local nos testes. A ligação à Session pertence a T3. Campos adicionais continuam sob v1 até T6. As trocas de guardas nos callbacks de tela são necessárias para o mesmo contexto; a transação de tela permanece T4.

Premissas: manter escuta sem microfone, publicação somente após admissão e mute como transmissão desativada, sem fingir liberação. Arquivos de produto/testes: `src/rtc.js`, `tests/rtc.test.js`. Sem alteração dos 50 testes anteriores; cinco testes novos. Antes da correção, quatro novos testes falharam por asserção e um já passava, reutilizando a proteção existente para permissão antiga.

Gate: `npm.cmd test` **55/55**, zero falhas/skips/cancelled; `npm.cmd run build` **PASS**; `CONVERSA_TEST_EXTERNAL=0 node scripts/desktop-smoke.mjs` em source **PASS**, incluindo áudio RTP bidirecional, tela, parada, recusa e cancelamento. Este gate não certifica hardware nem todos os MEDIA.

### Adequação A/B: resultado esperado e asserção

| Critério / parte aplicável a T1 | Evidência e expressão | Resultado da spec | Coberto |
| --- | --- | --- | --- |
| MEDIA-01/04, controlador fechado | `tests/rtc.test.js:45` `assert.equal(requests,0)`; `:183` `assert.equal(f.captures.length,0)` | Nenhuma aquisição na abertura ou após close | Sim |
| MEDIA-02, exclusão de aquisição | `tests/rtc.test.js:56` `assert.equal(requests,1)`; `:75` `assert.equal(requests,2)` | Pedidos simultâneos não duplicam API | Sim |
| MEDIA-03/28, duas ordens e inventário completo | `tests/rtc.test.js:160` `ended(old)` e `assert.equal(f.call.microphone,current)`; helper `:40` `assert.ok(s.getTracks().every(t => t.readyState==='ended'))`; `:161` tracks novas live | Libera todas as antigas sem tocar nas novas | Sim; liberação síncrona, dentro de 1 s |
| MEDIA-05, provisório sem publicação | `tests/rtc.test.js:137` `assert.equal(f.call.admitted,false)` e `assert.equal(f.call.peers.size,0)` | Sem peers/publicação antes do ack | Sim |
| MEDIA-06/31, recusa e deadline real | `tests/rtc.test.js:66` `assert.rejects(..., e=>e.code===code)`; `:67` `ended(f.captures[0])`; `:169` código TIMEOUT, fase call-join, callId/geração exatos; `:171` pendente em 7999; `:173` ended/inativo após 8000 | Recusa por categoria ou timeout libera provisório | Sim |
| MEDIA-07/21/23, estado cancelável e close do controlador | `tests/rtc.test.js:139` `ended(oldMic)` e `assert.equal(f.states.at(-1).pending,false)`; `:162` `ended(current)`; `:202` `assert.equal(f.call.peers.size,0)` | Terminal local sem esperar rede, tracks ended e peers fechados | Sim, controlador; UI em T7 |
| MEDIA-08, escuta e aquisição só explícita | `tests/rtc.test.js:192` admitido/sem mic; `:194` `assert.equal(requests,1)` e sender null; `:198` sender contém a track adquirida após ação | Escuta não pede microfone automaticamente | Sim; tela integrada em T4/T8 |
| MEDIA-28, resposta e falha antigas | `tests/rtc.test.js:146` callId/geração atuais preservados; `:148` `assert.equal(f.call.admitted,true)` e `assert.deepEqual(f.errors,[])` | Resposta antiga não altera/reporta falha da nova | Sim |
| Contexto em todos os envios, alocadora | `tests/rtc.test.js:140` saída com contexto original; `:203` `assert.equal(event.callId,callId)` e `assert.equal(event.generation,41)`; `:180` rejeição CANCELLED | Campos capturados, epoch recusado antes de captura | Sim; alocadora Session em T3 |
| MEDIA-30, mute e liberação distintos | `tests/rtc.test.js:200` muted true, enabled false, readyState live; `:201` enabled true; `:202` `ended(mic)` | Mute desativa transmissão; saída encerra captura | Sim, API de track; percepção física em T9 |
| MEDIA-31/32, metadados do proprietário | `tests/rtc.test.js:195` código/fase exatos; `:196` callId/geração exatos. `Call.failure` constrói apenas erro categorizado/contexto e não registra mídia | Correlação disponível sem serialização de objetos externos | Sim para contexto; prova do diagnóstico completo em T7 |

Não há resultado definido com precisão insuficiente no recorte T1. Campos de payload relevantes são comparados por valor, incluindo callId/geração; tracks/peers são observados como estado. Nenhum teste apenas verifica ocorrência de chamada.

### Adequação C: mapeamento reverso dos testes usados

| Evidência / expressão | Requisito | Manter |
| --- | --- | --- |
| `tests/rtc.test.js:45` `assert.equal(requests,0)`, `:47` `ended(old)`, `:49` peers zero | MEDIA-01/03/04/21/23 | Sim, existente |
| `tests/rtc.test.js:56` requests um, `:58` admitido sem mic, `:75` `ended(late)` | MEDIA-02/07/08 | Sim, existente |
| `tests/rtc.test.js:66` rejeição por código, `:67` `ended(f.captures[0])` | MEDIA-06 | Sim, existente |
| `tests/rtc.test.js:140` saída exata, `:147` mic novo live, `:148` sem erro antigo | MEDIA-05/21/28; contexto de T1 | Sim, novo |
| `tests/rtc.test.js:160` `ended(old)` e mic atual, `:161` todas novas live | MEDIA-03/28, edge case de ordens | Sim, novo |
| `tests/rtc.test.js:169` TIMEOUT/contexto, `:173` ended, `:175` timers zero | MEDIA-06/31; deadline real de T1 | Sim, novo |
| `tests/rtc.test.js:180` CANCELLED, `:183` capturas zero | MEDIA-04/28; alocadora de T1 | Sim, novo |
| `tests/rtc.test.js:194` sender null, `:198` sender mic, `:200` disabled/live, `:203` contexto | MEDIA-02/05/08/30/31 | Sim, novo |

Adequação D: README/Verificação, matriz de tasks e padrões da skill; testes co-localizados com Call. **Veredito do autor T1: gate e adequação aprovados para o recorte; sem Verified global, sem desvio de spec, sem testes removidos/enfraquecidos/ignorados.** Commit identificado pelo título de T1 em Git; o próximo registro/Handoff guarda seu hash.

## T2 — terminal do participante e heartbeat

T1: `be83426`. T2 mantém um maior número e o último callId por WS; cancelamento recebido antes de join fecha essa geração. Duplicatas não consomem outra vaga nem reiniciam mute/tela. Saída antiga confirma seu próprio terminal. Cada snapshot recebe revisão crescente. O heartbeat usa expiração individual monotônica, rearmada pelo pong e limpa no close/shutdown. A tolerância v1 local fica até T6.

Arquivos: `server/service.js`, `tests/service.test.js`, status/evidência. Três testes novos falharam antes da implementação por geração ausente e falta de deadline individual. O teste histórico alinhado mantém suas asserções; sua instrumentação passa a incluir setTimeout e clock injetado, pois a expiração deixou de depender apenas de setInterval/Date. Nenhum caso ou asserção foi removido.

Gate Full: **58/58 Node = 50 + 8**, zero falhas/skips/cancelled; build PASS; smoke Electron source/interno PASS. Domínio do tempo em testes é controlado; não é medição de perda de rede física. Sem alteração de banco/mensagens ou fechamento integral STAB.

### Adequação A/B

| Critério | Evidência e expressão | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| MEDIA-24/28, saída antes da admissão e duplicatas | `tests/service.test.js:144` deepEqual do terminal `{callId:'old',generation:1,inCall:false,muted:true,sharing:false}`; `:147` código INVALID_EVENT/fase call-join; `:152` sharing true/muted false após join duplicado | Não reativa geração terminal; duplicata conserva estado | Sim |
| Saída antiga e mesmo número com outro callId | `tests/service.test.js:154` geração 1/inCall false; `:157` INVALID_EVENT em join/leave/media/signal; `:160` nova chamada inCall/sharing true, geração 2 | Nova tentativa intacta | Sim |
| MEDIA-18/25/26, cota e capacidade | `tests/service.test.js:173` CALL_FULL no sétimo; `:179` stopped.sharing false/inCall true; `:181` terminal/generation; `:183` sharing false e `performance.now()-started<1000`; `:186` seis admitidos após substituição | Parada/saída ignoram cotas, vaga livre em 1 s | Sim, WS real |
| Revisão crescente e ack correlacionado | `tests/service.test.js:164` `revisions.every(Number.isSafeInteger)`; `:165` revisão crescente; `:144` comparação integral do ack | Revisão crescente e geração da operação, sem confundir nova chamada | Sim |
| MEDIA-27, último pong alinhado/deslocado | `tests/service.test.js:120` socket fechado/zero clientes em 60000; `:198` aberto em 59999 após pong deslocado; `:200` fechado em 60000/zero timers | Prazo desde o último pong, sem tick extra | Sim |
| Limpeza/rearme de expiração | `tests/service.test.js:197` jobs.size 1 após novo pong; `:200`, `:202`, `:203` jobs.size 0 após timeout/close/shutdown | Não deixa timer próprio nem acumula por pong | Sim |
| MEDIA-31/32 | `tests/service.test.js:147` código/fase e seleção por requestId; `:137` versão e ausência de SECRET_TOKEN no diagnóstico inteiro | Erro correlacionado, diagnóstico sem conteúdo | Sim no proprietário; sanitização completa em T7 |

### Adequação C/D

| Teste / asserções | Âncora | Manter |
| --- | --- | --- |
| `tests/service.test.js:144` ack exato; `:147`, `:152`, `:154`, `:157`, `:160`, `:165` estados/códigos/revisão | MEDIA-24/28/31; terminal, duplicação e presença de T2 | Sim, novo |
| `tests/service.test.js:173`, `:179`, `:181`, `:183`, `:186` capacidade/estado/prazo | MEDIA-18/25/26 | Sim, novo |
| `tests/service.test.js:197`, `:198`, `:200`, `:202`, `:203` prazo e recursos | MEDIA-27; cleanup de T2 | Sim, novo |
| `tests/service.test.js:120` socket fechado e zero clientes | MEDIA-27 alinhado | Sim, histórico, apenas clock de instrumentação adaptado |

Guidelines: matriz do plano/README e skill. Payloads comparados por valores; estado remoto observado por outro WS. **Veredito do autor T2: gate e adequação aprovados, sem Verified global nem alteração de AC.**

## T3 — correlação na Session e ligação ao App

T2: `ca2ba07`. Session aloca gerações por epoch, cancela pedidos não terminais da chamada encerrada e confere ação/callId/geração nos acks. Respostas correlacionadas sem pedido pendente são consumidas; não viram erro da tentativa atual. Presença só avança com revisão crescente no contexto corrente. Timeout terminal vigente fecha o transporte em 8 s; deadline de geração substituída não derruba a chamada nova. Esse limite aplica o terminal por tentativa de MEDIA-28, sem alterar seu AC.

O App fornece a alocadora vinculada ao epoch. Ao sair, encerra e descarta o controlador; a próxima entrada na mesma conexão usa outra instância e geração maior. O smoke observa esse caminho real. Arquivos: `src/session.js`, ligação mínima em `src/main.jsx`, `tests/session.test.js`, `scripts/desktop-smoke.mjs` e registros. Controles/diagnóstico completos continuam em T7.

Seis testes Node novos. A tentativa inicial sem a correção ficou aguardando o cancelamento que o código ainda não fazia; foi interrompida, sem usar esse término como aprovação. O smoke novo inicialmente leu antes de getUserMedia assentar; acrescentada espera pela terceira tentativa, mantendo a mesma exigência e todas as asserções. Gate final: **64/64 Node = 50 + 14**, zero falhas/skips/cancelled, build PASS e smoke source/interno PASS.

### Adequação A/B

| Critério | Evidência e expressão | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| MEDIA-24/28/31, cancelamento e respostas antigas | `tests/session.test.js:119` CANCELLED/callId old/geração 1; `:125` nova callId; `:126` activeCallId new/erros vazios | Rejeita pedido antigo já no cancelamento; ack/erro antigo não altera nova | Sim |
| MEDIA-05/06, ack divergente | `tests/session.test.js:133` INVALID_EVENT; `:135` conexão terminada/código exato, para ação, callId e geração | Admissão não aceita resposta de outra operação | Sim |
| MEDIA-28, revisão/contexto | `tests/session.test.js:143` sharing false após revisão 1/2 antigas; `:145` sharing true no novo domínio; `:146` contexto antigo ignorado; `:148` reinício da conexão | Só snapshot crescente do contexto atual | Sim |
| Geração por conexão e ligação real | `tests/session.test.js:159` geração anterior +1, callId distinto/admitido; `:160` saída antiga mantém activeCallId novo; `:162` epoch antigo CANCELLED/duas aquisições; `scripts/desktop-smoke.mjs:210` geração crescente e `:211` IDs distintos | Substituir Call não reinicia geração; epoch antigo não captura | Sim, serviço real e Electron |
| MEDIA-21/26/31, timeout vigente | `tests/session.test.js:167` TIMEOUT/fase call-leave; `:168` conectado em 7999; `:169` desconectado/socket fechado em 8000 | Terminal sem ack fecha transporte após limpeza local (T1) | Sim |
| MEDIA-28, deadline antigo | `tests/session.test.js:177` conectado, activeCallId new, erros vazios | Evento de geração substituída não derruba chamada nova | Sim |
| Regressão de rascunhos/mensagens | `tests/session.test.js:60` draft original; `:69` texto integral/estado failed; `:71` uma mensagem/outbox vazia; `:103` destino real | T3 não perde texto nem altera destino | Sim, preservado |
| MEDIA-18/31/32, fronteira de pedidos | `tests/session.test.js:119` contexto do cancelamento, `:133` categoria exata; `:167` fase exata; sem serialização de payload em Session | Correlação disponível e erro antigo consumido | Sim no proprietário; prova de log global em T7 |

### Adequação C/D

| Teste / asserção | Âncora | Manter |
| --- | --- | --- |
| `tests/session.test.js:119`, `:125`, `:126` cancelamento/contexto/erros | MEDIA-24/28/31 | Sim |
| `tests/session.test.js:133`, `:135` INVALID_EVENT/estado | MEDIA-05/06/28 | Sim |
| `tests/session.test.js:143`, `:145`, `:146`, `:148` sharing observado | MEDIA-28 e revisão do plano T3 | Sim |
| `tests/session.test.js:159`, `:160`, `:162` geração/epoch/aquisições | MEDIA-05/24/28; integração de T3 | Sim |
| `tests/session.test.js:167`, `:168`, `:169` timeout/conexão | MEDIA-21/26/31 | Sim |
| `tests/session.test.js:177` conectado/current/sem erro | MEDIA-28, callback de deadline antigo | Sim |
| `scripts/desktop-smoke.mjs:210`, `:211` geração maior/callId diferente | Integração real obrigatória de T3 | Sim |

Guidelines: matriz/README/skill. Nenhum teste histórico excluído, ignorado ou enfraquecido. **Veredito do autor T3: gate e adequação aprovados no recorte; MEDIA continua sem Verified.**

## T4 — publicação e compensação de tela

T3: `2006457`. Tela tem operação própria, captura provisória, conjunto de peers afetados e estado selecting/publishing/active/terminal. `display` só é atribuído após publicação/ack no prazo absoluto de 8 s desde a captura. As mutações de tracks passam pelas filas existentes. Stop encerra tracks antes da rede, compartilha a mesma limpeza e seu prazo de 1 s. Peer com escrita ainda pendente é fechado já no aborto; aguardar a fila poderia deixar uma escrita antiga ocorrer depois da remoção. Peers saudáveis conservam voz/mute. Áudio retornado sem consentimento é encerrado e não entra no sender.

Arquivos: `src/rtc.js`, `tests/rtc.test.js`, status/evidência. Cinco testes novos. Os primeiros testes novos expuseram tela provisória anunciada como pronta; a execução vermelha com espera bloqueada foi interrompida. Na primeira correção, o teste histórico de sender suspenso também ficou aguardando o clock; a correção passou a fechar imediatamente apenas o peer com escrita pendente, preservando aquela asserção e o limite de 1 s. Nenhum teste foi alterado para contornar falha.

Gate final: **69/69 Node = 50 + 19**, zero falhas/skips/cancelled; build PASS e smoke Electron source/interno PASS. Callback nativo e seleção entre controladores são T5; estados/diagnóstico da UI são T7. As referências de T1/T2/T3 acima identificam as linhas em seus commits `be83426`/`ca2ba07`/`2006457`; linhas atuais serão consolidadas em T8.

### Adequação A/B

| Critério | Evidência e expressão | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| MEDIA-14/20, provisório e deadline absoluto | `tests/rtc.test.js:214` display null/sharingState publishing; `:227` TIMEOUT e fase screen-publication; `:228` publishing em 7999; `:229` ended/idle em 8000 | Sem sucesso antecipado; publicação/ack dividem 8 s | Sim |
| MEDIA-15/19, três peers e peer tardio | `tests/rtc.test.js:217` `ended(f.captures[1])`; `:219` peer fechado ou sender sem captura após resolução tardia; `:220` mic saudável preservado; `:221` admitido/mic live | Nenhum envio residual, inclusive peer tardio | Sim |
| MEDIA-16/17/19, stop repetido e mute | `tests/rtc.test.js:237` ended/display null; `:239` peer fechado/admitido/muted true; `:240` mic enabled false | Mesma limpeza, sem novo prazo ou alteração de mute | Sim |
| MEDIA-02/09/10/28 | `tests/rtc.test.js:246` mesma promessa/um pedido; `:249` áudio ended/sender null; `:250` vídeo live/active; `:252` display e sender continuam novos | Um pedido por operação, áudio por consentimento, resultado antigo descartado | Sim, controlador; fonte nativa em T5 |
| MEDIA-17/19/31, falha de notificação | `tests/rtc.test.js:262` ended/idle/admitido; `:263` MEDIA_FAILED/fase media; `:264` operationId/callId/geração iguais à chave da captura | Limpeza local e voz não dependem da notificação | Sim |
| MEDIA-03/21/23/28, liberação terminal | `tests/rtc.test.js:85` `ended(late)`; `:252` preserva display novo; `:253` `ended(current)` | Toda captura antiga ou do controlador fechado encerra | Sim, domínio |
| MEDIA-18/32, integração de estado e sem registro de mídia | `tests/rtc.test.js:230` evento final sharing false; smoke observa fim da tela remota; `:264` contexto técnico por valor | Estado terminal enviado com contexto; diagnóstico completo em T7 | Sim no recorte, sem certificação global |

### Adequação C/D

| Teste / expressão | Âncora | Manter |
| --- | --- | --- |
| `tests/rtc.test.js:214`, `:217`, `:219`, `:220`, `:221` estado/inventário/voz | MEDIA-14/15/19/20 e edge case de peer tardio | Sim |
| `tests/rtc.test.js:227`, `:228`, `:229`, `:230` categoria/prazo/estado | MEDIA-14/17/18 | Sim |
| `tests/rtc.test.js:237`, `:239`, `:240` liberação/prazo/mute | MEDIA-16/17/19 | Sim |
| `tests/rtc.test.js:246`, `:249`, `:250`, `:252` exclusão/consentimento/estado | MEDIA-02/09/10/28 | Sim |
| `tests/rtc.test.js:262`, `:263`, `:264` liberação/correlação | MEDIA-17/19/31 | Sim |

Guidelines: README/matriz/skill. Resultados observam tracks, senders e estado; não apenas chamadas de mocks. **Veredito do autor T4: gate e adequação aprovados; sem Verified global, sem alteração de AC, testes históricos preservados.**
