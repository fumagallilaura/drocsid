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

## T5 — seleção nativa por operação/documento

T4: `fdf6066`. A seleção existente conserva o callback no host e a aquisição real no renderer. Há uma chave preparada por documento até o assentamento da promessa do navegador. Preload mantém token privado e filtra eventos; host recusa chaves/IPC antigos. Prepare/cancel/finish síncronos fazem somente validação e memória; enumeração continua assíncrona. Resultado estruturado sobrevive ao AbortError. O adaptador relata a operação uma vez, independentemente da ordem entre IPC de erro e rejeição da captura.

A precisão do design usa `did-start-navigation` do frame principal, em vez do genérico did-start-loading: carregamento de subframe não invalida o preload principal. Não muda o resultado de nenhum AC. Fontes oficiais conferidas: [display handler](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts), [sendSync](https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrenderersendsyncchannel-args), [ativação transitória](https://w3c.github.io/mediacapture-screen-share/#dom-mediadevices-getdisplaymedia). Context7 não está disponível nesta sessão; código e docs locais foram consultados antes dessas fontes.

Arquivos: `electron/main.js`, `electron/preload.cjs`, `electron/policy.js`, adaptador mínimo em `src/main.jsx`; teste unitário em `tests/desktop-policy.test.js`, fixture pública e `scripts/desktop-capture-check.mjs`. Um teste Node novo; dez pedidos nativos no checker, todos com gesto preservado. A fixture instrumenta APIs públicas antes do entrypoint real; nenhum hook de teste entrou na produção. Sua leitura inicial de returnValue foi corrigida com um setter observador, pois a propriedade nativa não tem getter de resultado. Asserções mantidas.

Gate Full final: **70/70 Node = 50 + 20**, zero falhas/skips/cancelled; build, smoke source/interno, captura e perfil **PASS**, sequenciais. Concessão de loopback no callback prova a política; não prova conteúdo/qualidade de áudio real. T9 continua necessário.

### Adequação A/B

| Critério | Evidência e expressão | Resultado da spec | Coberto |
| --- | --- | --- | --- |
| MEDIA-09/11/28, chave exata e limites | `tests/desktop-policy.test.js:44` valid/same true; `:45` invalid false; `:46` outra operação false; `:47` limites máximos true | Chave limitada e inseparável da operação | Sim |
| MEDIA-11, privilégios preservados | `tests/desktop-policy.test.js:13` câmera false; `:25` IPC de subframe false; `:34` origem estrangeira false; perfil real câmera/subframe NotAllowedError | Só frame principal local confiável | Sim |
| MEDIA-12/23/28, reload/close/Escape | `scripts/desktop-capture-check.mjs:39`, `:49`, `:60` objetos exatos com calls 1/results cancelled/finished true e deliveries 0/1 | Callback único e nenhuma entrega tardia | Sim, asserções BUILD preservadas |
| Guarda antes do handler/reentrada | `scripts/desktop-capture-check.mjs:70` prepare de outra chave INVALID_EVENT; `:74` requests.length 4; `:77` controle reutilizável depois do assentamento | Callback antigo não é associado à nova tentativa | Sim |
| Handler duplicado | `scripts/desktop-capture-check.mjs:82` resultado null; `:87` callback original ainda com calls 0 | Não substitui nem finaliza o original | Sim |
| MEDIA-13/31, deadline com inventário suspenso | `scripts/desktop-capture-check.mjs:89` calls 0 em 59999; `:93` outcome failed/TIMEOUT/capture-selection após 60000 | Prazo desde a preparação, incluindo inventário | Sim, timer controlado pela fixture |
| Fonte inválida e chave alheia | `scripts/desktop-capture-check.mjs:102` calls 0 após chave alheia; `:105` failed/INVALID_EVENT/capture-selection | Não concede fonte fora do pedido | Sim |
| Documento antigo/token privado | `scripts/desktop-capture-check.mjs:118` prepare/cancel/finish recusados com resultados exatos; `:119` callback novo calls 0; `:124` token indefinido no bridge público | IPC antigo não altera seleção nova; token não exposto ao App | Sim |
| Inventário falho | `scripts/desktop-capture-check.mjs:128` mensagem específica; `:129` failed/MEDIA_FAILED/capture-inventory | Distingue erro técnico de cancelamento | Sim |
| MEDIA-10, consentimento de áudio | `scripts/desktop-capture-check.mjs:140` `{audioRequested:audio,audio:audio?'loopback':null,video:true}` para false/true | Loopback só quando pedido na operação | Sim, concessão nativa; som físico em T9 |
| Gesto e callback de todos os caminhos | `scripts/desktop-capture-check.mjs:144` todo request.calls===1; `:145` dez userGesture true | Preparação síncrona não perde gesto nem duplica callback | Sim |
| MEDIA-32 | Host envia ao logger só fase/código/requestId/erro técnico; eventos de UI carregam thumbnails necessários ao seletor, não ao diagnóstico. Sanitização inteira é exigida em T7 | Diagnóstico sem captura/título/SDP | Fronteira preservada; gate completo em T7 |

### Adequação C/D

| Testes / expressões | Âncora | Manter |
| --- | --- | --- |
| `tests/desktop-policy.test.js:44`, `:45`, `:46`, `:47` chaves/limites | MEDIA-09/11/28 | Sim, novo |
| `scripts/desktop-capture-check.mjs:70`, `:74`, `:77`, `:82`, `:87` guarda/callback/estado | MEDIA-12/28 e done-when de T5 | Sim, novo |
| `scripts/desktop-capture-check.mjs:89`, `:93`, `:102`, `:105` tempo/chave/categoria | MEDIA-09/12/13/31 | Sim, novo |
| `scripts/desktop-capture-check.mjs:118`, `:119`, `:124` documento/token | MEDIA-11/23/28 | Sim, novo |
| `scripts/desktop-capture-check.mjs:128`, `:129`, `:140`, `:144`, `:145` erro/consentimento/callback/gesto | MEDIA-09/10/12/13/31 | Sim, novo |

Guidelines: README/matriz/skill. Nenhuma asserção histórica removida, ignorada ou enfraquecida. **Veredito do autor T5: gate e adequação aprovados no componente, sem Verified global.**

## T6 — contrato v2 obrigatório

T5: `325c340`. Ativados geração positiva segura em todos os eventos de chamada/acks e revisão positiva segura na presença. Serviço, Session e Call retiraram a tolerância transitória. STAB/A14 e o vocabulário agora indicam v2, com v1 identificado como primeira revisão histórica. Os **113 textos de AC BUILD/STAB/MEDIA foram comparados byte a byte como texto e permanecem iguais à base `38062db`**, assim como o prefixo Decisions.

Arquivos: protocolo e limites em serviço/Session/Call; fixtures em protocol/session/rtc/bootstrap/helper e serialização do smoke. As alterações nos testes anteriores só acompanham versão/campos obrigatórios; todas as asserções de resultado, mensagens, limites, persistência e terminal permanecem. A expectativa numérica de bootstrap passa expressamente de 1 para 2, conforme a mudança de contrato. Quatro testes Node novos: **74/74 = 50 + 24**, zero falhas/skips/cancelled.

A integração adicional `test-results/protocol-v1-client-check.mjs` carrega cópias isoladas da Session/Call/protocolo v1 reais de `325c340`, sem alterar a árvore. Contra o serviço v2, observa INCOMPATIBLE_PROTOCOL, zero sockets WS e zero aquisições. Limpeza temporária validada dentro de TEMP. Não copia suporte v1 para a produção.

Gate Build: logs e resultados em `test-results/media-t6/gates.json`, matriz source, serviço externo, pacote e wrapper. Portátil 0.1.1, SHA-256 `c9026b05387d87d1b7f9b76c2a78ef0db4398ee3460a225071297cdcc5e4ba72`; win-unpacked em `.packaging/builds/1792960517829-3551fc38-9500-4050-9d11-eb14cc3a252f/win-unpacked/Conversa.exe`. Manifesto copiado para `test-results/media-t6/build.json`. Esta é a candidata de T6; T7 exige nova candidata em T8.

### Adequação A/B

| Critério | Evidência e expressão | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| MEDIA-05/24/25/28, todos os produtores | `tests/protocol.test.js:54` PROTOCOL_VERSION 2; `:57` geração 1; `:58` MAX_SAFE_INTEGER; `:59` inválidos geram INVALID_EVENT; `:60` v1 INCOMPATIBLE_PROTOCOL | Campos obrigatórios e limites exatos | Sim |
| MEDIA-26/28, ack e presença | `tests/protocol.test.js:68` ack.generation/presence.revision 1; `:70`, `:71` ausente/zero/tipo/faixa inválidos recusados; `:73` revisão máxima | Sem campo opcional ou tolerância v1 | Sim |
| Cliente v2/serviço v1 antes de mídia | `tests/session.test.js:182` INCOMPATIBLE_PROTOCOL; `:183` zero sockets/desconectado; `:187` CANCELLED/zero capturas | Não captura nem conecta protocolo misturado | Sim |
| Cliente/pedido v1/serviço v2 | `tests/service.test.js:209` INCOMPATIBLE_PROTOCOL; `:211` participante fora da chamada; integração do código v1 real em `test-results/protocol-v1-client-check.mjs` | Cliente antigo termina na configuração, sem ocupar vaga/capturar | Sim |
| Mesmo número com outro callId | `ca2ba07:tests/service.test.js:157` INVALID_EVENT; `:160` nova chamada inCall/sharing/geração intactos, reexecutados em T6 | Contrato novo não altera política terminal | Sim |
| Demais MEDIA de contrato | Testes T1–T5 reexecutados no Quick/Build com formatos v2 e resultados preservados | Admissão/saída/parada permanecem corretas | Sim para o recorte automatizado |

### Adequação C/D

| Teste / asserção | Âncora | Manter |
| --- | --- | --- |
| `tests/protocol.test.js:54`, `:57`, `:58`, `:59`, `:60` versão/geração | MEDIA-05/24/25/28 e done-when T6 | Sim |
| `tests/protocol.test.js:68`, `:70`, `:71`, `:73`, `:74` ack/revisão | MEDIA-26/28 | Sim |
| `tests/session.test.js:182`, `:183`, `:187` incompatibilidade/sem aquisição | MEDIA-05/06/28 | Sim |
| `tests/service.test.js:209`, `:211`, `:212` recusa/estado e próxima admissão válida | MEDIA-05/24/28 | Sim |

Guidelines: matriz/README/skill. Nenhuma coerção, skip, exclusão de teste ou compatibilidade escondida. O bump é uma mudança técnica local de T6 sob a autorização atual; não aprova publicação ou os 68 STAB.

**Veredito do autor T6: 14/14 gates Build PASS**, mais integração do cliente v1 real PASS. Adequação aprovada; sem Verified global. Assinatura/instalador, hardware e ruído continuam fora desta evidência.

Mensagem do commit T6: a primeira chamada do check_commit recebeu apenas o título e recusou a ausência do footer; o comando composto continuou indevidamente até o commit. Corrigido antes de T7: mensagem completa, título menor que 72 caracteres e footer BREAKING CHANGE validados com PASS, e commit T6 local amendado. Nenhuma mudança de código ou teste nesse ajuste.

## T7 — controles, reprodução e diagnóstico

T6: `5a8f657`. UI distingue seleção, publicação, ativo e parada, sem AO VIVO local antes do commit de tela. Vídeo remoto exige conexão e track recebida, em vez de só presença. Reprodução consulta o controlador e a Session atuais; o botão de silenciar saída bloqueia imediatamente e conserva o microfone. Saída e troca de sala bloqueiam reprodução antes da confirmação. O aviso de loopback explicita que pode incluir a própria chamada.

Diagnóstico tem lista de campos/códigos/fases/causas permitidos. Call preserva requestId do erro nativo, além de callId/geração/operationId. O teste de resultado encontrou requestId perdido no repasse; a implementação foi corrigida. LogFailure não serializa nomes de causa arbitrários. Não há nova plataforma de logging.

Arquivos: `src/main.jsx`, campo de correlação em `src/rtc.js`, sanitização no `server/service.js`, E2E em `scripts/desktop-smoke.mjs`, teste do logger em `tests/service.test.js`, registros. Um novo teste Node e cenários Electron; os primeiros testes de teclado foram reposicionados para depois da entrada real na sala, mantendo asserções. **75/75 Node = 50 + 25**, zero falhas/skips/cancelled. Full, captura/perfil e smoke externo **PASS**, com terceiro participante recebendo tela ativa.

### Adequação A/B

| Critério | Evidência e expressão | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| MEDIA-07, cancelamento por teclado | `scripts/desktop-smoke.mjs:175` foco/Enter em Cancelar entrada; `:177` todas as tracks tardias ended | Cancela sem aguardar permissão | Sim |
| MEDIA-17/20, fases reais | `scripts/desktop-smoke.mjs:288` Escolhendo visível; `:292` Publicando visível/AO VIVO count 0 enquanto ack retido; `:322` Parando visível | Não anuncia publicação antes de commit; parada distinta | Sim |
| MEDIA-28, erro antigo | `scripts/desktop-smoke.mjs:289` injeta erro com chave da seleção anterior; `:290` picker atual visível e só um diagnóstico de inventário | Erro antigo não fecha seleção nova nem reapresenta falha | Sim |
| MEDIA-10/29/30, saída e mute | `scripts/desktop-smoke.mjs:239` todas tracks de mic enabled/live com saída silenciada; teste anterior do mesmo fluxo confere isAudioMuted true/false; aviso explícito no App | Silenciar áudio só reprodução; microfone separado | Sim, controles; áudio físico em T9 |
| MEDIA-21/22, sala confirmada atrasada | `scripts/desktop-smoke.mjs:336` cabeçalho geral ainda visível; `:337` isAudioMuted true; `:338` todas tracks ended e PCs closed antes de liberar joined | Troca de texto termina a chamada imediatamente | Sim |
| MEDIA-23/29, recarga e desconexão | `scripts/desktop-smoke.mjs:347`, `:354` IDs de tracks observados ended; `:348`, `:355` isAudioMuted true/zero elementos de mídia | Encerramento local antes de perder contexto; sem reprodução reativada | Sim, sintético; controlador fechado e close nativo em T1/T5 |
| MEDIA-31/32, diagnóstico do fluxo real | `scripts/desktop-smoke.mjs:188` MEDIA_FAILED/capture-inventory/versão; `:189` requestId/callId/operationId UUIDs; `:190` geração positiva; `:191` chaves exatas; `:192` resultado inteiro sem MEDIA_PRIVATE_ | Categoria/fase/correlação sem nome/título/SDP/segredo/mensagem | Sim |
| Sanitização no host | `tests/service.test.js:219` ausência de sentinelas no resultado inteiro; `:220` deepEqual de todos os campos permitidos | Nomes de causa não viram canal de conteúdo | Sim |
| Geração após troca de controlador | Smoke mantém asserções de T3 de geração crescente/callId distinto, reexecutadas com v2 | Não reinicia número na mesma conexão | Sim |

### Adequação C/D

| Teste / expressão | Âncora | Manter |
| --- | --- | --- |
| `scripts/desktop-smoke.mjs:175`, `:177` teclado e ended | MEDIA-07/21/28 | Sim |
| `scripts/desktop-smoke.mjs:188`–`:192` valores/campos/ausência de sentinela | MEDIA-31/32 | Sim |
| `scripts/desktop-smoke.mjs:239` mic enabled/live | MEDIA-29/30; sem deafen | Sim |
| `scripts/desktop-smoke.mjs:290`, `:292`, `:322` seletor/publicação/parada | MEDIA-17/20/28 | Sim |
| `scripts/desktop-smoke.mjs:338`, `:347`, `:354` ended/peers closed | MEDIA-21/22/23/29 | Sim |
| `tests/service.test.js:219`, `:220` log inteiro sanitizado/exato | MEDIA-32 | Sim |

Guidelines: matriz/README/skill. Layout preservado; nenhuma funcionalidade extra, deafen, câmera ou TypeScript. **Veredito do autor T7: gate e adequação aprovados; falta a consolidação T8 e o Verifier independente. T9 físico pendente.**

## R1 — parada local sem esperar confirmação remota

Retorno independente de `f44d268`: MEDIA-17 falhou, com tracks encerradas mas botão desabilitado após 1.100 ms. O controlador aguardava o ack de rede dentro da mesma promessa da limpeza local. Agora `stopScreen` retorna somente a limpeza local, com o prazo original de 1 s; a notificação mantém correlação, diagnóstico e prazo remoto de 8 s em paralelo. A Session conserva o último pedido de estado de tela para que um timeout anterior não desconecte um compartilhamento posterior da mesma chamada. Um mute posterior não invalida o prazo da parada atual.

Dois testes novos falharam por asserção de estado antes da correção, sem watchdog. Três testes novos no total: **78/78 = 50 + 28**, zero falhas/skips/cancelled. Full, smoke externo e checks source de perfil/captura PASS; logs em `test-results/media-r1`. A asserção final de tipos/timing do smoke foi reexecutada após acrescentá-la. Sem alegação de resultado físico; a candidata anterior exige reconstrução antes de T8/reverify.

| AC / conjunção | Evidência exata e asserção | Resultado e adequação A/B |
| --- | --- | --- |
| MEDIA-17, prazo local sem ack | `tests/rtc.test.js:273` stopped=true em 1000, ended(previous), display=null e sharingState=idle antes de liberar a notificação | PASS no domínio; não espera a rede |
| MEDIA-17, controle utilizável | `scripts/desktop-smoke.mjs:339` botão Compartilhar habilitado com ack retido; `:341` timestamps numéricos e `:342` duração <=1000; remoção de sender atrasada 350 ms conserva a asserção de Parando | PASS Electron, relógio do renderer desde o click até a mutação que habilita |
| MEDIA-28, tela posterior protegida | `tests/rtc.test.js:276` display novo/live/admitted e errors=[] após falha antiga; `tests/session.test.js:198` transporte aberto/chamada atual após expirar stop anterior | PASS, inclusive na mesma geração da chamada |
| MEDIA-26, parada atual ainda tem limite | `tests/session.test.js:207` connected em 7999; `:208` desconectado/WS fechado em 8000, mesmo após mute independente | PASS; preserva recuperação segura quando não há novo estado de tela |

Reverso C/D: cada um dos três testes novos e a instrumentação de timing do smoke corresponde a uma linha acima. Nenhuma expectativa de tracks, voz preservada, erros ou controles foi retirada. O teste de Parando usa remoção realmente pendente; o estado não é prolongado por ack de rede para satisfazer a asserção. Sem API de teste na produção, nova abstração ou mudança de layout. Adequação do autor R1: PASS; Verifier e T9 permanecem pendentes.

## R2 — respostas terminais discriminadas pelo valor

R1: `01f3e1c`. Retorno do sensor da rodada 1: M4 admitia join antigo e M5 recusava terminais por cota, mas o helper esperava apenas um tipo de resposta; os testes terminavam por timeout. O helper agora aceita uma lista de tipos sem mudar o comportamento dos consumidores existentes. Nos testes proprietários, o primeiro resultado correlacionado ack/error é recebido e seu tipo/estado é comparado antes de esperar presença. Não há mudança de produto nesta correção de adequação.

| AC / sensor | Evidência e asserção de valor | Adequação A/B |
| --- | --- | --- |
| MEDIA-24/28, M4 | `tests/service.test.js:149` refused.type=error antes de INVALID_EVENT/call-join; aceita ack na espera para expor admissão indevida | PASS do baseline; sensor independente deve matar por tipo divergente |
| MEDIA-25/26, M5 | `tests/service.test.js:182` stopped.type=ack, sharing=false/inCall=true; `:184` left.type=ack e terminal correlacionado | PASS do baseline; RATE_LIMITED deixa de virar timeout de ack |
| Regressão STAB-28/29/30/68 | `tests/service.test.js:60`, `:62` mesma verificação de tipos, preservando os estados e repetição anteriores | PASS, sem certificação integral STAB |

Reverso C/D: as novas comparações de tipo e o suporte a lista pertencem exclusivamente às linhas acima. Asserções de código, estado, prazo, capacidade e repetição permanecem intactas. **78/78 = 50 + 28**, zero falhas/skips/cancelled; Full PASS, logs `test-results/media-r2`. Adequação do autor R2: baseline aprovado; a segunda rodada independente deve confirmar seis mortes válidas, sem contar watchdog.
