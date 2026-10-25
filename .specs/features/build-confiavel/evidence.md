# Evidência do build confiável

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
