# Investigação do Discord: captura e saída

**Resultado:** a investigação agora alcança implementações JavaScript de mídia e seus chamadores. Há evidência estática de separação entre parar compartilhamento e destruir conexão, descarte de alguns resultados após destruição e encaminhamento de eventos de término. Ainda não há ensaio de chamada nem prova da liberação física de dispositivos no Discord.

Data: 2026-10-25. Conversa inspecionado em `5133a3d`, sem alterações de implementação desde `58be3ed`. Este relatório amplia a pesquisa que fundamenta [spec](spec.md), [design](design.md) e [tasks](tasks.md). Os 34 MEDIA continuam In Tasks, nenhum Verified.

## Perguntas e resultado

| Pergunta | Resultado desta passagem |
| --- | --- |
| Parar tela e sair da voz usam a mesma operação? | **Respondida no JS recuperado:** há caminhos distintos. DR02/DR03. |
| Existe proprietário explícito da conexão? | **Respondida no JS recuperado:** instâncias, conjunto de conexões e remoção por evento Destroy. DR04. |
| Há proteção contra resultado após destruição? | **Parcial:** guardas concretas em callback nativo e aquisição de microfone do Browser. Não cobrem todas as esperas/callbacks. DR04/DR05. |
| Como a fonte e o áudio chegam à captura? | **Parcial:** enumeração no host, parâmetros de fonte/soundshare e alternativas Native/Browser localizados. Seletor completo e efeitos nativos pendentes. DR01/DR06. |
| Cancelamento, erro e término são distinguíveis? | **Parcial:** eventos separados e seus consumidores imediatos localizados; correlação de ponta a ponta não demonstrada. DR07. |
| Quais os efeitos de mute, deafen e fechar a janela? | **Parcial:** regras estáticas localizadas; hardware e configuração efetiva não observados. DR08/DR09. |
| O Discord satisfaz os prazos e invariantes MEDIA? | **Não respondida:** os prazos são contratos propostos para o Conversa. DR10. |

## Identidade e método

O MCP Agent Skills forneceu novamente `tlc-spec-driven`, catálogo `0.17.12`. A skill local `reverse-engineer-anything`, versão 42, orientou a investigação. O REA 6.7.0 também foi usado por uma conexão MCP stdio temporária via SDK, com `tools/list`, análise, resumos, exportação, importação e registro de dúvidas. Isso comprova essa conexão temporária, sem afirmar registro permanente do conector no cliente.

Foram examinados três conjuntos distintos:

| Conjunto | Identidade e alcance |
| --- | --- |
| Desktop instalado | `app-1.0.9265/modules/discord_desktop_core-1/discord_desktop_core/core.asar`, SHA-256 `922c22e53eceb3a62fdfa51240ebbbb55e8e75cbc03caa6b711f6193448fa48e`. Seis arquivos, além do diretório `data`. Membros extraídos como dados, sem executar bootstrap. |
| Ponte instalada de voz | `discord_voice/index.js`, 22.585 bytes, SHA-256 `c06fc0d68fbeb6b139e10ae98810918cb91512325e221922fe0de9b85a9cb8c1`. Addon `discord_voice.node`: SHA-256 `984dfb5ce083a513dfa207d9b48bca0a9f415d84df09b423e1505a7417009f60`. O addon não foi carregado nem decompilado. |
| Renderer recuperado do cache | Corpo Brotli `f_000008`, carrier SHA-256 `a12b7f32afb488c7995d4fb67839fc20f6a44b07689f6a981c097ca2f75cf644`, estável antes/depois da leitura. Corpo de 12.195.339 bytes, SHA-256 `f5472d48fb8748d17cce65a918643ce9e2e7bb69f0a5aa728e4404f6949220dc`. Referência interna `web.1cce76ccd5e996d2.js.map`; nenhum sourcemap original recuperado. |

O renderer do cache **não foi vinculado à versão instalada ou ativa**. O cache vivo pode conter recursos históricos de várias versões. A igualdade do hash de um carrier durante a leitura não torna o cache inteiro uma fotografia atômica. Relações entre seus factories são inferidas dos IDs e chamadas no mesmo bootstrap; não provam resolução dinâmica ou execução. Também não foi provado que esse renderer carregou a ponte instalada de voz descrita acima.

A recuperação leu 785 de 982 carriers `f_*`, reteve 353 corpos com assinatura literal `webpackChunkdiscord_app` e parou no orçamento agregado de 256 MiB. Foram descartados 50 corpos sem a assinatura; 381 não foram decodificados pelos formatos tentados. Um corpo reconhecido excederia o orçamento e não foi retido; 197 carriers ficaram sem leitura. Essas contagens não provam ausência de outros módulos. Cookies, LocalStorage e conteúdo de mensagens não fizeram parte da investigação.

No corpo escolhido, o parser AST recuperou 4.599 factories. Os extratos preservam o `ObjectMethod` original, com `({` e `});` apenas para torná-lo um programa analisável. Hashes e intervalos originais, com fim exclusivo, estão no índice. As versões legíveis foram geradas por AST para citar linhas; não são fontes oficiais nem pseudocódigo do addon.

## Evidências preservadas

Raiz dos registros locais: [2026-10-25-media](../../../../discord-research/2026-10-25-media). O [índice de evidências](../../../../discord-research/2026-10-25-media/investigation-evidence-index.json) guarda seleção, hashes, estatísticas e limitações. Os corpos e registros grandes ficam fora do Git do Conversa; este relatório não incorpora o código do Discord.

| Referência | Registro e Evidence ID |
| --- | --- |
| D6a: preloads do core | [Registro completo](../../../../discord-research/2026-10-25-media/core-preloads-evidence.json), `ev_2e032fd38e88ea7b47f77ace90cc2ba95ee35a09f314c49b3214899d0995fdaf`. Dois JS e manifesto selecionados, zero falhas de parse; grafos parciais, semântica truncada por limites. |
| D6b: seis factories do core | [Registro MCP completo](../../../../discord-research/2026-10-25-media/core-selected-evidence.json), `ev_becbaccc4b343556e35214325b17b7d84c21a3cdaf0be886328e236de43406fc`. [Proveniência](../../../../discord-research/2026-10-25-media/core-selected-provenance.json). Seis extratos analisados, zero falhas de parse; grafo parcial e semântica unknown. |
| D7: ponte instalada | [Registro](../../../../discord-research/2026-10-25-media/voice-evidence.json), `ev_35f607f4ddb52d61d00bcb0c6890ccf51925a0feb39f066dc1e78c8043bdac1d`. [Ledger integral](../../../../discord-research/2026-10-25-media/voice-findings.md). Um JS analisado, zero falhas; 478 arquivos fora da seleção, grafos parciais. |
| D8a: chamador nativo | [Registro](../../../../discord-research/2026-10-25-media/cache-voice-callers-evidence.json), `ev_7255b691925d3290c8f90ec772e41fd9736435ef6e197461ed0dbfce61a60481`. Factory `206959`, parse completo; grafo parcial. |
| D8b: base e Gateway | [Registro](../../../../discord-research/2026-10-25-media/cache-voice-support-evidence.json), `ev_0d68f3def0c1d1491c8a0109adf9427189af4a5f60b1b77117f2f789a32fd61e`. Factories `904986`, `823598`, `597643`, `282475`, zero falhas de parse; grafo parcial. |
| D8c: escolha de engine | [Registro](../../../../discord-research/2026-10-25-media/cache-engine-selection-evidence.json), `ev_17c54656d2426a74ebf1da6deeec869fc2ad202719a7752f2e9a4ffd174cefcc`. Factory `459838`, zero falhas de parse; grafo parcial. |
| D8d: ações de tela e estado | [Registro MCP exportado](../../../../discord-research/2026-10-25-media/capture-actions-evidence.json), `ev_4100c70b7cb4e2ab4dd92f10a5ab5d351ceae025e3287b9ca7c47aff220116c1`. Factories `25578`, `338771`, `405916`, três JS analisados, zero falhas; grafos parciais. |
| D8e: implementação Browser | [Registro MCP exportado](../../../../discord-research/2026-10-25-media/browser-capture-evidence.json), `ev_3ba27f5721dfc81e9c63b99f3aa7330ad5299f13149cb36bad275522bef11723`. Factory `113634`, um JS analisado, zero falhas; grafos parciais. |
| D9: fuses do executável | [Resposta MCP completa](../../../../discord-research/2026-10-25-media/fuses-mcp.json), `ev_dd0d9304580a6bcbc7d86f7362342413516d40639270a655324f492d3d227dcd`. `Discord.exe` SHA-256 `b9a2ba1c599b69c3c0ab55289ac2eae6f8b0ada084d7462444029a342418f857`. Leitura sem lançamento. |

Os registros REA ancoram a identidade e a análise estática dos extratos. Os encadeamentos abaixo também incluem leitura direta de sintaxe e AST, indicada nas fontes; não se presume que o REA resolveu todas as importações numéricas. O [ledger dos chamadores](../../../../discord-research/2026-10-25-media/cache-voice-callers-findings.md) e o [índice de factories](../../../../discord-research/2026-10-25-media/cache-factories-index.json) permitem retomar sem repetir as análises.

Limites operacionais preservados: a tentativa de analisar `core/bundle.js` integralmente expirou em 45 s, `ev_90f377bebb9cf88e78e3123c584c6fd2d5487c8dba7ac2103bae0febc6c5eecb`, com **zero JS analisados**. Não serve como prova do fluxo desse bundle; foram usadas sua extração AST e D6b. Uma resposta MCP ampla de quatro factories excedeu o transporte de 10 MiB; o envelope de erro foi preservado e não fundamenta conclusões. As perguntas de ações e Browser foram tratadas separadamente em D8d/D8e, com resumo e exportação completos antes de fechar a conexão. Parse concluído nunca é rotulado como cobertura semântica completa.

## Achados

“Observação” nesta tabela significa código ou bytes presentes nos artefatos identificados. Efeitos de execução permanecem separados.

| ID | Observação e fonte precisa | Implicação e limite |
| --- | --- | --- |
| DR01 | O preload expõe `DiscordNative.desktopCapture.getDesktopCaptureSources`; a chamada usa IPC invoke. O host filtra tipos para screen/window, enumera fontes e devolve ID, nome, thumbnail e ícone. Core: factories `9425` e `2236`, intervalos UTF-16 `23670–23993` do preload e `49318–50185` do bundle. D6. | Há fronteira explícita entre enumeração privilegiada e renderer. Esses trechos não selecionam a fonte, não concedem captura nem provam consentimento/cancelamento. |
| DR02 | A opção `stop-streaming` do factory `405916` chama o helper `338771`. Se o stream pertence ao usuário atual, o helper chama `setGoLiveSource(null)`. Depois chama `401843.vN`: esse export despacha `STREAM_CLOSE` quando solicitado e `STREAM_STOP`. O handler de Gateway encaminha este último a `streamDelete`, que envia `STREAM_DELETE`. D8d/D8b e leitura AST de `401843`, intervalo original `686081–689180`. | A ordem das chamadas JS separa limpar fonte, fechar estado local e notificar o serviço. Os trechos não aguardam ACK; não demonstram prazo de liberação nem o resultado no espectador. |
| DR03 | `MediaEngineNative.setGoLiveSource(null, context)` percorre as conexões daquele contexto e chama `clearDesktopSource`, `clearGoLiveDevices`, `setSoundshareSource(0,false)` e atualização de broadcast. Não chama destroy nesse ramo. [206959.pretty.js:1812](../../../../discord-research/2026-10-25-media/cache-analysis/factory-206959.pretty.js), D8a; ponte D7, linhas 165–170. | A implementação JS distingue a vida da fonte da vida da conexão. É referência concreta para parar tela preservando a chamada; voz saudável e liberação real ainda exigem observação. |
| DR04 | O callback inicial da conexão nativa retorna se `this.destroyed`. A destruição chama o objeto nativo e a base; a base marca destroyed, destrói o redutor, emite Destroy e remove listeners. O gerenciador retira a instância do Set ao receber Destroy. D8a, `206959.pretty.js:540`, `:610`, `:1720`; D8b, `904986.pretty.js:60`. | Há guardas e posse por instância. Não comprova proteção de todos os callbacks, repetição segura ou conclusão do stop nativo. |
| DR05 | No Browser, `AudioInput.enable` aguarda a aquisição e, se destruído, libera o stream retornado e lança erro. `AudioInput.destroy` libera o stream; o recurso de desktop tem destroy que chama stop em todas as tracks, e reuse separado que devolve ao pool. [113634.readable.js:243](../../../../discord-research/2026-10-25-media/cache-modules/factory-113634.readable.js), `:2472`, D8e. | Fundamenta verificar validade depois da aquisição e distinguir liberação de reutilização. Há outras esperas, como o filtro de áudio, e outros chamadores fora da prova. Não certifica toda corrida nem diz que essa classe foi usada no Windows. |
| DR06 | O seletor automático testa Native antes de Browser e usa Dummy como fallback, conforme `supported()`. O chamador nativo passa sourceId/opções de qualidade; soundshare passa identificador e flag de loopback. D8c, `459838.pretty.js:26`; D8a, `206959.pretty.js:672`, `:904`. | Os caminhos possuem mecanismos diferentes. Não se atribui a captura nativa do Discord ao `getDisplayMedia` do Conversa. `soundsharePid` não comprova isolamento por aplicativo nem escopo global. A6 do Conversa permanece seu contrato próprio. |
| DR07 | `DesktopSourceEnd` é consumido no MediaEngineStore para limpar Go Live. Os eventos de picker update, cancel e error são despachados separadamente. Falha de soundshare possui code/reason/willRetry no chamador. [25578.readable.js:1471](../../../../discord-research/2026-10-25-media/cache-modules/factory-25578.readable.js), `:1522`, `:1603`; D8d/D8a. | Confirma pontos de entrada distintos para término, cancelamento e erro. Não prova callback único, associação à tentativa, tratamento de eventos antigos ou fluxo completo do seletor. A definição lazy `826789` não apareceu nos corpos retidos; essa busca limitada não prova ausência no aplicativo. |
| DR08 | O cálculo de mute próprio inclui `mute || deaf`; deafen também é enviado separadamente à conexão. A seleção de outro canal de voz limpa a fonte. [25578.readable.js:804](../../../../discord-research/2026-10-25-media/cache-modules/factory-25578.readable.js), `:2223`, D8d. | Corrobora estaticamente a distinção de D5. Não revoga A5: “Silenciar áudio” do Conversa continua só saída. Não foi provado globalmente o efeito de trocar texto no Discord; C2 do Conversa permanece confirmado. |
| DR09 | No core, o handler close de Windows/Linux consulta `MINIMIZE_TO_TRAY`, padrão local true: oculta a janela e cancela o close; na outra alternativa chama app.quit. Core bundle, factory `5203`, região a partir de `192120` UTF-16, conferida por AST. D6 identifica o artefato; esta conclusão vem da leitura direta. | Fechar a janela do Discord não equivale necessariamente a sair da chamada ou encerrar o processo. A configuração efetiva não foi consultada. MEDIA-23 exige limpeza no Conversa e não adota esse comportamento de bandeja. |
| DR10 | O executável tem `EnableNodeCliInspectArguments` disabled. D9. Nenhum ensaio de chamada foi registrado nesta passagem. | `--inspect` não é um próximo passo válido por suposição. O fuse não prova que CDP do renderer esteja desabilitado. Captura física, ordem completa, prazos, callback único, saída sob cota e política do servidor continuam sem prova. |

## Efeito no planejamento do Conversa

| Requisito/tarefa | Resultado da comparação |
| --- | --- |
| MEDIA-03/04/28; T1/T4/T5 | DR04/DR05 oferecem precedentes concretos de guarda após destruição. Contexto imutável, geração por conexão e token de documento continuam propostas próprias, necessárias de validação no Conversa. |
| MEDIA-16/17/19/21; T1/T4 | DR02/DR03 sustentam separar parar tela de sair. A compensação total se qualquer peer falhar permanece A3 do Conversa; não foi encontrada prova de que Discord use essa política. |
| MEDIA-09–13/31; T5/T7 | DR01/DR07 localizam enumeração e eventos de resultado. A chave preparada, guarda até assentamento e callback único propostos ainda não são soluções atribuíveis ao Discord. |
| MEDIA-10/29/30; A5/A6; T7/T9 | DR06/DR08 reforçam medir microfone, reprodução e soundshare separadamente. Não acrescentam isolamento por aplicativo nem deafen ao escopo. |
| MEDIA-22/23; C2; T7/T9 | Texto encerra chamada no Conversa por decisão confirmada. Fechar a janela também é terminal no Conversa. O protocolo comparativo precisa distinguir X, minimizar, desconectar voz e sair do aplicativo. |
| MEDIA-24–27; T2/T3/T6 | D8b mostra envio de parada, sem revelar garantias do servidor Discord. Geração terminal, revisão de presença, cotas, heartbeat e protocolo 2 continuam propostas para nosso protótipo. |

Nenhum requisito, prazo, status de tarefa ou decisão foi aprovado por esta investigação. A recomendação de conservar os componentes do Conversa permanece Draft. LiveKit/SFU, contas e infraestrutura continuam fora deste recorte. O relatório BUILD anterior não certifica os 34 MEDIA.

## Dúvidas registradas e próxima observação

Três dúvidas foram registradas pelo MCP REA como **open**, com os registros estáticos importados como suporte. O [bundle exportado](../../../../discord-research/2026-10-25-media/discord-remaining-unknowns-bundle.json) preserva revisões, condições de resolução e evidências:

| Dúvida REA | Prova ainda necessária |
| --- | --- |
| `unk_d5acc230b37231505f8bca0c260c3cca0bfe52bab30bba5ba108570dd4bf17ab` | Identificar build, renderer e engine efetivamente ativos e comparar os hashes antes de atribuir o código histórico ao runtime. |
| `unk_af755a668d465ca739fd976085846343822056d3f8ea36506a9bdcc1abcbf722` | Cancelar/sair durante permissão ou seleção, reentrar e observar a resolução antiga sem afetar a tentativa nova. |
| `unk_8173c7acef98af35faedb1254d0c1167bc16017694c64fb20d83010488b4fa99` | Observar o fim de captura/soundshare/recepção e a preservação da voz ao parar somente tela; registrar os tempos medidos. |

A próxima passagem requer identificar um canal de voz de teste vazio e sob controle do usuário. A pergunta sobre servidor/canal foi enviada; nenhum canal foi escolhido por inferência. Para efeito remoto, é necessário também um participante de teste. A observação deve usar fonte e áudio de teste não sensíveis, versão registrada e estes passos:

1. Registrar estado fora da chamada e implementação/versão observável, sem reutilizar o cache como prova de execução.
2. Entrar no canal de teste; abrir o seletor e cancelar. Separar o estado da tela do microfone já admitido.
3. Compartilhar sem áudio e com áudio; parar somente a transmissão e verificar continuidade da voz e fim do som compartilhado no receptor.
4. Sair com seleção pendente, reentrar e concluir/cancelar o pedido antigo. Registrar o resultado por operação.
5. Comparar desconectar voz, X da janela e sair do aplicativo, registrando a opção efetiva de bandeja.

Quando houver CDP loopback da instância controlada, usar descoberta de páginas e observação passiva das ações manuais para correlacionar fontes e runtime. Sem essa correlação, observação de interface não prova qual módulo executou; sem instrumentação nativa, não se promete inventário interno completo. O ensaio remoto e o físico do Conversa continuam sendo gates próprios, distintos dessa pesquisa.

## Conferências desta entrega

As fontes foram tratadas como dados. Foram conferidos hashes do artefato, extratos e carriers escolhidos; o relatório distingue parse, grafo, inferência e execução. Os registros completos e as três dúvidas abertas estão preservados. `validate_spec.py --strict` e `validate_tasks.py --strict`: exit 0, zero erros e avisos. Conferidos 44 links locais existentes, 34 textos de ACs inalterados, nenhuma linha Verified e cinco extratos adicionais contra os intervalos/hashes originais. STATE preserva seu prefixo/Decisions. Nenhuma tarefa foi executada; a suíte do aplicativo não foi reexecutada e não foi emitida aprovação funcional de mídia.
