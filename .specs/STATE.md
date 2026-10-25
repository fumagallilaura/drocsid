# STATE

## Decisions

## Handoff

- **Feature**: [Captura/saída](features/captura-midia-saida/tasks.md), [execução e adequação](features/captura-midia-saida/execution.md). Revisão documental concluída em `38062db`, conferida no disco.
- **Phase / Task**: Execute, T1 `be83426` e T2 concluídas; próxima T3. Usuário escolheu implementação inline e Verifier independente no fechamento.
- **Completed**: T1 contexto capturado, geração injetável e limpeza local; T2 terminal por geração, revisão de presença e expiração desde pong real. Full PASS T2: 58/58 Node (50 + 8), build e smoke source/interno. Sem testes removidos/enfraquecidos/skips/cancelled; teste antigo de heartbeat apenas adaptou clock mantendo asserções.
- **In-progress** (file:line): Nenhum código parcial após este commit. MEDIA sem Verified; T3–T9 abertas. STAB 68 sem certificação integral; mensagens e shutdown continuam prioridades próprias. BUILD histórico `58be3ed` não certifica MEDIA/STAB.
- **Next step**: T3: correlação/geração na Session e ligação mínima App/Call com testes de substituição do controlador. Manter v1 aditivo até T6; reconciliar STAB/A14 antes do v2. T2 em Git pelo título `fix(server): fence terminal calls and expire participants by deadline`.
- **Blockers**: T9 exige dois PCs Windows, fones/microfones reais e operadores; não disponíveis por evidência nesta sessão. Não bloquear código por esse ensaio futuro. Sem aprovação integral/hardware. Causa do ruído desconhecida. Discord D6–D11 estáticos; U1 UI; quatro dúvidas open, sem repetir investigação. Câmera negada, tela existente, texto termina chamada, Silenciar áudio só reprodução. Contas/grupos privados/TURN autenticado bloqueiam publicação; SFU não aprovado. TypeScript somente depois da estabilização.
- **Uncommitted files**: Nenhum após commit T2. Decisions preservada byte a byte.
- **Branch**: `main`, sem remoto. MCP catálogo 0.17.13; revisão atual reconferida/preparada `7bed1026351b`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Commits locais autorizados; sem push/deploy/terceiros.
