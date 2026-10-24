# Evidência incremental da estabilização

Esta é a revisão de adequação do autor por tarefa. A validação independente final é separada. Nenhum teste usa o exit zero das sondagens históricas como aprovação.

## T1 — Contrato

Gate: `npm.cmd test` (7/7, zero skips) e `npm.cmd run build` aprovados. Os três testes anteriores permanecem. Antes da implementação, o novo teste reprovou por módulo inexistente. A expectativa de um escalar JSON foi corrigida durante a redação: número é estrutura inválida (INVALID_EVENT), não objeto de protocolo sem versão; nenhuma asserção foi relaxada.

| AC / critério da tarefa | Evidência e asserção | Resultado da spec | Coberto nesta unidade? |
| --- | --- | --- | --- |
| STAB-40/41, versão e estrutura | tests/protocol.test.js:14, `rejects(() => decode({ ...event('join'), v: 2 }), 'INCOMPATIBLE_PROTOCOL')`; :13, `rejects(() => parseClientEvent('{'), 'INVALID_EVENT')` | Categorias distintas | Sim; integração pendente |
| STAB-27, conteúdo | tests/protocol.test.js:31, `assert.equal(decode(...).text, text)`; :32, `rejects(..., 'INVALID_INPUT')` | Aceitar 1/2000, recusar vazio/2001 | Sim; persistência pendente |
| STAB-40, dados de servidor | tests/protocol.test.js:38, `rejects(() => parseServerEvent(...), 'INVALID_EVENT')` | Estrutura inválida não chega à UI | Sim; transporte pendente |
| STAB-49/50, configuração | tests/protocol.test.js:44, `assert.deepEqual(readIceServers(ice), ice)`; :47, `assert.equal(parsePort(value), Number(value))`; :48, `rejects(() => parsePort(value), 'INVALID_INPUT')` | ICE e PORT válidos/limites | Sim; bootstrap pendente |

Mapeamento reverso: as asserções das linhas 11–26 pertencem a STAB-40/41; 31–32 a STAB-27; 36–38 a STAB-40; 44–51 a STAB-49/50 e aos tetos A8. As quatro funções de teste não cobrem comportamento de bibliotecas ou requisitos externos. Litmus: aceitar versão 2, array como evento, texto de 2001 ou porta 65536 faria as asserções falharem. Padrão node:test/assert do repositório preservado. Adequação da unidade: PASS; não é validação integrada.
