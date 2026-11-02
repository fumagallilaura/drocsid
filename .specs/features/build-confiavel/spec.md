# Build confiável Specification

## Problem Statement

Na referência `dc8d7a1`, o cliente compilava, mas a suíte falhava por módulo ausente e o pacote Windows omitia um módulo importado pelo servidor. A solicitação de 2026-10-24 autorizou fechar essas integrações e verificar o build local. O resultado em `58be3ed` foi aprovado pelo [Verifier independente](validation.md): 11/11 critérios, 12/12 gates e 10/10 falhas injetadas detectadas por asserções. Esta entrega não certifica toda a estabilização nem publica uma release.

## Goals

- [x] Aprovar testes, compilação, integração Electron e conteúdo do pacote.
- [x] Produzir evidência reproduzível, sem depender de artefatos antigos ou de dados pessoais.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Publicação, assinatura, instalador e infraestrutura | Exigem outra entrega; nenhum serviço ou artefato será publicado externamente. |
| Aprovação integral dos 68 requisitos de estabilização | O escopo aqui é a integração e o build. Hardware físico, redes distintas e Device Guard mantêm suas limitações de evidência. |
| Autenticação, TURN autenticado e SFU | Permanecem fora do protótipo confiável. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Build redondo | Testes sem falhas/skips, bundle gerado, smoke desktop e conteúdo do pacote conferidos. | Compilar sozinho não prova integração. | Premissa técnica. |
| Perfil desktop | Concluir o contrato já esperado pela interface: nome, endereço e qualidade por userData; áudio do sistema desligado ao iniciar. | Fecha capacidade opcional ainda não implementada, conforme STAB-45/56. | Premissa técnica. |
| Validação Windows | Tentar abrir o executável empacotado com perfil temporário; registrar bloqueio do sistema como limitação, sem substituí-lo por PASS do binário. | O ambiente já apresentou Device Guard. | Premissa técnica. |

**Open questions:** none para o build local; publicação continua excluída.

## User Stories

### P1: Build e integração verificáveis

**User Story**: Como mantenedor, quero executar os comandos de build e teste com resultados confiáveis.

**Acceptance Criteria**:

1. WHEN a suíte Node e a compilação forem executadas THEN o projeto SHALL concluir com exit 0, zero testes falhos e zero testes ignorados, preservando as asserções existentes. (**BUILD-01**)
2. IF câmera, subframe ou origem alheia solicitar permissão de mídia ou IPC privilegiado THEN o desktop SHALL negar a capacidade, permitindo microfone somente ao frame principal local confiável. (**BUILD-02**)
3. WHEN o desktop reiniciar com o mesmo perfil e outra porta local THEN o desktop SHALL restaurar nome, endereço e qualidade, mantendo áudio do sistema desligado. (**BUILD-03**)
4. WHEN outro processo tentar abrir o mesmo perfil ativo THEN o desktop SHALL encerrá-lo com exit 1 e código ALREADY_RUNNING, preservando o host original. (**BUILD-04**)
5. WHEN o pacote Windows for produzido THEN o pacote SHALL conter todos os módulos locais importados por seu entrypoint, incluindo shared/protocol.js. (**BUILD-05**)
6. WHEN o runtime Electron for preparado sobre uma árvore de staging anterior THEN a preparação SHALL produzir somente o inventário atual, excluindo default_app.asar e arquivos obsoletos. (**BUILD-06**)
7. WHEN o diagnóstico source rodar sem manifesto de release THEN o diagnóstico SHALL abrir pelo código e observar zero elementos de mídia e nenhuma reprodução audível na entrada. (**BUILD-07**)
8. IF launch ou fechamento de um recurso de teste falhar THEN o harness SHALL executar as demais limpezas e terminar em até 5 s, incluindo suas esperas WS. (**BUILD-08**)
9. WHERE flags booleanas de teste forem fornecidas o harness SHALL aceitar 0/1 como falso/verdadeiro e rejeitar outros valores. (**BUILD-09**)
10. WHEN o smoke desktop rodar THEN o aplicativo SHALL completar mensagens, áudio RTP bidirecional, seleção/parada de tela e saída de chamada sem erros de renderer. (**BUILD-10**)
11. WHEN o build Windows concluir THEN o manifesto local SHALL identificar versão, SHA-256 do portátil, executável e caminho do artefato realmente produzido. (**BUILD-11**)

**Independent Test**: Executar npm test, npm run build, smoke source e diagnóstico source com perfil temporário. Reiniciar o perfil reservando a porta antiga para forçar outra origem. Tentar outro processo com o mesmo perfil. Produzir o portátil em staging novo, conferir seus módulos no ASAR e o hash no manifesto; tentar sua abertura separadamente. Injetar falhas de teardown e testar flags 0/1/inválida.

## Edge Cases

- Perfil com preferências inválidas conserva o arquivo anterior e inicia com padrões seguros.
- Cancelar, recarregar ou fechar a janela durante inventário de fontes encerra a seleção uma única vez.
- Um fechamento rejeitado não impede o fechamento do servidor externo de teste.
- Smoke sintético não aprova qualidade física, ausência de eco ou a causa do ruído relatado.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BUILD-01 | P1 | Execute | Verified |
| BUILD-02 | P1 | Execute | Verified |
| BUILD-03 | P1 | Execute | Verified |
| BUILD-04 | P1 | Execute | Verified |
| BUILD-05 | P1 | Execute | Verified |
| BUILD-06 | P1 | Execute | Verified |
| BUILD-07 | P1 | Execute | Verified |
| BUILD-08 | P1 | Execute | Verified |
| BUILD-09 | P1 | Execute | Verified |
| BUILD-10 | P1 | Execute | Verified |
| BUILD-11 | P1 | Execute | Verified |

## Success Criteria

- [x] Gates aprovados e relatório independente com evidência por critério.
- [x] Nenhum teste removido, enfraquecido ou ignorado para obter aprovação.
- [x] Limites do executável empacotado registrados separadamente da execução source.

## Execution Plan

1. [x] Concluir integração desktop: electron/main.js, preload.cjs, policy.js, integração mínima de erro em src/main.jsx e testes de política/perfil; gate Node 43/43, build, perfil e smoke aprovados. Adequação em evidence.md. Commit fix(desktop).
2. [x] Corrigir entrada do empacotamento: package.json, prepare-electron.mjs, build-windows.mjs e testes de pacote; gate Node 44/44, build, portátil e inventário ASAR aprovados. Perfil aprovado também no executável win-unpacked. Commit fix(build).
3. [x] Fechar diagnóstico e teardown: scripts desktop/startup e helper/testes necessários; Node 50/50, build, perfil, smoke source/empacotado, diagnóstico sem manifesto e abertura do wrapper portátil aprovados. Commit fix(harness).
4. [x] Fechar G1/G2 encontrados pelo primeiro Verifier: fixture source observa callbacks exatos para reload/close/Escape; teste de prazo exige estado terminal e kill até 5 s. Node 50/50, build, captura, perfil, smoke e pacote aprovados; re-verificação independente PASS em `58be3ed`. Commit test(capture).

Nenhuma extração ou dependência nova é necessária. Os passos são atômicos; cada um registra adequação em evidence.md antes do commit.

O Verifier independente é o fechamento após o último commit; os passos concluídos acima não substituem seu relatório. Gates: npm test, npm run build, node scripts/check-package.mjs, node scripts/desktop-profile-check.mjs, node scripts/desktop-capture-check.mjs, node scripts/desktop-smoke.mjs (também com CONVERSA_TEST_EXTERNAL=1), node scripts/startup-audio-check.mjs (source sem manifesto) e node scripts/portable-startup-check.mjs. Scripts com captura de tela devem rodar sequencialmente.

## Validation

Fechamento em 2026-10-24: [validation.md](validation.md) registra PASS independente no intervalo `dc8d7a1..58be3ed`. Node: 50/50, zero falhas/skips; smoke source e win-unpacked, servidor interno/externo, diagnóstico sem manifesto e wrapper portátil real aprovados. As dez mutações foram detectadas por asserções, sem sobreviventes ou timeouts externos; G1/G2 fechados. O gate `validate_state.py build-confiavel` passou com exit 0.

Artefato: `release-windows/Conversa-0.1.1-Windows.exe`, SHA-256 `cedb8048fedec3463e529401a4b71364e0d571eb65b376dd75042d4226b4f9c4`; manifesto atual em `test-results/build.json`. A aprovação é local e usa mídia sintética nos smokes. Assinatura, publicação, áudio físico, redes distintas e os 68 critérios STAB completos permanecem fora desta certificação.
