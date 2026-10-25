# STATE

## Decisions

## Handoff

- **Feature**: [Captura/saída](features/captura-midia-saida/tasks.md), [execução e adequação](features/captura-midia-saida/execution.md). Revisão documental concluída em `38062db`, conferida no disco.
- **Phase / Task**: Execute, T1 `be83426`, T2 `ca2ba07`, T3 `2006457`, T4 `fdf6066`, T5 `325c340`, T6 concluída; próxima T7. Usuário escolheu implementação inline e Verifier independente no fechamento.
- **Completed**: T1–T5 corrigem ownership/terminais/tela/seleção; T6 ativa v2 obrigatório, com STAB/A14/vocabulário reconciliados e v1 histórica preservada. Build 14/14 gates PASS: 74/74 Node (50 + 24), source, externos, win-unpacked e wrapper real. Cliente v1 real recusado antes de mídia. Portátil T6 SHA-256 `c9026b05387d87d1b7f9b76c2a78ef0db4398ee3460a225071297cdcc5e4ba72`; logs em test-results/media-t6. 113 ACs e Decisions íntegros.
- **In-progress** (file:line): Nenhum código parcial após este commit. MEDIA sem Verified; T7–T9 abertas. STAB 68 sem certificação integral; mensagens e shutdown continuam prioridades próprias. BUILD histórico `58be3ed` não certifica MEDIA/STAB.
- **Next step**: T7: estados/controles, bloqueio síncrono de reprodução e diagnóstico sanitizado no App; Full + captura/perfil e smoke externo. Depois T8 recompila/aceita a candidata final, Verifier independente e sensor isolado. T6 em Git pelo título `feat(protocol)!: require call generations and presence revisions`.
- **Blockers**: T9 exige dois PCs Windows, fones/microfones reais e operadores; não disponíveis por evidência nesta sessão. Não bloquear código por esse ensaio futuro. Sem aprovação integral/hardware. Causa do ruído desconhecida. Discord D6–D11 estáticos; U1 UI; quatro dúvidas open, sem repetir investigação. Câmera negada, tela existente, texto termina chamada, Silenciar áudio só reprodução. Contas/grupos privados/TURN autenticado bloqueiam publicação; SFU não aprovado. TypeScript somente depois da estabilização.
- **Uncommitted files**: Nenhum após commit T6. Decisions preservada byte a byte.
- **Branch**: `main`, sem remoto. MCP catálogo 0.17.13; revisão atual reconferida/preparada `7bed1026351b`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`. Commits locais autorizados; sem push/deploy/terceiros.
