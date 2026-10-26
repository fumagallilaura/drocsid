# MEDIA: fechamento após os pareceres independentes

**Verdict**: FAIL. A automação funcional passou; T9 não foi executada e o utilitário atual de mutação não funciona neste Python Windows.
**HEAD**:699d4ed, candidata0.1.1/protocolo2, SHA-256 `16caffca2bf5b129e48b8d79438baa0e5b23fd4ca225b1e3aca24e81b2646135`.
**Verifier**: fontes independentes preservadas em validation-round1.md e validation-round2.md. Este fechamento é reexecução do autor depois dos fixes, sem terceiro Verifier, conforme a revisão atual da skill.
**Proofs**:85pass/2 fail em `699d4ed`, somente C33/C34 físicos vermelhos.
**Mutations**:6 categorias independentes repetidas,6/6 por asserção no sensor próprio;0 linhas do mutate.py, cuja execução falhou por SIGHUP.

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Edge stop+leave da rodada2, MEDIA-16/17/21/24 | Ausência de conjunção relatada em validation-round2.md; agora rtc.test.js:315 exige inventário ended/PC fechado, duas ordens,999+1sem renovar prazo e reentrada preservada após replies antigas | Teste permanente R6 e reexecução das provas/mutantes em `699d4ed` | `7978124`, prova MEDIA-16/17/21/24 |
| T9 física ausente, MEDIA-33/34 | Usuário confirmou indisponibilidade; uat.md inteiro NÃO EXECUTADO. Zero evidência física | Dois PCs Windows/LAN confiável, fones/microfones reais e dois operadores, mesmo portátil validado; ciclos30s e sessão10min integral | |
| Gate formal da ferramenta atual indisponível | mutate.py f465b52756b8:214 falha AttributeError/SIGHUP antes de aplicar mutações; proofs.md tem0 linhas de sensor da ferramenta | Revisão compatível com Windows, depois repetir provas/mutações e validate_verification; não alterar relatório para fabricar aprovação | |

## Reexecução e limites

Matriz 16 integral PASS em `699d4ed`,94/94 Node, zero fail/skip/cancelled/todo, sem novo incidente de teardown/Device Guard. Executável `C:/Code/conversa/.packaging/builds/1792989110445-ac3c713a-d32d-4312-a32e-3862530418da/win-unpacked/Conversa.exe`; portátil release-windows/Conversa-0.1.1-Windows.exe. Logs/manifesto test-results/stabilizacao-postfix.

Sensor próprio usa os seis snippets da rodada2 em scratch separado e passa a baseline estreita antes de cada mutação. M1 captura antiga, M2 rollback, M3 callback alheio, M4 terminal antes de admissão, M5 cota e M6 fronteira de prazo morreram por comparação de valor; nenhuma sintaxe/import/watchdog contabilizada. Baselines94/94 antes/após; fonte restaurada byte a byte, porcelain real0 bytes igual. Os sete sensores STAB e quatro dos fixes foram repetidos no mesmo scratch, mas continuam evidência separada. Logs por caso em test-results/postfix-sensors.

O proofer devolve85pass/2 fail; o subutilitário que falhou não produziu linhas. Esse0não é aprovação de mutações. Não se inventaram linhas para satisfazer o gate. Nenhum MEDIA Verified ou feature completa. STAB possui seu próprio parecer e quatro fixes; terminar MEDIA não o aprova por associação. Ruído/eco/inteligibilidade e loopback reais desconhecidos. Texto termina chamada; Silenciar áudio só reprodução; câmera negada, sem SFU/TS. Publicação depende futuramente de contas/grupos privados/TURN autenticado. Discord não foi operado nesta execução.

## Gate

`validate_verification.py captura-midia-saida` em699d4ed retornou exit1, cinco erros/zero avisos: C33/C34 vermelhos,0linhas de mutação e os dois findings físicos/ferramenta abertos. Saída integral em test-results/postfix-sensors/media-gate-final.log.
