# Retomada da estabilização em 2026-10-26

Execução inline autorizada pelo usuário. Oito entregáveis históricos em [tasks.md](tasks.md); T1–T6 não são reimplementados por terem evidência antiga sem certificação. O [evidence.md](evidence.md) preserva seus registros originais. Este documento registra somente adequação nova por proprietário. Os 68 ACs continuam sem aprovação integral; nenhum resultado MEDIA fecha STAB automaticamente.

## R1 / T3 — mensagens persistidas e encerramento do serviço

Cinco testes novos cobrem conjunções que faltavam no conjunto permanente. O serviço existente passou sem alteração de produto ou banco. As sondagens preparatórias também passaram; agora a evidência executável fica junto do proprietário, em `tests/service.test.js`.

Gate da tarefa T3/Full: `npm.cmd test` PASS, **85/85 = 50 + 35**, zero fail/skip/cancelled/todo. Testes co-localizados de service/server também PASS. Logs: `test-results/stab-r1/{service,quick}.log`. Nenhuma asserção anterior removida ou relaxada.

| AC / conjunção | Evidência exata e valor exigido | Adequação A/B |
| --- | --- | --- |
| STAB-19/23/24 | `tests/service.test.js:232`: mesmo recibo após troca de sala e normalização; `:236`: error/OPERATION_CONFLICT/message para outra sala ou texto; `:240` ROOM_MISMATCH em envio ainda não persistido; `:241`/`:242` históricos café vazio e geral exatamente com a mensagem original | PASS; conflito não altera nem cria registros em outra sala |
| STAB-21/27 | `tests/service.test.js:249`: error/INVALID_INPUT para vazio/branco/2001; `:251` histórico vazio; `:253` texto normalizado idêntico, 2000 unidades UTF-16 e sequence=1; `:254` histórico só com o recibo aceito | PASS; rejeição não grava e limite inclui pares Unicode válidos |
| STAB-35/37 | `tests/service.test.js:261`: mesma promessa terminal; `:263`: HTTP 503/SHUTTING_DOWN; `:269`: Upgrade WS 503 e listener fechado após liberar a limpeza suspensa | PASS; usa APIs públicas HTTP/WS, sem novo hook de produção |
| STAB-36/37 | `tests/service.test.js:277`: ainda pendente em 4999 e mesma promessa no close repetido; `:279`: settled=true/SHUTDOWN_FAILED no instante 5000, antes de await | PASS; repetição não renova prazo e regressão não fica escondida por watchdog |
| STAB-33/63/R07 | `tests/service.test.js:287`: bytes HTTP404, evento close numérico, duração <=1000 e socket destruído, verificados após janela de observação de 1 s | PASS baseline; sensor deve remover resposta/fechamento e morrer na asserção, sem aguardar once(data/close) indefinidamente |

Reverso C/D: cada teste novo corresponde a uma linha; helpers e statements do produto foram reutilizados. Somente falhas deliberadas de cleanup geram SHUTDOWN_FAILED esperado. O timer do teste limita a observação e as asserções conferem dados/estado efetivos; a morte no sensor não pode ser atribuída ao término desse timer. Sem abstração, dependência, refatoração ou alteração de requisito. Adequação do autor R1: PASS; avaliação independente dos 68 STAB continua pendente.

## R2 / T5 — composição, transporte e prazos da Session

R1: `088e701`. Três testes novos fecham conjunções de texto recusado pelo transporte, recibo recebido depois da navegação e fronteiras de todas as seis fases A1. A Session existente passou sem alteração de produto. O backend controlado do teste de troca de sala agora aceita mensagens válidas, como um servidor saudável: se a barreira for removida, a expectativa de rejeição falha por valor, sem timeout artificial. O teste de rejeição exige outbox.length=1 antes de acessar seu conteúdo, para R05 não terminar apenas em TypeError.

Gate T5/Quick e teste co-localizado de Session: PASS, **89/89 = 50 + 39**, zero fail/skip/cancelled/todo. Logs em `test-results/stab-r2/{session,quick}.log`. Todos os resultados anteriores continuam exigidos.

| AC / conjunção | Evidência e expressão de resultado | Adequação A/B |
| --- | --- | --- |
| STAB-18/20/22, transporte recusou enviar | `tests/session.test.js:225` messages=0/outbox.length=1; `:226` texto integral/geral/failed; `:228` rascunho café preservado após reconexão; `:229`/`:230` rascunho geral e operação/texto falho originais preservados | PASS, nenhuma confirmação fabricada e buffers por sala separados |
| STAB-18/20/21/23/39, recibo atrasado | `tests/session.test.js:241` resultado igual ao recibo; `:242` sala café/draft novo intactos, mensagens/outbox atuais vazios; `:243` histórico geral com uma única mensagem; `:244` replay de contexto antigo não duplica e errors=[] | PASS, identidade/destino fixos sem alterar composição atual |
| STAB-38, seis fases A1 e retry manual | `tests/session.test.js:267` settled=false em 7999; `:268` settled=true/TIMEOUT/fase exata em 8000; `:270`–`:273` conexão/sala/admissão/reenvio manual bem-sucedidos; `:274` zero timers ao terminar | PASS configuration/websocket/hello/join/call-join/message; a espera de permissão não entra no prazo de admissão |
| STAB-63/R04/R05, sensor por resultado | `tests/session.test.js:56` backend pode confirmar mensagem válida e `:58` rejeição permanece obrigatória durante troca; `:69` outbox.length=1 antes de texto/estado | Baseline PASS, sensor independente ainda deve injetar regressões e comprovar AssertionError |

Reverso C/D: cada teste novo corresponde às três primeiras linhas; as duas ampliações de fixture/asserção ancoram a quarta. Sem novos helpers de produção ou abstrações de estado. Asserções antigas não foram substituídas; os controles de confirmação apenas tornam a regressão observável. Adequação do autor R2: PASS, sem certificação integral STAB e sem resultado físico.

## R3 / T6 — correlação de diagnóstico de reprodução

R2: `9b0c3ba`. Uma rejeição controlada de `HTMLMediaElement.play()` comprovou STAB-67 incompleto: o diagnóstico tinha fase/código/versão, mas callId e geração eram null. A nova asserção falhou por diferença de valor antes de alterar produto (`test-results/stab-r3/playback-before.log`). Media agora recebe esses dois metadados do proprietário vigente e os captura no effect que inicia o playback; rejeição tardia mantém a identidade original. O logger continua com a mesma lista restrita de campos e nenhuma mensagem técnica é serializada.

| AC / resultado | Evidência e expressão | Adequação A/B |
| --- | --- | --- |
| STAB-67, correlação disponível | `src/main.jsx:27` usa os metadados capturados; `scripts/desktop-smoke.mjs:293` exige MEDIA_FAILED/playback/callId e geração exatamente da tentativa, versão e causa sanitizada | PASS, antes null versus ID/geração fazia ExpectError |
| STAB-67, conteúdo excluído | `scripts/desktop-smoke.mjs:21` erro contém sentinelas em nome/mensagem/SDP/credencial; `:294` exige ausência de STAB_PRIVATE_ no conjunto inteiro de diagnósticos/saída nativa | PASS, conteúdo sensível não vira correlação |
| Recuperação/regressão | Sequência original de falha do peer, saída/reentrada manual e RTP bidirecional permanece no smoke depois da asserção; todos os controles/capturas anteriores continuam exigidos | PASS source interno/externo; qualidade física continua T9 |

Reverso C/D: injeção e novas comparações estão ancoradas a STAB-67; props/effect só fornecem correlação disponível. Não foi adicionada recuperação automática de reprodução. Uma tentativa experimental no teste de esperar a promessa nativa de play foi retirada por não corresponder ao resultado de diagnóstico exigido; não comprovaria qualidade física. A recuperação continua a reentrada manual já prevista. Todas as asserções anteriores do smoke permaneceram. **89/89**, zero fail/skip/cancelled/todo; Quick/build/smokes interno e externo/captura/perfil source PASS em `test-results/stab-r3`. Adequação do autor R3: PASS; produto alterado exige nova candidata antes do fechamento MEDIA/STAB.

Durante a redação do teste, um await nativo de play não terminou; somente a árvore de processos desse gate foi encerrada após conferir PIDs/parentesco. A remoção manual recursiva do perfil isolado `C:/Users/welli/AppData/Local/Temp/conversa-test-y4t7mS` foi bloqueada pela revisão automática (`blocked by policy`). A pasta foi mantida, sem tentativa por outro mecanismo; os processos foram encerrados. Os gates finais usaram novos perfis e teardown normal.

## R4 / T7 — perfil, permissões e ICE efetiva

R3: `8955755`. Nenhuma alteração do host foi necessária. O checker de perfil agora inicia um servidor separado isolado com a mesma configuração ICE do host desktop e compara os dois resultados efetivos. O servidor adicional participa do mesmo teardown independente dos demais recursos, inclusive em launch falhando. Os testes de perfil/permissões existentes e os resultados MEDIA foram reutilizados por suas asserções, sem assumir aprovação por nome de gate.

| AC | Evidência e resultado | Adequação A/B |
| --- | --- | --- |
| STAB-50 | `scripts/desktop-profile-check.mjs:31`: standalone.iceServers e embedded.iceServers iguais ao array configurado e entre si, obtidos de dois `/api/config` reais | PASS para configuração válida; parser compartilhado tem limites/tipos próprios em `tests/protocol.test.js` |
| STAB-45/56 | `scripts/desktop-profile-check.mjs:58`: host adicional exit=1/ALREADY_RUNNING, janelas originais preservadas; `:65`–`:68`: nome/endereço restaurados em outra porta, `:72` qualidade; `:73` áudio do sistema inicia off | PASS source, mesmos dados userData temporários |
| STAB-48 | `scripts/desktop-profile-check.mjs:37` câmera e `:45` iframe retornam NotAllowedError; política/IPC unitários e checker de captura mantêm origem/frame/chave não confiáveis negados | PASS, câmera continua fora do escopo e sem capacidade concedida |

Reverso C/D: a comparação nova e o recurso de servidor/cleanup pertencem a STAB-50; as comparações já existentes sustentam as outras linhas. Não há escolha de STUN/TURN de produto; a URL de loopback é só dado de teste, sem credenciais. **89/89**, zero fail/skip/cancelled/todo; Build STAB (Quick + build + smoke source) e perfil source PASS em `test-results/stab-r4`. Adequação do autor R4: PASS; T8 e o Verifier transversal permanecem necessários.

## R5 / T3 — dados existentes incompatíveis

Sem mudança de produto. `tests/service.test.js:106` ensaia dois bancos reais: versão futura e coluna obrigatória ausente. A abertura exige INVALID_INPUT e, após a falha, uma nova conexão SQLite compara todas as salas, mensagens e user_version aos valores anteriores (`:119`–`:124`). STAB-49/55 não permite exclusão automática ou confirmação falsa. Full/co-localizado PASS, **90/90 = 50 + 40**, zero fail/skip/cancelled/todo, logs `test-results/stab-r5`. As duas variantes afirmam os dados e a causa, não apenas ausência de crash. Nenhuma asserção antiga alterada. Cada preparação/asserção pertence a essa preservação; o cleanup remove só a pasta criada pelo próprio teste. Autor PASS; parecer STAB pendente.

## R6 / T3 — falha de abertura no bootstrap

STAB-49: `tests/bootstrap.test.js:34` fornece um diretório onde se exige arquivo SQLite. `:38` exige BOOTSTRAP_FAILED e causa ERR_SQLITE_ERROR; `:39` e `:43` exigem contagens SIGINT/SIGTERM originais; `:41` exige HTTP200 na nova execução e `:42` listener fechado após close. O servidor existente passa sem mudança de produto. As preparações/asserções pertencem somente a essa fronteira. Build/co-localizado PASS, **91/91 = 50 + 41**, zero fail/skip/cancelled/todo, Vite e smoke desktop source PASS em `test-results/stab-r6`. Nenhum teste antigo alterado; autor PASS, parecer independente pendente.

## R7 / T6 — autoria legada sem identidade

STAB-61/A10: `scripts/desktop-smoke.mjs:269` entrega dois eventos de contrato válidos na sala/contexto vigentes, mesmo nome e authorId/operationId null. `:274` exige cada artigo sem grouped e `:275` a autoria visível em ambos. Complementa convidados homônimos com IDs distintos (`:268`) e a migração de 10000 registros (`tests/service.test.js:92`), sem adivinhar identidade histórica. Produto existente passa; nenhuma asserção anterior alterada. Reverso: fixture e duas comparações pertencem somente a esse requisito.

**91/91**, zero fail/skip/cancelled/todo, Vite e smoke interno PASS. O externo inicial passou as asserções funcionais, mas retornou exit1 no teardown (`Test cleanup timed out`), portanto não foi aprovação. Inspeção de processos não encontrou remanescente; a repetição integral passou com teardown, sem mudança de prazo ou teste (`test-results/stab-r7/smoke-external-retry.log`). Causa do incidente de teardown não estabelecida; logs inicial e repetido preservados. A matriz final volta a exercitar esse caminho. Autor PASS para agrupamento; não declarar falha intermitente corrigida por uma repetição.

## R8 / T1 — F1, nomes recebidos dentro do limite normalizado

STAB-40, vocabulário de1–32 unidades após trim. `tests/protocol.test.js:41` acrescenta nomes de sala/membro/autor recebidos e join/create-room: branco17 e33 úteis são recusados;1/32 úteis e32 com padding são aceitos sem transformar o payload. Tipos null/array continuam recusados. A comparação do servidor falhou antes do fix por Missing expected exception (`stab-f1/before.log`). Predicado nominal compartilhado tem cinco usos efetivos, sem coagir tipos ou alterar IDs/texto. Co-localizado/Full92/92 e Vite PASS, zero fail/skip/cancelled/todo. Sem mudança em asserções históricas. Reverso: fixture e comparações pertencem somente aos campos nominais de C40. F1 corrigida pelo autor, provas/sensor finais pendentes.

## R9 / T3 — F2, diagnóstico de recusas do protocolo

STAB-67: `tests/service.test.js:312` usa WS real e captura os diagnósticos de candidato com índice7.25 (validação) e tentativa alheia (estado). `:319` reproduziu0 versus1 antes do fix; `:323` compara objetos completos: código INVALID_EVENT, fase protocol/signal, requestId exato, versão/runtime/causa sanitizada e ausência de extras; `:324` exclui sentinelas de mídia/token/SDP. O proprietário error registra uma vez cada resposta; catches fornecem a causa real, sem duplicação. Campos/códigos/fases do fio permanecem iguais; na falha de escrita o diagnóstico usa a fase da resposta message com PERSISTENCE_FAILED e causa SQLite.

Durante a redação, o teste novo esperava cause ProtocolError, mas essa classe herda name=Error. O valor foi corrigido para Error antes do fechamento, mantendo igualdade estrita de todos os campos; C67 exige categoria/fase/correlação, não rebatizar a classe. Não se alterou produção para fabricar um nome. O pré-fix continua reprovando0 versus1 antes desse campo. Nenhuma asserção histórica mudou. Co-localizado/Full93/93 e Vite PASS, zero fail/skip/cancelled/todo em stab-f2. Reverso: fixtures/comparações pertencem somente às recusas/privacidade de C67. F2 corrigida pelo autor, fechamento por provas/sensor ainda pendente.

## R10 / T2 — F3, validade individual de candidatos

STAB-43/A7: `tests/rtc.test.js:127` usa o peer controlado pronto para impedir que a negociação esvazie a fila. Candidatos recebidos em4321 e9321ms são exigidos antes da idade14999 e removidos individualmente em15000, enquanto peer/microfone/admissão permanecem íntegros. A descrição posterior recebe exatamente o terceiro candidato fresco, nunca os expirados; cleanup zera timers. A fixture é sintética e isola a regra de fila, sem alegar um estado físico de WebRTC. Todas as comparações novas pertencem a essa validade/entrega; o código existente passa sem alteração. RTC/Full94/94 e Vite PASS, zero fail/skip/cancelled/todo em stab-f3. Nenhuma asserção antiga alterada. F3 reforçada, script final/sensor pendentes.

## R11 / T3 — F4, página inteira ordenada e isolada

STAB-53: o teste legado em `tests/service.test.js:92` mantém todos os controles antigos, incluindo count10000/plano sem TEMP B-TREE. A nova igualdade compara os200 IDs/salas/textos/timestamps (todos timestamp1), não somente as extremidades. Depois das asserções originais, uma mensagem real é persistida em café; seu histórico deve ser exatamente o recibo e a página de geral permanece igual à original. Isso observa a ausência em outra sala com dados reais no banco, sem alterar a expectativa histórica10000. Sem mudança de produto. Co-localizado/Full94/94 e Vite PASS, zero fail/skip/cancelled/todo em stab-f4. Cada preparação/asserção extra pertence à ordenação/isolamento de C53; F4 reforçada, reexecução final pendente.
