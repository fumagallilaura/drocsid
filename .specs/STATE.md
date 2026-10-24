# STATE

## Decisions

## Handoff

- **Feature**: Estabilização: [spec](features/estabilizacao/spec.md), [design](features/estabilizacao/design.md), [tasks](features/estabilizacao/tasks.md), [evidência incremental](features/estabilizacao/evidence.md). Escopo: convidados confiáveis; trocar de sala encerra chamada.
- **Phase / Task**: Execute, T1–T3 concluídas em 2026-10-24. Usuário autorizou continuidade autônoma com MCP Agent Skills e pediu evitar Code SLOP. Pedido de conectar Git remoto foi explicitamente retirado; não configurar remoto. A restrição antiga a somente Specify foi substituída por essa autorização.
- **Completed**: Git local inicializado, baseline `63810f4`; plano `fb75d47`; T1 contrato v1 `5c1a05a`; T2 Call `ae07a55`; T3 serviço `7d24f4b`. Gates atuais: 26 testes Node aprovados, zero skips, build aprovado. Nenhum teste anterior eliminado ou enfraquecido. Regressões verificam captura obsoleta, rollback de tela, recibos/deduplicação, destino explícito, saída fora da cota, histórico legado, Upgrade, shutdown e limites. Adequação por tarefa em evidence.md.
- **In-progress** (file:line): Próxima T4, `server/index.js:1`. Atenção: o serviço já exige protocolo v1; a interface ainda usa o protocolo antigo e deve ser integrada em T5/T6/T7 antes de declarar o aplicativo funcional. `src/rtc.js:1` agora recebe send assíncrono com ack, callbacks Error, geração e dependências de mídia/clock injetáveis para testes. Não executar as sondagens antigas como gate de correção.
- **Next step**: Implementar T4 (bootstrap e HMR), depois T5 Session, T6 App, T7 permissões/preferências Electron e T8 harness. Uma tarefa por commit, testes antes, gate antes de marcar completa. Ao final despachar Verifier independente conforme skill e executar validate_state.py; sem PASS inventado para hardware real.
- **Blockers**: Nenhum para continuar localmente. Mídia física/ruído/redes distintas e portátil sob Device Guard continuam sem aprovação. R08/R09 e R23/R24 permanecem fora de escopo; LiveKit/SFU/hospedagem não aprovados. Plano tem oito componentes/tarefas coesas, cabe em um lote inline; só Verifier requer subagente.
- **Uncommitted files**: Este Handoff foi atualizado após T3; conferir git status ao retomar. Bancos de teste são temporários; dados pessoais e review/ não foram alterados. Artefatos de build dist/ são ignorados. Cliente MCP e Python portátil ficam em TEMP.
- **Branch**: `main`, repositório Git local em C:\Code\conversa, sem remoto. MCP: cliente stdio `%TEMP%/conversa-agent-skills-mcp-client.mjs`, catálogo 0.17.12, skill tlc-spec-driven revisão `C:/Users/welli/.cache/agent-skills-mcp/tlc-spec-driven/9f4c79355600`; referências implement/validate/sub-agents lidas integralmente. Python: `%TEMP%/conversa-spec-python-3.14.0/python.exe`.
