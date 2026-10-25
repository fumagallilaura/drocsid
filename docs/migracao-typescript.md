# Preparação para a migração para TypeScript

O usuário confirmou que todo código JavaScript próprio será migrado para TypeScript **depois da estabilização**. Este documento inventaria o projeto e os cuidados necessários para planejar essa mudança. A migração não começou; nenhuma dependência, configuração ou fonte foi alterada para habilitá-la.

Leitura do disco em 2026-10-25, branch `main`, base `a07702f`, último commit de código/testes `58be3ed`. Havia alterações documentais de investigação de mídia em andamento. O inventário precisa ser atualizado quando a estabilização terminar, pois ela ainda pode mudar os arquivos e os contratos abaixo.

## Escopo confirmado e limites deste documento

- Migrar as fontes próprias `.js`, `.jsx`, `.cjs` e `.mjs`: aplicativo, servidor, protocolo compartilhado, Electron, configuração executável, scripts, testes, fixtures e ferramentas próprias de revisão.
- Manter o comportamento aprovado durante a estabilização como referência de regressão. A troca de linguagem não aprova novas funcionalidades, câmera, SFU/LiveKit, outro transporte ou outra persistência.
- Dependências de `node_modules/`, runtime Electron, arquivos empacotados e bundles gerados continuam sendo dependências ou saídas. Não se reescreve código de terceiros nem JavaScript emitido pelo build.
- Preservar evidências históricas de `review/` e `artifacts/`. `review/main.formatted.jsx` é uma saída de `review/readable.mjs`; `review/build/assets/index-BiVaq4qq.js` é um bundle do snapshot. Ambos ficam fora da conversão das fontes. Os sete scripts próprios `review/*.mjs` entram no destino da migração, sem reinterpretar seus resultados como aprovação do aplicativo.
- A pesquisa externa em `../discord-research/` não faz parte do código do Conversa. Não migrar nem incorporar código proprietário do Discord.

São fatos confirmados a ordem estabilização → migração e o alcance sobre todo o JavaScript próprio. A sequência, a organização de tipos e os critérios de conclusão sugeridos abaixo são propostas para a futura spec. Este arquivo não aprova uma arquitetura, uma versão do TypeScript ou uma ferramenta de execução.

## Inventário das fontes

Há **30 arquivos de produto, configuração, scripts e testes**, mais **sete ferramentas próprias de revisão**: 37 fontes a considerar. O Git também contém as duas saídas históricas JavaScript/JSX descritas acima, totalizando 39 arquivos rastreados nessas extensões.

| Camada | Fontes atuais | Responsabilidade e atenção na conversão |
| --- | --- | --- |
| Interface React, 1 arquivo | [src/main.jsx](../src/main.jsx) | Componentes, formulários, modais, referências DOM, estado React e ligação entre `Session`, `Call` e `window.desktop`. É a única fonte JSX do aplicativo. |
| Sessão, 1 arquivo | [src/session.js](../src/session.js) | Configuração HTTP, WebSocket, envelope do protocolo, pedidos pendentes, correlação de respostas, contexto da sala, rascunhos e outbox. |
| Mídia, 1 arquivo | [src/rtc.js](../src/rtc.js) | `Call`, microfone, captura de tela, transceivers, SDP/ICE, gerações, deadlines e liberação de recursos. |
| Contrato compartilhado, 1 arquivo | [shared/protocol.js](../shared/protocol.js) | Versão, limites, erros e validadores de eventos, sinalização, ICE e porta. Usado no renderer, servidor e host Electron. |
| Servidor, 2 arquivos | [server/service.js](../server/service.js), [server/index.js](../server/index.js) | Express, WS, SQLite, admissão/presença, confirmação de mensagens, roteamento de upgrades, integração Vite e shutdown. O serviço também é iniciado pelo host desktop. |
| Electron, 3 arquivos | [electron/main.js](../electron/main.js), [electron/policy.js](../electron/policy.js), [electron/preload.cjs](../electron/preload.cjs) | Host, permissões, origem/frame confiáveis, preferências, seleção de captura, reprodução de áudio e bridge. O preload usa CommonJS; os outros dois usam ESM. |
| Configuração executável, 1 arquivo | [vite.config.js](../vite.config.js) | Configuração Vite com plugin React. O HTML aponta explicitamente para `/src/main.jsx`. |
| Scripts, 9 arquivos | Inventário abaixo | Build, empacotamento e verificação desktop também são código próprio a migrar. |
| Testes e suporte, 11 arquivos | Inventário abaixo | Nove arquivos `.test.js`, um helper e uma fixture Electron. A leitura das fontes contou 50 definições `test()`, sem executar a suíte nesta preparação. |

### Scripts de execução e distribuição

| Arquivo | Função atual |
| --- | --- |
| [scripts/build-windows.mjs](../scripts/build-windows.mjs) | Aciona electron-builder, usa staging novo, publica o portátil e escreve manifesto com versão, caminhos e SHA-256. |
| [scripts/prepare-electron.mjs](../scripts/prepare-electron.mjs) | Prepara cópia do runtime em `.packaging/electron`, omite `default_app.asar` e confere o alvo antes da limpeza. |
| [scripts/check-package.mjs](../scripts/check-package.mjs) | Confere manifesto, hash, módulos/imports locais no ASAR e igualdade dos bundles com `dist/`. |
| [scripts/test-runtime.mjs](../scripts/test-runtime.mjs) | Flags `0`/`1`, escolha source/empacotado, perfil temporário e teardown com prazo e validação do caminho de limpeza. |
| [scripts/desktop-smoke.mjs](../scripts/desktop-smoke.mjs) | Fluxos de mensagens, áudio RTP, captura, parada, chamada e modo com serviço externo/terceiro participante. |
| [scripts/desktop-profile-check.mjs](../scripts/desktop-profile-check.mjs) | Preferências após mudança de porta, instância única, permissões e cancelamento/falha do inventário de captura. |
| [scripts/desktop-capture-check.mjs](../scripts/desktop-capture-check.mjs) | Observa o callback real da captura durante reload, fechamento, resolução tardia e Escape no seletor. |
| [scripts/startup-audio-check.mjs](../scripts/startup-audio-check.mjs) | Diagnostica reprodução audível e elementos de mídia na entrada; pode exigir todas as janelas silenciadas. |
| [scripts/portable-startup-check.mjs](../scripts/portable-startup-check.mjs) | Abre o wrapper portátil real com perfil isolado, observa sua UI por CDP e confirma uma mensagem persistida. |

### Testes, fixture e helper

| Arquivo | Fronteira de regressão |
| --- | --- |
| [tests/protocol.test.js](../tests/protocol.test.js) | Eventos válidos/inválidos, versão, limites, ICE e porta. |
| [tests/session.test.js](../tests/session.test.js) | Tentativas antigas, handshake/deadline, troca de sala, recuperação/idempotência de mensagens e contrato com serviço real. |
| [tests/rtc.test.js](../tests/rtc.test.js) | Aquisições concorrentes/tardias, admissão, rollback de captura, parada e limites de negociação/candidatos, com doubles e relógio controlado. |
| [tests/service.test.js](../tests/service.test.js) | Confirmação/persistência, quotas, limites, protocolo, heartbeat, migração do banco legado e encerramento. |
| [tests/server.test.js](../tests/server.test.js) | Mensagens entre clientes, isolamento de salas, sinalização, reinício e limite de seis participantes. |
| [tests/bootstrap.test.js](../tests/bootstrap.test.js) | Configuração, portas, serviço separado, HMR e saída por SIGINT/SIGTERM. |
| [tests/desktop-policy.test.js](../tests/desktop-policy.test.js) | Permissões, origem/frame do IPC, captura e preferências. |
| [tests/packaging.test.js](../tests/packaging.test.js) | Staging atual sem arquivos obsoletos nem app de exemplo. |
| [tests/harness.test.js](../tests/harness.test.js) | Flags, escolha do alvo e limpeza de processos, perfis, sockets e servidores em falhas. |
| [tests/helpers/client.js](../tests/helpers/client.js) | Cliente WS auxiliar, fila de eventos, correlação e espera com timeout. |
| [tests/fixtures/desktop-main.mjs](../tests/fixtures/desktop-main.mjs) | Instrumenta registros públicos Electron e importa o entrypoint real. Não é o entrypoint distribuído. |

### Ferramentas próprias da revisão

| Arquivo | Destinação futura |
| --- | --- |
| [review/inventory.mjs](../review/inventory.mjs) | Converter o inventariador e atualizar extensões/caminhos; preservar os JSON históricos. Hoje enumera diretórios de forma não recursiva e não inclui `shared/` nessa lista. |
| [review/readable.mjs](../review/readable.mjs) | Converter a ferramenta Babel; revisar entrada `.jsx`, parser e saída se for usada com fontes TSX. Preservar a cópia formatada histórica. |
| [review/rtc-probes.mjs](../review/rtc-probes.mjs), [review/server-probes.mjs](../review/server-probes.mjs), [review/ui-probes.mjs](../review/ui-probes.mjs) | Converter fontes próprias e tratar seu uso como reprodução de defeitos do snapshot revisado. Não substituir as asserções de regressão pelos indicadores `confirmed` dessas sondagens. |
| [review/data-probes.mjs](../review/data-probes.mjs) | Converter a análise de banco/contraste; manter explícitos os valores e esquema históricos que ela analisa. |
| [review/verify-review.mjs](../review/verify-review.mjs) | Converter o verificador documental da revisão; ele exige 26 achados e sondagens confirmadas, e não certifica a versão estabilizada. |

HTML, CSS, SVG, JSON, banco e documentação não mudam de linguagem. Alguns desses arquivos precisarão de ajustes de integração na futura migração, como `index.html`, `package.json` e `package-lock.json`. Os registros históricos devem continuar identificáveis como históricos.

## Tooling atual e lacunas

Fontes: [package.json](../package.json), [package-lock.json](../package-lock.json), [vite.config.js](../vite.config.js) e [index.html](../index.html).

| Item | Estado observado |
| --- | --- |
| Módulos e entradas | `"type": "module"`; `main` aponta para `electron/main.js`. O preload é `electron/preload.cjs`. Servidor, scripts e testes importam fontes JavaScript diretamente. |
| Runtime de desenvolvimento | Manifesto exige Node `>=24.15.0`; nesta leitura, o processo Node era `24.21.0`. O portátil inclui o runtime Electron. Isso não define a estratégia futura de execução de TypeScript. |
| Build da interface | `npm run build` executa somente `vite build`; a configuração carrega `@vitejs/plugin-react`. Não há gate de tipos no comando atual. |
| Comandos | `dev`/`start` executam `server/index.js`; `test` usa `node --test tests/*.test.js`; `desktop` faz build e `electron .`; `dist:win` faz build e executa os dois scripts de packaging. |
| Empacotamento | Inclui `dist/**/*`, `electron/**/*`, `server/service.js`, `shared/**/*` e `package.json`. Saída Windows portable x64 via script de build. Não há etapa de emissão TS para host, preload ou servidor. |
| TypeScript | Não declarado no manifesto nem presente entre os pacotes do lock. Não há `tsconfig`, fonte `.ts`/`.tsx` própria ou script `typecheck` rastreado. |
| Declarações de tipos | `@types/node` `24.19.2` aparece no lock como dependência transitiva. `@types/react`, `@types/react-dom`, `@types/express` e `@types/ws` não aparecem. A preparação não aferiu a cobertura das declarações distribuídas pelas demais bibliotecas. |
| Dependências usadas por ferramentas | Scripts importam `playwright` e `@electron/asar`; revisão importa `@babel/parser` e `@babel/generator`. Esses nomes estão no lock, mas não são dependências diretas declaradas na raiz. A futura preparação deve decidir a dependência explícita necessária para cada ferramenta mantida. |
| Automação | Não há workflow de CI rastreado no inventário Git. Os comandos locais e os relatórios de validação são a evidência disponível. |

Versões resolvidas no lock nesta leitura: React/React DOM `19.3.1`, Express `5.3.0`, WS `8.22.0`, Vite `7.3.7`, plugin React `5.2.0`, Playwright Test `1.64.1`, Electron `45.0.0` e electron-builder `26.18.0`. O manifesto usa faixas para as seis primeiras e fixa as duas últimas. São dados de inventário, não escolhas de versões para a migração.

## Contratos que precisam de tipos e de validação em execução

TypeScript deverá descrever os contratos internos. A validação de dados externos continuará sendo necessária. Um tipo, uma coerção `as` ou uma declaração global não comprova a forma dos bytes recebidos, a validade da origem nem o estado de um dispositivo.

| Fronteira | Contrato observado e cuidado necessário |
| --- | --- |
| Protocolo WS e configuração HTTP | `parseClientEvent`, `parseServerEvent`, `validSignal`, `readIceServers` e `parsePort` validam dados em execução. Modelar os eventos por `type`, com seus campos obrigatórios e respostas correlatas. Preservar correlação por `requestId`, contexto de sala e identificadores/gerações de chamada conforme o contrato estabilizado. A versão atual do código é `PROTOCOL_VERSION = 1`; o design de mídia em andamento pode alterá-la antes desta migração. |
| Sessão → interface | `Session` publica estado, presença, sinalização, erros e desconexão por callbacks. Há estados sem sessão/sala/configuração, estados de conexão/transição e mensagens pendentes/falhas. Tipar a nulidade e os resultados assíncronos sem presumir que um pedido ainda é atual quando termina. |
| Mídia/WebRTC | `Call` recebe `mediaDevices`, `PeerConnection`, `Stream`, relógio e callbacks por injeção. Há tracks ausentes, transceivers ainda não atribuídos, streams encerrados e operações pendentes. Tipar dependências e doubles pelas operações necessárias, preservando as guardas de geração, rollback e parada em todos os caminhos. A tipagem não substitui a confirmação física de liberação de microfone/captura. |
| DOM/React | Referências DOM começam nulas; `srcObject`, áudio/vídeo, eventos de formulário, elementos focáveis e `inert` exigem tipos próprios. `modal`, `capture`, `transport` e os estados de mídia não devem ganhar tipos amplos apenas para aceitar qualquer objeto. |
| Preload/IPC | `window.desktop` é opcional fora do desktop. Expõe `platform`, `preferences`, `savePreferences`, `setPlaybackEnabled`, `onCaptureSources`, `onCaptureError` e `selectCapture`. Os listeners devolvem funções de remoção. `capture-select` carrega `requestId` e `sourceId`; a UI usa `null` para cancelar. Preferências carregam `name`, `server` e qualidade `720`/`1080`. A tipagem da bridge precisa corresponder ao preload e aos handlers reais. |
| Segurança e captura no host | `trustedIpc` e políticas verificam `sender`, `senderFrame`, origem e main frame. O host mantém seleção pendente por `requestId`/`contentsId` e resolve callback com fonte concedida ou `null`. Tipos não podem retirar essas verificações nem abrir permissões de câmera. `contextIsolation`, sandbox e `nodeIntegration: false` são configurações atuais a preservar. |
| SQLite e persistência | `DatabaseSync` retorna dados de consultas; salas/mensagens têm campos, nulidades e índices próprios. Mensagens legadas recebem `authorId`, `operationId` e `sequence` durante a abertura do banco. Descrever e conferir o resultado de consulta antes de tratá-lo como evento válido, sem mudar o esquema ou a idempotência para facilitar tipos. |
| Erros, timers e encerramento | `ProtocolError` acrescenta `code`; alguns fluxos acrescentam `phase` e outros examinam `cause`, códigos de SO/SQLite e `name`. Tratar erro externo como desconhecido antes de acessar campos. Timers DOM, Node e relógios de teste têm contextos distintos. Preservar prazos, idempotência de `close()` e limpeza após falha parcial. |
| Testes desktop | `page.evaluate`, `desktop.evaluate` e callbacks serializados executam em ambientes diferentes. Há globals de instrumentação, como `window.__testConnections` e `globalThis.__captureProbe`. Manter declarações de teste restritas a esses ambientes; não ampliar o contrato de produção para acomodá-las nem depender de valores externos que não são transportados ao callback. |
| Empacotamento e caminhos | `import.meta.url`, caminhos relativos e `process.cwd()` determinam raízes e entradas. O checker compara bytes `.js`/`.cjs` do disco com ASAR. Com emissão TS, sua referência deverá continuar sendo a saída atual correta, com imports alcançáveis, versão e hash reais. Não basta trocar a extensão no checker ou retirar a comparação. |

## Sequência recomendada para o planejamento

1. **Fechar a estabilização e congelar uma referência verificável.** Reconciliar os 26 achados com a evidência atual e os requisitos STAB/MEDIA, incluindo aceite físico quando exigido. O PASS de BUILD não encerra esses outros escopos. Registrar commit, versões, comandos, resultados, artefato e limites conhecidos.
2. **Especificar a migração a partir dessa referência.** Atualizar este inventário. Definir o que significa “todo código” concluído, compatibilidade de execução/distribuição, política de tipos e tolerância temporária a fontes JS. Produzir a spec pela `tlc-spec-driven` antes de alterar fontes.
3. **Decidir execução e emissão por ambiente.** Verificar documentação oficial e compatibilidade das versões escolhidas para renderer, Node, Electron e preload CJS. Definir entradas e saídas, resolução de imports, declarações, assets e comandos. O planejamento não deve presumir que o sucesso de `vite build` verifica os tipos do restante do projeto.
4. **Converter contratos e consumidores em lotes verificáveis.** Uma ordem candidata é protocolo compartilhado e seus testes, serviço/servidor e testes, sessão/RTC e doubles, políticas/host/preload, interface, packaging/harness e ferramentas de revisão. O suporte mínimo de testes acompanha cada lote; scripts necessários para verificar um lote devem ser adaptados antes de usá-los. A ordem final depende da estratégia de execução escolhida.
5. **Fechar distribuição e cobertura total.** Confirmar que fontes do produto, scripts, testes, fixtures e sete ferramentas da revisão entraram no destino definido. Repetir a matriz source/empacotado/portátil e atualizar os comandos documentados para as novas entradas. Preservar snapshots e relatórios anteriores.
6. **Validar independentemente.** A futura execução seguirá os gates e o Verifier da skill. Registrar asserções de resultado por critério e as limitações físicas. Concluir somente com todas as fontes próprias cobertas e nenhuma exclusão silenciosa no typecheck.

Essa sequência propõe ordem de trabalho. Não é um `tasks.md` aprovado e não autoriza começar a conversão antes da estabilização.

## Gates de regressão já existentes

O [relatório independente de BUILD](../.specs/features/build-confiavel/validation.md) registrou PASS de 12 execuções em `58be3ed`, 50 testes Node e dez mutações mortas por asserções. **Esses comandos não foram reexecutados para produzir este documento.** Seus caminhos são os atuais; deverão ser reconciliados com a execução TS escolhida, mantendo os resultados que verificam.

| Gate atual | O que preservar como resultado |
| --- | --- |
| `npm.cmd test` | Contratos, persistência, sessão/RTC, políticas, bootstrap, packaging e harness; nenhuma falha, teste ignorado ou asserção removida. Novos testes da estabilização se somam à referência atual de 50. |
| `npm.cmd run build` | Interface compilada com assets e imports atuais. Acrescentar verificação de tipos é uma proposta da migração; ela não existe hoje. |
| `node scripts/desktop-capture-check.mjs` | Callback resolvido uma vez, cancelamento e ausência de entrega tardia em reload/close/Escape. |
| `node scripts/desktop-profile-check.mjs` em source e win-unpacked | Preferências após mudança de porta, instância única, permissões e cancelamento/inventário. |
| `node scripts/desktop-smoke.mjs` em source e win-unpacked, cada um com `CONVERSA_TEST_EXTERNAL=0` e `1` | Mensagens, áudio RTP bidirecional, vídeo recebido, parada de captura, saída e participante tardio, sem erros do renderer. |
| `node scripts/startup-audio-check.mjs` com `CONVERSA_CHECK_SOURCE=1`, `CONVERSA_CHECK_MUTED=1` e manifesto inexistente | Diagnóstico source independente de release; entrada sem elementos de mídia nem reprodução audível observada. |
| `npm.cmd run dist:win`, seguido de `node scripts/check-package.mjs` | Portátil Windows atual, módulos e bundle corretos, versão e SHA-256 coerentes. |
| `node scripts/portable-startup-check.mjs` | Wrapper portátil real inicia UI/preload/serviço e persiste uma mensagem, sem mídia na entrada. |

Os modos empacotados usam o `executable` do manifesto atual `test-results/build.json` em `CONVERSA_TEST_EXECUTABLE`; o wrapper usa o campo `portable`. Flags booleanas aceitam `0` e `1`. Os ensaios de captura/Electron devem continuar sequenciais e usar perfis temporários isolados com limpeza conferida.

Além desses gates, incorporar os testes e critérios que forem concluídos durante a [estabilização](../.specs/features/estabilizacao/spec.md) e a [captura/saída de chamada](../.specs/features/captura-midia-saida/spec.md). A matriz automática atual não comprova áudio físico, eco, encerramento real de todos os dispositivos, NAT entre redes distintas ou desempenho de seis transmissores. Esses limites precisam continuar explícitos após a migração.

Proposta de gate adicional para a futura spec: verificar todas as fontes próprias com política estrita de tipos acordada, sem `any`, coerções, `@ts-ignore`, `@ts-nocheck` ou exclusões amplas usados para esconder erros. Exceções inevitáveis de fronteira precisam ser locais, justificadas e acompanhadas de validação/teste. A decisão de flags e ferramenta ainda está pendente.

## Decisões pendentes para a futura spec

| Questão objetiva | Por que precisa ser resolvida |
| --- | --- |
| Qual estratégia executará e distribuirá Node/Electron/scripts/testes: saída compilada ou outra forma verificada para os runtimes escolhidos? | Define entradas, imports, artefatos, comandos e o gate do pacote. Não presumir um único caminho para browser, Node e preload. |
| Quais configurações de tipos e separação entre ambientes serão usadas? | Renderer tem DOM e bridge; servidor/scripts têm Node; host tem Electron; testes injetam doubles e globals. Evitar que tipos globais façam uma API indisponível parecer válida em outro ambiente. |
| Qual versão do TypeScript e quais declarações serão dependências diretas? | Não existe compilador TS no projeto hoje; tipos transitivos não constituem uma configuração de desenvolvimento aprovada. Verificar compatibilidade sem atualizar bibliotecas de aplicação por conveniência. |
| Será permitida convivência temporária entre JS e TS, e como sua remoção será medida? | Uma transição pode ser incremental, mas o destino confirmado abrange todos os 37 arquivos próprios inventariados, mais os que surgirem na estabilização. Fontes fora do typecheck não contam como migradas. |
| Como os sete scripts de revisão serão executados contra o snapshot histórico? | Há imports/caminhos e pressupostos antigos. Preservar evidência e a semântica de “defeito confirmado”, com ambiente de execução explícito. Não usar suas saídas históricas como gate de saúde. |
| Quais ensaios físicos deverão ser repetidos após a conversão? | Tipos e mocks não demonstram comportamento de hardware. Definir o subconjunto de regressão física a partir do aceite real da estabilização e do alcance do diff. |

Essas respostas pertencem ao planejamento da migração. Não bloqueiam a preparação documental nem o trabalho atual de estabilização.

## Como atualizar este inventário

Na raiz do projeto, listar fontes rastreadas e separar saídas históricas, sem executar as sondagens:

```powershell
git ls-files -- '*.js' '*.jsx' '*.cjs' '*.mjs'
git ls-files -- '*tsconfig*' '*.ts' '*.tsx'
Get-Content -Raw -Encoding UTF8 package.json
```

Conferir também fontes novas ainda não rastreadas e o lock. Recontar a suíte por suas definições e execução real na referência final. Não assumir que os números e caminhos de 2026-10-25 sobreviverão à estabilização.
