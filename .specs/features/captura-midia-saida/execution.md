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
