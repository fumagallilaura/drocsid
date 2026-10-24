# Estabilização do Conversa Specification

**Data:** 2026-10-24. **Fase:** Specify, escopo Large/Complex. **Estado:** proposta de requisitos; implementação não iniciada. Os critérios abaixo descrevem o resultado exigido de uma futura estabilização. Não atestam o comportamento da versão 0.1.1.

## Problem Statement

O Conversa oferece texto, voz e tela em um protótipo desktop Windows, mas falhas de concorrência e encerramento permitem capturas sem controle, mensagens enviadas à sala errada, perda de texto e recursos que impedem o servidor de terminar. A revisão registrou 26 achados, ainda sem correções. Esta especificação estabiliza o protótipo para testes com pessoas de confiança e estabelece critérios que reprovem os defeitos atuais.

## Goals

- [ ] Encerrar toda captura cancelada, recusada, obsoleta ou sem chamada válida, inclusive quando a aquisição termina depois da saída.
- [ ] Persistir cada envio aceito uma única vez, na sala fixada pelo usuário, e preservar todo texto sem confirmação.
- [ ] Permitir saída da chamada com a cota esgotada e encerrar o serviço dentro de um prazo verificável.
- [ ] Dar destinação explícita aos 26 achados, sem confundir cobertura de requisitos com correções realizadas.
- [ ] Aprovar a futura estabilização por resultados derivados desta spec, com limitações de hardware, rede e distribuição registradas.

## Evidence Baseline

O handoff foi lido integralmente e reconciliado com o disco antes da redação. Não existe repositório Git em `C:\Code\conversa` nem nos ascendentes consultados. Os 18 arquivos de implementação/configuração de [baseline.json](../../../review/baseline.json) tiveram seus SHA-256 conferidos: **18/18 iguais**. Não havia `spec.md`, `context.md`, `design.md` ou `tasks.md` em `.specs/features/` nem loja de lições confirmadas.

Fontes lidas: [revisão completa](../../../review/REVISAO_COMPLETA.md), [resumo](../../../review/summary.json), [plano de produto](../../../PLANO_PRODUTO.md), [README](../../../README.md) e código citado na rastreabilidade. O resumo registra 17 reproduções de defeitos, três testes existentes aprovados, build isolado aprovado e auditoria sem vulnerabilidades reportadas. Esses resultados pertencem à revisão anterior; não foram reexecutados nesta sessão e não aprovam o aplicativo.

| Categoria | O que a evidência permite afirmar |
| --- | --- |
| Comportamento atual | Electron/React, Node/Express/WS, SQLite e WebRTC em malha; acesso por convidados; uma sala por socket; limite de seis pessoas por chamada. O limite não é garantia de qualidade. |
| Defeitos reproduzidos | R01–R07, R10–R12 e parte de R13/R19 têm reproduções descritas na revisão. As sondagens aprovam a reprodução do defeito, não o resultado desejado. |
| Inspeção e risco | Os demais itens conservam a natureza declarada no relatório. Não se transforma risco estrutural em incidente ou exploração comprovada. |
| Evidência ausente | Causa do ruído físico na entrada; áudio real do sistema; redes distintas; seis usuários em sessão prolongada; nova aprovação do portátil sob Device Guard; restauração de backup e leitor de tela. |
| Propostas do plano | Contas, papéis, grupos privados, LiveKit/SFU, hospedagem, assinatura, atualização e metas de 60 minutos continuam propostas. Não são decisões arquiteturais desta spec. |

## Confirmed Decisions

| ID | Decisão confirmada | Origem |
| --- | --- | --- |
| C1 | Estabilizar o protótipo atual para testes com pessoas de confiança. Contas, grupos privados e TURN autenticado ficam para outra entrega e bloqueiam futura publicação com essas garantias. | Resposta do usuário nesta sessão, 2026-10-24. |
| C2 | Trocar de sala de texto encerra a chamada. Manter voz independente da sala de texto está fora deste escopo. | Resposta do usuário nesta sessão, 2026-10-24. |
| C3 | Nesta sessão, produzir somente a spec e atualizar somente o Handoff de STATE.md. Não implementar, refatorar, criar design ou decompor tarefas. | Instrução explícita do usuário. |

Estas confirmações não preenchem nem alteram a seção Decisions de STATE.md. A stack observada é contexto atual, não aprovação de arquitetura futura.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Cadastro, login, administrador, grupos privados, convites autenticados e revogação | C1. R08 permanece aberto e bloqueia promessa de privacidade/publicação correspondente. Convite nesta spec é apenas endereço com sala. |
| Emissão autenticada de credenciais TURN e contratação/operação de relay | C1. R09 permanece aberto. Esta entrega não autoriza expor credenciais estáticas nem tornar público o serviço. |
| Migração para LiveKit, SFU, outro banco ou outro transporte | Propostas não aprovadas. Os requisitos são independentes dessa escolha. |
| Reconexão automática, retomada automática de mídia e fila offline após fechar o aplicativo | Recuperação manual é o limite desta entrega. Reenvio explícito idempotente e preservação de texto na sessão estão incluídos. |
| Paginação completa, busca, anexos, reações, mensagens privadas e edição | Expansões de produto. Preservam-se os últimos 200 registros por sala na visualização atual. |
| Retenção com exclusão automática, quotas de armazenamento por conta e administração de salas | Exigem política de dados e identidade. Não haverá expiração implícita de mensagens nesta estabilização. |
| Instalador, assinatura, atualizações, promoção de release e limpeza/retenção do staging | R23/R24 serão tratados em entrega de distribuição. O portátil atual continua sem aprovação demonstrada. |
| Reorganização geral de componentes, adoção de ferramentas e pipeline completo de CI | R22 requer design futuro. Aqui se exigem invariantes testáveis, sem determinar módulos, frameworks ou quantidade de arquivos. |
| Operação pública, disponibilidade/escala de produção e garantia de qualidade com seis usuários em redes distintas | Não demonstradas. O teto de seis e os limites abaixo apenas delimitam o protótipo. |
| Tornar chamada independente da sala de texto | C2. |

## Assumptions & Open Questions

Os padrões abaixo tornam os resultados verificáveis. São **propostas desta spec**, não decisões confirmadas do produto. Alterá-los exige revisar os critérios e seus testes. Nenhum deles implica autorização para implementar nesta sessão.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| A1 — Prazos do protocolo | 8 s por fase: configuração HTTP, abertura WS, espera de hello, confirmação de sala, admissão de chamada e confirmação de mensagem. O relógio da fase começa no pedido correspondente; o de hello começa na abertura WS. | Reaproveita a referência de 8 s atual e fecha a espera não coberta de R10. Não soma um prazo durante a interação humana com permissões. | Não; padrão proposto. |
| A2 — Liberação local | Até 1 s após o evento terminal ou após a resolução de uma aquisição obsoleta, o que ocorrer por último para aquela captura. | A permissão do sistema operacional pode não ser cancelável; todo resultado tardio continua precisando de liberação. | Não; padrão proposto. |
| A3 — Publicação parcial de tela | Abortar o novo compartilhamento por inteiro se qualquer publicação falhar; preservar a chamada e o microfone nos peers saudáveis. | Evita captura invisível e evita apresentar sucesso parcial como sucesso total. Não determina como compensar senders. | Não; padrão conservador proposto. |
| A4 — Encerramento | 5 s para terminar o serviço, contados do primeiro pedido. Upgrade desconhecido recebe rejeição em até 1 s. | O encerramento atual não possui limite; os números são limites de aceitação, não medições. | Não; padrão proposto. |
| A5 — Recuperação | Reentrada/reenvio manuais. Rascunhos e envios sem confirmação sobrevivem à troca de sala, desconexão e reconexão na mesma execução do aplicativo. Não há garantia após fechar ou cair o processo cliente. | Corrige perda silenciosa sem aprovar a reconexão automática proposta no plano. | Não; limite proposto. |
| A6 — Identidade de envio | Identificador opaco de operação globalmente único por envio, preservado no reenvio; recibo durável no mesmo serviço/banco, sem expiração automática. O nome não autentica o remetente. | Permite deduplicação após reconexão e reinício sem inventar contas. Não promete segurança contra outro convidado malicioso. | Não; contrato proposto. |
| A7 — Mídia sem conexão | 15 s desde o início de cada tentativa de negociação por peer até mídia pronta; até 128 candidatos ICE pendentes por peer, cada um com validade de 15 s desde o recebimento. Após falha, recuperação manual explícita. | Limita espera e memória sem decidir SDK, ICE restart ou SFU. | Não; limites propostos. |
| A8 — Recursos do protótipo | Até 24 conexões WS simultâneas por serviço; fila de saída de até 1 MiB por socket; até 100 salas; mensagem de 1 a 2000 unidades UTF-16 após trim; payload de entrada de até 65536 bytes; seis admitidos por chamada. | Os três últimos tetos de conteúdo/capacidade e o teto de salas preservam o comportamento atual. Conexões/fila são novos padrões para limitar R15. Não são promessa de desempenho. | Não; preservar os limites observados e propor os demais. |
| A9 — Preferências e captura | Persistir nome, endereço e qualidade em cada perfil desktop. Áudio do sistema começa desligado em cada execução; seleção de tela expira após 60 s. Sem microfone, permitir ouvir/compartilhar mediante admissão válida. | Mantém escuta sem microfone, escolha explícita e áudio opcional; não transforma preferência antiga em consentimento para nova execução. | Não; padrão proposto a partir do fluxo atual. |
| A10 — Instâncias e dados existentes | Um único host desktop ativo por diretório userData; janelas de teste do mesmo processo compartilham esse host. Preservar salas e mensagens antigas; autoria legada sem ID não é agrupada por nome. | Evita escrita concorrente não coordenada e falsa identidade, sem exigir contas nem atribuir autores antigos por adivinhação. | Não; política proposta para R16/R18. |
| A11 — Conexão perdida | Liberação da vaga no servidor em até 60 s desde o último pong, ou desde a abertura se ainda não houve pong, sem aguardar reconexão do cliente. Saída recebida tem efeito em até 1 s no servidor de teste. | Distingue limpeza local imediata de detecção remota por heartbeat. | Não; limites propostos. |
| A12 — Limites de validação visual | Modal com ciclo de foco e Escape; contraste mínimo de 4,5:1 nos três textos normais identificados; manter leitura quando distante mais de 100 px do fim. | Fecha os casos amostrados de R19/R26, sem alegar auditoria completa de acessibilidade. | Não; critérios propostos. |
| A13 — Transporte do ambiente de teste | Endereço vazio usa host local em loopback. Servidor externo é escolhido explicitamente; HTTP/WS permanece permitido apenas no contexto de teste confiável documentado. | Preserva LAN de teste sem converter CORS, Origin ou TLS em autenticação nem aprovar operação pública. | Não; limite proposto para este protótipo. |
| A14 — Compatibilidade e resultados | Primeira revisão explícita do contrato: versão 1; ausência de versão é incompatível. Códigos estáveis são as categorias definidas abaixo; o texto pode ser traduzido. | Dá valores esperados aos testes de compatibilidade e erro sem definir os envelopes/eventos do protocolo, que pertencem ao design. | Não; contrato observável proposto. |

**Open questions: none** que impeçam fechar o escopo confirmado C1/C2; as escolhas ainda não confirmadas estão explicitadas em A1–A14. Não há decisão essencial de arquitetura sendo tomada por silêncio.

**Dúvidas pendentes para outras entregas:** modelo de conta/administração e autorização; provedor/custo/expiração de TURN; necessidade de SFU/LiveKit; hospedagem; identidade de assinatura e política de release; retenção/backup; metas de qualidade entre redes e com seis pessoas. São decisões adiadas, não requisitos aprovados desta entrega.

**Pendência de evidência:** a causa do ruído na abertura continua desconhecida. Bloquear playback fora da chamada e parar tracks obsoletas não prova sua resolução física.

## Acceptance Vocabulary

Tentativa vigente é a operação ainda não cancelada/substituída na conexão, sala e chamada correspondentes. Cada receptor, inclusive o servidor, distingue essa tentativa das anteriores; sair é terminal para ela. Transporte saudável, nos ensaios, significa conexão aberta sem perda/atraso artificial além dos prazos declarados. Prontidão de mídia remota exige conexão de mídia estabelecida e track recebida; presença sozinha não basta. Os prazos são medidos com relógio monotônico e, em testes de domínio, podem ser avançados por relógio controlado. Nenhum prazo corre enquanto o usuário decide sobre uma permissão, exceto o limite explícito do seletor de tela.

Para STAB-40/41 e os erros correlatos, as categorias observáveis propostas são: `INCOMPATIBLE_PROTOCOL` para versão diferente de 1/ausente; `INVALID_EVENT` para JSON/estrutura/tipo inválido; `INVALID_INPUT` para conteúdo ou configuração inválidos; `ROOM_MISMATCH` para destino divergente; `OPERATION_CONFLICT` para reutilização conflitante de ID; `RATE_LIMITED` para cota; `CALL_FULL` para capacidade; `TIMEOUT` para prazo; `PERSISTENCE_FAILED` para falha antes do commit; `MEDIA_FAILED` para aquisição/publicação/negociação que falhou; `BOOTSTRAP_FAILED` para banco/listener que não abre; `SHUTDOWN_FAILED` para limpeza incompleta; `ALREADY_RUNNING` para segundo host. Esses códigos expressam resultados, sem determinar biblioteca, mensagens de fio ou divisão de componentes. Falha de broadcast depois do commit conserva o recibo de sucesso da persistência e registra separadamente a fase de entrega.

Uma configuração ICE válida para os ensaios é um array, inclusive vazio, de objetos com urls como string não vazia ou lista não vazia de strings não vazias, usando stun/stuns/turn/turns. username e credential, quando presentes, são strings. PORT é inteiro entre 0 e 65535. Essas definições concretizam STAB-49/50 e não aprovam credenciais estáticas em serviço público. Somente o frame principal da interface local confiável pode exercer os privilégios de STAB-48; subframes, mesmo sob uma janela confiável, não recebem essa autorização.

## User Stories

Prioridades das histórias orientam esta estabilização: P1 protege captura, texto e encerramento; P2 completa a base de teste confiável. As prioridades originais R01–R26 permanecem na matriz de destinação. Cada critério possui um ID próprio. WHEN/WHILE/IF/THEN/WHERE/SHALL são as palavras da notação EARS; SHALL indica a obrigação proposta.

### P1: US1 — Captura pertence à tentativa atual

**User Story**: Como participante, quero entrar, cancelar e sair sem deixar meu microfone ou minha tela capturando sem controle.

**Why P1**: R01/R02 permitem recursos ativos após cancelamento ou recusa de admissão.

**Acceptance Criteria**:
1. WHEN o aplicativo abrir ou recarregar fora de uma chamada THEN o Conversa SHALL permanecer sem iniciar captura de microfone, tela ou áudio do sistema. (**STAB-01**)
2. WHILE houver uma aquisição de mídia de um tipo pendente na mesma tentativa o Conversa SHALL impedir outra aquisição concorrente desse tipo. (**STAB-02**)
3. IF uma aquisição retornar depois de cancelamento, saída, substituição de tentativa ou fechamento THEN o Conversa SHALL encerrar todas as tracks retornadas dentro de A2, sem incorporá-las à tentativa atual. (**STAB-03**)
4. WHILE o controlador de chamada estiver definitivamente fechado o Conversa SHALL rejeitar ações que iniciem captura antes de chamar APIs de mídia. (**STAB-04**)
5. WHEN ocorrer saída, desconexão, troca de sala, desmontagem ou fechamento da janela THEN o Conversa SHALL encerrar todas as tracks já adquiridas por essa chamada dentro de A2. (**STAB-05**)
6. WHEN chegar confirmação de admissão da tentativa vigente THEN o Conversa SHALL representar a participação admitida dessa tentativa, sem inferir admissão de respostas de outra tentativa. (**STAB-06**)
7. IF a admissão for recusada por qualquer motivo ou exceder A1 THEN o Conversa SHALL desfazer toda captura provisória dessa tentativa dentro de A2, independentemente do texto localizado do erro. (**STAB-07**)
8. WHILE houver captura ou admissão pendente o Conversa SHALL oferecer uma ação de cancelamento acessível que encerre a tentativa. (**STAB-08**)
9. IF o microfone for negado ou indisponível THEN o Conversa SHALL permitir admissão em modo de escuta e compartilhamento sem track de microfone. (**STAB-09**)

**Independent Test**: Controlar a ordem de resolução de duas permissões; sair e reentrar antes da primeira resposta; clicar repetidamente em ativar microfone; tentar entrar após close. Inventariar todas as tracks retornadas, não apenas a referência final. Recusar admissão por sala cheia, cota e erro genérico; nunca deve sobrar track live nem ser necessário reconhecer texto em português. A captura pendente deve poder ser cancelada por teclado.

### P1: US2 — Tela termina de forma consistente

**User Story**: Como participante, quero saber se estou compartilhando e conseguir parar mesmo quando um destinatário falha.

**Why P1**: R03 deixa captura, senders e interface em estados divergentes.

**Acceptance Criteria**:
1. WHEN o usuário iniciar compartilhamento THEN o Conversa SHALL exigir seleção explícita da fonte para aquela tentativa, com áudio do sistema somente se solicitado nessa execução conforme A9. (**STAB-10**)
2. IF o seletor for cancelado, expirar em 60 s ou retornar após a tentativa terminar THEN o Conversa SHALL terminar essa operação sem conservar captura de tela ou áudio do sistema. (**STAB-11**)
3. IF a publicação para qualquer peer falhar ou não concluir em 8 s após obter a captura THEN o Conversa SHALL encerrar todas as tracks do novo compartilhamento dentro de A2. (**STAB-12**)
4. IF uma publicação parcial for abortada THEN o Conversa SHALL cessar o envio dessa captura por todos os peers locais dentro de A2, inclusive quando a remoção de um sender falhar. (**STAB-13**)
5. WHEN ocorrer parada pelo aplicativo ou encerramento da fonte pelo sistema THEN o Conversa SHALL encerrar localmente todas as tracks de tela e áudio do sistema dentro de A2. (**STAB-14**)
6. WHEN o compartilhamento terminar por parada, cancelamento ou erro THEN o Conversa SHALL convergir para estado local sem compartilhamento em até 1 s, mesmo se a notificação de rede ou um sender falhar. (**STAB-15**)
7. IF iniciar ou parar tela falhar THEN o Conversa SHALL preservar a admissão e o estado anterior do microfone nos peers saudáveis. (**STAB-16**)
8. WHEN o compartilhamento terminar com transporte saudável THEN o Conversa SHALL confirmar aos participantes da sala o estado sem compartilhamento em até 8 s, inclusive após erro parcial ou cota esgotada. (**STAB-68**)

**Independent Test**: Usar dois peers, falhar a substituição em apenas um e conferir captura encerrada, ausência de mídia residual nos dois e controles utilizáveis. Repetir com falha na remoção, onended, cancelamento e saída enquanto o seletor está aberto. Em transporte saudável, a presença remota deve refletir sharing=false após a operação confirmada; se o transporte falhar, aplica-se STAB-32. Não confundir fim local com recebimento instantâneo pelo outro computador.

### P1: US3 — Texto mantém destino e resultado

**User Story**: Como participante, quero que cada mensagem pertença à sala escolhida e que meu texto continue recuperável se o envio não for confirmado.

**Why P1**: R04/R05 afetam o destinatário da conversa e descartam conteúdo.

**Acceptance Criteria**:
1. WHILE uma troca de sala aguardar confirmação o Conversa SHALL impedir submissão de mensagens, mantendo a sala confirmada como contexto visível da composição. (**STAB-17**)
2. WHEN um envio for submetido THEN o Conversa SHALL fixar sua sala explícita e seu identificador de operação, que não mudam em resposta a navegação ou reenvio. (**STAB-18**)
3. IF a sala explícita não corresponder à sala confirmada no servidor para aquela operação THEN o serviço SHALL rejeitar o envio sem persistir mensagem em qualquer sala. (**STAB-19**)
4. WHEN uma troca de sala, desconexão ou reconexão ocorrer na mesma execução THEN o Conversa SHALL preservar separadamente o texto recuperável de cada sala, incluindo envios ainda sem confirmação. (**STAB-20**)
5. WHEN o servidor aceitar um envio THEN o serviço SHALL confirmar somente após persistência, com recibo que identifique operação, mensagem, sala e ordem de inserção. (**STAB-21**)
6. IF o transporte não aceitar o envio, o servidor recusá-lo ou a confirmação exceder A1 THEN o Conversa SHALL manter o texto integral recuperável na sala original como rascunho ou envio pendente/falho, sem apresentá-lo como confirmado. (**STAB-22**)
7. WHEN a mesma operação com a mesma sala e conteúdo for reenviada THEN o Conversa SHALL apresentar o mesmo resultado persistido, com uma única mensagem no banco e na lista do cliente. (**STAB-23**)
8. IF um identificador de operação já usado for apresentado com outra sala ou conteúdo THEN o serviço SHALL rejeitar o conflito sem alterar o registro original. (**STAB-24**)
9. IF a entrega ou o broadcast falhar depois do commit THEN o serviço SHALL conservar o resultado persistido consultável pelo reenvio da mesma operação, sem declarar que o commit foi desfeito. (**STAB-25**)
10. WHEN o serviço reiniciar com o mesmo banco THEN o serviço SHALL conservar mensagens confirmadas e os resultados de deduplicação de A6. (**STAB-26**)
11. IF o texto após trim estiver vazio ou exceder 2000 unidades UTF-16 THEN o serviço SHALL rejeitar o envio sem gravar mensagem ou descartar o texto recuperável do cliente. (**STAB-27**)

**Independent Test**: Atrasar joined em 800 ms na troca geral→projetos e tentar submeter pelo formulário e por evento direto. Conferir banco e clientes das duas salas, incluindo ausência de entrega à sala errada. Exercitar socket fechado, rejeição, erro de escrita, commit com confirmação perdida, reenvio simultâneo e reinício. Testar 0/1/2000/2001 unidades após trim e conteúdo com espaços preservado no rascunho em caso de recusa. Deduplicar usando o recibo, sem tratar nome como credencial. A5 delimita a durabilidade no cliente.

### P1: US4 — Sair sempre libera a chamada

**User Story**: Como participante, quero sair e liberar minha vaga mesmo após muitas ações ou perda de conexão.

**Why P1**: R06 bloqueia a saída pelo mesmo orçamento usado na sinalização.

**Acceptance Criteria**:
1. WHEN chegar uma saída válida da tentativa vigente THEN o serviço SHALL processá-la mesmo com o orçamento de mensagens ou sinalização esgotado. (**STAB-28**)
2. WHEN essa saída for processada THEN o serviço SHALL convergir em até 1 s para participante fora da chamada, sem compartilhamento e sem vaga ocupada, com confirmação correlacionada. (**STAB-29**)
3. WHEN a saída da mesma tentativa for repetida THEN o serviço SHALL devolver o mesmo estado terminal sem nova admissão ou erro de recurso já encerrado. (**STAB-30**)
4. WHILE o usuário estiver fora de chamada admitida ou com áudio recebido silenciado o desktop SHALL manter reprodução de mídia bloqueada, inclusive após recarga e eventos tardios. (**STAB-31**)
5. IF o transporte for perdido sem saída confirmada THEN o serviço SHALL remover a participação em chamada dentro de A11, sem condicionar a liberação à reconexão. (**STAB-32**)

**Independent Test**: Esgotar a cota com sinalização sintética e sair; outro cliente observa vaga liberada e o sétimo participante consegue entrar. Repetir a saída e injetar admissão/sinalização antigas: nenhuma captura ou playback pode voltar. Interromper a conexão e controlar o heartbeat; verificar A11 sem esperar rede física. STAB-03/05 exigem a liberação local sem aguardar confirmação.

### P1: US5 — Servidor e desktop encerram com prazo

**User Story**: Como usuário e operador do protótipo, quero fechar o aplicativo ou o servidor sem sockets abandonados impedindo a saída.

**Why P1**: R07 reproduz encerramento que não conclui após Upgrade desconhecido.

**Acceptance Criteria**:
1. WHEN um Upgrade sem consumidor registrado chegar em modo de produção THEN o serviço SHALL rejeitá-lo com HTTP 404 e finalizar o socket em até 1 s. (**STAB-33**)
2. WHEN um Upgrade pertencente ao HMR registrado chegar em desenvolvimento THEN o serviço SHALL permitir que o consumidor de desenvolvimento o processe. (**STAB-34**)
3. WHILE o serviço estiver encerrando o serviço SHALL recusar novas admissões HTTP/WS com HTTP 503 em conexões ainda atendíveis. (**STAB-35**)
4. WHEN ocorrer fechamento do serviço, saída do desktop, SIGINT ou SIGTERM THEN o sistema SHALL liberar listeners, sockets HTTP/WS/Upgrade, temporizadores e banco dentro de A4. (**STAB-36**)
5. IF houver pedidos repetidos de encerramento ou falha em uma etapa de limpeza THEN o sistema SHALL executar a limpeza restante dentro do prazo original, com resultado terminal único e sem rejeições assíncronas não tratadas. (**STAB-37**)

**Independent Test**: Abrir /unused-upgrade, conexões HTTP ociosas e WS normais; chamar close duas vezes simultaneamente. Injetar falha em uma etapa e conferir ausência de handles próprios pendentes, porta liberada e banco reabrível. Exercitar os dois sinais em processos filhos e a saída do Electron. Confirmar HMR em desenvolvimento. Prazo máximo não autoriza descartar commit confirmado nem forçar saída antes de tentar as demais limpezas.

### P2: US6 — Sessão e mídia não ficam presas em estados antigos

**User Story**: Como participante, quero distinguir espera, admissão e conexão real, com uma forma explícita de tentar novamente após falhas.

**Why P2**: R10/R13/R14 ampliam as corridas críticas; R26 apresenta presença como conexão de mídia.

**Acceptance Criteria**:
1. IF qualquer fase de A1 exceder seu prazo THEN o Conversa SHALL terminar essa espera com erro identificável e permitir uma nova tentativa manual. (**STAB-38**)
2. IF uma resposta HTTP, evento WS, callback ou sinal pertencer a conexão, sala ou tentativa de chamada substituída THEN o Conversa SHALL descartá-lo sem modificar o estado vigente. (**STAB-39**)
3. IF um evento recebido tiver versão incompatível, tipo desconhecido ou campos com tipo/limite inválido THEN o receptor SHALL recusá-lo sem aplicar estado nem encaminhar sinalização inválida. (**STAB-40**)
4. WHEN uma operação com resposta terminal falhar THEN o protocolo SHALL identificar código estável, operação e fase, independentemente do texto apresentado ao usuário. (**STAB-41**)
5. IF um peer falhar ou não alcançar mídia pronta em 15 s desde o início da negociação THEN o Conversa SHALL terminar essa negociação como falha recuperável por ação manual, sem manter indicação indefinida de conexão em curso. (**STAB-42**)
6. WHILE candidatos aguardarem descrição remota o Conversa SHALL limitar sua pendência e validade conforme A7, sem reutilizá-los em outra tentativa. (**STAB-43**)
7. WHILE não houver mídia remota pronta o Conversa SHALL distinguir presença/admissão de mídia conectada, oferecendo entrada para assistir quando o usuário estiver fora da chamada em vez de apresentar vídeo inexistente como AO VIVO. (**STAB-44**)

**Independent Test**: Abrir WS sem hello; omitir confirmação de sala e de admissão; entregar respostas de tentativas anteriores depois da atual. Enviar JSON inválido, null, arrays, candidato de tipo incorreto e versão incompatível a ambos os receptores. Falhar oferta inicial e tentar novamente; controlar 129 candidatos e expiração. Observar a indicação sem outro participante e durante mídia conectada/falha. O contrato deve definir formatos/limites por tipo antes da implementação, sem exigir uma biblioteca de schema nesta fase.

### P2: US7 — Entrada, preferências e permissões são coerentes

**User Story**: Como usuário desktop, quero reencontrar minhas preferências, entrar na sala do endereço colado e conceder apenas a captura solicitada.

**Why P2**: R11/R12 quebram a entrada diária; R17/R18 deixam configuração e fronteiras privilegiadas imprecisas.

**Acceptance Criteria**:
1. WHEN o desktop reiniciar com o mesmo userData e outra porta local THEN o Conversa SHALL restaurar nome, endereço e qualidade conforme A9, mantendo áudio do sistema desligado no início da execução. (**STAB-45**)
2. WHEN um endereço válido com room=cafe for colado em Servidor do grupo THEN o Conversa SHALL usar a origem indicada e selecionar cafe após confirmação dessa sala. (**STAB-46**)
3. IF o endereço usar esquema não HTTP/HTTPS, embutir credenciais ou indicar sala inexistente THEN o Conversa SHALL apresentar erro específico sem ingressar silenciosamente em outra sala. (**STAB-47**)
4. IF uma permissão ou IPC privilegiado vier de frame/origem não confiável, ou solicitar câmera fora do caso de uso THEN o desktop SHALL negá-lo sem conceder captura ou controle de reprodução. (**STAB-48**)
5. IF PORT ou qualquer entrada ICE configurada tiver formato inválido, ou o bootstrap falhar ao abrir banco/listener THEN o sistema SHALL recusar a inicialização com causa identificável e liberar os recursos já abertos. (**STAB-49**)
6. WHEN desktop e servidor separado receberem a mesma configuração ICE válida THEN o sistema SHALL expor a mesma configuração efetiva de mídia para testes, respeitando os limites de acesso de C1 e A13. (**STAB-50**)

**Independent Test**: Reiniciar com o mesmo perfil e duas portas; conferir que duas janelas do mesmo processo usam o mesmo host. Colar convite para cafe, endereço inválido e sala removida/inexistente; não aceitar fallback silencioso. Testar frame principal confiável, subframe/origem distinta, câmera e IPC de outra janela para seleção alheia. Iniciar com porta ocupada, PORT fora de 0–65535/não inteiro, ICE não-array, urls ausente/não-string nem lista de strings e credencial não-string. Formato válido permite stun/stuns/turn/turns e credencial textual opcional em teste. Não introduz emissão de credenciais nem valida um serviço TURN externo.

### P2: US8 — Dados e recursos mantêm limites verificáveis

**User Story**: Como operador do teste, quero preservar o histórico existente e impedir que um cliente lento ou host duplicado comprometa a sessão inteira.

**Why P2**: R15/R16 afetam operação e persistência. A cobertura é parcial: não equivale a política de produção.

**Acceptance Criteria**:
1. WHEN uma nova conexão ou criação de sala exceder os tetos de A8 THEN o serviço SHALL recusá-la sem expulsar participantes já admitidos ou criar registros excedentes. (**STAB-51**)
2. IF a fila de saída de um socket exceder 1 MiB THEN o serviço SHALL encerrar esse consumidor lento sem bloquear confirmações destinadas aos clientes saudáveis. (**STAB-52**)
3. WHEN o histórico de uma sala for solicitado THEN o serviço SHALL devolver os últimos 200 registros em ordem de inserção, estável para timestamps iguais e sem registros de outra sala. (**STAB-53**)
4. WHEN a seleção dos últimos 200 registros for analisada em uma sala com 10000 mensagens THEN o serviço SHALL evitar ordenação temporária de todo o histórico da sala antes do limite. (**STAB-54**)
5. IF houver erro de escrita, contenda de banco ou incompatibilidade de dados existentes THEN o sistema SHALL preservar os registros anteriores sem confirmação falsa ou exclusão automática de mensagens. (**STAB-55**)
6. WHEN um segundo host desktop tentar abrir o mesmo userData ativo THEN o desktop SHALL recusar esse host adicional de forma identificável, preservando as janelas do host original. (**STAB-56**)

**Independent Test**: Conectar 24 clientes e recusar o 25º; criar a 100ª sala e recusar a 101ª; admitir seis e recusar o sétimo. Induzir fila de saída acima do teto e confirmar entrega em um consumidor saudável. Consultar 10000 mensagens com timestamps repetidos e conferir EXPLAIN do trecho que seleciona a página, sem proibir ordenação apenas dos 200 resultados finais. Reabrir cópia de banco 0.1.1 com salas e mensagens antigas e simular SQLITE_BUSY/falha de escrita. Não executar esses ensaios sobre o banco pessoal.

### P2: US9 — Interface representa ações e estados reais

**User Story**: Como participante que usa teclado e lê o histórico, quero controles alcançáveis e informação coerente com o estado real.

**Why P2**: R19 reproduz falha modal e R26 mistura estados reais com rótulos enganosos.

**Acceptance Criteria**:
1. WHILE um modal estiver aberto o Conversa SHALL manter o foco dentro dele desde a abertura, com ciclo Tab/Shift+Tab e fundo sem interação. (**STAB-57**)
2. WHEN Escape ou a ação de fechar encerrar um modal THEN o Conversa SHALL restaurar o foco ao acionador ainda disponível ou a um controle equivalente do contexto atual. (**STAB-58**)
3. WHERE houver texto normal nos três seletores de R19 o Conversa SHALL apresentar contraste de pelo menos 4,5:1 contra o fundo efetivo. (**STAB-59**)
4. WHEN uma mensagem chegar durante leitura distante mais de 100 px do fim THEN o Conversa SHALL preservar a posição de leitura. (**STAB-60**)
5. WHEN mensagens de convidados distintos tiverem o mesmo nome THEN o Conversa SHALL agrupá-las somente se houver a mesma identidade de autoria registrada, nunca inferida do nome, conforme A10. (**STAB-61**)
6. WHILE houver captura de tela ativa e a qualidade selecionada mudar o Conversa SHALL indicar que a preferência vale para a próxima captura, sem prometer a resolução efetiva da atual. (**STAB-62**)

**Independent Test**: Percorrer criação de sala, configurações e seletor apenas por teclado; fechar o seletor precisa cancelar a operação de STAB-11. Medir as cores de composer-footer, app-footer e space-header .eyebrow. Receber mensagens enquanto se lê acima do limiar; duas sessões homônimas e registros legados permanecem visualmente distintos. Os indicadores de voz/tela são cobertos por STAB-44. Versão visual e botão de espaço sem ação continuam pendências menores de R26.

### P2: US10 — Verificação detecta defeitos e falhas são explicáveis

**User Story**: Como mantenedor, quero reproduções que diferenciem defeito de correção e diagnóstico que explique falhas sem registrar conteúdo sensível.

**Why P2**: R20/R21 impedem confiar na aprovação; R25 descarta evidência necessária inclusive para investigar o ruído.

**Acceptance Criteria**:
1. WHEN a suíte de aprovação da estabilização for executada contra os comportamentos defeituosos R01–R07 THEN a suíte SHALL reprovar cada um por violação dos resultados definidos nesta spec. (**STAB-63**)
2. WHEN o diagnóstico de áudio for solicitado pelo código sem artifacts/build.json THEN o diagnóstico SHALL executar nesse modo com dados isolados, sem depender de manifesto de release. (**STAB-64**)
3. IF launch, fechamento do desktop ou uma espera WS de teste falhar THEN o harness SHALL finalizar seus próprios recursos e esperas dentro de 5 s, sem processos/listeners de teste abandonados. (**STAB-65**)
4. WHERE flags booleanas de teste forem fornecidas o harness SHALL interpretar 0 como falso e 1 como verdadeiro, rejeitando valores não reconhecidos. (**STAB-66**)
5. WHEN ocorrer erro de captura, reprodução, protocolo, persistência ou encerramento THEN o sistema SHALL registrar localmente fase, código, correlação e versão/ambiente suficientes para identificar a operação, excluindo texto de mensagens, credenciais, tokens, thumbnails e mídia capturada. (**STAB-67**)

**Independent Test**: Exercitar regressões com expectativa correta e falhas controladas, sem transformar exit zero das sondagens atuais em aprovação. Rodar diagnóstico de origem sem manifesto em cópia temporária. Simular launch bloqueado, close rejeitado, WS fechado e flags 0/1/inválida. Falhar play e inventário de fontes: diferenciar falha técnica de cancelamento. Inspecionar registros com valores sentinela de conteúdo e segredo para confirmar ausência. O ruído físico requer novo ensaio sem --mute-audio e sem microfone sintético; seu resultado deve ser registrado como observado, não inferido desses testes.

## Edge Cases

| Caso limite | Resultado definido em |
| --- | --- |
| Permissão antiga resolve após sair/reentrar; controlador fechado recebe ação | STAB-02–05 |
| Chamada recusada por cota, sala cheia ou mensagem de erro traduzida | STAB-06–09, STAB-41 |
| Um peer aceita tela e outro rejeita; remoção de sender também falha | STAB-12–16 |
| Seletor expira, janela fecha ou fonte termina pelo sistema | STAB-03/05/11/14/15/68 |
| Troca para B sem confirmação enquanto A ainda aparece | STAB-17–20, STAB-39 |
| Commit acontece e ack se perde; reenvio concorrente ou após reinício | STAB-21–26 |
| Dois convidados têm mesmo nome; registros antigos não têm authorId | STAB-61, A10 |
| Cota esgotada, saída repetida ou conexão desaparece | STAB-28–32 |
| Upgrade desconhecido, HMR legítimo e encerramento concorrente | STAB-33–37 |
| WS abre sem hello; resposta do fetch/socket anterior chega depois | STAB-38–41 |
| Candidato inválido, candidato antigo e fila cheia | STAB-40/42/43 |
| Persistência bloqueada, banco antigo e segundo host do mesmo perfil | STAB-49/55/56 |
| Teste falha antes do try atual ou ao fechar o primeiro recurso | STAB-64–66 |

## Implicit Requirement Dimensions

| Dimensão | Cobertura ou N/A com motivo |
| --- | --- |
| Validação e limites de entrada | STAB-19/24/27/40/47/49/51, A7/A8. Valores de fronteira estão nos testes independentes. |
| Falha e falha parcial | STAB-03/07/11–16/22/25/37/38/49/55/65. |
| Idempotência, retry e duplicação | STAB-18/23–26/30/37/39. Reenvio/reentrada são manuais; automação está fora de escopo. |
| Fronteira de acesso e rate limits | STAB-19/28/40/48/51/52. R08/R09 permanecem bloqueadores externos; nomes e Origin não dão privacidade. O ajuste de cotas por classe além de preservar saída será definido no design, sem valores presumidos como aprovados. |
| Concorrência e ordem | STAB-02–07/17–26/29/37/39/53/56. |
| Ciclo e expiração de dados | STAB-20/26/43/55; A5/A6/A9/A10. Exclusão automática N/A porque nenhuma política de retenção foi aprovada; mensagens antigas são preservadas. |
| Observabilidade | STAB-38/41/44/49/67; evidências separadas por código, desktop, hardware e artefato. |
| Falha de dependências externas | STAB-07/12–16/22/38/42/49. Pagamentos e serviços de terceiros N/A porque não fazem parte do protótipo estabilizado. |
| Integridade de transições | STAB-03–08/15/17–20/28–32/35–44. Saída e tentativa substituída são terminais; eventos tardios não as revertem. |

## Requirement Traceability

Todos os requisitos estão em **Specify**, com status **Pending**. Nenhuma linha significa implementação aprovada ou achado corrigido. Os apontamentos de código identificam o comportamento atual que fundamenta o requisito, não a evidência de seu atendimento.

| Requirement ID | Story | Achados | Evidência atual (file:line) | Phase | Status |
| --- | --- | --- | --- | --- | --- |
| STAB-01 | US1 | R01, R20 | src/rtc.js:8; electron/main.js:50 | Specify | Pending |
| STAB-02 | US1 | R01 | src/rtc.js:8; src/rtc.js:92 | Specify | Pending |
| STAB-03 | US1 | R01, R03 | src/rtc.js:8; src/rtc.js:106 | Specify | Pending |
| STAB-04 | US1 | R01 | src/rtc.js:130 | Specify | Pending |
| STAB-05 | US1 | R01, R02, R03, R26 | src/rtc.js:121; src/main.jsx:101 | Specify | Pending |
| STAB-06 | US1 | R02, R13 | src/main.jsx:81; server/service.js:86 | Specify | Pending |
| STAB-07 | US1 | R02 | src/main.jsx:90; src/rtc.js:8 | Specify | Pending |
| STAB-08 | US1 | R01, R02 | src/main.jsx:108; src/main.jsx:142 | Specify | Pending |
| STAB-09 | US1 | R02 | src/rtc.js:14 | Specify | Pending |
| STAB-10 | US2 | R03, R17 | electron/main.js:25; src/rtc.js:106 | Specify | Pending |
| STAB-11 | US2 | R01, R03 | electron/main.js:30; src/main.jsx:150 | Specify | Pending |
| STAB-12 | US2 | R03 | src/rtc.js:106 | Specify | Pending |
| STAB-13 | US2 | R03 | src/rtc.js:112; src/rtc.js:118 | Specify | Pending |
| STAB-14 | US2 | R03 | src/rtc.js:111; src/rtc.js:115 | Specify | Pending |
| STAB-15 | US2 | R03, R13 | src/rtc.js:119; src/main.jsx:113 | Specify | Pending |
| STAB-16 | US2 | R03, R14 | src/rtc.js:106; src/rtc.js:115 | Specify | Pending |
| STAB-68 | US2 | R03, R06, R13 | src/rtc.js:119; server/service.js:95 | Specify | Pending |
| STAB-17 | US3 | R04 | src/main.jsx:101; src/main.jsx:144 | Specify | Pending |
| STAB-18 | US3 | R04, R05, R13 | src/main.jsx:144; server/service.js:75 | Specify | Pending |
| STAB-19 | US3 | R04 | server/service.js:72 | Specify | Pending |
| STAB-20 | US3 | R04, R05 | src/main.jsx:78; src/main.jsx:120 | Specify | Pending |
| STAB-21 | US3 | R05, R13, R16 | server/service.js:75 | Specify | Pending |
| STAB-22 | US3 | R05 | src/main.jsx:46; src/main.jsx:144 | Specify | Pending |
| STAB-23 | US3 | R05, R13 | server/service.js:75; src/main.jsx:87 | Specify | Pending |
| STAB-24 | US3 | R05, R13 | server/service.js:72 | Specify | Pending |
| STAB-25 | US3 | R05, R16, R25 | server/service.js:76; server/service.js:107 | Specify | Pending |
| STAB-26 | US3 | R05, R16 | server/service.js:11; tests/server.test.js:62 | Specify | Pending |
| STAB-27 | US3 | R05, R13 | server/service.js:73; src/main.jsx:144 | Specify | Pending |
| STAB-28 | US4 | R06 | server/service.js:59; server/service.js:92 | Specify | Pending |
| STAB-29 | US4 | R06, R13 | server/service.js:92 | Specify | Pending |
| STAB-30 | US4 | R06, R13 | server/service.js:92; src/main.jsx:107 | Specify | Pending |
| STAB-31 | US4 | R01, R20, R26 | src/main.jsx:52; electron/main.js:44 | Specify | Pending |
| STAB-32 | US4 | R06, R14 | server/service.js:109; server/service.js:111 | Specify | Pending |
| STAB-33 | US5 | R07 | server/service.js:42 | Specify | Pending |
| STAB-34 | US5 | R07, R18 | server/index.js:18 | Specify | Pending |
| STAB-35 | US5 | R07, R18 | server/service.js:42; server/service.js:118 | Specify | Pending |
| STAB-36 | US5 | R07 | server/service.js:118; electron/main.js:72; server/index.js:25 | Specify | Pending |
| STAB-37 | US5 | R07, R25 | server/service.js:118; server/index.js:25 | Specify | Pending |
| STAB-38 | US6 | R02, R05, R10 | src/main.jsx:61; src/main.jsx:68 | Specify | Pending |
| STAB-39 | US6 | R01, R04, R13, R14 | src/main.jsx:69; src/main.jsx:92; src/rtc.js:72 | Specify | Pending |
| STAB-40 | US6 | R13 | server/service.js:61; src/main.jsx:69 | Specify | Pending |
| STAB-41 | US6 | R02, R05, R06, R13, R25 | server/service.js:40; src/main.jsx:90 | Specify | Pending |
| STAB-42 | US6 | R14 | src/rtc.js:31; src/rtc.js:62 | Specify | Pending |
| STAB-43 | US6 | R13, R14, R15 | src/rtc.js:27; src/rtc.js:85 | Specify | Pending |
| STAB-44 | US6 | R14, R26 | src/main.jsx:132; src/main.jsx:141 | Specify | Pending |
| STAB-45 | US7 | R11 | src/main.jsx:21; electron/main.js:20 | Specify | Pending |
| STAB-46 | US7 | R12 | src/main.jsx:43; src/main.jsx:59; src/main.jsx:123 | Specify | Pending |
| STAB-47 | US7 | R12, R18 | src/main.jsx:59; src/main.jsx:76 | Specify | Pending |
| STAB-48 | US7 | R17 | electron/main.js:11; electron/main.js:23; electron/preload.cjs:2 | Specify | Pending |
| STAB-49 | US7 | R16, R18, R25 | server/index.js:8; server/index.js:22; electron/main.js:13 | Specify | Pending |
| STAB-50 | US7 | R18 | electron/main.js:13; server/index.js:12 | Specify | Pending |
| STAB-51 | US8 | R15 | server/service.js:52; server/service.js:81 | Specify | Pending |
| STAB-52 | US8 | R15 | server/service.js:36 | Specify | Pending |
| STAB-53 | US8 | R16, R20 | server/service.js:23; tests/server.test.js:36 | Specify | Pending |
| STAB-54 | US8 | R16 | server/service.js:15; server/service.js:23 | Specify | Pending |
| STAB-55 | US8 | R15, R16 | server/service.js:11; server/service.js:76 | Specify | Pending |
| STAB-56 | US8 | R16, R18 | electron/main.js:12; electron/main.js:13 | Specify | Pending |
| STAB-57 | US9 | R19 | src/main.jsx:16 | Specify | Pending |
| STAB-58 | US9 | R19 | src/main.jsx:16; src/main.jsx:150 | Specify | Pending |
| STAB-59 | US9 | R19 | src/style.css:1; review/data-probes.json:43 | Specify | Pending |
| STAB-60 | US9 | R26 | src/main.jsx:51 | Specify | Pending |
| STAB-61 | US9 | R16, R26 | server/service.js:14; src/main.jsx:144 | Specify | Pending |
| STAB-62 | US9 | R26 | src/main.jsx:149; src/rtc.js:108 | Specify | Pending |
| STAB-63 | US10 | R20, R22 | tests/server.test.js:36; review/REVISAO_COMPLETA.md:210 | Specify | Pending |
| STAB-64 | US10 | R21 | scripts/startup-audio-check.mjs:7 | Specify | Pending |
| STAB-65 | US10 | R21 | scripts/desktop-smoke.mjs:15; tests/server.test.js:14 | Specify | Pending |
| STAB-66 | US10 | R21 | scripts/desktop-smoke.mjs:12; scripts/startup-audio-check.mjs:30 | Specify | Pending |
| STAB-67 | US10 | R25 | server/service.js:54; server/service.js:107; src/main.jsx:13; electron/main.js:34 | Specify | Pending |

**Coverage:** 68 requisitos, 68 associados a histórias e evidências atuais; zero mapeados a tarefas porque Tasks não foi iniciado. Todos Pending. Nenhuma cobertura é evidência de implementação.

## Review Findings Disposition

“Incluído” significa que há requisito de estabilização, não correção concluída. “Parcial” mantém explicitamente o restante aberto. Nenhum dos 26 achados é encerrado por esta sessão.

| Achado | Prioridade original | Destinação | Rastreabilidade e limite |
| --- | --- | --- | --- |
| R01 | P1 | Incluído | STAB-01–05/08/11/39; aquisição concorrente e obsoleta, fechamento terminal. |
| R02 | P1 | Incluído | STAB-05–09/38/41; admissão correlacionada e compensação de qualquer recusa. |
| R03 | P1 | Incluído | STAB-03/05/10–16/68; rollback total de tela e parada independente dos peers. |
| R04 | P1 | Incluído | STAB-17–20/39; destino fixo, barreira de troca e descarte de resposta antiga. |
| R05 | P1 | Incluído | STAB-18/20–27/38/41; recibo após commit, preservação e reenvio idempotente manual. |
| R06 | P1 | Incluído | STAB-28–32/41/68; saída fora da cota de ações e liberação terminal. |
| R07 | P1 | Incluído | STAB-33–37; ownership de Upgrade e encerramento com prazo. |
| R08 | P1 | Adiado, bloqueia privacidade/publicação | C1 e Out of Scope. Não há requisito de contas/autorização nesta entrega; salas continuam de convidados. |
| R09 | P1 | Adiado, bloqueia TURN público | C1 e Out of Scope. STAB-50 não sana a entrega pública de segredo; não afirmar R09 corrigido. |
| R10 | P2 | Incluído | STAB-38/39; prazo também após WS abrir, até hello e demais confirmações. |
| R11 | P2 | Incluído | STAB-45, A9; preferências por perfil independentes da porta, sem persistir consentimento de áudio do sistema. |
| R12 | P2 | Parcial | STAB-46/47; preservar sala no endereço colado. Convites autenticados/expiráveis e protocolo desktop ficam adiados. |
| R13 | P2 | Incluído como contrato de resultados | STAB-06/18–26/29/30/39–43; versão, validação e correlação. Formatos completos são trabalho de design, não prescritos aqui. |
| R14 | P2 | Parcial | STAB-16/32/39/42–44; negociação limitada, limpeza e nova tentativa manual. ICE restart, renovação TURN e recuperação automática ficam adiados. |
| R15 | P2 | Parcial | STAB-43/51/52/55, A8; conexões, filas e limites existentes. Retenção, limites por identidade e carga de produção ficam adiados. |
| R16 | P2 | Parcial | STAB-21/25/26/49/53–56/61; ordem, seleção, preservação e contenda. Modelo de membros, migrações gerais e escala ficam adiados. |
| R17 | P2 | Incluído | STAB-10/48; menor privilégio e validação de frame/origem. Não equivale a auditoria de toda a segurança Electron. |
| R18 | P2 | Parcial | STAB-34/35/47/49/50/56, A13; configuração e bootstrap coerentes. TLS/proxy/readiness de produção e operação remota pública ficam adiados. |
| R19 | P2 | Parcial | STAB-57–59; teclado modal e três contrastes identificados. Auditoria completa, zoom e leitor de tela permanecem pendentes. |
| R20 | P2 | Parcial | STAB-63 e critérios de sucesso; resultados esperados substituem falsa aprovação por probes. CI completo e qualidade física/rede prolongada permanecem pendentes. |
| R21 | P2 | Incluído | STAB-64–66; diagnóstico independente do manifesto e limpeza mesmo com falha anterior à abertura. |
| R22 | P2 | Parcial, arquitetura adiada | Invariantes US1–US8 e STAB-63 fundamentam futuras fronteiras. Não se especificam extrações, tipos, lint, formatação, CI ou Git nesta sessão. |
| R23 | P2 | Adiado, bloqueia distribuição aprovada | Out of Scope. Sem assinatura, instalador ou nova validação do portátil. Device Guard continua pendência operacional. |
| R24 | P3 | Adiado para distribuição | Out of Scope. Staging, retenção de builds e promoção atômica não são alterados por esta spec. |
| R25 | P3 | Incluído com prioridade de suporte P2 | STAB-25/37/41/49/67; falhas distinguíveis e registros sem conteúdo sensível. Causa física do ruído segue desconhecida. |
| R26 | P3 | Parcial | C2; STAB-05/31/44/60–62. Indicadores, leitura e autoria incluídos; versão visual e botão sem ação ficam pendentes. |

**Cobertura dos achados:** 26/26 com destinação; 13 incluídos, 9 parciais e 4 adiados. Incluído/parcial/adiado não altera a contagem de **zero correções nesta sessão**.

## Success Criteria

- [ ] Todos os 68 requisitos possuem evidência de resultado correto e identificação da versão avaliada antes de se declarar esta estabilização implementada.
- [ ] R01–R07 são reproduzíveis como falhas em referência isolada e deixam de ocorrer na candidata; sondagens históricas continuam identificadas como reprodução de defeitos.
- [ ] Nenhuma captura escapa do inventário de tracks nos casos de concorrência, recusa, timeout, erro parcial, cancelamento, troca de sala, desconexão e fechamento.
- [ ] Atraso de sala, confirmação perdida, falha após commit e reenvio não causam mensagem na sala errada, perda silenciosa ou duplicação. A ausência de entrega em outra sala é observada diretamente.
- [ ] Cota esgotada não impede saída; Upgrade desconhecido não impede encerramento; os limites A2/A4/A11 são medidos em ensaios controlados.
- [ ] Há verificação desktop dos fluxos críticos de entrada, escuta sem microfone, dois participantes, áudio RTP nos dois sentidos, seleção/parada de tela, troca de sala e fechamento. RTP/vídeo decodificado não são apresentados como qualidade sonora ou ausência de eco.
- [ ] A abertura normal com hardware real tem procedimento e resultado registrados, sem flags de silêncio ou dispositivo sintético; se o ruído não for reproduzido, registrar essa limitação em vez de declarar sua causa resolvida.
- [ ] Todos os itens parciais/adiados continuam visíveis. Não apresentar esta entrega como salas privadas, serviço público seguro, garantia de seis usuários em redes distintas ou distribuição Windows aprovada.

## Specification Validation

A validação desta sessão é da **spec**, não do produto. Não se executam tarefas de correção nem se produz validation.md de implementação.

- Skill carregada via MCP Agent Skills 0.1.8, usando cliente MCP local por stdio: search_skills → read_skill → fetch_skill_files → prepare_skill_files. Catálogo fixado pelo MCP: @tech-leads-club/skills-catalog@0.17.12; revisão de staging: 9f4c79355600.
- [Skill de origem](<https://github.com/tech-leads-club/agent-skills/blob/bc4f025632b0443ed3450aaec6fe96aec5b9a0c5/packages/skills-catalog/skills/(development)/tlc-spec-driven/SKILL.md>): referências specify, discuss, memory, coding-principles, lessons e code-analysis lidas integralmente. As referências retornadas pelo MCP foram conferidas contra os textos já lidos integralmente; conteúdo idêntico.
- Gate estrutural: **PASS**, validate_spec.py da revisão preparada pelo MCP, com --strict: **exit 0, zero erros, zero avisos**. Executado em 2026-10-24 com Python 3.14.0 portátil em diretório temporário, pois python/python3 do PATH apontam ao atalho da Microsoft Store. O SHA-256 do validador é 2a0b7e334d026f9556c665fbd0386cfa5b17c62a5e921fed52a9422bc27bc006.
- Invocação: `python "C:/Users/welli/.cache/agent-skills-mcp/tlc-spec-driven/9f4c79355600/scripts/validate_spec.py" ".specs/features/estabilizacao/spec.md" --strict`, substituindo python pelo interpretador disponível. O gate examina o Markdown; não valida o aplicativo.
- Conferências adicionais: 68 ACs com 68 IDs únicos, correspondência integral com as 68 linhas de rastreabilidade, 26 achados únicos com destinação e referências locais existentes. A seção Decisions de STATE.md permanece preservada.
- Fechamento semântico: critérios EARS com IDs únicos; distinção entre evidência e proposta; nove dimensões cobertas; perguntas essenciais C1/C2 respondidas; demais padrões registrados como premissas; 26 achados com destinação. Design, Tasks e Execute permanecem não iniciados.
