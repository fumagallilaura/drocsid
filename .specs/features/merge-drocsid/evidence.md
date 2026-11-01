# Drocsid candidate evidence

T12 passou os gates automáticos locais. O parecer independente e as provas em HEAD são registrados separadamente em `verification.md` e `proofs.md`; este relatório não os substitui. MEDIA/T9 física continua pendente.

## Candidate

- Produto0.1.1, Node24.21.0, Electron45.0.0, PostgreSQL17.11 nativo real.
- Portátil: `C:/Code/conversa/release-windows/Drocsid-0.1.1-Windows.exe`.
- SHA256: `00a862e610c005b552905385cfff5d36663764de220b2e891f150caf8bc809c9`.
- Executável empacotado: `.packaging/builds/1793522408719-31b0cbb8-cce2-4e62-bffa-62033a4753b0/win-unpacked/Drocsid.exe`.
- Manifesto local: `test-results/build.json`. Artefatos grandes são ignorados, não enviados ao Git.

O checker compara SHA do EXE, versão/metadados, todos os módulos próprios alcançáveis por imports estáticos/dinâmicos e todos os arquivos de `dist` ao ASAR. Foram alcançados main/preload/policy, diagnostics/service/database/identity e protocolo. Recusa arquivos de dados/configuração privada e configuração PostgreSQL no renderer. O cliente padrão abre com PostgreSQL propositalmente indisponível e mantém o perfil legado byte-idêntico.

## Automated results

`npm run dist:win` aprovado, seguido de18 gates sequenciais em `npm run check:release`: Node, strict/Vite, ASAR, smoke interno/externo source/empacotado, perfil source/empacotado, startup source/empacotado, captura nativa, ciclo de vida source/empacotado, wrapper portátil real, contas/grupos/convites, cliente sem banco e auditoria. São19 gates contando a construção inicial. Logs locais: `test-results/drocsid-merge-t12-*`, `test-results/release/*.log` e `test-results/release-matrix.json`. A rodada inicial ocorreu sobre4a77a51 com alterações T12; `check_proofs.py` repete a matriz sem reconstruir o EXE no HEAD commitado.

-152/152 testes Node; zero fail/cancelled/skipped/todo. Baseline149 casos/1008 asserções anteriores intactos; três casos novos. Strict nos quatro ambientes, sem any explícito ou supressões.113 textos de ACs históricos e Decisions intactos.
- O wrapper portátil real cadastrou uma conta pelos controles, criou grupo privado, persistiu exatamente uma mensagem com autor autenticado e abriu sem elementos de mídia. Não foi apenas o win-unpacked.
- Source/empacotado verificaram mensagens, áudio RTP bidirecional, mute, vídeo de tela, parada e limpeza. Capture observou callback nativo único, fronteira60s, IPC de documento antigo e cancelamentos. Lifecycle verificou todas as tracks encerradas em até1s em reload/desconexão/unmount/fechamento. Startup:16 amostras por execução, zero aquisição/reprodução não solicitada.
- Cinco sensores por AssertionError, em cópias isoladas, sem alterar fontes/emitidos/ASAR/EXE: identidade obsoleta no ASAR, SHA falso, import dinâmico omitido, auditoria aceitando alta/crítica e bind PostgreSQL inseguro. Somados aos lotes anteriores:56 sensores históricos por lote, sem alegar que todos foram reexecutados na mesma árvore.
- Auditoria real: produção0; completo15 moderadas de desenvolvimento,0 altas/0 críticas. Afetam tooling de empacotamento (`@electron/asar`, `electron-builder` e dependências); o npm sugere mudanças incompatíveis/rebaixamento, não aplicados com `--force`. Relatório bruto e hash do lock em `test-results/security-audit.json`. Auditoria indisponível/incompleta ou alta/crítica falha o gate; moderadas de produção também falham.
- Compose validado estaticamente: imagem17.11 por digest oficial, senha por secret externo e porta loopback. Não houve execução Docker, ausente na máquina. PostgreSQL nativo real aprovou transações, migrações, rollback, concorrência e shutdown.

## Walk and local data

O ensaio de UI em `test-results/drocsid-lab.log` repetiu cadastro, login errado/correto, logout, grupos privados, copiar/colar convite, aceitação/reuso negado, autoria da mensagem, troca de grupo/logout encerrando tracks e isolamento de rascunhos. A captura `test-results/desktop/drocsid-accounts.png` foi inspecionada visualmente. Sem captura vinculante fornecida; não há screens sub-agent.

Duas janelas nativas e banco isolado permanecem disponíveis para inspeção local. `test-results/drocsid-lab.json` informa endereço, perfil e credenciais exclusivamente de fixture (`ana`/`bia`, senha de teste). A conta bia vê Equipe A/B; ana é dona de Equipe A/Privado A. Configurações → Sair e trocar de servidor permite entrar na outra conta. O processo de laboratório usa somente loopback e não usa dados reais. Para encerrar e limpar seus próprios dados: criar `test-results/drocsid-lab-stop`; aguardar encerramento no log. Não remover o perfil real.

## Commit trace

| Task | Commit |
| --- | --- |
| T1 |41afbae|
| T2 |8d78b1f|
| AD-003 |a3f3367|
| T3 |1965746|
| T4 |1c18786|
| T5 |8a4e2a3|
| T6 |61c4b94|
| T7 |c11135e|
| T8 |4fa053e|
| T9 |5848828|
| T10 |3d05180|
| T11 |4a77a51|
| T12 |Commit que introduz este relatório, `build(release): validate the unified drocsid distribution`; `git log --oneline -- .specs/features/merge-drocsid/evidence.md` identifica-o.|

## Limits

Não há aprovação física de ruído, eco ou loopback. Faltam dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores para A7/T9 de dez minutos, usando este mesmo SHA. Testes em duas janelas num PC, dispositivos sintéticos e `--mute-audio` não substituem o ensaio. Também faltam validação NAT entre redes e qualidade com seis transmissores.

Sem assinatura de código/instalador, push, deploy AWS, alterações de banco de produção ou migração de dados reais. HTTPS/WSS público, TURN temporário autenticado, backup e operação ainda precisam de entrega própria. A câmera permanece negada, mudança de texto/grupo encerra a chamada, mute bloqueia somente reprodução e SFU/LiveKit não foi aprovado.
