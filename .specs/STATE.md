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
- **Status**: active

## Handoff

- **Feature**: [MERGE](features/merge-drocsid/tasks.md). Novo pedido: um produto baseado no Conversa, nome Drocsid, contas/grupos, TypeScript e segurança. Decisões técnicas delegadas. Execução inline e Verifier independente no fechamento.
- **Phase / Task**: Execute. T1 concluída neste merge; T2 próxima. Contas/grupos e UI ainda não adaptados; nenhum PASS integral da integração.
- **Completed**: Fetch drocsid/main94d9b9a, backup/main a2ae03c preservados; merge real de históricos independentes, conflitos de manifests/ignore resolvidos.95/95 Node (94 regressões+1), Vite e desktop-smoke aprovados; audit produção0 vulnerabilidades. Evidências test-results/drocsid-merge-t1-*.
- **In-progress**: tasks.md registra estado por tarefa. apps/* upstream é material temporário de adaptação, não resultado final de dois aplicativos. Lock regenerado por npm, não mesclado manualmente. T1 commit será o merge de dois pais contendo este Handoff.
- **Next step**: T2 strict/emissão e protocolo; depois RTC/Session, identidade, autorização, host/UI, ferramentas e release conforme plano. Cada gate antes do commit. Novo Verifier MERGE após T10; não reutilizar parecer STAB/MEDIA.
- **Blockers**: T9 física MEDIA segue indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback não certificados. Integração exige nova candidata/hash; portátil anterior não aprova o merge. AWS/TLS/TURN/publicação não entregues neste lote.
- **Historical evidence**: STAB158pass/0fail, MEDIA93pass/2fail físicos, sensores17/17 e94/94 em ec874ec; produto anterior699d4ed. SHA portátil anterior16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135. Ver specs históricas;113 ACs preservados. Não repetir investigação Discord nem adotar sua câmera; câmera negada, texto encerra chamada e mute só reprodução.
- **Uncommitted files**: conferir porcelain antes/depois do commit T1; merge aberto até seu commit. Perfil TEMP conversa-test-y4t7mS permanece intocado após rejeição automática histórica de remoção.
- **Branch**: integration/drocsid; remoto drocsid somente fetch. main e backup intactos em a2ae03c. MCP0.17.18/revisãoeec8e8fe8151. Python TEMP/conversa-spec-python-3.14.0/python.exe. Somente commits locais, sem push/deploy/terceiros.
