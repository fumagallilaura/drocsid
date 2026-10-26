# Candidata MEDIA atual

**Build do autor16/16 PASS, fechamento global pendente.** Versão0.1.1/protocolo2, código/testes `699d4ed`, produto de playback `8955755`, limites nominais `1c1bdbd` e diagnóstico `0345015`, Node24.21.0 e Electron45.0.0. [Rodada2 independente](validation-round2.md) preservada: 28 critérios integrais, quatro parciais pelo edge stop+leave e dois físicos ausentes. R6 `7978124` acrescenta as duas ordens desse edge sem mudança de produto. A revisão atual da skill reexecuta provas/mutantes após os dois pareceres existentes; não abre terceiro Verifier.

- Portátil: `release-windows/Conversa-0.1.1-Windows.exe`.
- SHA-256: `16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135`.
- Executável: `C:/Code/conversa/.packaging/builds/1792989110445-ac3c713a-d32d-4312-a32e-3862530418da/win-unpacked/Conversa.exe`.
- Manifesto/ledger/logs: `test-results/stabilizacao-postfix/{build,gates}.json` e logs por gate. checker do ASAR/dist comparou bytes ao source atual. Sem mudança de produto após o build. A candidata efa7fb4e da rodada2 é histórica, anterior ao fix de playback.

| Gate final | Exit |
| --- | --- |
| quick | 0 |
| build | 0 |
| source-smoke-internal | 0 |
| source-profile | 0 |
| source-capture | 0 |
| source-lifecycle | 0 |
| source-startup | 0 |
| source-smoke-external | 0 |
| dist-win | 0 |
| package | 0 |
| packaged-profile | 0 |
| packaged-lifecycle | 0 |
| packaged-smoke-internal | 0 |
| packaged-smoke-external | 0 |
| packaged-startup | 0 |
| portable-wrapper | 0 |

**94/94 = 50 + 44**, zero fail/skip/cancelled/todo. Os50 nomes originais e75 da primeira entrega MEDIA continuam presentes;212 das216 expressões históricas intactas e quatro só v1→v2. As388 expressões de f44d268 intactas. 113 textos AC e Decisions preservados. A matriz inclui source e win-unpacked, smokes interno/externo, perfil, captura source, lifecycle nas duas formas, startup e wrapper portátil real. O Device Guard histórico não reapareceu; nenhuma política/launcher alterado.

A rastreabilidade por32 critérios automatizáveis está em [Checks](tasks.md#checks), [execução por proprietário](execution.md), [evidência inicial histórica](evidence-initial.md) e nos dois pareceres independentes. A [evidência anterior do autor](evidence-round2-author.md) foi preservada inteira. A única conjunção retornada pela rodada2 é agora exercitada em `tests/rtc.test.js:315`: ambas as ordens stop/leave, remoção/ack retidos, todas as tracks antigas ended/PC fechado antes da rede, repetição999+1 sem renovar prazo e reentrada preservada após conclusões antigas. MEDIA-16/17/21/24 retorna às provas atuais e ao sensor independente já definido.

O smoke também exige diagnóstico de playback correlacionado e autoria legada distinta, mudanças de STAB com evidência própria. O incidente externo de teardown R7 foi FAIL e preservado; repetição e matriz final passaram, causa não estabelecida. Nenhum teste foi relaxado para isso.

**T9 não executada**: usuário confirmou falta de recursos em26/10. [UAT](uat.md) mantém todas as etapas NÃO EXECUTADAS. Dois PCs Windows na LAN confiável, fones/microfones reais e dois operadores continuam necessários para três ciclos30s e sessão10min/5frases por sentido. Zero evidência de ruído/eco/inteligibilidade/loopback físico, sem Physical/PASS integral/Verified. Provas atuais e sensores registrados em proofs.md e verification.md; T8 formal continua pendente pelo utilitário incompatível.

Texto encerra chamada; Silenciar áudio só reprodução; câmera negada; sem SFU/TS/contas. Contas/grupos privados/TURN autenticado bloqueiam publicação. Discord D6–D11 estático/cache e U1 UI, quatro desconhecidos de runtime continuam abertos; nenhum fluxo Discord repetido.

## Reexecução final

`check_proofs.py --mutations` em `699d4ed`: **85 provas pass,2 fail**. Os únicos checks vermelhos são C33/C34 físicos, não executados; os32MEDIA automatizáveis passaram. O utilitário de mutação filho falhou por SIGHUP ausente,0 linhas emitidas, sem aprovação dessa fase. Sensor próprio reexecutou os seis snippets independentes da rodada2: **6/6 por asserção**, baselines94/94, fonte restaurada e porcelain real idêntico. O mesmo scratch também repetiu sete STAB e quatro sondas dos fixes, total17/17, sem transferir certificação entre features. Logs test-results/postfix-sensors, versão/hash acima. [Fechamento e limites](verification.md). Nenhum Physical/Verified/PASS integral.
