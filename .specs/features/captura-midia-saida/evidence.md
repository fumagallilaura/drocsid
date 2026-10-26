# Evidência atual MEDIA, após correções da rodada 1

**Rodada independente 2: 80/80 Node, 16/16 gates e sensor 6/6 por asserção aprovados.** A candidata anterior teve bloqueio de Device Guard; ele não se repetiu no Build independente, sem mudança de política/launcher. A [rodada 2](validation-round2.md) preserva FAIL global: 28 ACs automáticos integrais, quatro parciais pela conjunção parar+sair e dois físicos não executados. O autor acrescentou R6 para essa conjunção, pendente de reverificação; com os cinco novos testes STAB, Quick atual é 86/86. T9 está pendente por indisponibilidade explícita do usuário; nenhum MEDIA recebe Verified pelo autor.

Código de produto corrigido em `01f3e1c`; testes/harness consolidados em `e4c9efe`. Gates em 25/10 e rodada independente encerrada em 26/10/2026, versão 0.1.1, protocolo 2, Node 24.21.0, Electron 45.0.0. A [evidência inicial](evidence-initial.md) é histórica, vinculada a `018019c`/`f44d268`: sua alegação de cobertura integral foi corrigida pelo [Verifier da rodada 1](validation-round1.md). Ela não identifica a candidata atual.

## Candidata e resultado dos gates

- Portátil atual: `C:/Code/conversa/release-windows/Conversa-0.1.1-Windows.exe`.
- SHA-256: `efa7fb4e86d0b8d09a2744fba41908fd86b915decafc121e0ec14f17edf9092e`.
- Win-unpacked: `C:/Code/conversa/.packaging/builds/1792964005781-63e531a1-a8f2-4e41-b51a-db408c9c0184/win-unpacked/Conversa.exe`.
- Manifesto/logs/ledger: `test-results/media-verifier-round2/build.json`, `gates.json` e logs por gate. Resultados locais ignorados pelo Git. Hash, módulos do ASAR e dist comparados aos bytes atuais pelo checker de pacote. Nenhuma mudança de produto em STAB R1 ou MEDIA R6.

| Gate | Resultado atual |
| --- | --- |
| Quick / build | PASS, 80/80 Node, zero fail/skip/cancelled/todo; Vite aprovado |
| Source smoke interno / externo | PASS, incluindo teclado nas duas pendências, tela nova antes de ack antigo e reprodução silenciada sob replay |
| Source perfil / captura | PASS, consentimento visível, CANCELLED correlacionado e guardas anteriores preservadas |
| Source ciclo da janela | PASS, inventário adquirido de mic+vídeo+áudio encerrado em <=1 s em reload/disconnect/Root.unmount/fechamento nativo |
| Source startup sem manifesto | PASS, oito amostras na abertura e oito após reload, contadores pré-App zero; não equivale a A7 |
| Dist Windows / checker do pacote | PASS, bytes e hash acima |
| Win-unpacked perfil | PASS no Build independente; ocorrência anterior de Device Guard preservada nos logs do autor |
| Win-unpacked ciclo / smoke interno / smoke externo / startup | PASS no Build independente, com asserções e snapshots conferidos |
| Wrapper portátil real | PASS, renderer/preload/serviço abertos, uma mensagem persistida e zero mídia inicial; execução separada do gate após a falha unpacked |

Os logs históricos `test-results/media-t8-revised/packaged-profile*.log` registram o bloqueio da candidata `fc7c344e...f993`; o diagnóstico não estabelece a regra da política. A nova execução independente usou o launcher normal e passou os quatro gates unpacked antes não executados, além de perfil e wrapper separado. Não houve alteração de política nem contorno, e não se afirma que uma política foi corrigida. Builds locais geram portáteis de hashes distintos; isso não transfere evidência física entre candidatas nem aprova publicação/assinatura.

## Rastreabilidade e adequação do autor

As linhas da matriz inicial continuam ancoradas ao código `018019c` e ao seu commit de teste. Os 23 resultados aceitos pela rodada 1 foram preservados; as nove linhas abaixo substituem as conclusões parciais/falha daquela rodada. A avaliação independente atual deve rederivar os 32 resultados automatizáveis em HEAD. As matrizes A/B e reversas C/D de cada correção estão em [execution.md](execution.md).

| MEDIA / conjunção corrigida | Evidência exata no commit indicado, valor esperado e limite |
| --- | --- |
| 01 | `e4c9efe`, `scripts/startup-audio-check.mjs:34`: readyState=loading e calls exatamente microphone=0/display=0/legacy=0 na abertura e reload; oito amostras por fase. Física de 30 s segue T9. |
| 07 | `e4c9efe`, `scripts/desktop-smoke.mjs:189`, `:201`: foco/Enter nas pendências de aquisição e admissão; helper `:65` exige timestamps numéricos e <=1000; `:192` ended em <=1000 da resolução antiga; `:202` captura ended antes de liberar ack. |
| 08 | `08675ff`, `tests/rtc.test.js:199`: requests=1, mic=null, admitted=true e mesmo callId depois de compartilhar; `:200` mic sender null e vídeo publicado; `:201` vídeo live. Não solicita mic novamente. |
| 10 | `319b584`, `scripts/desktop-capture-check.mjs:140`, `:145`: aviso de todos os aplicativos/própria chamada visível em configurações e seletor; grants false/true permanecem exatos. Conteúdo físico não medido. |
| 17 | `01f3e1c`, `tests/rtc.test.js:273`: parada local resolvida em 1000 sem ack; `e4c9efe`, smoke `:375` botão habilitado, `:377` timestamps numéricos, `:378` <=1000; `:384` tela nova live após liberar ack antigo. |
| 23 | `e4c9efe`, `scripts/desktop-lifecycle-check.mjs:63`–`:66`: inventário mic/áudio/vídeo todo live; `:80`: cada ID ended e duração 0..1000; `:83`: playback nativo bloqueado; `:85`: root vazio em unmount. Track de áudio sintética acrescentada só quando o loopback não retorna áudio; nenhum resultado físico inferido. |
| 28 | `08675ff`, `tests/rtc.test.js:290`/`:291`: peer/queue novos, mic live e errors=[] preservados após sinal remoto antigo; `tests/session.test.js:216`: sinal local antigo não encaminhado, `:217`: novo chega uma vez. `01f3e1c`, session `:198`: stop antigo não desconecta tela nova na mesma chamada; `:208`: stop atual ainda encerra transporte em 8 s. |
| 29 | `e4c9efe`, smoke `:273` injeta ack/signal antigos, `:275` exige native muted=true e Ativar áudio; `:204` native muted e zero admissão depois do ack antigo fora da chamada. |
| 31 | `319b584`, `scripts/desktop-capture-check.mjs:62`: resultado inteiro cancelled/CANCELLED/capture-selection/requestId atual; `:63`: chave exata do finish. TIMEOUT/MEDIA_FAILED/INVALID_EVENT continuam distintos no mesmo checker. |

MEDIA-02–06/09/11–16/18–22/24–27/30/32: valores e limites aceitos pelo [Verifier da rodada 1](validation-round1.md#spec-anchored-acceptance-criteria), com asserções preservadas e reexecutadas no source atual. MEDIA-24/25 receberam adicionalmente tipos de resposta explícitos em `ce848a7`, `tests/service.test.js:149`/`:182`/`:184`; ack/error correlacionados chegam à asserção antes de esperar presença. O autor não conta timeout do helper como morte de mutante; o novo sensor é responsabilidade do Verifier.

## Commits e integridade

| Entrega | Commit |
| --- | --- |
| T1 / T2 / T3 | `be83426` / `ca2ba07` / `2006457` |
| T4 / T5 / T6 / T7 | `fdf6066` / `325c340` / `5a8f657` / `018019c` |
| T8 inicial / Verifier rodada 1 | `f44d268` / relatório preservado em `335fe89` |
| R1, parada local e prazo antigo | `01f3e1c` |
| R2, valor das respostas terminais | `ce848a7` |
| R3, tela sem mic e sinal antigo | `08675ff` |
| R4, cancelamento/consentimento | `319b584` |
| R5, fronteiras UI/ciclo | `e4c9efe` |
| Roteiro T9, sem execução física | `d5843c4` |

Comparação AST com `38062db`: **50 testes históricos preservados, 30 novos**, 216 asserções históricas, 212 idênticas e quatro exclusivamente v1→v2, como já justificado no registro T6. Comparação com `f44d268`: **75 testes preservados e cinco novos, todas as 388 asserções anteriores intactas**. Nenhuma remoção, skip ou enfraquecimento. Script local: `test-results/check-test-integrity.mjs [baseline]`. Os **113 textos de ACs** permanecem idênticos a `38062db`; prefixo de STATE/Decisions SHA-256 `f4f06a1a44eecf50dec6e134e20447952ea673ca9c78c366421a027ac44c9a57`.

## Limites e próximo gate

Revisão independente 2 preservada em [validation-round2.md](validation-round2.md): Build e seis mutações válidas concluídos, scratch removido e porcelain real antes/depois idêntico. Falta reverificar R6 em [validation.md](validation.md); o gate global validate_state permanece fechado por FAIL. [T9 física](uat.md) segue pendente: em 26/10 o usuário confirmou que os recursos não estão disponíveis agora. A causa do ruído permanece desconhecida.

STAB de mensagens/encerramento continua separado e sem certificação integral. D6–D11 são estáticos/cache histórico; U1 somente UI/processo; cache sem vínculo ao renderer ativo e quatro dúvidas de runtime abertas. Nenhuma investigação Discord, chamada ou convite foi repetido. Texto encerra chamada; Silenciar áudio só reprodução; câmera negada, SFU não aprovado, sem TypeScript. Contas/grupos privados/TURN autenticado permanecem bloqueadores de publicação futura.
