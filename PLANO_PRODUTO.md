# Evolução do Conversa para uma primeira versão confiável

Este é um plano proposto, baseado na revisão do código da versão 0.1.1. Atualização de coerência: 2026-10-25, base `7eedac8`, último código/testes `58be3ed`. As metas de produto abaixo continuam futuras; resultados locais existentes estão separados na situação atual.

O trabalho autorizado agora é revisar a documentação e depois continuar a estabilização do protótipo com convidados para pessoas de confiança, em uma sessão nova. Contas, grupos privados e TURN autenticado bloqueiam publicação futura e não fazem parte dessa estabilização. LiveKit/SFU permanece proposta. Todo JavaScript próprio será migrado para TypeScript somente depois da estabilização; o [inventário preparatório](docs/migracao-typescript.md) não inicia essa mudança.

## Objetivo inicial

Uma pessoa instala o aplicativo no Windows, cria sua conta, aceita um convite e conversa com um grupo de até seis pessoas. O grupo troca mensagens, usa voz e compartilha uma janela ou monitor com dispositivos reais e computadores em redes diferentes.

## Situação atual

- Texto e histórico em SQLite, voz e tela em WebRTC foram implementados.
- Os testes atuais de comunicação usam janelas no mesmo computador e microfone sintético.
- O acesso é de convidado. O servidor aceita nomes informados pelo cliente e não implementa contas, associação a grupos ou autorização por sala.
- A mídia usa conexões entre cada par de participantes. Há um limite de seis pessoas, sem avaliação de qualidade com seis usuários reais.
- Uma queda de conexão exige intervenção manual. O código atual confirma mensagens após persistência e deduplica pelo identificador de operação; o cliente mantém texto sem confirmação para reenvio manual na mesma execução. Isso ainda não certifica integralmente os critérios STAB correspondentes.
- O ruído relatado na entrada não foi reproduzido. Foram adicionados bloqueio de reprodução fora das chamadas e silêncio na saída dos testes.
- O bloqueio por Device Guard pertence ao ensaio histórico em `artifacts/VALIDACAO.md`. Depois, o [Verifier BUILD](.specs/features/build-confiavel/validation.md) aprovou localmente source, win-unpacked e abertura/envio pelo wrapper portátil de `58be3ed`: 11 critérios, 50 testes Node e 12 gates. Assinatura, instalador, distribuição pública e outras políticas Windows continuam pendentes.
- Os [68 STAB](.specs/features/estabilizacao/spec.md) têm [retomada própria](.specs/features/estabilizacao/execution.md), sem certificação integral. A [rodada independente 2 de MEDIA](.specs/features/captura-midia-saida/validation-round2.md) passou 80 testes, 16 gates e seis mutações por asserção; falta reverificar a última conjunção automática. O bloqueio histórico de Device Guard não se repetiu na nova build. Nenhum MEDIA Verified; T9/MEDIA-33/34 continuam pendentes por indisponibilidade explícita de recursos em 26/10. A [revisão de coerência](docs/revisao-coerencia-documental.md) conserva a referência documental anterior; o Handoff dá o estado atual.
- Trocar texto encerra a chamada; “Silenciar áudio” afeta somente reprodução. Tela já existe e será estabilizada; câmera permanece negada.

## Etapa 1 — estabelecer uma base verificável

Trabalho:

- Organizar as responsabilidades de interface, conexão, chamadas e reprodução de mídia para que falhas sejam identificáveis.
- Acrescentar diagnóstico de conexão e mídia: estado, erros, dispositivo selecionado e indicadores de perda/latência disponíveis. Excluir senhas, tokens, conteúdo de mensagens e capturas dos registros de diagnóstico.
- Reproduzir ou identificar a origem do ruído com a abertura normal em um computador de uso real.
- Manter verificações de entrada sem áudio e de liberação/bloqueio da reprodução durante chamadas.

Aceitação: abrir e fechar o aplicativo repetidamente sem reprodução não solicitada; registrar passos, versão e resultado para cada falha; ter um procedimento de reprodução para os problemas ainda abertos.

## Etapa 2 — contas, grupos e administrador

Trabalho:

- Criar cadastro, login, logout e revogação de sessões, com armazenamento seguro das senhas e limitação de tentativas.
- Criar o primeiro administrador por procedimento de instalação no servidor, com credencial própria e sem senha padrão.
- Separar os papéis de administrador do serviço, dono do grupo e membro.
- Criar associação entre usuários, grupos e salas. Exigir autorização no servidor para ler histórico, enviar mensagens, entrar em chamadas e emitir credenciais de mídia.
- Implementar convites revogáveis com expiração, além de remoção/bloqueio de membros.
- Acrescentar migrações de banco e testes de acesso indevido.

Aceitação: uma pessoa sem acesso ao grupo não consegue obter seu histórico nem entrar na chamada, inclusive por requisições diretas; alterar o nome ou os campos enviados pelo cliente não concede privilégios; uma sessão revogada perde acesso ao serviço.

## Etapa 3 — voz e tela com infraestrutura de mídia

Proposta técnica ainda não aprovada: avaliar LiveKit/SFU depois de estabilizar a mídia existente e medir seus limites. Uma integração depende de decisão explícita sobre arquitetura, hospedagem e custo; esta etapa não autoriza contratar, publicar nem substituir a malha. Electron/React, Node e WebRTC em malha são a implementação atual.

Trabalho:

- Emitir credenciais de mídia no backend somente após verificar conta e acesso à sala. Manter segredos do servidor fora do aplicativo distribuído.
- Hospedar o serviço com HTTPS/WSS e configurar conectividade de mídia e TURN.
- Definir comportamento de recuperação da chamada após queda de rede e atualização de permissões. Avaliar explicitamente os limites de revogação de tokens da modalidade de hospedagem escolhida.
- Oferecer seleção de microfone e saída, ajuste de volume, indicação de fala e preferências persistentes.
- Verificar início, parada e troca da fonte de tela; testar áudio do sistema separadamente e manter captura explicitamente solicitada pelo usuário.

Aceitação: computadores em redes diferentes recebem áudio nos dois sentidos e tela compartilhada; sair da chamada encerra a captura; perda de rede tem indicação clara e recuperação testada; um membro sem permissão não publica mídia.

## Etapa 4 — mensagens e recuperação de falhas

Trabalho:

- Verificar e completar o contrato já implementado de confirmação após persistência e deduplicação por identificador do cliente, sem recriá-lo em paralelo.
- Reconectar com atraso progressivo e recuperar mensagens posteriores ao último registro recebido.
- Verificar os estados pendente/falho, rascunhos e preferências já implementados; ampliar sua recuperação somente conforme os requisitos futuros aprovados.
- Paginar o histórico e definir limites de armazenamento e de uso por conta.

Aceitação: interromper e restaurar a rede não perde mensagens confirmadas nem duplica mensagens reenviadas; reiniciar o servidor preserva contas, grupos e histórico; a interface mostra corretamente os estados de envio e conexão.

## Etapa 5 — distribuição e operação

Trabalho:

- Produzir um instalador e assinar aplicativo, instalador e atualizações com uma identidade de publicação apropriada.
- Validar instalação, abertura, atualização e remoção em máquinas Windows de teste, incluindo as políticas que bloquearam a versão atual. Assinatura não substitui a aprovação exigida por uma política corporativa.
- Implementar atualização com recuperação de falha e compatibilidade das migrações.
- Preparar backup/restauração do banco, registro de erros, monitoramento e um procedimento de suporte.
- Documentar quais dados são armazenados e a diferença entre proteção do transporte e criptografia de ponta a ponta.

Aceitação: um usuário de teste consegue instalar, entrar no grupo e atualizar sem terminal; um backup é restaurado e conferido; não há regressão conhecida de instalação ou captura nas máquinas usadas para aprovação.

## Prova de uso da primeira versão

Metas propostas para aprovação:

1. Duas pessoas em computadores e redes diferentes realizam uma chamada de 60 minutos com fala real, mensagens e tela.
2. A mesma experiência é repetida com seis pessoas, registrando CPU, memória, upload, perda de áudio e interrupções percebidas.
3. São exercitados entrada e saída durante transmissão, troca de dispositivo, perda/restauração da rede, reinício do servidor e remoção de membro.
4. Há evidência de isolamento entre grupos e de autorização de ações administrativas.
5. A versão instalada é a mesma versão aprovada nos testes, com limites e problemas conhecidos registrados.

A próxima entrega autorizada é a continuidade da estabilização, após a revisão documental, reaproveitando a tela existente e verificando os gaps contra STAB/MEDIA. O fluxo conta → grupo privado → convite → entrada autorizada da etapa 2 pertence ao produto futuro e continua necessário antes de publicação. As metas de 60 minutos e seis pessoas acima não são o ensaio físico MEDIA de dois PCs por 10 minutos; nenhum deles foi aprovado por BUILD.

## Referências técnicas consultadas

- [LiveKit: opções de hospedagem e arquitetura](https://docs.livekit.io/transport/self-hosting/)
- [LiveKit: tokens e permissões](https://docs.livekit.io/frontends/reference/tokens-grants/)
- [Electron: assinatura de código](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- Evidência local BUILD: [validation.md](.specs/features/build-confiavel/validation.md), em `58be3ed`; pendências STAB/MEDIA e próximo passo no [STATE](.specs/STATE.md).
- Registro histórico anterior: [artifacts/VALIDACAO.md](artifacts/VALIDACAO.md). Seus resultados e bloqueios não substituem o relatório BUILD posterior.
