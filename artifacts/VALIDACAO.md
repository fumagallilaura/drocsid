# Verificação do protótipo — 24/10/2026

## Atualização 0.1.1 — reprodução de áudio

- A abertura normal da versão anterior foi observada sem reprodução audível e sem elementos de áudio ou vídeo na entrada. O ruído relatado pelo usuário não foi reproduzido nesse fluxo; sua causa não foi comprovada.
- Os testes anteriores usavam microfone sintético e podiam reproduzir seu sinal nos alto-falantes. Os testes agora usam `--mute-audio`, sem impedir a verificação dos pacotes RTP.
- O aplicativo agora inicia com a reprodução bloqueada no processo principal do Electron. A reprodução é liberada apenas dentro de uma chamada e bloqueada ao sair, silenciar a saída ou recarregar.
- Na versão 0.1.1 executada pelo código: abertura silenciosa verificada em oito observações, nenhum elemento de áudio/vídeo na entrada e controle de bloqueio/liberação aprovado durante o teste de chamada.
- Testes pelo código com servidor separado, três participantes, áudio RTP nos dois sentidos e compartilhamento de tela: aprovados.
- A execução do novo binário empacotado foi recusada pelo Windows com a mensagem de política Device Guard. A validação da 0.1.1 acima foi feita pelo código, sem desativar a política do sistema. Os resultados abaixo do aplicativo empacotado são da versão 0.1.0.

## Resultados anteriores — 0.1.0

- Build de produção Vite: aprovado.
- Testes do servidor: 3 aprovados, 0 falhas.
- Aplicativo Electron empacotado: aprovado no teste automatizado.
- Duas pessoas: mensagens recebidas, chamada conectada e áudio RTP recebido nos dois sentidos.
- Captura: seleção de uma janela do próprio aplicativo, vídeo recebido pelo outro participante, encerramento da transmissão e controles de chamada visíveis durante a transmissão.
- Servidor separado: clientes desktop conectados a um servidor em outra porta, incluindo os fluxos CORS e WebSocket.
- Três pessoas: terceiro participante entrou durante uma transmissão em andamento e recebeu o vídeo.
- Criação de sala: sala publicada, troca de sala e encerramento da chamada anterior.
- Persistência: salas e mensagens sobreviveram ao reinício do servidor no teste de integração.
- Limite: sétimo participante recusado na chamada; vaga liberada após uma saída.

## Evidências visuais

- `01-entrada.png`: entrada do aplicativo.
- `02-chamada-grupo.png`: chamada de grupo e mensagens.
- `03-tela-compartilhada.png`: janela compartilhada recebida pelo outro participante.

## Limites da verificação

Os testes foram executados neste Windows, com participantes em processos/janelas locais e microfone sintético. Não medem qualidade subjetiva de áudio, captura do som real do sistema, desempenho de uma chamada com seis transmissores ou conexões entre redes externas com NAT/TURN. O protótipo não possui autenticação de contas nem salas privadas.

O código de investigação do Discord ficou separado da implementação. A inspeção REA limitou-se ao manifesto do pacote local; não foi recuperada nem reproduzida a infraestrutura proprietária do serviço.
