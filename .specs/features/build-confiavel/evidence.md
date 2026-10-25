# Evidência do build confiável

## Passo 3: diagnóstico e fechamento

Gate em 2026-10-24: npm test **50/50**, zero falhas/skips; build e check-package aprovados. Diagnóstico source com CONVERSA_BUILD_MANIFEST apontando a arquivo inexistente: oito amostras, nenhuma reprodução audível, zero elementos audio/video, sem flags de silêncio ou microfone sintético. Perfil e smoke com servidor externo aprovados; smoke aprovado também no win-unpacked, incluindo terceiro participante durante tela ativa.

O wrapper portátil real foi aberto por portable-startup-check.mjs via CDP, com perfil temporário: interface React, preload, serviço local e uma mensagem confirmada; nenhum elemento de mídia. Fechamento normal do wrapper observado. Screenshot em test-results/desktop/portable-startup.png inspecionado visualmente. A tentativa anterior de automatizar o wrapper pelo launcher Electron do Playwright expirou; o procedimento CDP verifica a interface sem depender do stdout do launcher. Isso não constitui assinatura, aprovação de política corporativa ou teste físico de som.

| Critério | Asserção concreta | Resultado definido |
| --- | --- | --- |
| BUILD-07 | tests/harness.test.js:16 `assert.deepEqual(desktopTarget(...manifest inexistente...), {args:[resolve('.')]})`; scripts/startup-audio-check.mjs:23–26 `toBe(false)`, `toBe(0)`, `toBe(true)` | Source não consulta manifesto; entrada sem reprodução ou elementos de mídia. |
| BUILD-08 | tests/harness.test.js:24–26 `rejects(...,AggregateError)`, `killed === true`, `server.listening === false`, ECONNREFUSED | Falha de close não conserva o outro listener. |
| BUILD-08 prazo/WS | tests/harness.test.js:32 `rejects(...AggregateError...timed out)` após clock de 5 s; :41 `rejects(waiting,/WS closed/)` | Limpeza tem resultado terminal; espera WS termina por fechamento. |
| BUILD-08 launch/perfil | tests/harness.test.js:47 `throws(.../Unsafe test profile/)`; :55–56 exit 1, killed false, duração <5000 | Launch realmente falho não deixa servidor mantendo o processo vivo; remoção limitada a perfil temporário. |
| BUILD-09 | tests/harness.test.js:12–15 false/true/fallback e throws para valores inválidos | 0 não habilita modos; valores desconhecidos falham explicitamente. |
| BUILD-10 | scripts/desktop-smoke.mjs:205–208 bytesReceived >0, :225 e :241 videoWidth >0, :253 ausência de renderer errors | Texto, voz, tela, participante tardio e saída verificados sem reduzir expectativas. Linhas finais serão rederivadas pelo Verifier. |
| BUILD-11 abertura real | scripts/portable-startup-check.mjs:28–36 `toBeVisible()`, preferências padrão, heading geral, uma mensagem e zero audio/video | Wrapper carrega a interface e o serviço realmente empacotados. |

Mapeamento reverso: harness.test.js cobre somente BUILD-07/08/09; portable-startup-check cobre BUILD-11 e os casos sem mídia de BUILD-07. As alterações do smoke preservam as asserções existentes e escolhem a janela proprietária por título único, definido após o carregamento. Uma execução concorrente com seleção genérica havia falhado na recepção tardia; não se atribui essa falha a qualidade física. Os gates source/empacotado passaram após a fixture fixar sua própria fonte. A conferência de pacote agora compara código e bundle com o disco; package.json é reduzido pelo builder e tem seus campos de runtime/versão conferidos, sem exigir igualdade dos campos de desenvolvimento. Verificação independente ainda pendente.

## Passo 2: empacotamento

Gate em 2026-10-24: npm test **44/44**, zero falhas/skips; npm run dist:win e check-package aprovados. Portátil local: release-windows/Conversa-0.1.1-Windows.exe, SHA-256 `cedb8048fedec3463e529401a4b71364e0d571eb65b376dd75042d4226b4f9c4`. Manifesto atual em test-results/build.json. O executável win-unpacked passou no desktop-profile-check; o wrapper portátil ainda não recebeu essa aprovação. Nenhuma publicação externa ou assinatura foi realizada.

| Critério | Evidência / asserção | Resultado |
| --- | --- | --- |
| BUILD-05 | scripts/check-package.mjs:20 `assert.equal(entries.has(path),true)` para cada import local e :28 `assert.equal(checked.has('shared/protocol.js'),true)` | Seis módulos locais acessíveis no ASAR, incluindo contrato e preload; dist/index.html presente (:30). |
| BUILD-06 | tests/packaging.test.js:18–23 conteúdo atual/seguinte, `existsSync(...obsolete.dll) === false` e `existsSync(...default_app.asar) === false` | Staging não mescla arquivos antigos e preserva dados atuais do runtime. |
| BUILD-11 | scripts/check-package.mjs:9–14 versão igual, arquivos existentes e digest SHA-256 igual ao manifesto; :29 versão interna igual | Manifesto identifica o artefato produzido, sem depender de artifacts/build.json histórico. |

Mapeamento reverso: packaging.test.js contém apenas BUILD-06; check-package contém BUILD-05/11 e a presença do bundle requerida por BUILD-01. Nenhum teste anterior alterado. Adequação do passo 2: resultados de inventário, conteúdo e hash, além da abertura do aplicativo empacotado, substituem a suposição de que o glob correto basta.

## Passo 1: integração desktop

Gate em 2026-10-24: npm test **43/43**, zero falhas/skips; npm run build aprovado; desktop-profile-check e desktop-smoke aprovados pelo código. O primeiro smoke identificou a origem serializada com barra final e o cancelamento incompatível com Electron 45; ambos foram corrigidos. Nenhuma asserção anterior foi removida ou enfraquecida.

| Critério / caso | Asserção concreta | Resultado exigido |
| --- | --- | --- |
| BUILD-02 mídia | tests/desktop-policy.test.js:13 `assert.equal(...,false)`; scripts/desktop-profile-check.mjs:28 e :36 `expect(...).toBe('NotAllowedError')` | Câmera e subframe negados inclusive no runtime. |
| BUILD-02 IPC/display | tests/desktop-policy.test.js:25 `assert.equal(trustedIpc(...),false)` e :31 `assert.equal(allowDisplayCapture(...),true)` | Frame exato; origem normalizada. |
| BUILD-03 | scripts/desktop-profile-check.mjs:59–67 `toHaveValue(saved.name)`, `toHaveValue(saved.server)`, `not.toBe(oldPort)`, `toHaveValue('720')`, `not.toBeChecked()` | Perfil restaurado em outra porta, áudio do sistema desligado. |
| BUILD-04 | scripts/desktop-profile-check.mjs:52–53 `expect(code).toBe(1)`, `toContain('ALREADY_RUNNING')`, `toBe(before.length)` | Segundo processo recusado sem janela extra. |
| Preferência inválida | scripts/desktop-profile-check.mjs:26–27 `toEqual({name:'',server:'',quality:'1080'})`, `toBe('{invalid preferences')`; tests/desktop-policy.test.js:38–39 deepEqual/throws | Fallback seguro e arquivo original preservado; somente campos válidos persistidos. |
| Falha/cancelamento de fontes | scripts/desktop-profile-check.mjs:75 `toBeVisible()` sobre erro específico; :87–89 `toHaveCount(0)`, `toBeEnabled()`, `expect(nativeErrors).toEqual([])` | Inventário falho, reload durante inventário e Escape deixam ação utilizável sem rejeição nativa não tratada. |
| BUILD-01/10 | npm test exit 0, 43/43; scripts/desktop-smoke.mjs:200 `...bytesReceived > 0` e :218 `...videoWidth > 0` | Testes, compilação e mídia integrada sem regressão. O relatório final rederiva linhas no HEAD. |

Mapeamento reverso: todas as asserções novas em desktop-policy e desktop-profile-check pertencem às linhas acima (BUILD-02/03/04 e casos limite da spec). Testes de origem/frame são unitários; câmera/subframe e persistência são exercitados também no Electron porque o helper sozinho não prova a integração dos handlers. Sem guidelines adicionais no repositório; preservados node:test e Playwright existentes. Adequação: cobertura necessária e suficiente para o passo 1; BUILD-05–11 aguardam seus gates.
