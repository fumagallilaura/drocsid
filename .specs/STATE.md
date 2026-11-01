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

- **Feature**: [MERGE](features/merge-drocsid/tasks.md), um produto Drocsid baseado no Conversa. Resposta "Prefiro postgresql" registrada em AD-003; AD-002 superseded. Execução inline autorizada, Verifier independente após T12.
- **Phase / Task**: Phase1/T1–T6 concluída. Próxima T7 (identidade/grupos), depois T8 (serviço PostgreSQL/autorização). Integração funcional, marca de UI, TypeScript de todos os proprietários e release ainda pendentes; nenhum PASS integral.
- **Completed**: Merge41afbae preserva a2ae03c/94d9b9a. Tipos/protocolo8d78b1f. Decisão PostgreSQL a3f3367; persistência1965746; importador readOnly1c18786; Call TS8a4e2a3; Session TS neste commit `refactor(session): type correlated requests and transport ownership`.113/113 testes, zero fail/skip/cancelled/todo; strict Node/browser, Vite, desktop-smoke, capture e lifecycle aprovados. Sensores14/14 por AssertionError em cópias isoladas, fontes intactas. Nenhum dado real migrado.
- **In-progress**: tasks.md registra cada tarefa/AC e evidência em test-results/drocsid-{postgres,merge}-*. A aplicação ainda usa o serviço SQLite até T8; PostgreSQL e importador são componentes testados, sem fallback final aprovado. apps/* é material temporário upstream; um aplicativo ao fechar T12. Baseline anterior preservada e STAB-39 reforçada com frame inválido antigo; nenhuma asserção removida/afrouxada.
- **Next step**: T7 em server/identity.ts, reutilizando o pool/transações de server/database.ts e sem adotar auth/captura fracas do upstream. Testar scrypt/limites, expiração/revogação, tickets e grupos/convites com PostgreSQL real. Não pedir de novo autorização local ou workers; sem Verifier MERGE até T12. Hardware não bloqueia este trabalho independente.
- **Blockers / limits**: MEDIA/T9 física permanece indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback sem aprovação; candidata antiga não aprova bytes novos. Câmera negada, texto encerra chamada, mute só reprodução. Sem SFU. Audit produção0; audit completo exit1 por15 moderadas de desenvolvimento,0 altas/críticas; limpeza T12 pendente. Sem deploy AWS/TLS público/TURN autenticado nem push.
- **Resources / evidence**: PostgreSQL17.11-5 real em %TEMP%/conversa-postgresql-17.11-5/pgsql/bin; wrapper with-test-postgres inicia/encerra clusters locais SCRAM, logs em test-results/postgres. docs/postgresql.md explica o importador e seu status.113 ACs históricos intactos. MEDIA/STAB anteriores: ec874ec, STAB158pass/0fail, MEDIA93pass/2fail físicos; não transferir aprovação. Portátil anterior SHA16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135 é histórico, não candidata MERGE.
- **Uncommitted files**: nenhum após commit T6; reconferir porcelain. Perfil TEMP conversa-test-y4t7mS intocado após rejeição automática histórica de remoção; não tentar contornar.
- **Branch**: integration/drocsid; main e backup intactos em a2ae03c, remoto drocsid somente fetch. MCP0.17.18/eec8e8fe8151 via cliente TEMP/conversa-agent-skills-mcp-client.mjs; Python TEMP/conversa-spec-python-3.14.0/python.exe. Somente commits locais, sem terceiros.
