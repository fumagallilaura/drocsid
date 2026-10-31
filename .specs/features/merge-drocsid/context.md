# Drocsid Integration Context

**Gathered:** 2026-10-31. **Status:** execução local autorizada, decisões técnicas delegadas.

## User decisions

Pedido: “Vamos fazer merge dos dois projetos, faça pull desse projeto e resolva os conflitos”.

Resposta à escolha entre integrar funcionalidades e manter dois aplicativos: “Manter o conversa como principal, mas o nome deve ser Drocsid. Voce deve tomar as melhores decisões, baseado em boas práticas de mercado, mantenha o padrão em typescript, a segurança também é uma validação importante”.

O resultado é um produto, baseado no Conversa, chamado Drocsid. Contas e grupos do Drocsid serão adaptados a esse produto. A nova instrução autoriza TypeScript nesta integração; substitui o adiamento anterior dessa migração. Não autoriza push, deploy ou comunicação com terceiros. A preferência desta sessão por execução inline e Verifier independente permanece.

## Reconciled sources

- Conversa: `a2ae03cd59a6c7da0a56d256cf01cb9f4aaae8ac`, main e backup/conversa-before-drocsid-20261031 preservados.
- Drocsid: `94d9b9a6de48903c0b2fa055a34b7f2cd8626e0a`, buscado por git fetch no remoto drocsid.
- Branch de trabalho: integration/drocsid. Históricos sem ancestral comum. T1 executou merge real e resolveu os três add/add em .gitignore, package.json e package-lock.json; nenhum caminho não mesclado permanece.
- Baseline reexecutada: 94/94 Node, zero falhas/skips/cancelled/todo; Vite build aprovado. Logs test-results/drocsid-merge-baseline-node.log.
- Nenhum Docker/PostgreSQL CLI ou listener local5432 foi encontrado na conferência. Não se presume execução da suíte PostgreSQL do upstream.

## Delegated technical decisions

Preservar Call, Session, protocolo, serviço, seletor e isolamento Electron do Conversa. Adaptar identidade, associação a grupos e convites do upstream; não substituir esses proprietários pelos caminhos de mídia com falhas já reproduzidas. Um único banco SQLite mantém transações e histórico existentes; PostgreSQL e escala horizontal pertencem à futura infraestrutura AWS. O servidor de rede exige contas; convidado é opção explícita somente em serviço restrito ao loopback. Tokens ficam em memória no cliente e em hash no banco, com expiração e revogação; upgrades usam tickets descartáveis, nunca senha ou sessão durável em URL.

TypeScript estrito cobre fontes próprias, scripts, testes e ferramentas de revisão; bundles históricos permanecem artefatos. Emissão para JavaScript em Node/Electron/preload preserva entradas verificáveis; renderer é construído pelo Vite. Nenhum any, ts-ignore ou ts-nocheck será usado para esconder falhas. A política de mídia continua: câmera negada, texto encerra chamada, silenciar áudio afeta somente reprodução.

## Limits

Pergunta do usuário: “Pra que usaremos SQLite?”. Esclarecido: persistência de contas, grupos, permissões, sessões e mensagens no serviço existente, para um único processo com armazenamento persistente. Deploy AWS e eventual PostgreSQL/RDS para múltiplas instâncias continuam fora deste merge; SQLite não é cache do renderer nem armazenamento de áudio/vídeo. Referência: https://www.sqlite.org/whentouse.html (2026-10-31).

DMs, anexos, reações, embeds e políticas legais do upstream não entram automaticamente: esta escolha autorizou integrar contas/grupos no Conversa. Seus commits permanecem no histórico. Não haverá segundo aplicativo ativo no resultado final. TLS/TURN autenticado e infraestrutura AWS não serão declarados entregues por este merge. T9 física segue não executada; a integração invalida a candidata anterior para aceitação física, exigindo novo hash após os gates automáticos.
