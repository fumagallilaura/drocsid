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

- **Feature**: [MERGE](features/merge-drocsid/tasks.md) concluída localmente. Conversa principal chamado Drocsid, TypeScript estrito e PostgreSQL único (AD-001/003).
- **Phase / Task**: T1–T12 e fechamento formal completos. Verifier independente retornou; sete lacunas de prova corrigidas em uma passagem. Nenhum PASS integral de hardware.
- **Completed**: T12 429a3d2, correção do destino visível160a116, fechamento V1 7eb451a/V2 ab8c0fa/V3–V7 1529b99, parecer/Closed c10f4f3. Provas finais emc10f4f3:23 pass/0 fail; validate_verification0 erros/0 avisos.152/152, strict quatro ambientes/Vite, dist:win e18 gates source/empacotado/portátil PASS.149 casos anteriores presentes;1007/1008 assert idênticos e um fortalecido.113 ACs e Decisions intactos.60 sensores por lote com controles/proveniência, dois T10 substituídos após falha de preparação; não uma reexecução conjunta. Lições L-018–024 candidatas pelo script, sem promoção.
- **In-progress**: Nenhuma implementação MERGE pendente. Cliente padrão sem banco/credenciais, perfil appData/conversa e SQLite antigo/atual com recibos preservados. Conta/grupo/convite por controles reais, senha/token só em memória. Fontes TS; JS/MJS emitidos/ignorados, não reconverter. Laboratório isolado com duas janelas/dados de fixture: test-results/drocsid-lab.json/log; criar drocsid-lab-stop encerra seus proprietários.
- **Next step**: Quando houver recursos, executar MEDIA/A7/T9 com esta candidata. Infraestrutura AWS/HTTPS/WSS/TURN temporário e operação pública exigem entrega própria e autorização de deploy. Não reabrir tarefas MERGE concluídas nem migrar dados reais implicitamente.
- **Blockers / limits**: MEDIA/T9 física indisponível: dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores. Ruído/eco/loopback sem aprovação. Câmera negada, texto/grupo encerra chamada, mute só reprodução, sem SFU. Audit produção0, completo15 moderadas dev/0 altas/críticas. Compose só validado estaticamente, Docker ausente; PG real nativo testado. Sem deploy AWS/TLS público/TURN temporário, push ou terceiros.
- **Resources / evidence**: MERGE/evidence.md e verification.md versionados; proofs.md é saída local ignorada, regenerada no HEAD final para evitar autorreferência do commit; snapshots anteriores c10f4f3/dcfd635 preservados. Logs test-results/drocsid-merge-proofs-final.log/verification-gate.log, drocsid-verifier-*, release/*.log e verifier-fix-sensors.json. SHA256 cd1b3b43bf4756c8d8b3e8821b8972873a87ac54d5265e4c14009588ead2ddd0; release-windows/Drocsid-0.1.1-Windows.exe, manifesto test-results/build.json. PG17.11 em TEMP/conversa-postgresql-17.11-5/pgsql/bin. MCP0.17.18/eec8e8fe8151, Python TEMP/conversa-spec-python-3.14.0/python.exe; skill selftest24 killed/0 survived na T11.
- **Uncommitted files**: nenhum após commit documental de fechamento; reconferir Git. Nenhum dado real migrado. TEMP conversa-test-y4t7mS permanece intocado após rejeição automática histórica de remoção, não contornar.
- **Branch**: integration/drocsid; main/backup em a2ae03c, remoto drocsid somente fetch, sem push. Decisions byte-idêntica; relatório independente MERGE próprio, sem transferir certificação física MEDIA ou publicar AWS.
