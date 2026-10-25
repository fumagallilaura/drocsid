# STATE

## Decisions

## Handoff

- **Feature**: [Captura/saída](features/captura-midia-saida/tasks.md), [execução e adequação](features/captura-midia-saida/execution.md). Revisão documental concluída em `38062db`, conferida no disco.
- **Phase / Task**: Execute, T1 `be83426`, T2 `ca2ba07`, T3 concluída; próxima T4. Usuário escolheu implementação inline e Verifier independente no fechamento.
- **Completed**: T1 contexto/limpeza local; T2 terminal por geração, revisão e expiração exata; T3 Session correlaciona/cancela pedidos e descarta snapshots antigos, App usa geração da conexão ao substituir Call. Full PASS T3: 64/64 Node (50 + 14), build e smoke source/interno. Sem testes removidos/enfraquecidos/skips/cancelled.
- **In-progress** (file:line): Nenhum código parcial após este commit. MEDIA sem Verified; T4–T9 abertas. STAB 68 sem certificação integral; mensagens e shutdown continuam prioridades próprias. BUILD histórico `58be3ed` não certifica MEDIA/STAB.
- **Next step**: T4: operação de tela provisória/publicada, fila de senders, inventário dos peers afetados e compensação de resoluções tardias. Manter v1 aditivo até T6; reconciliar STAB/A14 antes do v2. T3 em Git pelo título `fix(session): reject stale call replies and presence snapshots`.
- **Blockers**: T9 exige dois PCs Windows, fones/microfones reais e operadores; não disponíveis por evidência nesta sessão. Não bloquear código por esse ensaio futuro. Sem aprovação integral/hardware. Causa do ruído desconhecida. Discord D6–D11 estáticos; U1 UI; quatro dúvidas open, sem repetir investigação. Câmera negada, tela existente, texto termina chamada, Silenciar áudio só reprodução. Contas/grupos privados/TURN autenticado bloqueiam publicação; SFU não aprovado. TypeScript somente depois da estabilização.
- **Uncommitted files**: Nenhum após commit T3. Decisions preservada byte a byte.
- **Branch**: `main`, sem remoto. MCP catálogo 0.17.13; revisão atual reconferida/preparada `7bed1026351b`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Commits locais autorizados; sem push/deploy/terceiros.
