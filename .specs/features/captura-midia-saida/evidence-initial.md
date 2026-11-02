# Evidência automatizada da candidata Windows

**Resultado do autor: 75/75 testes Node e 14/14 gates Build aprovados.** T1–T8 executadas; a revisão independente ainda precisa confirmar a adequação e executar o sensor. **MEDIA não está aprovada integralmente.** T9/MEDIA-33/34 permanecem sem execução física, com disponibilidade de dois PCs e operadores não confirmada. STAB de mensagens e encerramento não recebe certificação por este relatório.

Data: 2026-10-25. Código avaliado: **`018019c`**, após T7. O commit de T8 altera somente documentos/status. Versão 0.1.1, protocolo 2, Node 24.21.0 e Electron 45.0.0. A versão 0.1.1 sozinha não identifica esta candidata.

## Candidata e gates

- Portátil: `C:/Code/conversa/release-windows/Conversa-0.1.1-Windows.exe`.
- SHA-256: **`fe9ee1feab3765c210a8033a8b3b70789d22fcf7525af792b37d2b97a9f2202a`**.
- Win-unpacked: `C:/Code/conversa/.packaging/builds/1792961293078-18f72252-d81e-464f-a632-0ac06f8d906d/win-unpacked/Conversa.exe`.
- Manifesto identificado: `test-results/media-t8/build.json`; logs/exit codes: `test-results/media-t8/gates.json`. Resultados locais ignorados pelo Git; este relatório guarda a identidade e o resultado. O checker compara SHA-256, módulos do ASAR e cada arquivo de dist com os bytes do disco.

| Gate | Resultado |
| --- | --- |
| `npm.cmd test` | 75 PASS, 0 fail/skipped/cancelled/todo |
| `npm.cmd run build` | PASS |
| Smoke source/interno | PASS, RTP bidirecional, vídeo recebido, parada, controles e mensagens |
| Perfil source | PASS, outra porta, instância única, câmera/subframe negados |
| Captura source/fixture do entrypoint real | PASS, dez solicitações nativas com gesto, callback único, cancelamento, timeout e documento antigo |
| Diagnóstico source com manifesto inexistente | PASS, 8 amostras, zero elementos de áudio/vídeo e reprodução audível observada |
| Smoke source/servidor externo | PASS, inclusive terceiro participante entrando em tela ativa |
| `npm.cmd run dist:win` | PASS, portátil local atual |
| `node scripts/check-package.mjs` | PASS, hash acima e módulos/bundle atuais |
| Perfil win-unpacked | PASS |
| Smoke win-unpacked/interno | PASS |
| Smoke win-unpacked/externo | PASS |
| Diagnóstico win-unpacked | PASS, entrada bloqueada |
| `node scripts/portable-startup-check.mjs` | PASS, wrapper real, entrada/envio persistido e encerramento |

Os comandos/variáveis estão no plano, seção Gate Check Commands. Checkers com captura executaram sequencialmente, com perfis/bancos temporários e teardown próprio. O diagnóstico de entrada observa cerca de seis segundos; não é o ensaio físico de três ciclos de 30 s. Smokes de mídia usam microfone sintético e saída física silenciada.

Além da matriz, a Session/Call/protocolo **v1 reais de `325c340`** foram carregados em cópias isoladas sob TEMP contra o servidor v2 atual: INCOMPATIBLE_PROTOCOL, zero WS e zero aquisição. `test-results/protocol-v1-client-check.mjs` preserva a checagem local. Não foi incorporado suporte v1 ao produto.

## Integridade

Comparação AST dos testes com `38062db`: **50 testes históricos preservados, 25 novos**. Das **216 expressões de asserção históricas**, 212 permanecem iguais. Quatro acompanham exclusivamente a mudança explícita v1→v2: expectativa de bootstrap, comparação da versão atual no parser, versão rejeitada e hello válido. As categorias/valores de resultado continuam explícitos; os testes novos exigem v2 e recusam v1. Nenhuma asserção foi tornada menos específica; nenhum teste foi removido, ignorado ou desabilitado. Instrumentação de clock/serialização foi adaptada mantendo resultados. Checagem local: `test-results/check-test-integrity.mjs`.

Os **113 textos de ACs BUILD/STAB/MEDIA** foram comparados com `38062db` e estão inalterados. O prefixo de STATE anterior a Handoff, incluindo Decisions, mantém SHA-256 `f4f06a1a44eecf50dec6e134e20447952ea673ca9c78c366421a027ac44c9a57`. A reconciliação de STAB/A14 altera a premissa/vocabulário de versão e preserva sua origem histórica, sem modificar AC para acomodar teste.

## Resultados por critério

Esta tabela é a avaliação automatizada **do autor**, no código `018019c`, antes do Verifier. Cada resultado fica limitado ao mecanismo observado. Liberação física, fala percebida e qualidade não são inferidas de tracks sintéticas ou RTP.

| MEDIA | Evidência exata e expressão | Resultado observado / limite |
| --- | --- | --- |
| 01 | `tests/rtc.test.js:46` `assert.equal(requests,0)`; `scripts/desktop-smoke.mjs:348` zero elementos e isAudioMuted true após reload | Sem captura inicial no controlador; entrada/reload bloqueados no desktop. A7 é separado. |
| 02 | `tests/rtc.test.js:57` requests 1; `:76` requests 2 em ativação simultânea; `:246` mesma promessa de tela e requests 1 | Aquisição exclusiva de cada tipo na tentativa. |
| 03 | `tests/rtc.test.js:161` `ended(old)` e microfone novo preservado; helper `:41` exige every readyState ended; `:85` tela tardia ended | Ambas as ordens de permissão e tela antiga liberadas, sem incorporar ao contexto novo. |
| 04 | `tests/rtc.test.js:51` rejeição após close/requests 2; `:184` captures.length 0 com ações em controlador fechado | APIs não chamadas depois do fechamento. |
| 05 | `tests/rtc.test.js:138` admitted false/peers.size 0 enquanto ack está retido; `tests/session.test.js:133` INVALID_EVENT para ack divergente | Provisório não publicado; admissão confere contexto. |
| 06 | `tests/rtc.test.js:67` rejeição por CALL_FULL/RATE_LIMITED/TIMEOUT/INVALID_EVENT; `:68` ended/inativo; `:170` TIMEOUT real/fase/contexto e `:174` ended | Qualquer recusa ou 8 s de admissão libera provisório. |
| 07 | `scripts/desktop-smoke.mjs:175` foco/Enter em Cancelar entrada; `:177` tracks tardias ended; `tests/rtc.test.js:140` estado pending false sem esperar ack | Ação acessível e término local; estados de aquisição/admissão usam o mesmo pending. |
| 08 | `tests/rtc.test.js:59` admitted true/microphone null; `:195` requests 1/sender mic null; `:199` sender recebe mic só após ação | Escuta sem nova aquisição automática; tela mantém a mesma admissão. |
| 09 | `tests/desktop-policy.test.js:46` outra chave false; `scripts/desktop-capture-check.mjs:102` callback 0 após chave alheia; `:105` fonte inválida INVALID_EVENT | Seleção pertence à operação/pedido inventariado. |
| 10 | `scripts/desktop-capture-check.mjs:140` deepEqual `{audioRequested:audio,audio:audio?'loopback':null,video:true}` nas duas opções; `tests/rtc.test.js:249` áudio sem consentimento ended/sender null | Política de concessão e envio. Aviso de áudio global no App; conteúdo real em T9. |
| 11 | `tests/desktop-policy.test.js:13` câmera false; `:25` IPC subframe false; `:34` origem alheia false; perfil real exige NotAllowedError | Câmera/frame/origem alheios negados. Não equivale a autenticação. |
| 12 | `scripts/desktop-capture-check.mjs:39`, `:49`, `:60` callbacks/resultados/finished/deliveries exatos; `:144` todos calls===1 | Escolha/cancelamento/reload/close/timeout resolvem uma vez; handler extra não substitui o original. |
| 13 | `scripts/desktop-capture-check.mjs:89` calls 0 em 59999; `:93` failed/TIMEOUT; `:105` failed/INVALID_EVENT; `:129` failed/MEDIA_FAILED | Operação termina sem fonte concedida nos caminhos negativos. |
| 14 | `tests/rtc.test.js:217` todas tracks ended após falha parcial; `:227` TIMEOUT de publicação; `:228` publishing em 7999; `:229` ended/idle em 8000 | Prazo absoluto de 8 s incluindo confirmação, compensação local imediata. |
| 15 | `tests/rtc.test.js:219` cada peer fechado ou sender sem captura após resolução tardia | Inventário inclui saudável, falho, suspenso e tardio. |
| 16 | `tests/rtc.test.js:103` `ended(display)` após onended; `scripts/desktop-smoke.mjs:323` every track ended após parada | Tela e áudio do sistema terminam localmente; ensaio físico separado. |
| 17 | `tests/rtc.test.js:237` ended/display null; `:239` peer fechado e admissão preservada com stop repetido; `:262` ended/idle mesmo com notificação falha | Controles e estado local convergem; deadline de limpeza não é renovado. |
| 18 | `tests/service.test.js:179` stopped.sharing false/inCall true; `scripts/desktop-smoke.mjs:326` Tela de Ana count 0 | Serviço confirma e participante deixa de apresentar a tela; smoke saudável dentro do timeout do harness. |
| 19 | `tests/rtc.test.js:220` sender mic saudável conserva track; `:221` admitido/mic live; `:239` muted true preservado | Falha de tela fecha só peer incapaz de cessar envio; voz saudável preservada no modelo. Física em T9. |
| 20 | `scripts/desktop-smoke.mjs:288` Escolhendo visível; `:292` Publicando visível/AO VIVO count 0; `:295`, `:296` observador fora da chamada sem vídeo/AO VIVO | Pendência/publicação/mídia pronta separadas. |
| 21 | `tests/rtc.test.js:140` oldMic ended/pending false com saída sem ack; `:203` ended(mic)/peers.size 0; `scripts/desktop-smoke.mjs:338` inventário completo ended/PCs closed | Término local não espera rede. |
| 22 | `scripts/desktop-smoke.mjs:336` sala geral ainda visível; `:337` playback bloqueado; `:338` tracks ended/PCs closed antes de liberar joined | Texto encerra a chamada antes da confirmação da sala nova. |
| 23 | `scripts/desktop-smoke.mjs:347`, `:354` IDs de tracks reportados ended na recarga/desconexão; `scripts/desktop-capture-check.mjs:39`, `:49` callback único em reload/close | Limpeza no controlador/documento; os checkers não certificam indicador físico do Windows. |
| 24 | `tests/service.test.js:144` terminal com contexto original; `:154` saída antiga inCall false/geração 1; `:160` nova chamada intacta | Idempotência e tentativa posterior preservadas. |
| 25 | `tests/service.test.js:179` stop false/inCall true e `:181` leave false/sharing false/geração 1 após cotas de mensagem/mídia/sinal | Terminais fora da cota. |
| 26 | `tests/service.test.js:183` sharing false e `performance.now()-started<1000`; `:186` seis admitidos após substituição | Vaga liberada e confirmação correlacionada dentro de 1 s no teste local. |
| 27 | `tests/service.test.js:120` socket fechado em 60000 alinhado; `:198` aberto em 59999 após pong deslocado; `:200` fechado/zero timers em 60000 | Deadline desde o pong real, sem tolerância de outro tick. |
| 28 | `tests/rtc.test.js:147`, `:148`, `:149` contexto/mic/admissão novos preservados; `tests/session.test.js:143` sharing não regride; `scripts/desktop-capture-check.mjs:118`, `:119` IPC antigo recusado/callback novo não alterado | Resultados antigos descartados em Call/Session/host; serviço rejeita geração terminal. |
| 29 | `scripts/desktop-smoke.mjs:238` isAudioMuted true ao silenciar; `:337`, `:348`, `:355` bloqueado em troca/reload/desconexão | Reprodução depende da chamada atual e da opção de saída. |
| 30 | `tests/rtc.test.js:201` muted true/enabled false/readyState live; `scripts/desktop-smoke.mjs:239` mic continua enabled/live ao silenciar apenas saída | Mute não é stop nem deafen. Fala real não transmitida será verificada em T9. |
| 31 | `scripts/desktop-smoke.mjs:188` código/fase/versão; `:189` três IDs técnicos; `:190` geração positiva; `scripts/desktop-capture-check.mjs:93`, `:105`, `:129` categorias distintas | Cancelamento e falha técnica não dependem de texto traduzido. |
| 32 | `scripts/desktop-smoke.mjs:191` chaves exatas; `:192` ausência de MEDIA_PRIVATE_ no diagnóstico inteiro; `tests/service.test.js:219`, `:220` log inteiro sanitizado/exato | Sem títulos, nomes arbitrários de causa, mídia, SDP, ICE, credenciais ou texto de mensagem. |

## Commits e fronteiras

| Tarefa | Commit | Resultado |
| --- | --- | --- |
| T1 | `be83426` | Tentativa/contexto/microfone |
| T2 | `ca2ba07` | Terminal por geração e deadline de participante |
| T3 | `2006457` | Session e ligação da alocadora ao App |
| T4 | `fdf6066` | Operação de tela, filas e compensação |
| T5 | `325c340` | Seleção nativa por chave/documento |
| T6 | `5a8f657` | Protocolo 2 obrigatório e reconciliação STAB/A14 |
| T7 | `018019c` | Controles, playback e diagnóstico |
| T8 | Commit documental que contém este relatório | Consolidação, sem novo código/teste |
| T9 | Não executada | Faltam ensaio e resultado de A7; disponibilidade ainda não confirmada |

As matrizes de adequação e mapeamento reverso de cada tarefa estão em [execution.md](execution.md). A consolidação não adia testes para depois das correções.

## Referência Discord e limites

D1/D2 continuam estáticos/parciais; D3–D5 são documentação. D6–D11 são extratos estáticos com a cobertura e proveniência do [relatório](discord-investigation.md). U1 é observação de UI/processo: voz entrou/saiu, mas câmera/tela estavam indisponíveis. Isso não prova captura, liberação ou sua causa. O cache não foi vinculado ao renderer ativo; Browser não é presumido como engine Windows. As quatro dúvidas permanecem open. Nenhuma investigação, chamada, convite ou mudança de conta Discord foi repetida nesta implementação; registros grandes continuam fora do Git.

Conversa preserva as diferenças deliberadas: trocar texto encerra a chamada; Silenciar áudio só bloqueia reprodução; câmera permanece negada. Não foram adicionados SFU/LiveKit, contas, TURN autenticado ou TypeScript. Contas/grupos privados/TURN autenticado continuam bloqueadores de publicação futura.

**MEDIA-33/34: pendentes, sem Verified.** Recursos exatos: dois PCs Windows na mesma LAN confiável, fones, microfones reais e operadores; portátil/hash acima; três ciclos de 30 s e sessão de 10 minutos com todas as etapas A7. Ruído não foi diagnosticado ou declarado curado. A aprovação BUILD histórica, esta matriz sintética e o portátil local não substituem esse resultado.

## Próxima avaliação

Verifier fresco deve rederivar a cobertura, executar Build e pelo menos seis mutações semânticas isoladas nas categorias do plano. Nenhum sensor foi alegado pelo autor. O resultado independente ficará em validation.md; sem T9 não há PASS integral da feature nem fechamento de validate_state.
