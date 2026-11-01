# STATE

## Decisions

### AD-001
- **Decision**: O produto unificado mantém a base do Conversa, chama-se Drocsid e adota TypeScript nesta integração.
- **Reason**: Em2026-10-31 o usuário respondeu: “Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante”. O novo escopo substitui o adiamento da migração até depois da aceitação física.
- **Trade-off**: A integração exige nova candidata e regressão automática; não herda certificação física do protótipo anterior.
- **Scope**: Produto, fontes próprias, tooling e distribuição; T9 continua pendente, sem push/deploy.
- **Date**: 2026-10-31
- **Status**: active

### AD-002
- **Decision**: Contas e grupos são adaptados ao serviço e banco SQLite do Conversa, sem backend PostgreSQL paralelo.
- **Reason**: Decisão técnica delegada pelo usuário. Preserva histórico, transações, idempotência, shutdown e isolamento de mídia já testados; evita operar dois bancos e dois produtos para o protótipo de um processo.
- **Trade-off**: Escala horizontal e mudança de banco pertencem à futura infraestrutura AWS; o merge não certifica produção pública.
- **Scope**: Identidade, autorização, grupos e persistência do Drocsid unificado.
- **Date**: 2026-10-31
- **Status**: superseded by AD-003

### AD-003
- **Decision**: PostgreSQL será a persistência única do servidor Drocsid; SQLite fica restrito à leitura e importação explícita do legado.
- **Reason**: O usuário respondeu “Prefiro postgresql” em2026-10-31, substituindo a escolha delegada AD-002. Preservar o serviço/RTC/Session do Conversa e adaptar suas consultas/transações assíncronas ao PostgreSQL.
- **Trade-off**: Exige PostgreSQL real nos testes, migrações versionadas e importação transacional do banco legado. O cliente Electron acessa a API e não recebe credenciais do banco; o banco não precisa ser instalado nos PCs dos usuários.
- **Scope**: Persistência, identidade/grupos, bootstrap, importador, testes e distribuição. Nenhum deploy AWS ou alteração de banco de produção autorizado.
- **Date**: 2026-10-31
- **Status**: active

## Handoff

- **Feature**: [MERGE](features/merge-drocsid/tasks.md). Conversa principal chamado Drocsid, PostgreSQL único (AD-003). Execução inline, Verifier fresco após T12.
- **Phase / Task**: T1–T12 implementadas com gates próprios verdes. Fechamento: provas em HEAD, Verifier fresco e gate formal. Nenhum PASS integral de hardware.
- **Completed**: Commits T1–T11 em MERGE/evidence.md; T11 4a77a51. T12 neste commit `build(release): validate the unified drocsid distribution`: apps/workspaces paralelos removidos, Compose seguro, documentação e pacote unificados.152/152, zero fail/skip/cancelled/todo; strict quatro ambientes/Vite, dist:win e18 gates source/empacotado/portátil PASS.149 casos/1008 assert anteriores,113 ACs e Decisions intactos. Cinco sensores T12, fontes/emitidos/ASAR/EXE intactos;56 históricos por lote, sem alegar reexecução conjunta.
- **In-progress**: Backend PostgreSQL único; cliente padrão sem banco/credenciais, perfil appData/conversa preservado. Contas/grupos/convites por controles reais, senha/token em memória. JS/MJS emitidos/ignorados, não reconverter. Laboratório local aberto com duas janelas/dados de fixture: test-results/drocsid-lab.json/log; criar drocsid-lab-stop encerra seus proprietários. Nenhum dado real migrado.
- **Next step**: check_proofs.py merge-drocsid em HEAD limpo, dispatch registrado e Verifier independente fresco; uma passagem de correções, novas provas e validate_verification.py exit0 antes de declarar conclusão.
- **Blockers / limits**: MEDIA/T9 física indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback sem aprovação. Câmera negada, texto/grupo encerra chamada, mute só reprodução, sem SFU. Audit produção0, completo15 moderadas dev/0 altas/críticas. Compose só validado estaticamente, Docker ausente; PG real nativo testado. Sem deploy AWS/TLS público/TURN temporário, push ou terceiros.
- **Resources / evidence**: MERGE/evidence.md, logs test-results/drocsid-merge-t12-*, release/*.log, merge-t12-sensors.json/test-integrity.json. Nova candidata SHA256 00a862e610c005b552905385cfff5d36663764de220b2e891f150caf8bc809c9; release-windows/Drocsid-0.1.1-Windows.exe, manifesto test-results/build.json. PG17.11 real em TEMP/conversa-postgresql-17.11-5/pgsql/bin. MCP0.17.18/eec8e8fe8151, Python TEMP/conversa-spec-python-3.14.0/python.exe; skill selftest24 killed/0 survived na T11.
- **Uncommitted files**: lote T12 listado neste commit; reconferir Git. TEMP conversa-test-y4t7mS intocado após rejeição automática histórica de remoção, não contornar.
- **Branch**: integration/drocsid; main/backup em a2ae03c, remoto drocsid somente fetch. Decisions preservada byte a byte; Verifier MERGE após T12, pareceres MEDIA/STAB não substituem.
