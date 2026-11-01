# Drocsid candidate evidence

T12 passou os gates automáticos locais. O parecer independente e as provas em HEAD são registrados separadamente em `verification.md` e `proofs.md`; este relatório não os substitui. MEDIA/T9 física continua pendente.

## Candidate

- Produto0.1.1, Node24.21.0, Electron45.0.0, PostgreSQL17.11 nativo real.
- Portátil: `C:/Code/conversa/release-windows/Drocsid-0.1.1-Windows.exe`.
- SHA256: `cd1b3b43bf4756c8d8b3e8821b8972873a87ac54d5265e4c14009588ead2ddd0`.
- Executável empacotado: `.packaging/builds/1793523641844-408198a2-a57f-4235-b35b-4a58ca8f7603/win-unpacked/Drocsid.exe`.
- Manifesto local: `test-results/build.json`. Artefatos grandes são ignorados, não enviados ao Git.

O checker compara SHA do EXE, versão/metadados, todos os módulos próprios alcançáveis por imports estáticos/dinâmicos e todos os arquivos de `dist` ao ASAR. Foram alcançados main/preload/policy, diagnostics/service/database/identity e protocolo. Recusa arquivos de dados/configuração privada e configuração PostgreSQL no renderer. O cliente padrão abre com PostgreSQL propositalmente indisponível e mantém o perfil legado byte-idêntico.

## Automated results

`npm run dist:win` aprovado, seguido de18 gates sequenciais em `npm run check:release`: Node, strict/Vite, ASAR, smoke interno/externo source/empacotado, perfil source/empacotado, startup source/empacotado, captura nativa, ciclo de vida source/empacotado, wrapper portátil real, contas/grupos/convites, cliente sem banco e auditoria. São19 gates contando a construção inicial. Logs locais: `test-results/drocsid-merge-t12-*`, `test-results/release/*.log` e `test-results/release-matrix.json`. A rodada inicial ocorreu sobre4a77a51 com alterações T12; `check_proofs.py` repete a matriz sem reconstruir o EXE no HEAD commitado.

-152/152 testes Node; zero fail/cancelled/skipped/todo. T12 preservou149 casos/1008 asserções anteriores e acrescentou três casos. No fechamento do Verifier,1007 dessas asserções continuam idênticas; a única substituída passa a exigir ancestralidade de HEAD em vez de aceitar MERGE_HEAD. Strict nos quatro ambientes, sem any explícito ou supressões.113 textos de ACs históricos e Decisions intactos.
- O wrapper portátil real cadastrou uma conta pelos controles, criou grupo privado, persistiu exatamente uma mensagem com autor autenticado e abriu sem elementos de mídia. Não foi apenas o win-unpacked.
- Source/empacotado verificaram mensagens, áudio RTP bidirecional, mute, vídeo de tela, parada e limpeza. Capture observou callback nativo único, fronteira60s, IPC de documento antigo e cancelamentos. Lifecycle verificou todas as tracks encerradas em até1s em reload/desconexão/unmount/fechamento. Startup:16 amostras por execução, zero aquisição/reprodução não solicitada.
- Cinco sensores por AssertionError, em cópias isoladas, sem alterar fontes/emitidos/ASAR/EXE: identidade obsoleta no ASAR, SHA falso, import dinâmico omitido, auditoria aceitando alta/crítica e bind PostgreSQL inseguro. Reexecutados na candidata corrigida. A contagem dos lotes anteriores é histórica; a reconferência dos dois sensores UI de T10 está registrada abaixo, sem contar falha de preparação como discriminação.
- Auditoria real: produção0; completo15 moderadas de desenvolvimento,0 altas/0 críticas. Afetam tooling de empacotamento (`@electron/asar`, `electron-builder` e dependências); o npm sugere mudanças incompatíveis/rebaixamento, não aplicados com `--force`. Relatório bruto e hash do lock em `test-results/security-audit.json`. Auditoria indisponível/incompleta ou alta/crítica falha o gate; moderadas de produção também falham.
- Compose validado estaticamente: imagem17.11 por digest oficial, senha por secret externo e porta loopback. Não houve execução Docker, ausente na máquina. PostgreSQL nativo real aprovou transações, migrações, rollback, concorrência e shutdown.

## Walk and local data

O ensaio de UI em `test-results/drocsid-lab.log` repetiu cadastro, login errado/correto, logout, grupos privados, copiar/colar convite, aceitação/reuso negado, autoria da mensagem, troca de grupo/logout encerrando tracks e isolamento de rascunhos. A captura `test-results/desktop/drocsid-accounts.png` foi inspecionada visualmente. Sem captura vinculante fornecida; não há screens sub-agent.

Duas janelas nativas e banco isolado permanecem disponíveis para inspeção local. `test-results/drocsid-lab.json` informa endereço, perfil e credenciais exclusivamente de fixture (`ana`/`bia`, senha de teste). A conta bia vê Equipe A/B; ana é dona de Equipe A/Privado A. Configurações → Sair e trocar de servidor permite entrar na outra conta. O processo de laboratório usa somente loopback e não usa dados reais. Para encerrar e limpar seus próprios dados: criar `test-results/drocsid-lab-stop`; aguardar encerramento no log. Não remover o perfil real.

## Follow-up: visible server destination

A primeira matriz passou, mas `check_proofs` em429a3d2 reteve o fechamento: o perfil empacotado, depois de mudar porta, não entrou no grupo. A reprodução capturou o campo vazio e a requisição indevida a `http://localhost:4310/api/config`, usando estado antigo do endereço salvo. A nova asserção no checker compara diretamente a origem solicitada com a origem local atual e reproduziu o defeito por ExpectError, sem depender do timeout da tela seguinte.

A submissão agora lê `server` do formulário no gesto, sincroniza o estado e salva esse mesmo destino após sucesso. Mantidos todos os asserts anteriores; adicionados somente observação da requisição e comparação da origem. A candidata anterior SHA `00a862e610c005b552905385cfff5d36663764de220b2e891f150caf8bc809c9` foi substituída pela candidata acima.152/152 e matriz18/18 novamente PASS; logs `test-results/drocsid-profile-target-*`.

Um sensor adicional usa controle idêntico e uma mudança do campo no capture de submit, antes do handler React: controle PASS, mutante que volta a usar estado antigo falha exatamente na origem localhost:4310. Relatório `test-results/profile-submit-sensors.json`, fontes/emitidos intactos. Os cinco sensores de pacote/segurança T12 também foram reexecutados com o novo ASAR/EXE.

A reconferência encontrou dois sensores UI de T10 que falharam no heading inicial, antes da regra pretendida; os registros originais foram preservados e não são discriminação válida. O build isolado desses sensores agora carrega o plugin React igual ao produto e usa um controle limpo. Reexecução dos mutantes de listagem antiga e senha persistida exige respectivamente a asserção do botão Equipe A e a comparação false/true de segredo armazenado; falha de startup não é aceita. A contagem por lote passa a57 com o novo sensor de destino, substituindo as duas detecções inválidas pelos ensaios corrigidos; não implica reexecução de todos os lotes no mesmo HEAD.

## Independent Verification Closure

O Verifier fresco revisou160a116 sem Handoff e sem reexecutar provas. Os21 checks foram julgados; dois exemplos próprios passaram em PostgreSQL real. O parecer original FAIL identifica sete lacunas nas provas selecionadas, sem defeito de execução observado. O conteúdo original permanece em verification.md; a coluna Closed registra as correções locais.

- V1/C1:7eb451a exige os dois ancestrais de HEAD, com zero caminhos não mesclados.
- V2/C4:ab8c0fa abre/recarrega/fecha perfis isolados com SQLite antigo e atual, incluindo authorId, operationId/recibo e sequence37; os dois mantêm os hashes de banco/preferências.
- V3–V7: `scripts/merge-proofs.mts` seleciona explicitamente25 casos complementares, exige cada nome PASS, contagem exata e zero fail/cancelled/skipped/todo. C7 abrange revogação e expiração idle/absoluta com sockets; C8 inclui modo convidado ativado com Host/listener hostis; C11 inclui rollback da associação; C19 exige migrações, DDL falho, recibos, ordem e pool; C20 exige conflitos e falha no meio da importação. Os casos antigos são reutilizados, sem duplicar ou remover suas asserções. Acrescentados socket ativo na expiração absoluta e recibo exato reenviado após reabrir.

Três sensores adicionais por AssertionError: merge preparado sem ancestralidade real, caso obrigatório renomeado/ausente no agregado e apagamento apenas do recibo SQLite atual. Os controles passam e fontes/emitidos permanecem intactos. Relatório `test-results/verifier-fix-sensors.json`;60 sensores por lote com proveniência histórica, sem reexecução conjunta. Gates após correção:152/152, strict/Vite, matriz18/18 e cinco agregados/25 casos PASS. Logs `test-results/drocsid-verifier-*`. ASAR/EXE mantêm o SHA acima, pois as correções do parecer são de testes/provas.

A rodada final de provas em HEAD e `validate_verification.py` continuam sendo os gates formais; resultados constam dos próprios arquivos, sem inferir aprovação física.

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
| T12 |429a3d2|
| Visible destination fix |Commit `fix(ui): submit the visible server destination` que introduz a seção Follow-up; a linha de histórico desse arquivo identifica-o.|

## Limits

Não há aprovação física de ruído, eco ou loopback. Faltam dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores para A7/T9 de dez minutos, usando este mesmo SHA. Testes em duas janelas num PC, dispositivos sintéticos e `--mute-audio` não substituem o ensaio. Também faltam validação NAT entre redes e qualidade com seis transmissores.

Sem assinatura de código/instalador, push, deploy AWS, alterações de banco de produção ou migração de dados reais. HTTPS/WSS público, TURN temporário autenticado, backup e operação ainda precisam de entrega própria. A câmera permanece negada, mudança de texto/grupo encerra a chamada, mute bloqueia somente reprodução e SFU/LiveKit não foi aprovado.
