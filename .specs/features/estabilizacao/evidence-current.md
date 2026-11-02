# Evidência atual de estabilização

**Automação STAB e gate formal aprovados em `ec874ec`; aceitação física pendente.** Reexecução de 2026-10-31:158provas pass/0fail, validate_verification exit0/zero erros/avisos e sensor próprio7+4 por asserção. Quatro achados independentes corrigidos. Escopo STAB separado de MEDIA. 68 claims em [tasks.md](tasks.md#checks), uma por AC, com testes nomeados. O relatório histórico [evidence.md](evidence.md) permanece intacto; [execution.md](execution.md) registra cada nova conjunção e seu proprietário. Nenhum STAB Verified pelo autor.

Candidata avaliada em **699d4ed**, versão 0.1.1, protocolo2, Node24.21.0, Electron45.0.0. Produto corrigido em `8955755` (playback), `1c1bdbd` (limite nominal) e `0345015` (diagnóstico de recusas); os demais fixes ampliam evidência. Portátil `release-windows/Conversa-0.1.1-Windows.exe`, SHA-256 `16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135`. Manifesto, ledger e logs `test-results/stabilizacao-postfix/`.

**94/94 = 50 + 44**, zero fail/skip/cancelled/todo. Gate Build STAB (Node + Vite + smoke source) e matriz adicional MEDIA de16 gates passaram. Perfil source/packaged compara configuração ICE efetiva dos dois hosts, restaura preferências em outra porta e recusa câmera/frame/segunda instância. Ciclo inventaria tracks em reload/disconnect/unmount/close. Startup source não depende de manifesto. O wrapper portátil real abriu renderer/preload/serviço e persistiu uma mensagem. Todos os exit codes incluem teardown.

| Escopo de AC / proprietário | Commits e evidência executável |
| --- | --- |
| 01–16/31/39/42–44/68, captura/saída | Call histórica `ae07a55` e correções MEDIA T1–T7/R1–R6; rtc/session/service, capture/lifecycle/startup e smoke. R6 `7978124` prova stop+leave nas duas ordens. Mapeamentos de resultado nos relatórios MEDIA, sem herdar aprovação de STAB por nome. |
| 17–27/53–55, mensagens e dados | T3 `7d24f4b`, T5 `d456168`; retomada `088e701`, `9b0c3ba`, `cdfb626`. Valores de sala/ID/texto/recibo, nenhum registro em outra sala, retry/restart, limite UTF16, contenda e dados incompatíveis em service/session/server. |
| 28–30/32–38/49, servidor/encerramento | `088e701`, `0a1d1e2`, testes service/bootstrap. 404 e socket fechado em1s, 503 durante shutdown retido, mesmo close/prazo original de5s, SIGINT/SIGTERM, causa de bootstrap e retry. A emissão dos sinais em processo filho é o método Windows, sem alegar entrega Unix entre processos. |
| 40/41/46/47/50–52, contrato/limites | T1 `5c1a05a`, protocolo atual MEDIA `5a8f657`, protocol/service/session, comparação ICE desktop `1c85e6e`. Versão2 obrigatória e v1 negada; categorias estáveis, tetos e origem/sala do endereço preservadas. |
| 45/48/56, perfil/permissões | BUILD e MEDIA preservados; T7 `1c85e6e`, desktop-policy/profile/capture. userData isolado, origem/frame e host único; sem autenticação de convidados. |
| 57–62, UI | T6 `dc8d7a1` preservada, smoke por gestos/contraste/scroll. R7 `f85926e` acrescenta duas autorias legadas null sem agrupamento e mantém homônimos por ID. |
| 63–66, harness/sensor | harness.test.js, startup/desktop-smoke e provas atuais. R01–R07 discriminados pelo Verifier independente e repetidos em `699d4ed`; gate verde sozinho não comprova sensor. |
| 67, diagnósticos | `8955755` corrige correlação callId/generation de playback, asserção pré-fix falhava por valor; captura/protocolo/persistência/shutdown mantêm categorias e logs restritos. Sentinelas de conteúdo não aparecem na saída. |

Integridade AST: todos os50 nomes de `38062db` e75 de `f44d268` preservados. Das216 expressões originais,212 idênticas e quatro somente v1→v2, já justificadas em MEDIA/T6. Todas as388 expressões da primeira entrega MEDIA intactas. 113 textos AC e prefixo Decisions intactos. Nenhum skip ou teste removido. Rastreabilidade reversa nova está em execution; os testes antigos são regressão exigida, não prova apenas pelo nome.

O externo inicial de R7 retornou exit1 no teardown depois das asserções; não foi contado como aprovação. Inspeção sem processo remanescente, repetição integral e nova matriz 16 passaram sem mudar prazo/asserts. Causa do incidente não estabelecida. O perfil TEMP `conversa-test-y4t7mS` de R3 permanece após remoção manual rejeitada automaticamente; nenhum processo associado permanece.

Hardware real, causa do ruído, inteligibilidade/eco/loopback e redes distintas não demonstrados. T9 MEDIA segue pendente por indisponibilidade explícita dos dois PCs Windows/LAN confiável, fones/mics e dois operadores. Isso também mantém pendente o sucesso físico da estabilização. Contas/grupos privados/TURN autenticado bloqueiam publicação; câmera/SFU/TS continuam fora da execução atual. Nenhuma investigação/call/convite Discord repetida.

Skill do fechamento anterior: MCP0.17.14, revisão preparada `f465b52756b8`. Execute/validate/memory/coding-principles/sub-agents/lessons lidas integralmente; nenhuma lesson confirmed. Os scripts Python são chamados do caminho real com um launcher TEMP que apenas inclui a pasta do script em sys.path, necessária ao Python portátil isolado. Provas e gate históricos registrados abaixo; a atualização de31/10 usa MCP0.17.18/eec8e8fe8151.

## Fechamento histórico em 699d4ed

Verifier STAB válido em `573491e` retornou F1–F4, todos fechados por commits em [verification.md](verification.md). Não houve segunda rodada de julgamento. `check_proofs.py --mutations` em `699d4ed` executou **136 provas funcionais,0 fail**, Build incluso. A ferramenta filha mutate.py não aplicou mutações: AttributeError/SIGHUP ausente no Python Windows. A saída136pass/0mutants e exit0 do proofer **não aprovam o sensor da ferramenta**. `validate_verification.py` retornou **exit1**, um erro:0 linhas de mutação diante de5 mínimas. Nenhuma linha foi fabricada para mudar esse resultado.

Sensor isolado próprio após fixes: **7/7 R01–R07** definidos pelo Verifier, **4/4** regressões F1–F4 (nome bruto em vez de normalizado, omitir log, omitir expiração e permutar ordem intermediária). Todos morreram por ERR_ASSERTION, nenhuma sintaxe/import/timeout contabilizada. Com6 MEDIA, total17/17; Quick94/94 antes/após, cada prova estreita também verde antes de mutar, fonte restaurada por bytes e porcelain real0 bytes idêntico. Logs `test-results/postfix-sensors/{sensor,isolation}.json`, baselines e logs por mutante. As próprias amostras F1/C67 viraram testes permanentes e F3 ganhou prova de idade14999/15000 sem fechar o peer. A página completa compara200 registros e ausência de outro histórico com mensagem real persistida em café.

O driver TEMP inicial duplicou --test-reporter na primeira baseline; falhou antes de qualquer mutação e não foi contado como sensor. Argumento corrigido, log preservado, sem mudar teste/produto. A matriz 16 após todos os fixes passou integralmente, incluindo teardown externo; o incidente R7 anterior continua histórico sem causa estabelecida.

A skill daquela execução exigia literalmente “Done means every finding is closed by a commit and `validate_verification.py` exits 0.” [Cópia exata do SKILL carregado pelo MCP naquela data](C:/Users/welli/AppData/Local/Temp/conversa-tlc-spec-driven-current/SKILL.md). O gate histórico não passou. Não foi alterada a skill, ignorado teste ou usado sensor próprio como se fossem linhas emitidas pelo utilitário.

## Fechamento automático em 2026-10-31

MCP Agent Skills0.17.18, revisão checksum `eec8e8fe8151`, SKILL/Execute/Validate/Memory/Coding Principles/Sub-agents/Tasks/Lessons lidas. O fluxo oficial não fornece mutate.py; exige provas nomeadas e juízo por critério. Os112 comandos Node anteriores foram expandidos sem perder seleção para134 linhas reais de aprovação, copiadas de Node94/94. `check_proofs.py` em `ec874ec` retornou158pass/0fail, Build incluso. `validate_verification.py estabilizacao` retornouexit0, zero erros/avisos. Logs stab-execute.log, stab-proofs.log e stab-gate.log em test-results/closure-20261031.

O MESMO `/root/stab_independent_verifier` retomou apenas a forma de seu parecer original de `573491e`, completando68 linhas em `## Checks`,64yes e4no históricos F1–F4. O corpo do parecer e os Closed foram preservados; não houve novo julgamento do HEAD atual ou aprovação física. A rodada2 prevista pela skill é a reexecução do script e dos sensores sobre os fixes já commitados. Sem segundo Verifier.

Sensor isolado repetido em `ec874ec`:7/7 R01–R07 e4/4 fixes STAB, mais6/6 MEDIA, todos por falha de asserção de valor. Cada seleção estreita passou antes da mutação; baselines94/94 antes/depois. Fontes restauradas byte a byte, porcelain real0 bytes idêntico, scratch e junction removidos com caminhos conferidos. JSONs e logs por caso em test-results/closure-20261031/sensors. Nada contado por sintaxe/import/timeout. Os dois proofers começaram com árvore limpa no mesmo HEAD; o relatório MEDIA gerado foi preservado fora de .specs entre execuções e reposto depois, sem mudar entradas de produto/testes.

Pacote reconferido por `check-package.mjs` e SHA-256; código, testes e binário iguais aos de `699d4ed`. A matriz16/16 continua a execução anterior do mesmo produto/hash, não uma nova matriz rodada hoje. Integridade AST reexecutada:50nomes originais presentes,216asserções com as quatro alterações exclusivas v1→v2 já justificadas;75nomes e388asserções de f44d268 preservados. Os113 textos de AC e prefixo Decisions conferem byte a byte com38062db. Logs e drivers reproduzíveis em test-results/closure-20261031.

Após o gate foram registradas pelo script quatro lições candidatas dos findings F1–F4: L-014 normalização de nomes, L-015 diagnóstico de protocolo, L-016 idade por candidato e L-017 sequência completa/isolamento do histórico. Recorrência1; nenhuma promovida a confirmed ou usada como orientação desta execução.

T8 automatizada concluída. O sucesso físico STAB e MEDIA/T9 continuam pendentes. Ruído, eco, inteligibilidade e loopback físicos desconhecidos; sem Verified/PASS integral, publicação ou migração TypeScript.
