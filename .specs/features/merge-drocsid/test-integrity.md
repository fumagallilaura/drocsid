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

## Release Integrity, T12

A comparação contra4a77a51 encontra todos os149 casos anteriores e suas1008 asserções idênticas, sem adaptação adicional de valores. Os três novos casos cobrem metadados Drocsid, ausência de backend/workspaces paralelos e configuração segura do Compose, além da recusa de auditoria alta/crítica/incompleta. A suíte atual contém152 casos; o resultado executado fica na matriz de release, não é inferido desta contagem. Os113 ACs históricos e Decisions continuam intactos.

`apps/*` saiu do produto conforme T12: eram três aplicativos upstream não executados pelos comandos do Conversa, com servidor e contratos independentes. O teste desse servidor duplicado acompanha a remoção do proprietário; não substitui nem remove os149 testes mantidos da base integrada. Todo o código upstream permanece acessível no ancestral94d9b9a. Não se migrou nem removeu dado de usuário; caches ignorados de dependências não foram apagados.

Cinco sensores T12 detectados por AssertionError em cópias isoladas: identidade desatualizada no ASAR, SHA incorreto do portátil, falta da verificação de import dinâmico, auditoria aceitando alta/crítica e publicação PostgreSQL fora de loopback. Fontes, emitidos, ASAR e EXE originais byte-idênticos antes/depois. Relatórios locais: `test-results/merge-t12-test-integrity.json`, `merge-t12-sensors.json` e logs por sensor.

A repetição das provas detectou destino salvo antigo após limpar o campo do servidor. O checker de perfil mantém todas as asserções anteriores e acrescenta somente a captura da próxima requisição de configuração e comparação exata de origem; a nova asserção reproduziu o defeito antes da correção. A leitura do campo no submit resolveu o cenário source/empacotado. Controle limpo e mutante de estado antigo foram discriminados pela origem, sem usar falha de startup como evidência. Dois sensores UI de T10 tinham justamente esse erro de preparação; os logs antigos permanecem históricos, e foram substituídos por ensaios com plugin React e falha específica da regra. Proveniência completa em evidence.md.

## Verifier Fix Integrity

O parecer independente encontrou sete lacunas de prova. Nenhum caso Node foi removido:152 continuam passando, incluindo os149 anteriores. Contra4a77a51,1007/1008 asserções anteriores são idênticas após erasure; a única diferença remove a aceitação de MERGE_HEAD e exige que o upstream seja ancestral de HEAD, fortalecendo MERGE-01. As demais mudanças só acrescentam cenários/asserts: expiração absoluta com atividade recente/socket ativo, recibo exato após reabertura e perfis legados0/1 com recibos.113 ACs e Decisions permanecem intactos.

Os agregados de C7/C8/C11/C19/C20 reutilizam25 casos existentes e exigem seus nomes/contagens/sucesso, sem um segundo conjunto de regras simuladas. A ausência de um caso obrigatório foi discriminada por AssertionError apesar de os demais testes selecionados passarem. Os outros sensores fecham o falso positivo de ancestralidade e perda somente de recibo atual. Evidência: `test-results/merge-verifier-fix-test-integrity.json` e `verifier-fix-sensors.json`.
