# Revisão de coerência documental do Conversa

**Resultado em 2026-10-25:** inconsistências documentais corrigidas, sem alteração de implementação, testes, dependências, configuração ou artefatos. Os 113 textos de critérios BUILD/STAB/MEDIA, seus prazos e estados de rastreabilidade foram preservados. Esta revisão não aprova a implementação da estabilização.

Base conferida no disco: `main`, `7eedac86c3abb69b6bbbc27d0cf02b82fdfebdc1`, sem remoto e com árvore limpa ao iniciar. Último código/testes: `58be3ed`; documentação anterior: `437616d` e `d4e9bdc`. A coordenadora não editou arquivos em paralelo. As referências de achados abaixo com prefixo de commit são imutáveis: `git show <commit>:<arquivo>` recupera as linhas citadas antes das notas desta revisão.

## Achados e correções

| ID | Evidência concreta | Correção e limite |
| --- | --- | --- |
| DOC-01 | `7eedac8:README.md:60` e `:104` determinavam substituir a malha por SFU. `7eedac8:PLANO_PRODUTO.md:45` propunha “avaliar e integrar LiveKit”. A spec STAB exclui essa migração e a autorização atual não a aprova. | README e plano agora tratam SFU/LiveKit como avaliação futura. A etapa atual é estabilizar a tela já existente. Nenhuma tecnologia foi escolhida ou instalada. |
| DOC-02 | `7eedac8:PLANO_PRODUTO.md:15` dizia que mensagens não tinham confirmação/deduplicação. `server/service.js:119` consulta a operação, `:126` persiste e `:128` confirma; `src/session.js:183` fixa operação/sala e `:187` oferece retry explícito. | Corrigida a situação atual e a etapa 4 do plano. Reaproveitar e verificar o contrato existente; preservação no cliente continua limitada à mesma execução e recuperação é manual. Presença de código não certifica todos os STAB de mensagens. |
| DOC-03 | `7eedac8:PLANO_PRODUTO.md:17` apresentava Device Guard como último resultado do binário. `.specs/features/build-confiavel/validation.md:40` inicia a matriz posterior de 12 gates, incluindo win-unpacked e wrapper real. | Separados o bloqueio histórico e o PASS local posterior em `58be3ed`. Assinatura, instalador, outras políticas Windows e publicação continuam pendentes. `artifacts/VALIDACAO.md` permaneceu intocado. |
| DOC-04 | `7eedac8:README.md:110` limitava toda a investigação Discord ao manifesto. `7eedac8:.specs/features/captura-midia-saida/discord-investigation.md:41` já relacionava D6–D11/U1 e `:97` introduzia as dúvidas abertas. | README remete à pesquisa posterior e distingue estática, documentação e UI/processo. Cache histórico sem vínculo ao renderer ativo, hipótese do gate de vídeo e quatro dúvidas open permanecem explícitos. Nenhuma análise REA ou operação Discord foi repetida. |
| DOC-05 | `7eedac8:.specs/features/estabilizacao/design.md:3` atribuía autorização à autonomia; `:42` promovia A1–A14 a padrões adotados. A spec, em `:55` e `:78`, preservava o limite documental original e premissas não confirmadas. | Design/tasks históricos agora registram o avanço T1–T6 e a atribuição de autorização corrigida pela spec, sem apagar commits. STAB/C6 e MEDIA/C7 registram a nova autorização sequencial: revisão primeiro, estabilização pela sessão nova depois. Nenhuma premissa técnica foi promovida a decisão confirmada. |
| DOC-06 | `7eedac8:.specs/features/estabilizacao/tasks.md:7` dizia apenas In Progress; T1–T6 tinham marcas concluídas, T7/T8 abertas, enquanto `spec.md:319` mantinha os 68 Pending. BUILD passou depois em escopo próprio; MEDIA tem nove tarefas ainda Draft. | Adicionados contexto histórico, commits T1–T6 e regra de reconciliação. Marcas antigas e medições ficam preservadas, sem equivaler a Verified. BUILD pode fornecer evidência reutilizável, mas não fecha integralmente T7/T8 ou os 68 STAB. Não executar dois planos concorrentes de tela. |
| DOC-07 | `7eedac8:review/REVISAO_COMPLETA.md:9` dizia que a pasta não tinha Git; `review/summary.json:12` registrava três testes sem identificar a referência. A versão 0.1.1 também identifica o código posterior, tornando a versão insuficiente para distinguir os ensaios. | Nota datada antes do corpo original do relatório, preservado byte a byte, e metadados aditivos `historicalContext` no resumo. Todos os campos de medição antigos conservam seus valores. Referências `file:line` do corpo pertencem a `63810f4`; os links de código servem para navegação. Não reexecutar o gerador histórico como gate de saúde do HEAD. |
| DOC-08 | `7eedac8:.specs/features/captura-midia-saida/design.md:113` atribuía `INVALID_EVENT` à fonte inválida; a tabela em `:182` agrupava inventário falho e fonte inválida sob `MEDIA_FAILED`. T5 já discriminava ambas as categorias. | Tabela separada: inventário falho usa `MEDIA_FAILED`; fonte inválida usa `INVALID_EVENT`, sem concessão. Nenhum critério, prazo ou código de produção foi alterado. |
| DOC-09 | `7eedac8:.specs/features/captura-midia-saida/tasks.md:153` adiava a ligação da alocadora ao App para T7, mas T6, em `:217`, exigia todos os produtores/consumidores ligados antes de ativar v2. O design já exigia geração por conexão; `src/rtc.js:12` mostra contador por instância e `src/main.jsx:132` é o ponto de construção de Call. | A ligação mínima App/Session/Call já prevista foi antecipada para T3, com teste integrado no mesmo commit futuro. T7 preserva essa ligação ao integrar os controles. Dependências e nove tarefas não mudam; nenhum mecanismo foi implementado nesta revisão. |
| DOC-10 | `7eedac8:README.md:45` orientava hospedar pela internet e configurar TURN, apesar do aviso de protótipo convidado em `:58`. `server/service.js:59` entrega a configuração ICE sem autenticação. | Instrução passou a ensaio restrito de confiança; contas, grupos privados e TURN autenticado ficam explícitos como bloqueadores de publicação futura. O exemplo ICE não autoriza uso de segredo de produção. |

O [README](../README.md) e o [plano](../PLANO_PRODUTO.md) agora distinguem capacidades implementadas, evidência local e propostas de produto. A [preparação TypeScript](migracao-typescript.md) mantém o inventário confirmado de 37 fontes próprias, sem iniciar a migração. [STATE](../.specs/STATE.md) recebeu alteração somente no corpo de Handoff; Decisions foi preservada byte a byte.

## Escopos e rastreabilidade conferidos

| Conjunto | Estado sustentado pela evidência | O que não está aprovado |
| --- | --- | --- |
| [Revisão original](../review/REVISAO_COMPLETA.md) e [summary](../review/summary.json) | 26 achados: 9 P1, 14 P2, 3 P3. Dezessete probes `confirmed`; baseline/after iguais, 18 hashes iguais aos blobs de `63810f4`. | Exit 0 das probes significa reprodução de defeito. Não atesta saúde do HEAD. Nenhuma probe foi reexecutada. |
| [STAB](../.specs/features/estabilizacao/spec.md), design, tasks e evidence | 68 ACs únicos e 68 linhas Pending. Vinte e seis achados com destinação: 13 incluídos, 9 parciais, 4 adiados. T1–T6 históricos têm commits; T7/T8 não foram fechadas por esta revisão. | Nenhum fechamento integral STAB ou encerramento dos 26 achados. |
| [BUILD](../.specs/features/build-confiavel/spec.md), evidence e validation | PASS independente local em `58be3ed`: 11 ACs, 50 testes, 12 gates, 10 mutações detectadas por asserções. O manifesto e o portátil ainda têm SHA-256 `cedb8048fedec3463e529401a4b71364e0d571eb65b376dd75042d4226b4f9c4`, reconferido por leitura/hash. | Mídia física, causa universal do ruído, NAT entre redes, seis transmissores, assinatura ou publicação. Os gates históricos não foram reexecutados. |
| [MEDIA](../.specs/features/captura-midia-saida/spec.md), design, tasks e investigação | 34 ACs únicos, 34 linhas In Tasks, nove tarefas Draft e nenhuma executada. As duas matrizes de planejamento continuam distintas da aprovação funcional. | Nenhum MEDIA Verified. UAT de dois PCs, três ciclos de 30 s e sessão de 10 min permanece não realizado. Não confundir com as metas futuras de 60 min/seis pessoas do plano. |
| [Pesquisa Discord](../.specs/features/captura-midia-saida/discord-investigation.md) | D1/D2 estáticos/parciais; D3–D5 documentais; D6–D11 estáticos delimitados; U1 é UI/processo externo ao REA. Quatro registros `unknowns` continuam open no bundle local. | Vínculo do cache ao renderer ativo, causa dos controles indisponíveis, transmissão/captura/liberação física ou efeitos no receptor. |
| [TypeScript](migracao-typescript.md) | 39 arquivos JS/JSX/CJS/MJS rastreados: 37 fontes próprias e duas saídas históricas. Sete ferramentas próprias de revisão incluídas no destino futuro. Cinquenta definições `test()` por leitura, sem nova execução. | Nenhuma fonte convertida, compilador/configuração instalado ou estratégia de emissão aprovada. Atualizar inventário depois da estabilização. |

Os registros externos de Discord foram consultados em `C:/Code/discord-research/2026-10-25-media/` e `2026-10-25-runtime/`. A leitura de `discord-refined-unknowns-bundle.json`, `capture-gates-provenance.json` e `ui-observations.json` confirmou a existência e natureza dos registros citados; não reconstituiu a análise estática nem transformou UI em inventário de tracks. O laboratório foi autorizado, sem convites, e a fonte artificial foi encerrada sem compartilhamento, conforme os registros históricos.

## Validação desta revisão

Skill `tlc-spec-driven` carregada por MCP Agent Skills stdio: catálogo `0.17.13`, revisão `7bed1026351b`. `read_skill` e referências completas memory/coding-principles/specify/tasks foram lidas. `prepare_skill_files` confirmou os quatro scripts solicitados por checksum, sem mudança de revisão. Python portátil: `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Nenhuma lição confirmada; arquivos gerados de lessons não foram alterados.

Comandos estruturais executados da raiz, usando os scripts preparados da skill:

```text
validate_spec.py estabilizacao --strict
validate_spec.py captura-midia-saida --strict
validate_spec.py build-confiavel --strict
validate_tasks.py estabilizacao --strict
validate_tasks.py captura-midia-saida --strict
check_commit.py --message "docs: reconcile documentation before stabilization"
git diff --check
```

As três specs e os dois planos passaram com zero erros/avisos. A conferência adicional compara os 113 textos de ACs com a base, IDs únicos, linhas/status de rastreabilidade, mapeamento MEDIA bidirecional, contagens, dependências, referências locais, prefixo Decisions, medições históricas e integridade dos arquivos fora do escopo documental. O corpo original da revisão foi comparado byte a byte; os campos originais do resumo foram comparados por valor. O relatório de validação BUILD e seus dados históricos não foram reescritos.

Resultado da conferência adicional: **257 links Markdown locais existentes, zero destinos ausentes nesses links**, incluindo caminhos para evidências externas ao Git; 22 links web não foram reconsultados. Mapeamento MEDIA bidirecional: 34/34; nove tarefas, zero itens marcados concluídos. Destinação STAB: 26/26, com 13 incluídos, 9 parciais e 4 adiados. SHA-256 do prefixo anterior a Handoff, incluindo Decisions: `f4f06a1a44eecf50dec6e134e20447952ea673ca9c78c366421a027ac44c9a57`, idêntico à base. `check_commit.py`: OK; `git diff --check`: sem erros. Esses resultados são documentais.

Não foi executado build, captura do aplicativo, teste funcional, análise REA ou interação Discord. `validate_state.py` não é gate desta correção documental: não se está encerrando uma feature de implementação. Os validadores de Markdown não certificam STAB/MEDIA.

## Pendências e próximo passo

1. A coordenadora recebe o commit documental e aciona a sessão nova somente após o término comprovado desta revisão. Essa sessão deve ler STATE integralmente e reconciliar Git, critérios, código e evidência antes de alterar implementação. A autorização sequencial já existe; os limites das entregas históricas não a anulam.
2. Manter STAB/A14 v1 e o v2 proposto de MEDIA explicitamente distintos. O código atual usa `PROTOCOL_VERSION = 1` em `shared/protocol.js:1`. Antes de eventual ativação, reconciliar a escolha técnica e atualizar a spec correspondente de forma expressa, sem mudar critérios para fazer testes passarem. Bridge síncrona e demais mecanismos do Draft também não viram decisões confirmadas por silêncio.
3. Reutilizar as capacidades e asserções existentes; demonstrar gaps antes de refazer caminhos. Tela continua existente, câmera negada, troca de texto terminal para a chamada, “Silenciar áudio” somente reprodução e recuperação manual delimitada por STAB/A5. MEDIA/A5 trata de mute e reprodução.
4. T9 e MEDIA-33/34 dependem de dois PCs Windows, hardware real e operadores disponíveis. Sem isso, registrar o bloqueio físico e não declarar PASS integral. A causa do ruído continua desconhecida.
5. As quatro dúvidas Discord continuam abertas: renderer/engine ativos, resposta antiga após cancelamento/reentrada, fim físico de tela/soundshare/recepção com voz preservada e causa dos controles indisponíveis. Não são autorização para nova operação Discord nesta revisão.
6. Contas, grupos privados e TURN autenticado continuam bloqueando publicação futura. LiveKit/SFU e infraestrutura não estão aprovados. TypeScript aguarda a estabilização; suas escolhas de tooling pertencem à futura spec.

Nenhuma decisão essencial faltou para concluir esta revisão documental. As pendências técnicas e físicas acima permanecem visíveis para a retomada, sem aprovação funcional implícita.
