# Conversa

Protótipo desktop para Windows inspirado na experiência de conversar em grupo: salas de texto, chamada de voz e compartilhamento de tela. Implementação independente em Electron, React, Node.js, WebSocket, SQLite e WebRTC.

## Abrir no Windows

O executável portátil fica em `release-windows/Conversa-0.1.1-Windows.exe` depois de `npm run dist:win`. Abra o arquivo, escolha seu nome e deixe o servidor vazio para testar localmente. No menu **Conversa → Nova janela de teste**, abra outro participante. As janelas compartilham o servidor local do mesmo processo.

Para executar a partir do código:

```powershell
npm.cmd install
npm.cmd run desktop
```

Requisito de desenvolvimento: Node.js 24.15 ou posterior compatível com `node:sqlite`. O executável inclui seu próprio runtime e não requer Node.js instalado.

## O que funciona

- Salas compartilhadas, criação de salas e lista de participantes online.
- Mensagens reais por WebSocket; os 200 últimos registros da sala são carregados ao entrar.
- Persistência das salas e de todas as mensagens no SQLite.
- Chamadas com até seis participantes, microfone, silêncio do áudio recebido e saída da chamada.
- Compartilhamento de janela ou monitor por seleção explícita no aplicativo Windows.
- Preferência de 720p/1080p, até 30 fps, e áudio do sistema opcional. A resolução efetiva depende da fonte e da negociação WebRTC.
- Parar a transmissão pelo aplicativo ou pelo encerramento da captura.
- Uso de um servidor de grupo externo, informado na tela de entrada.
- Reprodução de áudio bloqueada na entrada, após sair da chamada e ao recarregar a janela. A reprodução é liberada somente dentro de uma chamada e respeita o botão de silenciar áudio.

## Conversar entre computadores

Todos os participantes precisam apontar para **o mesmo servidor**. Cada processo desktop inicia um servidor restrito ao próprio computador; deixar o endereço vazio em máquinas diferentes cria espaços separados.

Para um teste em uma rede local confiável, rode o servidor do projeto no computador que hospedará o grupo:

```powershell
npm.cmd run build
$env:HOST = '0.0.0.0'
$env:PORT = '4310'
npm.cmd start
```

No aplicativo de cada pessoa, informe `http://IP-DO-COMPUTADOR:4310` no campo **Servidor do grupo**. O firewall do computador servidor precisa permitir essa porta para a rede usada. O aplicativo desktop mantém a interface local e conecta apenas os dados e a sinalização a esse endereço.

Para uso pela internet, hospede esse servidor atrás de HTTPS/WSS e configure TURN. O servidor inicia com STUN público do Google; STUN sozinho não estabelece conexão em todas as redes. Configure os servidores ICE no processo que hospeda o grupo:

```powershell
$env:ICE_SERVERS = '[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:SEU-TURN:3478","username":"USUARIO","credential":"SENHA"}]'
npm.cmd start
```

O protótipo distribui essa configuração aos participantes. Em produção, credenciais TURN devem ter curta duração e exigir sessão autenticada.

## Dados e limites

No desktop, o banco fica no diretório `userData` do Electron, normalmente `%APPDATA%/Conversa/conversa.sqlite`. No servidor separado, o padrão é `data/conversa.sqlite` e pode ser alterado com `DB_PATH`.

Esta versão usa convidados, sem autenticação: nomes não comprovam identidade, salas não são privadas e qualquer pessoa com acesso ao servidor pode entrar e ler o histórico das salas. Use em testes com pessoas de confiança. Não é uma versão pronta para hospedagem pública.

A mídia usa uma malha de conexões diretas entre os participantes, ou relay TURN quando configurado. O limite de seis pessoas é imposto pelo servidor, mas não representa uma garantia de qualidade: o consumo de upload cresce com o grupo. Antes de ampliar, substituir a malha por um SFU e acrescentar contas, permissões, convites autenticados, limites de armazenamento e monitoramento.

O áudio do sistema pode incluir todos os aplicativos, inclusive a reprodução da própria chamada. Use fones e mantenha essa opção desligada quando não for necessária. A opção está desligada por padrão.

## Verificação

```powershell
npm.cmd test
npm.cmd run build
node scripts/desktop-smoke.mjs
node scripts/desktop-profile-check.mjs
node scripts/desktop-capture-check.mjs
```

Os testes Node verificam contrato, captura, sessão, mensagens, persistência, capacidade, encerramento, staging e limpeza do harness. O smoke desktop usa microfone sintético, verifica áudio RTP nos dois sentidos, vídeo recebido e parada de captura. A saída física fica desativada com `--mute-audio`; os pacotes continuam sendo verificados. O teste de perfil exercita preferências após mudança de porta, instância única, câmera/subframe negados e cancelamento da seleção. Capturas atuais ficam em `test-results/desktop/`; os registros em `artifacts/` são históricos.

Para testar também um servidor separado e um terceiro participante entrando durante a transmissão:

```powershell
$env:CONVERSA_TEST_EXTERNAL = '1'
node scripts/desktop-smoke.mjs
```

Depois de `npm.cmd run dist:win`, execute `node scripts/check-package.mjs` para conferir imports, bundle, versão e SHA-256 do portátil. O manifesto atual fica em `test-results/build.json`; `artifacts/build.json` é histórico. Para testar o aplicativo empacotado, defina `CONVERSA_TEST_EXECUTABLE` com o campo `executable` desse manifesto e execute os scripts desktop. Isso testa o executável win-unpacked. Para abrir e verificar o wrapper portátil real, execute `node scripts/portable-startup-check.mjs`; ele usa perfil temporário, verifica entrada/envio e fecha o aplicativo. Os testes locais não verificam NAT entre redes distintas, desempenho com seis transmissores nem áudio real do sistema.

Para verificar a abertura normal, sem microfone sintético nem flags para silenciar o processo inteiro:

```powershell
$env:CONVERSA_CHECK_MUTED = '1'
$env:CONVERSA_CHECK_SOURCE = '1'
node scripts/startup-audio-check.mjs
```

O diagnóstico observa todas as janelas e verifica que não há reprodução audível nem elementos de áudio/vídeo na entrada. O resultado atual fica em `test-results/startup-audio.json`. O modo source não lê manifesto. Para diagnosticar o executável empacotado, use `CONVERSA_CHECK_SOURCE=0` e o manifesto atual ou `CONVERSA_TEST_EXECUTABLE`. As flags booleanas aceitam somente `0` e `1`. Esses ensaios não demonstram a causa do ruído físico relatado.

## O que falta para um produto completo

Para o objetivo de conversar e compartilhar tela com amigos, as próximas etapas são:

1. **Uso pela internet sem configuração manual:** hospedar servidor HTTPS/WSS e TURN, abrir convites diretamente no aplicativo e validar chamadas entre computadores em redes diferentes.
2. **Identidade e privacidade:** contas, login, salas privadas, convites com expiração, papéis e permissões; hoje o acesso é de convidado.
3. **Áudio no uso diário:** escolher microfone e fone/alto-falante, controlar volumes, push-to-talk e testar eco, Bluetooth e áudio real do sistema. Hoje são usados os dispositivos padrão.
4. **Resiliência:** reconexão automática do servidor, recuperação da mídia após mudanças de rede e confirmação/reenvio de mensagens. Hoje, após desconexão, é preciso reconectar manualmente.
5. **Distribuição e operação:** instalador, assinatura do executável, atualização automática, recuperação de falhas e backups do servidor.
6. **Qualidade e capacidade:** testes prolongados com hardware real, redes lentas e seis participantes. Para grupos maiores, acrescentar um SFU em lugar da malha atual.

Anexos, busca, edição de mensagens, reações, notificações e mensagens privadas são expansões adicionais; não são necessários para validar primeiro o fluxo de grupo, voz e tela.

## Relação com a investigação do Discord

Foi inspecionado com REA apenas o `package.json` do `app.asar` da instalação local `app-1.0.9265`. O manifesto declarou `bundle.js` como entrada Electron. Essa inspeção não estabeleceu a implementação interna das chamadas, codecs, infraestrutura ou compartilhamento do Discord. Nenhum código proprietário foi copiado para este projeto.

Evidência original: `../discord-research/discord-package-evidence.json`, ID `ev_9300ac6c7d10ca4a8f8a67a55a85ae0c5da52cc25ea05a77addabf037502c158`. Artefato SHA-256: `0025c02c7241045a12464309604ec4d5b8ec7ed2ce43cce05d5dacb8f253f672`. A estrutura, transporte, limites e interface do Conversa são decisões próprias de implementação.

Referências: [Electron: captura de mídia](https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts), [Electron: segurança](https://www.electronjs.org/docs/latest/tutorial/security), [WebRTC: conexões](https://webrtc.org/getting-started/peer-connections), [WebRTC: TURN](https://webrtc.org/getting-started/turn-server).
