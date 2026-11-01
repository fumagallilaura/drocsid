# TypeScript Test Integrity

Baseline da T11: `3d05180`,147 casos Node e986 asserções dentro desses casos. A suíte atual tem149 casos: acrescenta verificação de metadados do pacote e inventário de fontes/configurações TypeScript. Nenhum caso anterior foi removido, ignorado ou renomeado.

## Assertion Comparison

A comparação de AST preserva946/986 asserções após retirar apenas sintaxe de tipos e chamadas `required`. Esse helper acrescenta uma asserção de existência e devolve o mesmo valor. Não substitui valores esperados nem permite continuar quando o valor falta.

As40 diferenças restantes mantêm os resultados exigidos:

| Count | Adaptation | Preserved outcome |
| --- | --- | --- |
|31|Guarda `isRecord` antes de ler campos de erro desconhecido; uma também usa a porta validada do listener.|Mesmos códigos, fases, contexto, expiração e causas. Não exige uma classe de implementação específica.|
|2|Captura observada recebe alias `selected` após exigir sua existência.|Áudio false e altura ideal720, com resultado tardio liberado.|
|2|Socket real recebe alias após validar URL; ticket não pode faltar.|Token durável ausente da URL e ticket aleatório43 caracteres.|
|1|`testPort` valida endereço do listener antes da requisição de saúde.|Mesma resposta HTTP200 no servidor reiniciado.|
|1|Callback de fechamento rejeita erro e resolve somente sucesso.|Falha desktop ainda fecha listener; ECONNREFUSED posterior.|
|1|Callback de falha de processo valida os campos antes das três asserções originais.|Exit1, killed false e diagnóstico ENOENT/launch.|
|1|Busca por identidade de track usa `some(track => track === sender.track)`.|Nenhum sender aberto retém track da captura revertida; tracks são objetos, não NaN.|
|1|Compara uma cópia de `signals` antes da entrega seguinte.|Array vazio na chamada antiga e um sinal na chamada nova, sem narrowing estático permanente para never[].|

Relatório por caso/expressão: `test-results/merge-t11-test-integrity.json`. Comparação reproduzível nesta árvore: `node test-results/check-merge-typed-integrity.mjs 3d05180`. O script de comparação é evidência local auxiliar; os testes e tipos versionados continuam os gates do projeto. Os113 textos de ACs BUILD/STAB/MEDIA e o prefixo Decisions de STATE foram comparados byte a byte e permanecem intactos.

## Fixtures and Historical Tools

Os doubles RTC têm portas estruturais verificadas contra Call e são compartilhados somente entre o teste e a sondagem RTC histórica. Não simulam classes completas do browser nem usam casts para ocultar membros faltantes. O registro de IPC usa o evento nativo com Proxy e retém o evento original para reenvio de documento antigo. O relógio nativo preserva a assinatura e encaminha os argumentos ao timer original.

A conversão encontrou uma suposição errada na fixture: o handshake `capture-document` não possui chave de operação. Ele passa ao handler original; os controles de captura continuam observados e validados. Exceção da fixture encerra Electron com1, evitando bloqueio por diálogo nativo. O checker completo aprovou inventário, IPC antigo, cancelamento e fronteira exata60s após essa correção.

Sete ferramentas históricas receberam fontes `.mts` e emissão ignorada `.mjs`. As que dependem do serviço usam a fixture PostgreSQL isolada; as asserções que reproduzem defeitos continuam sendo sondagens históricas, sem executar o gerador nem reaprovar HEAD. Relatórios, JSONs, bundle e fonte formatada históricos não foram regenerados. Scripts de revisão não são gates de saúde.
