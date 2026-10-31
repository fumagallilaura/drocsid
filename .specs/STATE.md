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

- **Feature**: [MERGE](features/merge-drocsid/tasks.md). Novo pedido: um produto baseado no Conversa, nome Drocsid, contas/grupos, TypeScript e segurança. Decisões técnicas delegadas. Execução inline e Verifier independente no fechamento.
- **Phase / Task**: Execute. T1 e T2 concluídas; T3 próxima. Contas/grupos e UI ainda não adaptados; nenhum PASS integral da integração.
- **Completed**: Merge41afbae tem os dois pais a2ae03c/94d9b9a, conflitos de manifests/ignore resolvidos. T2 em8d78b1f habilita strict/noEmitOnError e protocolo tipado, com JS emitido nos caminhos existentes.95/95 Node (94 regressões+1), tsc, Vite e desktop-smoke aprovados em T2; audit produção0 vulnerabilidades em T1. Evidências test-results/drocsid-merge-t1-* e drocsid-merge-t2-*.
- **In-progress**: tasks.md registra estado por tarefa. apps/* upstream é material temporário de adaptação, não resultado final de dois aplicativos. Lock regenerado por npm, não mesclado manualmente. Fontes restantes ainda não são TypeScript; nenhuma declaração de migração completa. Pergunta SQLite respondida: persistência do serviço único, sem áudio/vídeo no banco; AWS/múltiplas instâncias requerem decisão de infraestrutura própria.
- **Next step**: T3 RTC; depois Session, identidade, autorização, host/UI, ferramentas e release conforme plano. Ler controlador e seus testes; usar contratos das operações consumidas por browser/doubles, sem casts amplos ou supressões. Cada gate antes do commit. Novo Verifier MERGE após T10; não reutilizar parecer STAB/MEDIA.
- **Blockers**: T9 física MEDIA segue indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback não certificados. Integração exige nova candidata/hash; portátil anterior não aprova o merge. AWS/TLS/TURN/publicação não entregues neste lote.
- **Historical evidence**: STAB158pass/0fail, MEDIA93pass/2fail físicos, sensores17/17 e94/94 em ec874ec; produto anterior699d4ed. SHA portátil anterior16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135. Ver specs históricas;113 ACs preservados. Não repetir investigação Discord nem adotar sua câmera; câmera negada, texto encerra chamada e mute só reprodução.
- **Uncommitted files**: nenhum após commit deste Handoff; reconferir porcelain. Não há merge aberto. Perfil TEMP conversa-test-y4t7mS permanece intocado após rejeição automática histórica de remoção.
- **Branch**: integration/drocsid; remoto drocsid somente fetch. main e backup intactos em a2ae03c. MCP0.17.18/revisãoeec8e8fe8151. Python TEMP/conversa-spec-python-3.14.0/python.exe. Somente commits locais, sem push/deploy/terceiros.
