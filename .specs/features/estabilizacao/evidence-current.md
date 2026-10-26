# Evidência atual de estabilização

**Automação do autor aprovada; fechamento independente pendente.** Escopo STAB separado de MEDIA. 68 claims em [tasks.md](tasks.md#checks), uma por AC, com comandos que selecionam suas provas. O relatório histórico [evidence.md](evidence.md) permanece intacto; [execution.md](execution.md) registra cada nova conjunção e seu proprietário. Nenhum STAB Verified pelo autor.

Candidata avaliada em **f85926e**, versão 0.1.1, protocolo2, Node24.21.0, Electron45.0.0. Produto de playback em `8955755`; commits posteriores deste lote ampliam somente evidência. Portátil `release-windows/Conversa-0.1.1-Windows.exe`, SHA-256 `cecd15829760e1aa0d30f14db23584016c525d9ffee988c5ec06178b4f14b46e`. Manifesto, ledger e logs `test-results/stabilizacao-final/`.

**91/91 = 50 + 41**, zero fail/skip/cancelled/todo. Gate Build STAB (Node + Vite + smoke source) e matriz adicional MEDIA de16 gates passaram. Perfil source/packaged compara configuração ICE efetiva dos dois hosts, restaura preferências em outra porta e recusa câmera/frame/segunda instância. Ciclo inventaria tracks em reload/disconnect/unmount/close. Startup source não depende de manifesto. O wrapper portátil real abriu renderer/preload/serviço e persistiu uma mensagem. Todos os exit codes incluem teardown.

| Escopo de AC / proprietário | Commits e evidência executável |
| --- | --- |
| 01–16/31/39/42–44/68, captura/saída | Call histórica `ae07a55` e correções MEDIA T1–T7/R1–R6; rtc/session/service, capture/lifecycle/startup e smoke. R6 `7978124` prova stop+leave nas duas ordens. Mapeamentos de resultado nos relatórios MEDIA, sem herdar aprovação de STAB por nome. |
| 17–27/53–55, mensagens e dados | T3 `7d24f4b`, T5 `d456168`; retomada `088e701`, `9b0c3ba`, `cdfb626`. Valores de sala/ID/texto/recibo, nenhum registro em outra sala, retry/restart, limite UTF16, contenda e dados incompatíveis em service/session/server. |
| 28–30/32–38/49, servidor/encerramento | `088e701`, `0a1d1e2`, testes service/bootstrap. 404 e socket fechado em1s, 503 durante shutdown retido, mesmo close/prazo original de5s, SIGINT/SIGTERM, causa de bootstrap e retry. A emissão dos sinais em processo filho é o método Windows, sem alegar entrega Unix entre processos. |
| 40/41/46/47/50–52, contrato/limites | T1 `5c1a05a`, protocolo atual MEDIA `5a8f657`, protocol/service/session, comparação ICE desktop `1c85e6e`. Versão2 obrigatória e v1 negada; categorias estáveis, tetos e origem/sala do endereço preservadas. |
| 45/48/56, perfil/permissões | BUILD e MEDIA preservados; T7 `1c85e6e`, desktop-policy/profile/capture. userData isolado, origem/frame e host único; sem autenticação de convidados. |
| 57–62, UI | T6 `dc8d7a1` preservada, smoke por gestos/contraste/scroll. R7 `f85926e` acrescenta duas autorias legadas null sem agrupamento e mantém homônimos por ID. |
| 63–66, harness/sensor | harness.test.js, startup/desktop-smoke e provas atuais. R01–R07 ainda devem ser discriminados pelo Verifier independente; gate verde sozinho não comprova sensor. |
| 67, diagnósticos | `8955755` corrige correlação callId/generation de playback, asserção pré-fix falhava por valor; captura/protocolo/persistência/shutdown mantêm categorias e logs restritos. Sentinelas de conteúdo não aparecem na saída. |

Integridade AST: todos os50 nomes de `38062db` e75 de `f44d268` preservados. Das216 expressões originais,212 idênticas e quatro somente v1→v2, já justificadas em MEDIA/T6. Todas as388 expressões da primeira entrega MEDIA intactas. 113 textos AC e prefixo Decisions intactos. Nenhum skip ou teste removido. Rastreabilidade reversa nova está em execution; os testes antigos são regressão exigida, não prova apenas pelo nome.

O externo inicial de R7 retornou exit1 no teardown depois das asserções; não foi contado como aprovação. Inspeção sem processo remanescente, repetição integral e nova matriz16 passaram sem mudar prazo/asserts. Causa do incidente não estabelecida. O perfil TEMP `conversa-test-y4t7mS` de R3 permanece após remoção manual rejeitada automaticamente; nenhum processo associado permanece.

Hardware real, causa do ruído, inteligibilidade/eco/loopback e redes distintas não demonstrados. T9 MEDIA segue pendente por indisponibilidade explícita dos dois PCs Windows/LAN confiável, fones/mics e dois operadores. Isso também mantém pendente o sucesso físico da estabilização. Contas/grupos privados/TURN autenticado bloqueiam publicação; câmera/SFU/TS continuam fora da execução atual. Nenhuma investigação/call/convite Discord repetida.

Skill MCP atual0.17.14, revisão preparada `f465b52756b8`. Execute/validate/memory/coding-principles/sub-agents/lessons lidas integralmente; nenhuma lesson confirmed. Os scripts Python são chamados do caminho real com um launcher TEMP que apenas inclui a pasta do script em sys.path, necessária ao Python portátil isolado. Provas e gate de fechamento serão registrados depois deste commit.
