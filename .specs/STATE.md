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
- **Phase / Task**: T1–T10 integração concluídas. Próxima T11: converter harness/scripts/testes/revisão restantes; T12 limpa duplicação e fecha pacote/provas/Verifier. Nenhum PASS integral.
- **Completed**: Merge41afbae, protocolo8d78b1f, PG1965746, importador1c18786, Call8a4e2a3, Session61c4b94, identidadec11135e, serviço4fa053e, desktop5848828. T10 neste commit `feat(ui): integrate secure accounts and private groups`: React TSX, contas/grupos/convites por gestos, prazos8s e isolamento de resposta/contexto.147/147, zero fail/skip/cancelled/todo; strict quatro ambientes, Vite, contas/client/desktop-smoke/profile/capture/lifecycle PASS. Sensores dos lotes47/47;141 casos/921 assert e113 ACs anteriores intactos na T10.
- **In-progress**: Backend só PostgreSQL; cliente Electron padrão sem banco/credenciais. UserData legado appData/conversa preservado. Senhas/tokens em memória; clipboard permite só escrita sanitizada no frame principal confiável. Lucide0.577.0 corrige tipos SVG incompatíveis sem supressões. test-runtime/client/accounts já TS, não reconverter. apps/* ainda temporário até T12. Nenhum dado real migrado.
- **Next step**: Converter ferramentas/testes restantes para TS estrito mantendo asserções e provas reais; depois construir candidata nova, auditoria, ASAR/hash e Verifier independente.
- **Blockers / limits**: MEDIA/T9 física indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback sem aprovação; dois usuários automatizados em um PC não substituem ensaio. Câmera negada, texto/grupo encerra chamada, mute só reprodução, sem SFU. Audit produção0 na T8; completo anterior15 moderadas dev/0 altas/críticas, limpeza T12 pendente. Sem deploy AWS/TLS público/TURN autenticado, push ou terceiros.
- **Resources / evidence**: Logs test-results/drocsid-merge-t10-*; merge-t10-sensors.json/test-integrity.json; imagem desktop/drocsid-accounts.png. PG17.11 real em TEMP/conversa-postgresql-17.11-5/pgsql/bin, SCRAM isolado. MCP0.17.18/eec8e8fe8151; Python TEMP/conversa-spec-python-3.14.0/python.exe com scripts verificados no python314._pth; selftest24 killed/0 survived na T9. SHA candidata anterior16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135 é histórico, bytes novos ainda sem ASAR/candidata.
- **Uncommitted files**: lote T10 listado no commit; reconferir Git antes de continuar. TEMP conversa-test-y4t7mS intocado após rejeição automática histórica de remoção, não contornar.
- **Branch**: integration/drocsid; main/backup em a2ae03c, remoto drocsid somente fetch. Decisions preservada byte a byte; Verifier MERGE após T12, pareceres MEDIA/STAB não substituem.
