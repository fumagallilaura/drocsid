# STATE

## Decisions

## Handoff

- **Feature**: [Captura/saída](features/captura-midia-saida/tasks.md), [execução e adequação](features/captura-midia-saida/execution.md). Revisão documental concluída em `38062db`, conferida no disco.
- **Phase / Task**: Execute inline, retorno da rodada 1 do Verifier em `f44d268`. Build 14/14 e Node 75/75 passaram, mas MEDIA-17 funcional e lacunas de evidência/sensor exigem correções por proprietário antes de repetir T8. T9 física não executada.
- **Completed**: Código T7 `018019c`; T8 consolida 32 MEDIA em [evidence.md](features/captura-midia-saida/evidence.md). 75/75 Node, 14/14 Build incluindo source/externos/win-unpacked/wrapper real, zero falhas/skips/cancelled. Portátil SHA-256 `fe9ee1feab3765c210a8033a8b3b70789d22fcf7525af792b37d2b97a9f2202a`; manifesto/logs test-results/media-t8. 50 testes históricos e 216 asserções conferidos: 212 iguais, quatro somente contrato v1→v2. 113 ACs/Decisions íntegros; sem TS.
- **In-progress** (file:line): R1 `01f3e1c` corrige parada local/nova tela; R2 em `tests/service.test.js:149`/`:182` discrimina ack/error para M4/M5. 78/78 Node, Full e gates dos proprietários aprovados. MEDIA-01–32 Implementing, sem Verified; T9/MEDIA-33/34 não executados. STAB 68 sem certificação integral; mensagens e shutdown continuam prioridades próprias.
- **Next step**: Completar conjunções MEDIA-01/07/08/10/23/28/29/31 nos proprietários, com commits/gates. Consolidar T8 e pedir rodada 2 ao Verifier independente; exigir seis mutações válidas e comparação porcelain. Sem A7/T9 não há PASS integral nem fechamento.
- **Blockers**: T9 exige dois PCs Windows, fones/microfones reais e operadores; não disponíveis por evidência nesta sessão. Não bloquear código por esse ensaio futuro. Sem aprovação integral/hardware. Causa do ruído desconhecida. Discord D6–D11 estáticos; U1 UI; quatro dúvidas open, sem repetir investigação. Câmera negada, tela existente, texto termina chamada, Silenciar áudio só reprodução. Contas/grupos privados/TURN autenticado bloqueiam publicação; SFU não aprovado. TypeScript somente depois da estabilização.
- **Uncommitted files**: Conferir porcelain após cada commit de correção e o relatório do Verifier. Decisions preservada byte a byte.
- **Branch**: `main`, sem remoto. MCP catálogo 0.17.13; revisão atual reconferida/preparada `7bed1026351b`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Commits locais autorizados; sem push/deploy/terceiros.
