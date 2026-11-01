# Drocsid Integration Specification

**Approved**: 2026-10-31 - user: "Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante"

**Amended**: 2026-10-31 - user: "Prefiro postgresql". AD-003 substitui SQLite como backend; T1/T2 preservadas, MERGE-18 esclarecida e MERGE-19–21 acrescentadas por esta escolha.

## Problem Statement

Conversa e Drocsid têm históricos independentes, interfaces, contratos e persistências distintos. O usuário autorizou uma integração funcional local: manter a base estabilizada do Conversa, usar o nome Drocsid, incorporar contas e grupos e validar TypeScript e segurança. Juntar diretórios sem ligar esses comportamentos não atende ao pedido.

## Goals

- [ ] Um aplicativo Drocsid, com ambos os históricos e comandos executáveis.
- [ ] Contas e grupos isolados no serviço e na interface do Conversa.
- [ ] TypeScript estrito, regressão preservada e revisão de segurança independente.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Push, deploy/AWS, banco de produção ou contatos | Somente execução e commits locais autorizados. |
| SFU, câmera, mudança da semântica de áudio ou chamada independente do texto | Decisões anteriores preservadas. |
| DMs, uploads, embeds, reações e certificação legal | A escolha foi integrar contas/grupos ao Conversa; não adotar toda a interface upstream. |
| Certificação física, NAT entre redes e seis transmissores | Recursos T9 indisponíveis; não substituíveis por mocks. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Produto | Conversa como base, nome Drocsid, contas/grupos integrados | Resposta literal no context.md | y |
| Tecnologia | TypeScript estrito, PostgreSQL único no servidor e emissão JS para os runtimes | PostgreSQL escolhido diretamente; integração preserva os contratos do Conversa | y + user delegated |
| Contas | Usuário 2–32 caracteres a-z0-9_., senha15–128, scrypt N131072/r8/p1 e sal aleatório16bytes | Sem MFA; orientação OWASP e base upstream | user delegated |
| Sessão | Token aleatório32bytes, hash SHA256; expiração absoluta24h e inatividade30min; logout revoga conexões | Identidade revogável, sem segredo persistente no renderer | user delegated |
| Convite | Código aleatório32bytes, hash no banco, prazo24h, uso único e revogação pelo dono | Evita convites permanentes ou enumeráveis | user delegated |
| Limites de autenticação | Cinco falhas por IP/usuário em60s; no máximo duas derivações de senha concorrentes | Limita força bruta e memória do scrypt; erro de login genérico | user delegated |
| Legado | Perfil e banco existentes preservados; salas antigas somente no modo local de confiança | Não expor histórico de convidados ao criar contas | user delegated |

**Open questions:** none essenciais; usuário delegou as decisões técnicas. As limitações físicas permanecem abertas como evidência.

## User Stories

### P1: US1 — Um produto com história e tipos verificáveis

**User Story**: Como mantenedor, quero integrar os históricos e manter o produto executável.

**Acceptance Criteria**:

1. WHEN concluir a integração THEN o Git SHALL conter os dois commits de origem como ancestrais e zero caminhos não mesclados. (**MERGE-01**)
2. WHEN abrir o aplicativo ou produzir o portátil THEN o produto SHALL apresentar Drocsid e executar a interface, serviço e captura derivados do Conversa como único aplicativo. (**MERGE-02**)
3. WHEN verificar tipos THEN o projeto SHALL aprovar todas as fontes próprias de aplicação, scripts, testes e ferramentas de revisão em TypeScript estrito, sem ocultar erros com any ou supressões. (**MERGE-03**)
4. WHEN abrir o perfil e banco legados THEN o produto SHALL preservar preferências, salas, mensagens e recibos anteriores sem excluir ou atribuir autoria por adivinhação. (**MERGE-04**)

**Independent Test**: Conferir ancestrais, árvore, inventário de fontes, typecheck e dados de uma cópia isolada do banco legado; abrir source e portátil.

### P1: US2 — Identidade com sessão revogável

**User Story**: Como participante, quero criar uma conta e controlar minha sessão.

**Acceptance Criteria**:

1. WHEN cadastrar uma conta válida THEN o serviço SHALL armazenar somente a derivação scrypt com sal aleatório e criar uma identidade única, recusando duplicatas com409. (**MERGE-05**)
2. IF o login for inválido ou exceder os limites definidos THEN o serviço SHALL devolver401 genérico ou429 sem expor existência da conta nem iniciar derivações além do limite concorrente. (**MERGE-06**)
3. WHEN expirar ou revogar a sessão THEN o serviço SHALL negar seu reuso e finalizar suas conexões de mídia/sinalização em até1s da invalidação observada pelo serviço. (**MERGE-07**)
4. IF uma requisição de rede não possuir sessão válida THEN o serviço SHALL negar dados privados e credenciais ICE, inclusive no upgrade WS, sem permitir modo convidado fora de loopback explicitamente habilitado. (**MERGE-08**)

**Independent Test**: Comparar senhas iguais com sais distintos, ausência de tokens brutos no banco/logs, limites de tempo e concorrência, logout, ticket expirado/repetido e requisições sem sessão.

### P1: US3 — Grupos com autorização no servidor

**User Story**: Como participante, quero conversar em grupos privados sem acessar dados de outros grupos.

**Acceptance Criteria**:

1. WHILE uma conta não for membro do grupo o serviço SHALL impedir listagem, histórico, mensagens, presença e sinalização desse grupo, inclusive quando IDs forem conhecidos. (**MERGE-09**)
2. WHEN criar um grupo THEN o serviço SHALL registrar seu dono e uma sala inicial na mesma transação; somente o dono poderá administrar salas e convites. (**MERGE-10**)
3. WHEN aceitar um convite válido THEN o serviço SHALL adicionar o membro uma única vez e consumir o código na mesma transação, recusando código expirado, revogado ou já usado. (**MERGE-11**)
4. IF uma conta reutilizar uma operação de mensagem de outra conta THEN o serviço SHALL recusar a operação sem revelar ou modificar o resultado original, mantendo a idempotência do próprio remetente após reconexão. (**MERGE-12**)

**Independent Test**: Duas contas e dois grupos, IDs conhecidos, join/message/signal forjados, convite concorrente, dono/membro e mensagem reenviada por outra identidade.

### P1: US4 — Interface e mídia sem regressões

**User Story**: Como usuário, quero usar contas e grupos na interface familiar e sair da chamada com segurança.

**Acceptance Criteria**:

1. WHEN usar os controles de cadastro, login, logout, criar grupo e aceitar convite THEN o aplicativo SHALL mostrar o resultado confirmado ou erro recuperável, mantendo senha e sessão fora das preferências e armazenamento persistente do renderer. (**MERGE-13**)
2. WHEN sair, cancelar, mudar sala ou encerrar uma captura THEN o produto SHALL manter as invariantes de geração, prazos, inventário e reprodução dos testes MEDIA/STAB existentes, com câmera negada. (**MERGE-14**)
3. WHEN construir o pacote THEN o build SHALL emitir host/preload/serviço atuais e o checker SHALL comparar os bytes alcançáveis ao ASAR e conferir SHA256 do portátil. (**MERGE-15**)
4. WHEN validar a integração THEN os gates SHALL executar testes negativos de autorização e sessões, checagem de dependências e Verifier independente, registrando qualquer vulnerabilidade alta/crítica não resolvida como bloqueador. (**MERGE-16**)
5. WHILE o ensaio físico T9 não for executado o relatório SHALL manter ruído, eco, loopback e aceitação física sem aprovação e identificar a nova candidata por hash. (**MERGE-17**)
6. WHEN concluir o produto unificado THEN os comandos de execução e pacote SHALL usar um único aplicativo e backend PostgreSQL, sem servidor SQLite paralelo. (**MERGE-18**)

**Independent Test**: Gestos nos controles reais, dois usuários/grupos, mídia sintética e matriz source/packaged/portátil. O ensaio físico é separado e permanece pendente.

### P1: US5 — Persistência PostgreSQL e migração conservadora

**User Story**: Como operador, quero PostgreSQL no servidor e uma importação verificável dos dados legados.

**Acceptance Criteria**:

1. WHEN iniciar a persistência PostgreSQL THEN o componente SHALL aplicar migrações versionadas atomicamente, manter ordem e recibos de mensagens após reconexão, reverter operações incompletas e encerrar o pool sem sessões pendentes. (**MERGE-19**)
2. WHEN importar um SQLite legado THEN o importador SHALL preservar IDs, nomes, texto, datas, ordem, autoria e recibos em uma transação repetível sem duplicação, recusar destinos conflitantes e manter o arquivo de origem inalterado. (**MERGE-20**)
3. IF configurar acesso ao banco THEN o servidor SHALL exigir credenciais explícitas, recusar TLS sem verificação em conexões remotas e manter a URL/senha fora de logs, renderer, preferências e pacote do cliente. (**MERGE-21**)

**Independent Test**: PostgreSQL real isolado; reinício, rollback e dois escritores concorrentes. Importar fixtures SQLite antigas e atuais duas vezes e comparar todos os campos e bytes da origem; provocar conflito. Verificar configuração local/remota/TLS e artefato desktop.

## Edge Cases

- Permissão antiga, stop+leave concorrentes, prazo original e resultado tardio preservam MEDIA/STAB.
- Ticket WS descartável não é sessão durável; erro não registra URL/token/senha.
- Repetir convite ou operação alheia não concede acesso nem duplica associação.
- Shutdown durante hash pendente não acessa banco fechado nem mantém listener.
- Salas legadas não viram públicas por causa do cadastro de uma conta.
- Migração concorrente usa lock transacional; schema futuro/desconhecido é recusado, nunca sobrescrito.
- PostgreSQL não disponível faz o teste falhar com instrução concreta; nenhum skip, banco emulado ou fallback SQLite o aprova.

## Implicit Requirement Dimensions

Validação/limites: MERGE-05/06/08/11. Falha/transação: MERGE-04/10/11. Idempotência: MERGE-11/12/14. Autorização: MERGE-06–12. Concorrência: MERGE-06/11/14. Expiração: MERGE-07/11. Observabilidade: MERGE-08/16. Dependências: MERGE-03/15/16. Transições: MERGE-07/13/14. Infraestrutura pública não é aprovada por estes gates.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MERGE-01 | US1 | Execute/T1 | Implemented; final proofs pending |
| MERGE-02 | US1 | Execute/T9/T10 + Tasks/T12 | Drocsid native host and React UI implemented; final package/proofs pending |
| MERGE-03 | US1 | Execute/T2–T11 + Tasks/T12 | Maintained app/tooling/tests/review sources pass strict inventory without explicit any/suppressions; temporary upstream apps cleanup and final proofs pending |
| MERGE-04 | US1 | Execute/T4/T9 | Legacy import and native default profile/preferences/database bytes tested; final proofs pending |
| MERGE-05 | US2 | Execute/T7/T8 | Identity and HTTP implemented; final proofs pending |
| MERGE-06 | US2 | Execute/T7/T8 | Identity and HTTP limits tested; final proofs pending |
| MERGE-07 | US2 | Execute/T7/T8 | Expiry/revocation, owned connection termination and logout/ticket concurrency tested; final proofs pending |
| MERGE-08 | US2 | Execute/T7–T9 | Network authorization, one-use tickets and desktop client default tested; final proofs pending |
| MERGE-09 | US3 | Execute/T7/T8/T10 | Service and UI isolation tested with two accounts/groups; final proofs pending |
| MERGE-10 | US3 | Execute/T7/T8/T10 | Atomic owner administration and group controls tested; final proofs pending |
| MERGE-11 | US3 | Execute/T7/T8/T10 | Atomic invitations plus native copy/paste, acceptance and reuse refusal tested; final proofs pending |
| MERGE-12 | US3 | Execute/T3/T6/T8 | Authenticated receipts and concurrent single broadcast tested; final proofs pending |
| MERGE-13 | US4 | Execute/T10 | Native account/group controls, recovery, deadlines, stale response rejection and non-persistent credentials tested; final proofs pending |
| MERGE-14 | US4 | Execute/T5/T6/T9–T11 + Tasks/T12 | Typed media/UI/harness pass regression and desktop/capture/lifecycle/startup; final artifact pending; physical T9 unavailable |
| MERGE-15 | US4 | Tasks | In Tasks |
| MERGE-16 | US4 | Tasks | In Tasks |
| MERGE-17 | US4 | Tasks | In Tasks |
| MERGE-18 | US4 | Execute/T8 + Tasks/T12 | Service uses PostgreSQL; upstream duplicate app/dependencies cleanup pending |
| MERGE-19 | US5 | Execute/T3 | Implemented; final proofs pending |
| MERGE-20 | US5 | Execute/T4 | Implemented; final proofs pending |
| MERGE-21 | US5 | Execute/T3 + Tasks/T8/T9/T12 | Partial: configuration and real no-fallback test; client/artifact checks pending |

## Sources

- [Contexto e autorização](context.md), commits a2ae03c e94d9b9a e os113 ACs históricos, preservados.
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), consultados em2026-10-31.
- Nenhuma captura visual vinculante foi fornecida; a base visual é a interface do Conversa.
- AD-003, resposta "Prefiro postgresql", [node-postgres Transactions](https://node-postgres.com/features/transactions), [SSL](https://node-postgres.com/features/ssl) e [PostgreSQL Windows](https://www.postgresql.org/download/windows/), consultados em2026-10-31.

## Success Criteria

- [ ] MERGE-01–21 têm provas de resultado e parecer independente, sem enfraquecer a regressão.
- [ ] Pacote Drocsid abre e funciona; nenhum dado legado excluído.
- [ ] T9 física permanece pendente com recursos necessários explícitos, sem publicação implícita.
