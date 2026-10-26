# Estabilizacao verification

**Verdict**: FAIL. C40 aceita nome de sala fora do limite normalizado e C67 não registra a recusa de protocolo. Duas provas deixam valores exigidos sem asserção suficiente.

**HEAD**: 573491e076203694113126065aa15331206e09ba
**Verifier**: independent sub-agent `/root/stab_independent_verifier` (author != verifier), primeiro Verifier STAB válido.
**Proofs**: `proofs.md` em `573491e`: 87 provas pass e Build pass na entrega recebida; o cabeçalho atual registra 134 pass após separar filtros de comandos, sem mudança de HEAD ou asserções.
**Mutations**: 7 - R01, R02, R03, R04, R05, R06, R07 em `mutations.json`; 7/7 mortas por `ERR_ASSERTION` no sensor isolado. `mutate.py` atual saiu 1 por incompatibilidade Windows, não contado como morte.

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1, Major, C40: nome recebido com zero unidades após trim é aceito. | `spec.md:119` fixa nomes de exibição e de sala em 1–32 unidades após trim; C40 exige recusa de campos fora do limite. `shared/protocol.js:71` só mede a string bruta. A amostra própria `hello.rooms[0].name = ' '.repeat(17)` retornou aceita, com comprimento normalizado 0, quando se esperava `INVALID_EVENT`. `own-examples.log`, exemplo 1, contém `true !== false`. Os predicados de autor e membro em `:73` e `:76` também medem a string bruta; o sensor executado demonstra especificamente `room.name`. Os testes C40 de servidor usam tipo errado/null e não seguram este limite normalizado. | Validar o limite após trim nos campos nominais recebidos abrangidos pelo vocabulário C40 e acrescentar provas dos valores normalizados, mantendo os casos válidos. | `1c1bdbd`, prova do proprietário registrada em execution.md |
| F2, Major, C67: recusa de protocolo no serviço não gera diagnóstico local. | C67 em `spec.md:291` inclui erros de protocolo. `server/service.js:114` responde ao cliente sem chamar `logFailure`. No serviço real isolado, um candidato com `sdpMLineIndex:7.25` recebeu `INVALID_EVENT`, fase `protocol`, requestId `verifier-protocol-741`; a captura de `console.warn` ficou em 0. O sensor falhou na asserção de diagnóstico correlacionado. `tests/service.test.js:155` segura shutdown e `desktop-smoke.mjs:223`/`:301` seguram captura/playback, sem provar esse ramo de protocolo. | Registrar a falha local com código, fase, correlação disponível, versão/ambiente e sem conteúdo recebido. Acrescentar prova no serviço para o ramo de validação, com sentinela de conteúdo sensível. | `0345015`, prova do proprietário registrada em execution.md |
| F3, Major, C43: a prova não distingue validade do candidato de fechamento da negociação. | `tests/rtc.test.js:116`–`:124` enfileira candidatos e avança 15000 ms; então exige peer fechado e fila vazia. `src/rtc.js:123`–`:126` esvazia a fila ao remover o peer, independentemente de `expireCandidates`. Assim, a asserção de fila 0 não segura a validade de cada candidato. A amostra própria de domínio recebida em 4321 ms mantém o peer pronto, observa 1 candidato aos 14999 ms de idade e 0 aos 15000 ms. O código passou nessa amostra. | Acrescentar prova de expiração por idade que mantenha o peer e a fila observáveis sem o timeout de negociação esvaziá-la; afirmar preservação antes do limite e remoção no limite. | `070dd2f`, prova do proprietário registrada em execution.md |
| F4, Major, C53: a prova da página com timestamps iguais não segura toda a ordem. | `tests/service.test.js:100` afirma comprimento 200 e somente os textos das extremidades 9800 e 9999; `:103` verifica plano e total do banco. Uma permutação dos 198 elementos intermediários preservaria essas asserções. C53 exige ordem de inserção estável para os 200 registros. A consulta real em `server/service.js:51` está ordenada; este achado é sobre a força da prova. | Comparar a sequência completa dos 200 identificadores/valores esperados, com timestamps iguais, e manter a verificação de sala. | `9048e70`, prova do proprietário registrada em execution.md |

## Mutation results

Cada snippet final ocorre uma vez no código do diff `63810f4..573491e`. Cada prova estreita passou sem mutação antes de sua aplicação. As falhas abaixo são valores/asserções, sem erro de sintaxe/importação, helper timeout ou watchdog.

| Regression | Resultado mutado contra baseline verde | Asserção que matou |
| --- | --- | --- |
| R01, captura antiga sem stop | Inventário de tracks encerradas: false, esperado true. | `tests/rtc.test.js:48`, helper `:41` |
| R02, recusa de admissão sem compensação | Inventário provisório encerrado: false, esperado true. | `tests/rtc.test.js:68`, helper `:41` |
| R03, rollback da tela sem stop | Inventário do display encerrado: false, esperado true. | `tests/rtc.test.js:92`, helper `:41` |
| R04, envio durante troca de sala | Submissão resolveu; era exigida rejeição `INVALID_EVENT`. | `tests/session.test.js:57` |
| R05, perda do texto/outbox recusado | Outbox 0, esperado 1. | `tests/session.test.js:69` |
| R06, cota esgotada cobrada da saída | Resposta `error`, esperada `ack`, depois de esgotar sinalização. | `tests/service.test.js:63` |
| R07, Upgrade desconhecido sem rejeição/finalização | Bytes HTTP vazios, esperada resposta iniciada por HTTP 404. | `tests/service.test.js:309` |

R06 foi estreitada após a comparação de integridade: o primeiro sensor detectava a cobrança de cota em `sharing:false`; o JSON final cobra a saída `call-leave` contra o orçamento de sinalização esgotado. O sensor final R06 e Quick antes/depois passaram no baseline e falharam somente na mutação. A tabela registra o JSON final.

`mutate.py` da revisão `f465b52756b8` foi executado sem alteração em scratch, inclusive com o JSON final. Exit 1: `AttributeError: module 'signal' has no attribute 'SIGHUP'`, linha 214, antes de aplicar mutações. Não fornece sete mortes da ferramenta. O sensor próprio preservou suas saídas separadamente. O teto 5 do campo Mutations não reduz as sete regressões exigidas por C63.

## Own examples

1. C40: nome de sala formado por 17 espaços, valor não nomeado pela spec/checks. O parser aceitou o nome normalizado vazio. FAIL, F1. A regra vem da frase explícita de `spec.md:119`, não de uma exigência nova de apresentação.
2. C43: candidato recebido no instante 4321 ms, com `sdpMLineIndex:43567`, em fixture de domínio cujo peer permanece pronto. Fila 1 antes da idade de 15000 ms, fila 0 ao atingir a idade, peer preservado. PASS. Esta é uma amostra sintética da regra de validade, sem inferência de rede física.

O sensor adicional C67 também usa serviço/WS reais em loopback e banco `:memory:`. Seus resultados estão no mesmo log, com diagnóstico 0 e resposta correlacionada. Nenhuma prova própria abriu GUI ou chamada real.

## Integrity and limits

Os 68 ACs, seus valores/conjunções e os níveis da Test Coverage Matrix foram confrontados com os arquivos de implementação e as asserções selecionadas. Os achados acima distinguem comportamento incorreto de prova insuficiente. As provas GUI recebidas foram inspecionadas no código, sem reexecutá-las nesta revisão. Os demais critérios não tiveram divergência adicional identificada nesta amostra; isso não certifica cenários físicos ausentes.

Quick em scratch: 91/91 antes e 91/91 após os sete sensores; 91/91 antes e após o refinamento final R06. Os três arquivos de produto foram restaurados byte a byte. O scratch terminou com porcelain vazio. O porcelain **real**, capturado com `git status --porcelain=v1 -z`, foi idêntico antes/depois da janela: SHA-256 `d199d5b08586e9f055fac7769f2c1106ba0591b574142143bb70dcdf4bb6800f`. As escritas permitidas do Verifier ocorreram antes desse snapshot ou após a comparação. O root foi avisado da liberação antes da escrita deste relatório.

Scratch exclusivo `C:/Users/welli/AppData/Local/Temp/conversa-stab-independent-tqj9v5eq/worktree`: caminho absoluto, pai TEMP e prefixo conferidos. Junction `node_modules` removida sem recursão antes de remover o worktree. Worktree e pasta exclusiva removidos; nenhuma remoção em `conversa-test-y4t7mS`. Sem edição de produto/testes reais e sem commit do Verifier.

Logs e fontes descartáveis preservados em `test-results/stab-verifier/` (ignorado): `sensor-summary.json`, `R01`–`R07` baseline/mutant logs, `R06-refined-summary.json`, Quick, `mutate-current-final-json.log`, `own-examples.log`, scripts reproduzíveis, snapshots porcelain e `teardown.json`.

Recursos T9 foram informados indisponíveis: dois PCs Windows na LAN, fones/microfones e duas pessoas. Qualidade física, ruído, eco e áudio real do sistema permanecem sem observação conclusiva. RTP e vídeo decodificado não provam essas propriedades. Nenhuma captura visual vinculante foi fornecida. Autenticação, TURN público e distribuição/publicação continuam fora da certificação.

## Gate

`validate_verification.py estabilizacao --root C:/Code/conversa`, revisão `f465b52756b8`, executado com Python 3.14.0: **exit 1**, 5 erros, 0 avisos. Exigiu as 5 linhas mínimas de mutação configuradas e encontrou 0 em `proofs.md`; também recusou os quatro achados com `Closed` vazio. Saída integral em `test-results/stab-verifier/validate-verification.log`. As sete mortes próprias não foram inventadas como linhas de mutação em `proofs.md`, nem usadas para esconder o exit não zero da ferramenta ou do gate.

## Author fix pass

Os quatro achados do snapshot573491e foram tratados em uma passada, pelos commits indicados em Closed. Relato independente acima preservado. Full94/94 e Vite passaram; candidata/provas/sensor finais precisam ser repetidos após os dois fixes de produto. Nenhum novo Verifier ou nova rodada de julgamento. O fechamento continua sem aprovação enquanto validate_verification não passar; o utilitário de mutação da revisão atual falha no Python Windows por SIGHUP, sem mortes válidas atribuídas a ele.
