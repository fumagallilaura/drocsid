# STATE

## Decisions

## Handoff

- **Feature**: [Captura/saída](features/captura-midia-saida/tasks.md), [execução e adequação](features/captura-midia-saida/execution.md). Revisão documental concluída em `38062db`, conferida no disco.
- **Phase / Task**: Execute, T1 `be83426`, T2 `ca2ba07`, T3 `2006457`, T4 concluída; próxima T5. Usuário escolheu implementação inline e Verifier independente no fechamento.
- **Completed**: Tentativas/terminais correlacionados e geração da Session; T4 separa tela provisória/ativa, compensa peers tardios/suspensos e conserva voz saudável. Full PASS T4: 69/69 Node (50 + 19), build e smoke source/interno. Sem testes removidos/enfraquecidos/skips/cancelled. Evidência detalhada em execution.md; linhas de tarefas anteriores são dos commits citados.
- **In-progress** (file:line): Nenhum código parcial após este commit. MEDIA sem Verified; T5–T9 abertas. STAB 68 sem certificação integral; mensagens e shutdown continuam prioridades próprias. BUILD histórico `58be3ed` não certifica MEDIA/STAB.
- **Next step**: T5: correlacionar seleção Electron/bridge/adaptador por operação e documento, com fixture real e testes de política. Ler APIs primárias antes de adotar o IPC síncrono proposto. Manter v1 até T6; reconciliar STAB/A14 antes do v2. T4 em Git pelo título `fix(rtc): settle screen publication and rollback every affected peer`.
- **Blockers**: T9 exige dois PCs Windows, fones/microfones reais e operadores; não disponíveis por evidência nesta sessão. Não bloquear código por esse ensaio futuro. Sem aprovação integral/hardware. Causa do ruído desconhecida. Discord D6–D11 estáticos; U1 UI; quatro dúvidas open, sem repetir investigação. Câmera negada, tela existente, texto termina chamada, Silenciar áudio só reprodução. Contas/grupos privados/TURN autenticado bloqueiam publicação; SFU não aprovado. TypeScript somente depois da estabilização.
- **Uncommitted files**: Nenhum após commit T4. Decisions preservada byte a byte.
- **Branch**: `main`, sem remoto. MCP catálogo 0.17.13; revisão atual reconferida/preparada `7bed1026351b`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Commits locais autorizados; sem push/deploy/terceiros.
