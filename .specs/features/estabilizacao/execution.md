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
