# STATE

## Decisions

## Handoff

- **Feature**: [Captura de mídia e saída da chamada](features/captura-midia-saida/spec.md), recorte de R01–R03/R06 com fronteiras de suporte. [Estabilização](features/estabilizacao/spec.md): 68 STAB Pending; nenhum dos 26 achados encerrado por esta spec.
- **Phase / Task**: Specify concluída em 2026-10-25. Pedido atual: montar a spec considerando engenharia reversa do Discord. Não avançar automaticamente para design, tarefas ou implementação.
- **Completed**: 34 critérios MEDIA, quatro histórias, rastreabilidade STAB/achados, nove dimensões, prazos e protocolo físico explícitos. `validate_spec.py --strict`: exit 0, zero erros/avisos; 34 IDs/34 linhas e oito links locais conferidos. MCP Agent Skills tlc-spec-driven, catálogo 0.17.12, revisão 9f4c79355600; nenhuma lição confirmada. Código do Conversa inspecionado em `1d97d46`; nenhuma correção/teste novo ou reexecução da suíte nesta entrega.
- **In-progress** (file:line): Nenhum código em andamento. Discord D1 inspecionava só manifesto; D2 ampliou para bundle via REA CLI 6.7.0, com timeout de 30 s e evidência parcial preservada em `../discord-research/discord-media-shell-evidence.json`, `details.partial_observation`, ID `ev_5de472a64ad800ad28afe38202c5f68727d7b2129912b3e4e9368e8adf0ba541`. Sem observação de chamada/runtime Discord. D3–D5 são documentação oficial, não prova do binário. REA MCP ausente nesta sessão; não foi configurado.
- **Next step**: Revisar/aprovar a spec antes de planejar sua execução; reutilizar evidência existente somente após conferir os resultados exigidos. Não repetir tarefas antigas por checkboxes. Não configurar remoto Git.
- **Blockers**: Nenhuma decisão essencial pendente para a spec; A1–A8 são premissas. Observação de runtime Discord e ensaio físico ainda pendentes. Protótipo confiável; trocar sala de texto encerra chamada. “Silenciar áudio” só bloqueia reprodução; paridade de deafen não aprovada. Contas/grupos privados/TURN autenticado bloqueiam publicação; LiveKit/SFU não aprovado.
- **Uncommitted files**: Nenhum após o commit documental. Apenas nova spec e Handoff alterados no Conversa; Decisions preservada. Registro REA bruto permanece na pasta irmã discord-research. BUILD anterior conserva PASS 11/11, Node 50/50, 12 gates e 10/10 mutações; não certifica MEDIA ou STAB completos. Portátil/hash em `test-results/build.json`.
- **Branch**: `main`, sem remoto; base desta redação `1d97d46`, último código/testes `58be3ed`. Cliente MCP `%TEMP%/conversa-agent-skills-mcp-client.mjs`; Python `%TEMP%/conversa-spec-python-3.14.0/python.exe`; scripts da skill em `C:/Users/welli/.cache/agent-skills-mcp/tlc-spec-driven/9f4c79355600/scripts/`.
