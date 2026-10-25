# Captura de mídia e saída da chamada Specification

**Data:** 2026-10-25. **Escopo:** Large/Complex. **Fase:** planejamento Design/Tasks, Draft para revisão conjunta. **Referência do código:** `1d97d46`; base do planejamento `cd53044`, branch `main`, árvore limpa no início da retomada. O pedido posterior autorizou [design](design.md) e [tarefas](tasks.md), sem implementação. Os 34 critérios estão In Tasks, nenhum Verified.

**Cronologia atualizada em 2026-10-25:** as restrições C3/C4/C6 delimitam as respectivas entregas históricas de spec, planejamento e investigação. Depois delas, C7 autorizou revisão/correção documental e continuidade da estabilização em sequência. A revisão atual não executa tarefas; os nove itens continuam Draft. A sessão nova retoma após o término comprovado da revisão, conferindo código, gates e propostas técnicas. Ver [relatório de coerência](../../../docs/revisao-coerencia-documental.md) e [Handoff](../../STATE.md).

## Problem Statement

O build local do Conversa foi aprovado, mas essa aprovação não certificou todo o ciclo de vida da mídia. Os achados R01–R03 e R06 da revisão original tratam de microfone perdido entre tentativas, captura mantida após recusa, tela parcialmente publicada e saída bloqueada pela cota. O código mudou desde aquela revisão; é necessário verificar os resultados atuais, aproveitando o que já existe e corrigindo futuramente apenas os gaps demonstrados.

O Discord é a referência de engenharia reversa para a experiência de voz e tela. Esta spec vincula os comportamentos de referência à evidência disponível e define os resultados exigidos do Conversa. Os prazos, a política de compensação e os limites do protótipo são propostas próprias; não são conclusões sobre a implementação interna do Discord.

## Goals

- [ ] Nenhum microfone, vídeo de tela ou áudio do sistema permanece ativo após seu evento terminal, inclusive quando a aquisição resolve depois dele.
- [ ] Iniciar ou parar tela termina em um estado verificável, com preservação da voz nos peers saudáveis após falha parcial.
- [ ] Sair funciona com a cota esgotada, libera a vaga e impede que eventos antigos reativem a tentativa encerrada.
- [ ] Produzir evidência automatizada e física identificada por versão, distinguindo integração, percepção de áudio e referência do Discord.

## Evidence Baseline

Fontes: [revisão completa](../../../review/REVISAO_COMPLETA.md), [resumo da revisão](../../../review/summary.json), [spec de estabilização](../estabilizacao/spec.md), [validação BUILD](../build-confiavel/validation.md), [README](../../../README.md) e [plano proposto](../../../PLANO_PRODUTO.md). As sondagens históricas reproduzem defeitos; exit 0 nelas não significa aprovação. O plano tem afirmações históricas e propostas ainda não aprovadas.

| Fonte no Conversa `1d97d46` | Observação por inspeção | Limite da evidência |
| --- | --- | --- |
| `src/rtc.js:30`, `:54`, `:176`, `:200`, `:210` | Há identificação de tentativa, aquisição de microfone, publicação/compensação de tela e liberação local. | Código presente não comprova todas as ordens de resolução e falhas. |
| `src/main.jsx:79`, `:87`, `:104`, `:118`, `:124` | Há cancelamento do seletor, fechamento por desconexão, controle de reprodução e saída antes da troca de sala. | A entrega MEDIA ainda precisa verificar eventos antigos entre saída e reentrada. |
| `electron/main.js:51`, `:57`, `:76`, `:95`; `electron/policy.js:9`, `:17`, `:20` | Pedidos de captura possuem resolução centralizada e verificação de frame/origem; recarga cancela pedidos. | BUILD verificou callback único em reload/close/Escape, permissões e alguns fluxos integrados. |
| `server/service.js:106`, `:134`, `:137`, `:153` | Saída e parada de tela são isentas da cota; há admissão, confirmação e heartbeat. | O prazo do heartbeat precisa ser medido também com último pong fora do alinhamento do temporizador. |
| `tests/rtc.test.js:41–114`; `tests/service.test.js:54`, `:114`; `scripts/desktop-capture-check.mjs:33`, `:39`, `:49`, `:60` | Existem asserções de captura obsoleta, compensação, saída e callback único. | São candidatos a evidência reutilizável; cada valor esperado deve ser comparado a esta spec antes de marcar Verified. |

O relatório BUILD aprovou 11 critérios BUILD, 50/50 testes Node e 12 gates em `58be3ed`, sem certificar todos os STAB. Seus smokes usam mídia sintética. Nenhum teste do aplicativo foi reexecutado para declarar atendimento MEDIA nas entregas de Specify e planejamento.

## Discord Reference and Reverse Engineering

| ID | Fonte e natureza | O que está estabelecido | O que permanece desconhecido |
| --- | --- | --- | --- |
| D1 | [Evidence REA anterior](../../../../discord-research/discord-package-evidence.json), `ev_9300ac6c7d10ca4a8f8a67a55a85ae0c5da52cc25ea05a77addabf037502c158` | Inspeção estática de `package.json` do `app.asar` local, instalação `app-1.0.9265`; entrada declarada `bundle.js`. | Não analisou os fluxos de captura ou chamada. |
| D2 | [Inspeção REA do bundle](../../../../discord-research/discord-media-shell-evidence.json), `details.partial_observation.evidence_id = ev_5de472a64ad800ad28afe38202c5f68727d7b2129912b3e4e9368e8adf0ba541` | Em 2026-10-25, a CLI REA 6.7.0 selecionou `bundle.js`, leu 3.076.973 bytes e reteve análise parcial após timeout de 30.000 ms. O registro completo conserva o erro e a evidência parcial. | Cobertura de relações e semântica incompleta; não demonstra aquisição, política de cancelamento, liberação de tracks ou execução do Discord. Contagem zero de uma API na projeção não prova ausência no aplicativo. |
| D3 | [Discord: Go Live and Screen Share](https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share), documentação oficial consultada em 2026-10-25 | Descreve entrada em canal de voz, ação de compartilhar, escolha de janela ou tela e início explícito. | Documento de produto, não observação de runtime da instalação D1. |
| D4 | [Discord: Video & Screenshare Updates](https://support.discord.com/hc/en-us/articles/360045784891-Video-Screenshare-Updates-Multistream-and-More), documentação oficial | Descreve a ação própria de parar transmissão dentro da chamada. | Não estabelece compensação por peer, prazos de liberação ou mecanismos internos. |
| D5 | [Discord: Keybinds](https://support.discord.com/hc/en-us/articles/217083547-How-do-I-add-different-Keybinds), documentação oficial | Distingue mute de deafen; deafen também desativa o microfone. | Essa semântica não é automaticamente a do botão atual “Silenciar áudio” do Conversa. |
| D6 | [Investigação do core desktop](discord-investigation.md), artefato instalado, preloads e extratos AST | Enumeração privilegiada de fontes, bridge e caminho de fechar/ocultar janela localizados. Registros completos e hashes no relatório. | A análise integral do bundle main expirou sem analisar JS; seus fluxos foram lidos por extração AST. Não há observação de chamada. |
| D7 | [Ponte instalada de voz](../../../../discord-research/2026-10-25-media/voice-findings.md), REA e leitura estática | Fábricas por conexão e operações distintas para destruir conexão, limpar fonte e controlar soundshare. | Efeitos internos do addon não decompilado e vínculo ao renderer ativo permanecem desconhecidos. |
| D8 | [Chamadores de mídia recuperados](discord-investigation.md), cache histórico, REA e AST | Caminhos separados para parar Go Live e destruir conexão; guardas concretas após destruição; fontes, eventos e alternativas Native/Browser localizados. | Cache parcial, sem versão ativa atribuída; guardas locais não certificam todas as corridas, liberação física ou preservação real da voz. |
| D9 | [Fuses do executável](../../../../discord-research/2026-10-25-media/fuses-mcp.json), REA MCP | Leitura do executável identifica `EnableNodeCliInspectArguments` desabilitado. | Não demonstra estado de CDP do renderer nem comportamento de mídia em execução. |
| D10 | [Capacidade, permissões e seletor](../../../../discord-research/2026-10-25-media/capture-gates-evidence.json), REA MCP | Quinze novos extratos do renderer histórico; gate comum de vídeo, dispositivo, autorização e estados do picker. | Zero falhas de parse, grafo parcial e semântica unknown; valor efetivo e ligação ao runtime não demonstrados. |
| D11 | [Handlers de indisponibilidade](../../../../discord-research/2026-10-25-media/unavailable-evidence.json), REA MCP | Três extratos distinguem indisponibilidade por configuração do produto e suporte. | Não identifica a causa na sessão observada nem cobre módulos lazy importados. |
| U1 | [Interface/processo do laboratório](../../../../discord-research/2026-10-25-runtime/ui-observations.json), Orca/Windows | Criação autorizada, canal privado, voz conectada, câmera/tela indisponíveis e saída confirmada na UI. | Registro externo ao REA; sem seletor, transmissão, receptor ou prova física de captura/liberação. |

D1 e D2 referem-se ao mesmo ASAR, SHA-256 `0025c02c7241045a12464309604ec4d5b8ec7ed2ce43cce05d5dacb8f253f672`. D2 foi obtido pela CLI existente porque REA MCP não estava exposto; o diagnóstico indicou registro ausente no Codex. O MCP Agent Skills está operacional. As análises estáticas não executaram o Discord; U1 é uma observação posterior separada. Fontes públicas atuais não comprovam comportamento daquela versão instalada.

**Aplicação da referência:** D3 fundamenta a seleção explícita de fonte; D4 e os chamadores D8 fundamentam a distinção entre parar tela e sair da chamada. D8 também fornece exemplos concretos de guarda após destruição. R01–R03/R06 fundamentam as invariantes de segurança do Conversa. Nenhuma evidência permite atribuir ao Discord nossos prazos, IDs de tentativa, transações, WebRTC em malha ou estratégia de compensação. Não se exige copiar a arquitetura do Discord ou migrar para SFU/LiveKit.

**Aprofundamento em 2026-10-25:** [relatório e rastreabilidade](discord-investigation.md) registram D6–D11, U1, cobertura, quatro dúvidas abertas no REA e protocolo de observação. O REA foi usado também por conexão MCP stdio temporária, com registros exportados antes de encerrá-la; isso não afirma registro permanente no cliente. Os factories do cache não foram executados nem atribuídos à instalação por inferência. Os 34 ACs e as decisões de produto permanecem preservados.

**Investigação ainda pendente:** observar seleção/cancelamento, parada de tela, saída durante captura e dispositivos no Discord Windows, além de correlacionar o renderer ativo. U1 confirma apenas entrada/saída na UI; seus controles indisponíveis limitaram o ensaio. A causa desse estado continua hipótese. D3–D5 são comportamento documentado; falhas sintéticas por peer do Conversa não são falhas reproduzidas no Discord.

## Confirmed Decisions

| ID | Decisão | Origem |
| --- | --- | --- |
| C1 | Estabilizar o protótipo com convidados para pessoas de confiança; contas, grupos privados e TURN autenticado continuam bloqueadores de publicação. | Resposta anterior do usuário, preservada. |
| C2 | Trocar de sala de texto encerra a chamada, inclusive uma entrada pendente. | Resposta anterior do usuário; a referência Discord não revoga essa decisão. |
| C3 | Produzir a spec de captura de mídia e saída da chamada considerando a engenharia reversa do Discord. | Pedido de 2026-10-25. Somente Specify nesta entrega. |
| C4 | Gerar design e tarefas para este recorte, sem iniciar implementação. | Pedido posterior de 2026-10-25: “Gere o design e as tasks”. Documentos técnicos apresentados juntos como Draft. |
| C5 | O assistente escolhe o ambiente privado de investigação no Discord. | “não sei, tome a decisão”, seguido de “Autorizar a criação e o aceite”. Conversa Lab / Teste de mídia criados sem convites; observação e limpeza em U1. |
| C6 | Concluir a investigação pelo código e atualizar design/tasks, sem iniciar implementação. | Resposta explícita nesta retomada: “Concluir investigação e atualizar design/tasks”. Reaproveitar o compartilhamento existente; câmera permanece fora deste recorte. |
| C7 | Revisar/corrigir a documentação e depois continuar a estabilização pela sessão nova; migrar todo JavaScript próprio para TypeScript somente após estabilizar. | Autorização sequencial do usuário de 2026-10-25, registrada em `7eedac8` e no encaminhamento desta revisão. Não transforma propostas do Draft em decisões confirmadas nem autoriza publicação. |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Implementação, refatoração e nova release nesta entrega documental | O pedido C4 autoriza design/tarefas; execução permanece para uma próxima entrega. |
| Contas, autorização de grupos, TURN autenticado, hospedagem e SFU/LiveKit | C1; propostas de outras entregas. |
| Mensagens, histórico e encerramento completo do servidor | Requisitos STAB próprios; aqui se verifica saída da chamada e liberação de suas capturas, não todo o shutdown HTTP/WS/banco. |
| Câmera, troca de fonte durante transmissão, escolha de dispositivos, volumes e push-to-talk | Expansões; usa-se microfone padrão e seleção de tela já existentes. Câmera permanece negada. |
| Paridade completa com Discord, inclusive deafen, sons de entrada/saída e voz independente do texto | Não foi aprovada; C2 permanece. “Silenciar áudio” conserva o contrato de bloquear a reprodução. |
| Reconexão automática ou retomada automática de captura | Nova entrada é manual e exige nova tentativa e nova seleção de fonte. |
| Garantia com seis pessoas, redes distintas, áudio isolado por aplicativo e qualidade universal | O limite atual de seis permanece; ensaios desta spec não demonstram esses resultados. |
| Assinatura, instalador e publicação | Não fazem parte da estabilização de mídia local. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| A1 — Prazos locais | Até 1 s para liberação e convergência local, contado do evento terminal; para stream ainda não adquirido, da resolução tardia. | Herda STAB/A2; não promete fechar uma permissão nativa que o sistema não permite cancelar. | Proposta herdada. |
| A2 — Prazos de operação | 8 s para confirmação de admissão/saída/estado remoto e publicação; publicação conta da obtenção da captura, pedido conta do envio. Seletor: 60 s desde o pedido ao host, incluindo inventário. | Herda STAB/A1/A9; a espera humana por permissão do microfone não consome o prazo de admissão antes de enviá-la. | Proposta herdada. |
| A3 — Falha parcial de tela | Abortar todo o novo compartilhamento se um peer falhar; manter voz e admissão nos peers saudáveis. | Evita sucesso parcial invisível, conforme STAB-12–16. | Proposta herdada; não atribuída ao Discord. |
| A4 — Servidor | Saída recebida libera a vaga em até 1 s; perda silenciosa libera em até 60 s do último pong ou da abertura sem pong. | Herda STAB/A11. O relógio começa no evento real, não no tick seguinte do heartbeat. | Proposta herdada. |
| A5 — Mute e reprodução | Silenciar microfone interrompe sua transmissão, podendo manter a captura live. “Silenciar áudio” só bloqueia reprodução; sair encerra captura e reprodução. | Preserva os controles existentes e explicita a diferença para deafen de D5. | Padrão de estabilização proposto a partir do código atual. |
| A6 — Áudio do sistema | Desligado em cada execução; cada compartilhamento usa a escolha explícita atual. Loopback pode incluir outros aplicativos e a própria chamada. | Contrato existente; nenhuma promessa de isolar o áudio da janela. | Proposta herdada de STAB/A9. |
| A7 — Ensaio físico | Dois PCs Windows numa LAN confiável, fones, microfones reais e 10 minutos de sessão; três ciclos de abertura/recarga fora de chamada, com 30 s de observação por ciclo. Voz: cinco frases de teste em cada sentido, repetidas corretamente pelo receptor no início e após parar a tela. | Amostra limitada e repetível para o ruído relatado; não é meta de desempenho nem teste entre redes. | Procedimento proposto nesta spec. |
| A8 — Cobertura | IDs MEDIA detalham o recorte STAB; a evidência atual pode ser reutilizada após conferir as asserções, sem pressupor nova implementação. | Evita refazer código por status documental e evita transformar BUILD em aprovação MEDIA. | Regra de rastreabilidade desta spec. |

**Open questions:** none essenciais para redigir este recorte. A1–A8 são padrões explícitos, não decisões arquiteturais aprovadas por silêncio. Paridade adicional com Discord, dispositivos alternativos e infraestrutura ficam adiados. A causa do ruído e o comportamento de runtime do Discord são pendências de evidência, não fatos conhecidos.

## Acceptance Vocabulary

- **Tentativa** identifica uma entrada em chamada no contexto de uma conexão e sala. Reentrada cria outra tentativa. Um compartilhamento tem também sua própria operação. Respostas, eventos nativos e resultados de aquisição pertencem à operação que os iniciou, mesmo se outra chamada já estiver ativa.
- **Terminal** é cancelamento, recusa, timeout, saída, troca de sala, desconexão, recarga ou fechamento para aquela tentativa. Voltar a entrar não desfaz o terminal anterior. Uma parada de tela encerra somente a operação de tela.
- **Liberada** significa todas as tracks adquiridas daquela operação com `readyState=ended`, nenhum sender transmitindo a captura e nenhum peer daquela chamada ainda aberto após saída. `enabled=false`, referência nula ou interface escondida sozinhos não provam liberação. Streams retornados em qualquer ramo entram no inventário de verificação.
- **Voz preservada** significa mesmo estado de admissão e mute anterior à falha de tela, com a track de microfone e áudio entre peers saudáveis utilizáveis. Um peer que não permite retirar mídia pode ser encerrado para cessar seu envio.
- **Transporte saudável** é o cenário controlado sem perda artificial. Ausência de confirmação não impede limpeza local; com transporte perdido aplica-se A4 à vaga remota. No teste, tempo é monotônico e relógios controlados exercitam fronteiras, inclusive +1 ms.
- **Resultado** usa categorias já definidas: `CALL_FULL`, `RATE_LIMITED`, `TIMEOUT`, `MEDIA_FAILED` ou `INVALID_EVENT`, com operação/tentativa e fase. Cancelamento voluntário é resultado distinguível de falha técnica, sem depender do texto traduzido. Não se prescrevem envelopes de protocolo ou nomes de funções novos.

## User Stories

### P1: US1 — O microfone pertence à tentativa vigente

**User Story**: Como participante, quero entrar, cancelar e tentar novamente sem deixar um microfone antigo capturando ou transmitindo.

**Acceptance Criteria**:

1. WHEN abrir ou recarregar fora de uma chamada THEN o Conversa SHALL permanecer sem iniciar captura de microfone, tela ou áudio do sistema. (**MEDIA-01**)
2. WHILE uma aquisição de um tipo estiver pendente na mesma tentativa o Conversa SHALL reutilizar ou recusar pedidos concorrentes desse tipo sem iniciar outra aquisição. (**MEDIA-02**)
3. IF uma aquisição resolver após o terminal de sua tentativa THEN o Conversa SHALL liberar todas as tracks retornadas dentro de A1, sem incorporá-las à tentativa nova. (**MEDIA-03**)
4. WHILE o controlador estiver definitivamente fechado o Conversa SHALL recusar ações de captura antes de invocar a API de mídia. (**MEDIA-04**)
5. WHILE não houver admissão confirmada da tentativa vigente o Conversa SHALL impedir publicação de sua captura provisória aos outros participantes. (**MEDIA-05**)
6. IF a admissão for recusada ou exceder os 8 s de A2 THEN o Conversa SHALL encerrar a tentativa e liberar sua captura provisória dentro de A1, qualquer que seja o código ou idioma do erro. (**MEDIA-06**)
7. WHILE aquisição ou admissão estiver pendente o Conversa SHALL oferecer cancelamento por teclado que torne a tentativa terminal dentro de A1 sem aguardar a permissão nativa. (**MEDIA-07**)
8. IF o microfone for negado ou indisponível THEN o Conversa SHALL permitir entrada em escuta e compartilhamento após admissão válida, sem track de microfone nem novas solicitações de microfone sem ação explícita. (**MEDIA-08**)

**Independent Test**: Controlar duas permissões e resolver a antiga depois de sair/reentrar, nas duas ordens; inventariar cada track. Repetir entrar/ativar microfone; cancelar por teclado durante permissão e durante admissão. Testar recusa por capacidade, cota, erro genérico e confirmação ausente. Conferir zero publicação antes da admissão e preservação da captura nova após terminar a antiga.

### P1: US2 — Compartilhar e parar tela são operações controladas

**User Story**: Como participante, quero escolher o que compartilho e parar a tela mesmo quando um destinatário ou uma operação assíncrona falha.

**Acceptance Criteria**:

1. WHEN iniciar cada compartilhamento THEN o Conversa SHALL exigir escolha explícita de uma fonte pertencente à lista daquele pedido, sem reutilizar seleção antiga. (**MEDIA-09**)
2. WHEN obter mídia de tela THEN o Conversa SHALL incluir áudio do sistema somente conforme o consentimento de A6, informando que o áudio pode abranger aplicativos além da janela selecionada. (**MEDIA-10**)
3. IF câmera, frame secundário, origem alheia ou remetente IPC não autorizado pedir uma capacidade de mídia privilegiada THEN o desktop SHALL negá-la, mantendo essas capacidades restritas ao frame principal local confiável. (**MEDIA-11**)
4. WHEN um pedido nativo de seleção for concluído por escolha, cancelamento, timeout, recarga ou fechamento THEN o host SHALL resolvê-lo exatamente uma vez, com a fonte válida ou cancelamento. (**MEDIA-12**)
5. IF o seletor for cancelado, falhar, expirar nos 60 s de A2 ou devolver fonte inválida THEN o Conversa SHALL terminar a operação sem conservar captura de tela ou áudio do sistema. (**MEDIA-13**)
6. IF qualquer publicação falhar ou não concluir nos 8 s de A2 THEN o Conversa SHALL abortar o novo compartilhamento e liberar todas as suas tracks dentro de A1. (**MEDIA-14**)
7. WHEN abortar uma publicação parcial THEN o Conversa SHALL cessar o envio dessa captura por todos os peers locais dentro de A1, inclusive com remoção rejeitada ou publicação que resolva depois do aborto. (**MEDIA-15**)
8. WHEN o usuário parar a tela ou o sistema encerrar sua fonte THEN o Conversa SHALL encerrar todas as tracks de tela e áudio do sistema dessa operação dentro de A1. (**MEDIA-16**)
9. WHEN a tela terminar, inclusive por parada repetida ou falha de sender/notificação THEN o Conversa SHALL convergir dentro de A1 para estado local sem compartilhamento e controles utilizáveis. (**MEDIA-17**)
10. WHEN o compartilhamento terminar com transporte saudável THEN o Conversa SHALL confirmar aos participantes o estado sem compartilhamento em até 8 s de A2. (**MEDIA-18**)
11. IF iniciar ou parar tela falhar THEN o Conversa SHALL preservar a voz anterior nos peers saudáveis conforme o vocabulário, sem encerrar a chamada inteira. (**MEDIA-19**)
12. WHILE a seleção ou publicação estiver pendente o Conversa SHALL apresentar esse estado sem indicar publicação concluída ou mídia remota pronta apenas por presença de participantes. (**MEDIA-20**)

**Independent Test**: Dois peers, um aceita a tela e outro rejeita; repetir com um sender suspenso que resolve depois do aborto. Medir captura, senders, voz saudável e estado remoto separadamente. Exercitar Escape, fonte removida, inventário vazio/falho, timeout sem interação, `onended`, parada repetida e saída/reentrada enquanto o inventário está pendente. Aceitar somente fonte do pedido e janela corretos. Testar áudio do sistema desligado e ligado; zero pacotes não é a única evidência de silêncio, e RTP/vídeo decodificado não aprovam qualidade física.

### P1: US3 — Sair é terminal e libera a vaga

**User Story**: Como participante, quero sair imediatamente e impedir que uma tentativa antiga ocupe a chamada ou reative minha mídia.

**Acceptance Criteria**:

1. WHEN sair ou cancelar a chamada THEN o Conversa SHALL liberar todas as capturas já adquiridas e fechar os peers dessa tentativa dentro de A1, independentemente da confirmação da rede. (**MEDIA-21**)
2. WHEN solicitar troca de sala de texto THEN o Conversa SHALL tornar a chamada anterior terminal sem aguardar a confirmação da nova sala. (**MEDIA-22**)
3. WHEN desconectar, desmontar, recarregar ou fechar a janela THEN o Conversa SHALL executar a liberação terminal de suas capturas e seleções pendentes conforme A1. (**MEDIA-23**)
4. WHEN repetir saída da mesma tentativa THEN o serviço SHALL devolver seu estado terminal sem erro de recurso já encerrado nem efeito sobre uma tentativa posterior. (**MEDIA-24**)
5. WHEN receber saída válida ou parada válida de tela da tentativa vigente THEN o serviço SHALL processá-la mesmo com a cota de mensagens ou sinalização esgotada. (**MEDIA-25**)
6. WHEN receber saída válida THEN o serviço SHALL liberar a vaga e representar o participante fora da chamada e sem compartilhamento em até 1 s de A4, com confirmação correlacionada. (**MEDIA-26**)
7. IF perder o transporte sem saída confirmada THEN o serviço SHALL liberar a participação em até 60 s de A4 sem exigir reconexão do cliente. (**MEDIA-27**)
8. IF confirmação, pedido de admissão, inventário de fontes, sinalização ou presença de uma tentativa terminal chegar atrasado THEN o receptor SHALL descartá-lo sem reativar captura, seletor, reprodução ou ocupação e sem alterar a tentativa nova. (**MEDIA-28**)
9. WHILE estiver fora de chamada admitida ou com “Silenciar áudio” ativo o desktop SHALL bloquear a reprodução de mídia, inclusive depois de recarga e eventos tardios. (**MEDIA-29**)
10. WHILE o microfone estiver silenciado o Conversa SHALL impedir a transmissão de fala pela track de microfone, permitindo mantê-la capturada conforme A5 sem apresentar mute como liberação do dispositivo. (**MEDIA-30**)

**Independent Test**: Esgotar cada cota aplicável e sair/parar tela; outro participante observa vaga e compartilhamento liberados e uma nova pessoa consegue ocupar a sexta vaga. Duplicar saída antes/depois de nova entrada. Atrasar admissão no cliente e no servidor, incluindo chegada depois de cancelar. Medir heartbeat com último pong em 0 ms e deslocado do tick; conferir antes do limite e no limite de 60 s. Em desconexão e recarga, observar tracks e reprodução local sem esperar a vaga remota. Durante mute, RTP de silêncio pode continuar; testar ausência de fala transmitida.

### P1: US4 — Aprovação de mídia tem evidência reproduzível

**User Story**: Como mantenedor e participante de teste, quero distinguir falha técnica, cancelamento e áudio real para saber o que foi aprovado.

**Acceptance Criteria**:

1. WHEN uma operação de admissão, captura, publicação ou saída falhar THEN o Conversa SHALL expor categoria estável, fase e identificação da operação disponível, distinguindo cancelamento voluntário sem depender do texto traduzido. (**MEDIA-31**)
2. WHEN registrar diagnóstico de mídia THEN o Conversa SHALL omitir áudio/vídeo, thumbnails, títulos de fontes, SDP, candidatos ICE, credenciais e conteúdo de mensagens, mantendo apenas metadados técnicos de correlação e versão. (**MEDIA-32**)
3. WHEN executar os três ciclos físicos de abertura/recarga fora de chamada definidos em A7 THEN o Conversa SHALL permanecer sem captura ou reprodução de mídia não solicitada durante os 30 s de cada ciclo, com resultado de ruído registrado por ciclo. (**MEDIA-33**)
4. WHEN executar a sessão física de 10 minutos de A7 THEN o Conversa SHALL completar o protocolo físico abaixo com 5/5 frases compreendidas em cada sentido nas duas medições e todos os passos aprovados dentro dos prazos A1/A2/A4. (**MEDIA-34**)

**Independent Test**: Preservar versão/hash, Windows, modelos de dispositivos, topologia, fonte e horários de eventos, sem gravar conversas ou tela como condição de aprovação. Rodar com dispositivos reais e sem microfone sintético ou `--mute-audio`. Usar fonte de teste não sensível e som identificável para verificar loopback desligado/ligado e parada. Marcar cada etapa PASS/FAIL/inconclusiva; qualquer falha ou etapa não executada impede aprovação física integral. Ruído não reproduzido significa apenas ausência na configuração ensaiada, sem atribuir causa ou cura universal.

### Protocolo físico de MEDIA-34

| Passo | Resultado esperado |
| --- | --- |
| Voz no início e após parar a tela | Cada pessoa lê cinco frases não sensíveis definidas antes do ensaio; o receptor repete todas corretamente, 5/5 em cada sentido em ambas as medições. Registrar interrupções ou ruído contínuo; se impedirem o resultado esperado, FAIL. |
| Mute e retorno da voz | Com loopback desligado, três frases faladas com o microfone silenciado não são ouvidas pelo outro PC; depois de ativá-lo, as três são compreendidas. A própria fala não é reproduzida localmente pelo Conversa. |
| Tela e parada | A fonte de teste selecionada contém um relógio em movimento visível no outro PC; parar a tela encerra todas as suas tracks em A1 e o estado remoto de compartilhamento termina em A2. Voz continua utilizável. |
| Loopback | Com um som de teste contínuo e o microfone silenciado, compartilhar sem áudio não entrega esse som; compartilhar novamente com áudio solicitado o entrega. Parar a tela encerra suas tracks de áudio e o envio. Isso testa áudio global, sem prometer isolamento da janela. |
| Saída e reentrada | Sair encerra as tracks locais e reprodução em A1, retira a presença de chamada em A4 e permite nova entrada manual. O outro PC não recebe nova fala da track antiga após a liberação; buffer ou pacote já em trânsito não constitui nova captura. |

Indicador de uso de dispositivo do Windows é evidência complementar, identificado por processo; outros aplicativos podem manter o dispositivo aberto. Não substitui o inventário de tracks e o teste de envio.

## Edge Cases

| Caso | Resultado observável exigido |
| --- | --- |
| Permissão antiga resolve durante chamada nova | Todas as tracks antigas ended; novas tracks preservadas; zero alteração de admissão nova. MEDIA-03/28. |
| Sair enquanto permissão ou inventário está pendente | Tentativa terminal antes da resposta; callback nativo único quando aplicável; resultado tardio descartado. MEDIA-07/12/21/23/28. |
| Uma publicação aceita, outra rejeita e uma terceira fica pendente | Captura inteira encerrada, nenhum envio residual após resolução tardia, voz saudável preservada. MEDIA-14/15/19. |
| Microfone negado, tela disponível | Admissão em escuta e tela explícita possíveis; nenhum microfone é solicitado novamente sem ação. MEDIA-08/09. |
| Parar tela e sair quase simultaneamente | Estado terminal único; nenhuma referência removida pula uma track do inventário. MEDIA-16/17/21/24. |
| Saída antiga chega depois da nova admissão | Nova tentativa permanece íntegra; a antiga não volta a ocupar vaga. MEDIA-24/28. |
| Cota esgotada e sétimo participante aguardando | Saída/parada não recebem recusa por cota; vaga liberada admite substituto respeitando o teto de seis. MEDIA-25/26. |
| Último pong entre dois ticks | Prazo contado do pong real, sem tolerância implícita de mais um intervalo. MEDIA-27. |
| Captura é só silenciada, sem stop | Não satisfaz liberação terminal; mute isolado pode conservar captura. MEDIA-21/30. |
| Ruído aparece apenas com hardware real | Etapa física FAIL com configuração/passos registrados; smoke sintético não substitui o resultado. MEDIA-33/34. |

## Implicit Requirement Dimensions

| Dimensão | Cobertura no recorte |
| --- | --- |
| Validação e limites | Fonte pertence ao pedido e frame; áudio por consentimento; câmera negada; teto existente de seis. MEDIA-09–13/26. Qualidade 720p/1080p, até 30 fps, permanece preferência existente, sem meta nova de desempenho. |
| Falha e sucesso parcial | Compensação de toda a tela e preservação da voz. MEDIA-06/13–19. |
| Idempotência e duplicatas | Aquisição concorrente, callback único, repetição de parada/saída. MEDIA-02/12/17/24. |
| Fronteiras de acesso e cota | Frame/origem/remetente confiáveis e ações terminais fora da cota. MEDIA-11/25. Contas/autorização N/A neste recorte por C1. |
| Concorrência e ordem | Gerações antigas, resultados tardios e tentativa terminal imutável. MEDIA-03/15/22–24/28. |
| Ciclo de dados e expiração | Tracks, pedidos de seleção e participação possuem término/prazos. MEDIA-03/12–18/21/27. Retenção de mensagens N/A; mídia não é gravada por esta feature. |
| Observabilidade | Categoria/fase/correlação e exclusão de conteúdo sensível. MEDIA-31/32. |
| Dependências externas | Permissão nativa, fonte encerrada, sender rejeitado, rede perdida e hardware. MEDIA-03/08/12–19/27/33/34. |
| Integridade de transições | Pendente não equivale a admitido/publicado; sair não depende de ack; nova tentativa não ressuscita a anterior. MEDIA-05–07/20–30. |

## Requirement Traceability

Os IDs MEDIA detalham o recorte sem substituir os IDs STAB. As linhas de código acima estão fixadas em `1d97d46`; a origem dos achados é a revisão da referência `63810f4`. In Tasks indica planejamento mapeado, sem certificação de atendimento e sem afirmar defeito necessariamente presente no código atual.

| Requirement ID | Story | Origem STAB | Achados | Tasks | Phase | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MEDIA-01 | US1 | STAB-01 | R01 | T1, T7, T8 | Execute | Implementing |
| MEDIA-02 | US1 | STAB-02 | R01 | T1, T4, T8 | Execute | Implementing |
| MEDIA-03 | US1 | STAB-03/39 | R01 | T1, T4, T8 | Execute | Implementing |
| MEDIA-04 | US1 | STAB-04 | R01 | T1, T8 | Execute | Implementing |
| MEDIA-05 | US1 | STAB-06 | R02 | T1, T3, T6, T8 | Execute | Implementing |
| MEDIA-06 | US1 | STAB-07/38 | R02/R10 | T1, T3, T6, T8 | Execute | Implementing |
| MEDIA-07 | US1 | STAB-08 | R01/R02 | T1, T7, T8 | Execute | Implementing |
| MEDIA-08 | US1 | STAB-09 | R02 | T1, T7, T8 | Execute | Implementing |
| MEDIA-09 | US2 | STAB-10 | R03 | T4, T5, T7, T8 | Execute | Implementing |
| MEDIA-10 | US2 | STAB-10/45 | R03/R11 | T4, T5, T7, T8, T9 | Execute | Implementing |
| MEDIA-11 | US2 | STAB-48 | R17 | T5, T8 | Tasks | In Tasks |
| MEDIA-12 | US2 | STAB-11/39/48 | R01/R03/R17 | T5, T8 | Tasks | In Tasks |
| MEDIA-13 | US2 | STAB-11 | R03 | T5, T8 | Tasks | In Tasks |
| MEDIA-14 | US2 | STAB-12 | R03 | T4, T8 | Execute | Implementing |
| MEDIA-15 | US2 | STAB-13/39 | R03/R14 | T4, T8 | Execute | Implementing |
| MEDIA-16 | US2 | STAB-14 | R03 | T4, T8, T9 | Execute | Implementing |
| MEDIA-17 | US2 | STAB-15 | R03 | T4, T7, T8 | Execute | Implementing |
| MEDIA-18 | US2 | STAB-68 | R03/R06 | T2, T3, T4, T8 | Execute | Implementing |
| MEDIA-19 | US2 | STAB-16 | R03 | T4, T8 | Execute | Implementing |
| MEDIA-20 | US2 | STAB-06/44 | R02/R26 | T4, T7, T8 | Execute | Implementing |
| MEDIA-21 | US3 | STAB-05 | R01/R02/R06 | T1, T4, T7, T8, T9 | Execute | Implementing |
| MEDIA-22 | US3 | STAB-05; C2 | R01/R06 | T7, T8 | Tasks | In Tasks |
| MEDIA-23 | US3 | STAB-05/36 (capturas) | R01/R03/R07 | T1, T4, T5, T7, T8 | Execute | Implementing |
| MEDIA-24 | US3 | STAB-30/39 | R06/R13 | T2, T3, T6, T8 | Execute | Implementing |
| MEDIA-25 | US3 | STAB-28/68 | R06 | T2, T6, T8 | Execute | Implementing |
| MEDIA-26 | US3 | STAB-29 | R06 | T2, T3, T6, T8 | Execute | Implementing |
| MEDIA-27 | US3 | STAB-32 | R06/R14 | T2, T8 | Execute | Implementing |
| MEDIA-28 | US3 | STAB-03/06/39; terminal explícito | R01/R02/R06/R13 | T1, T2, T3, T4, T5, T6, T7, T8 | Execute | Implementing |
| MEDIA-29 | US3 | STAB-31 | R06/R26 | T7, T8, T9 | Tasks | In Tasks |
| MEDIA-30 | US3 | A5; controle existente | R26 (recorte mídia) | T1, T7, T8, T9 | Execute | Implementing |
| MEDIA-31 | US4 | STAB-41/67 | R13/R25 | T1, T2, T3, T4, T5, T6, T7, T8 | Execute | Implementing |
| MEDIA-32 | US4 | STAB-67 | R25 | T1, T2, T3, T4, T5, T7, T8 | Execute | Implementing |
| MEDIA-33 | US4 | STAB-01/31/63; A7 | R20/R25 | T9 | Tasks | In Tasks |
| MEDIA-34 | US4 | STAB-63; A7 | R20 | T9 | Tasks | In Tasks |

**Coverage:** 34 critérios únicos, 34 linhas, quatro histórias e 34/34 mapeados a tarefas. R01–R03/R06 são o núcleo; os demais achados entram apenas pelas fronteiras de suporte listadas. Esta spec não encerra nenhum dos 26 achados nem certifica os 68 STAB. D3/D4 são referências documentais para MEDIA-09/16; D6–D11 e U1 acrescentam a pesquisa delimitada no relatório, sem certificar atendimento ou equivalência de execução.

## Success Criteria

- [ ] Cada MEDIA possui evidência de valor esperado e resultado observado, versão/hash e limite da verificação; o relatório reutiliza testes atuais somente após conferir suas asserções.
- [ ] Testes de domínio inventariam todas as tracks e medem os prazos; integração observa callback/IPC, interface, peers e estado remoto nos caminhos críticos. Incluem confirmação antiga e heartbeat desalinhado.
- [ ] O Verifier independente realiza o fechamento futuro conforme a skill, com falhas semânticas isoladas de captura obsoleta, compensação, saída com cota e prazos; nenhum teste é removido, ignorado ou enfraquecido para passar.
- [ ] O ensaio físico de A7 passa com voz nos dois sentidos, tela, loopback solicitado e saídas verificadas. Etapa ausente/inconclusiva permanece visível e impede a aprovação física integral.
- [ ] Afirmações sobre Discord indicam D1–D11, U1 e o tipo de evidência do relatório. Desconhecidos e diferenças deliberadas, incluindo C2 e A5, permanecem identificados.
- [ ] Publicação, causa universal do ruído, qualidade entre redes e os 68 STAB completos não são declarados aprovados por este recorte.

## Specification Validation

Validação desta entrega: somente fechamento estrutural e semântico da spec, sem `validation.md` de implementação. Skill `tlc-spec-driven` carregada pelo MCP Agent Skills, catálogo `0.17.12`, arquivos preparados com checksum na revisão `9f4c79355600`. Confirmed lessons: nenhuma. Referências Specify/Discuss/Memory e complementares da skill já lidas nesta conversa; REA e seus guias de conexão/JavaScript foram lidos para D1/D2.

O fechamento verifica EARS, IDs, rastreabilidade, premissas, nove dimensões, links locais e preservação de Decisions. Comando obrigatório antes da entrega: `python <skill-dir>/scripts/validate_spec.py .specs/features/captura-midia-saida/spec.md --strict`. O resultado desse comando não aprova o aplicativo. Nenhuma nova decisão essencial ficou sem padrão explícito; a futura observação do Discord permanece identificada como trabalho de evidência.

**Fechamento Specify em 2026-10-25:** `validate_spec.py --strict` PASS, exit 0, zero erros e zero avisos. Naquele fechamento: 34 ACs únicos, 34 linhas Specify/Pending, oito links locais existentes e hash do ASAR igual ao de D1/D2. Nenhum achado foi declarado corrigido.

**Atualização de planejamento em 2026-10-25:** design e tarefas em Draft, com alternativas, recomendação, contratos, riscos e mitigação. Nove tarefas em três fases, cobertura/matriz/gates e validação de granularidade, dependências e testes. Os textos dos 34 ACs são preservados; somente fase, status e mapeamento documental avançam. Nenhuma escolha do design é promovida a Decisions ou a aprovação de implementação.

**Retomada da investigação em 2026-10-25:** MCP Agent Skills catálogo `0.17.13`, scripts preparados e verificados na revisão `7bed1026351b`. D10/D11 ampliam a análise estática; U1 confirma somente estados de interface/processo. A atualização reforça o reaproveitamento da tela implementada e preserva a negação de câmera de MEDIA-11.

**Execução iniciada em 2026-10-25:** T1 tem gate Full e evidência incremental em [execution.md](execution.md). Os critérios tocados estão Implementing, sem Verified; o restante permanece In Tasks. O usuário escolheu execução inline e Verifier independente no fechamento. Referências a nenhum item executado acima descrevem o planejamento histórico.
