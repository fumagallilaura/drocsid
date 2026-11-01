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
- **Phase / Task**: T1–T9 de integração concluídas. Próxima T10 em src/main.jsx: React TSX, cadastro/login/logout, grupos/convites por gestos; T11 harness restante, T12 pacote/limpeza/provas e Verifier fresco. UI de contas e release não concluídos; nenhum PASS integral.
- **Completed**: Merge41afbae preserva a2ae03c/94d9b9a. Protocolo8d78b1f, PostgreSQL1965746/importador1c18786, Call8a4e2a3, Session61c4b94, identidade c11135e e serviço autorizado4fa053e. T9 neste commit `feat(desktop): type the drocsid client and preserve legacy profiles`.141/141, zero fail/skip/cancelled/todo; strict Node/browser/Electron/tools, Vite e client/desktop-smoke/profile/capture/lifecycle PASS. Sensores dos lotes41/41 por AssertionError, fontes intactas.141 casos/921 assert e113 textos históricos de ACs intactos na T9.
- **In-progress**: Backend ativo só PostgreSQL, contas/grupos/tickets/recibos autorizados, encerramento do próprio pool testado. Corrigida disputa logout/ticket; broadcast concorrente testa dois leitores ausentes antes dos commits. Electron padrão é cliente sem PostgreSQL/credenciais; host só com DROCSID_HOST=1 e DATABASE_URL explícita. Marca nativa Drocsid, userData padrão appData/conversa preservado; marca interna/UI ainda T10. test-runtime/checker client já TS; não reconverter em T11. apps/* temporário até T12. Nenhum dado real migrado.
- **Next step**: Integrar UI em src/main.tsx à Session existente, mantendo tokens/senha em memória e encerrando chamada ao mudar sala/grupo/sair. Testar controles reais, falhas recuperáveis, isolamento e preferências; não substituir RTC nem pedir autorização local/workers de novo.
- **Blockers / limits**: MEDIA/T9 física indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback sem aprovação; hash antigo não certifica bytes novos. Câmera negada, texto encerra chamada, mute só reprodução, sem SFU. Produção audit0 na T8; audit completo anterior15 moderadas dev/0 altas/críticas, limpeza T12 pendente. Sem deploy AWS/TLS público/TURN autenticado, push ou terceiros.
- **Resources / evidence**: PostgreSQL17.11 real em %TEMP%/conversa-postgresql-17.11-5/pgsql/bin, wrapper SCRAM local e logs test-results/drocsid-merge-t7/t8/t9-*. MCP0.17.18/eec8e8fe8151; Python TEMP/conversa-spec-python-3.14.0/python.exe, python314._pth inclui o scripts verificado para subprocessos; skill selftest24 killed/0 survived. Candidata MEDIA/STAB anterior SHA16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135 é só histórico; nova candidata/hash T12.
- **Uncommitted files**: nenhum após commit T9; reconferir Git. TEMP conversa-test-y4t7mS intocado após rejeição automática histórica de remoção; não tentar contornar.
- **Branch**: integration/drocsid; main/backup em a2ae03c, remoto drocsid somente fetch. Decisões acima preservadas byte a byte. Verifier MERGE somente após T12; pareceres MEDIA/STAB não o substituem.
