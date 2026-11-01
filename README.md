# Drocsid

Aplicativo Windows de texto, voz e compartilhamento de tela para pequenos grupos. Mantém a interface e os controladores do Conversa, com contas, grupos privados e PostgreSQL no servidor. Os históricos dos dois projetos estão unidos na branch `integration/drocsid`; não houve push nem deploy.

O estado dos gates e do parecer independente está em [.specs/features/merge-drocsid/tasks.md](.specs/features/merge-drocsid/tasks.md), com [hash e evidência da candidata](.specs/features/merge-drocsid/evidence.md). As provas BUILD/STAB/MEDIA anteriores pertencem às suas candidatas históricas. Não certificam o novo portátil, hardware, ruído ou eco.

## Executar

Requer Node >=24.15 e `npm.cmd ci`. O build compila as fontes próprias TypeScript em quatro ambientes estritos antes de executar Vite. Os `.js/.mjs/.cjs` de runtime são emitidos e ignorados pelo Git.

No PC do participante:

```powershell
npm.cmd run desktop
```

O cliente padrão abre sem PostgreSQL instalado. Informe o endereço do servidor, crie uma conta ou entre com usuário e senha. Crie um grupo ou aceite um código de convite. Somente membros acessam histórico, presença e chamadas; somente o dono cria salas e convites. Convites duram 24 horas, são revogáveis e de uso único. Senhas têm 15–128 caracteres; usuário usa 2–32 caracteres `a-z0-9_.`. Senha, sessão e convite ficam em memória; ao reabrir o app é preciso entrar novamente.

No computador servidor, configure um PostgreSQL dedicado com usuário, senha e banco explícitos. Defina `DATABASE_URL` no ambiente do servidor por seu gerenciador de segredos; consulte [configuração, TLS e migrações](docs/postgresql.md). Depois:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '4310'
npm.cmd run build
npm.cmd start
```

Para acesso de outros PCs numa LAN confiável, use `HOST=0.0.0.0` no servidor e informe `http://IP-DO-SERVIDOR:4310` nos clientes. O firewall precisa permitir a porta na rede de teste. Use conta e grupo privado; não habilite modo convidado nesse bind. O Electron mantém a interface local e conecta dados/sinalização ao servidor escolhido.

O modo legado é opcional e restrito ao loopback real: `DROCSID_TRUSTED_LOCAL=1` com `HOST=127.0.0.1`. Um host embutido de desenvolvimento exige também `DROCSID_HOST=1` e `DATABASE_URL`. Abertura normal do cliente não inicia banco nem servidor de grupo.

## PostgreSQL e dados legados

PostgreSQL é a única persistência ativa. A URL/senha do banco ficam no servidor, fora do renderer, preferências e portátil. Conexões remotas exigem `sslmode=verify-full`; `PG_CA_FILE` permite uma CA confiável. Não há senha padrão ou fallback SQLite.

O Compose local usa PostgreSQL 17.11 fixado por digest, porta somente `127.0.0.1:5432` e senha por arquivo externo ao Git, indicado em `DROCSID_POSTGRES_PASSWORD_FILE`. Essa configuração foi verificada estaticamente; Docker não está instalado no ambiente de validação. Os testes usam PostgreSQL real nativo. Veja [docs/postgresql.md](docs/postgresql.md).

O perfil padrão permanece `%APPDATA%/conversa`, preservando preferências e os bytes do SQLite legado. Não há importação automática nem inferência de conta pelo nome de convidado. Para importar uma cópia consistente, com o processo legado encerrado, configure o destino PostgreSQL e execute explicitamente:

```powershell
npm.cmd run import:sqlite -- --source 'C:\copia\conversa.sqlite'
```

Teste primeiro num destino dedicado. O importador abre a origem somente em leitura, preserva IDs/autoria/ordem/recibos e recusa conflitos numa transação. Nenhum banco real do usuário foi migrado por esta integração.

## Internet e AWS

O protocolo não é limitado a LAN. O servidor pode ser hospedado na AWS, mas ainda faltam implantação HTTPS/WSS, TURN autenticado com credenciais temporárias, operação de segredos, backup/restauração e validação entre redes. A integração local não publica infraestrutura.

A mídia usa WebRTC em malha, com limite de seis participantes. STUN sozinho não atravessa todas as redes. O servidor aceita `ICE_SERVERS` como JSON; essa configuração só é entregue após autenticação, ou no modo legado explícito de loopback. Um TURN de teste restrito pode ser configurado pelo operador; não embuta credenciais permanentes de produção no cliente. A emissão de credenciais temporárias ainda é futura. SFU/LiveKit não foi aprovado.

Trocar sala de texto ou grupo encerra a chamada. “Silenciar áudio” bloqueia somente reprodução. Tela já está implementada com seleção explícita de janela/monitor, 720p/1080p e áudio do sistema opcional, desligado por padrão. Câmera continua negada. Use fones: áudio global pode incluir a reprodução da própria chamada. Seleção de dispositivos, push-to-talk, reconexão automática e grupos maiores continuam propostas do [plano de produto](PLANO_PRODUTO.md).

## Verificação

`npm.cmd test` exige PostgreSQL real e falha se ele estiver ausente. Configure `DROCSID_PG_BIN` para `bin` de uma instalação completa, ou `DROCSID_TEST_DATABASE_URL` de um cluster local isolado com permissão de criar/remover bancos de teste. Não use produção. O wrapper cria clusters SCRAM/bancos aleatórios, encerra os proprietários e guarda logs em `test-results/postgres/`.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run security
npm.cmd run dist:win
npm.cmd run check:release
```

O último comando reutiliza a candidata construída: compara módulos emitidos/bundle ao ASAR e SHA-256 do EXE; executa testes Node, controles de conta/grupo/convite, perfil, captura, ciclo de vida e startup em source/empacotado, além do wrapper portátil real e auditoria. Os 18 gates sequenciais ficam em `test-results/release/`, a matriz em `test-results/release-matrix.json` e o manifesto em `test-results/build.json`. `artifacts/` contém evidência histórica.

Para executar um checker isoladamente após compilar:

```powershell
node scripts/with-test-postgres.mjs -- node scripts/desktop-smoke.mjs
node scripts/with-test-postgres.mjs -- node scripts/desktop-accounts-check.mjs
node scripts/desktop-client-check.mjs
```

Os testes de mídia usam dispositivos sintéticos e `--mute-audio`; não demonstram audibilidade física. O diagnóstico `startup-audio-check.mjs` observa abertura/reload sem microfone sintético, com 16 amostras de 750 ms e inventário de aquisição/reprodução. As flags `CONVERSA_CHECK_SOURCE`, `CONVERSA_CHECK_MUTED` e `CONVERSA_TEST_EXTERNAL` aceitam somente `0/1`; `CONVERSA_TEST_EXECUTABLE` seleciona o executável empacotado.

**MEDIA/T9 continua pendente:** são necessários dois PCs Windows na mesma LAN confiável, fones/microfones reais e dois operadores para o [roteiro A7 de dez minutos](.specs/features/captura-midia-saida/uat.md), usando o mesmo hash de candidata validada. Ruído, eco, loopback real, qualidade com seis transmissores e NAT entre redes não estão aprovados.

## Histórico e referências

[Estado atual e decisões](.specs/STATE.md), [especificação MERGE](.specs/features/merge-drocsid/spec.md), [integridade da regressão](.specs/features/merge-drocsid/test-integrity.md) e [migração TypeScript](docs/migracao-typescript.md) registram a evolução.

A [investigação Discord](.specs/features/captura-midia-saida/discord-investigation.md) é referência histórica delimitada de artefatos e UI. O cache não foi vinculado ao renderer ativo; o gate de vídeo é hipótese, não diagnóstico observado. Nenhum código proprietário foi incorporado. Os registros grandes continuam em `C:/Code/discord-research/`, fora do Git.
