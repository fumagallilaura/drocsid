# Aceitação física MEDIA: não executada

**T9 incompleta; MEDIA-33/34 sem Verified.** Nenhuma etapa física foi executada nesta sessão. A disponibilidade de dois PCs Windows, dois operadores, fones e microfones reais não foi confirmada. Este roteiro preparado não é evidência de ensaio nem aprovação de ruído, eco, fala ou loopback.

Usar a candidata identificada em [evidence.md](evidence.md), depois de conferida pelo [Verifier](validation.md). Se houver nova correção de produto, reconstruir/revalidar a candidata antes do ensaio. O mesmo SHA-256 deve estar nos dois PCs; registrar o hash efetivamente usado, sem herdar resultados de outro build.

| Recurso / identificação | PC A | PC B |
| --- | --- | --- |
| Windows / build / runtime Electron | Não informado | Não informado |
| Operador (rótulo A/B basta) | Não confirmado | Não confirmado |
| Fone e microfone reais, modelos | Não informados | Não informados |
| Executável / SHA-256 conferido | Não executado | Não executado |
| Servidor v2 acessível na LAN confiável / topologia | Não confirmado | Não confirmado |
| Fonte de teste sem conteúdo sensível, relógio em movimento e som identificável | Não preparada fisicamente | Não preparada fisicamente |

Executar sem microfone sintético e sem `--mute-audio`. Registrar horário de cada evento com relógio monotônico/diagnóstico, inventário de todas as tracks e respectivos resultados, além da percepção dos dois operadores. Não é necessário gravar conversas ou tela. O indicador do Windows é complementar e deve ser atribuído ao processo; outros aplicativos podem manter o dispositivo aberto.

| Etapa obrigatória A7 | Resultado exigido / registro | Estado atual |
| --- | --- | --- |
| Abertura/recarga 1, fora de chamada, 30 s | Zero aquisição/reprodução não solicitada; registrar ruído e configuração por PC | NÃO EXECUTADA |
| Abertura/recarga 2, fora de chamada, 30 s | Mesmo inventário e observação de ruído separados do ciclo 1 | NÃO EXECUTADA |
| Abertura/recarga 3, fora de chamada, 30 s | Mesmo inventário e observação separados dos ciclos anteriores | NÃO EXECUTADA |
| Sessão física de 10 min, horários inicial/final | Ambos conectados e dispositivos reais identificados durante o ensaio | NÃO EXECUTADA |
| Voz inicial A→B e B→A | Cinco frases não sensíveis definidas antes; receptor repete 5/5 corretamente em cada sentido; registrar interrupção/ruído | NÃO EXECUTADA |
| Mute e retorno, loopback desligado | Três frases não ouvidas enquanto mic silenciado; três compreendidas após ativar; sem reprodução local da própria fala pelo Conversa | NÃO EXECUTADA |
| Tela com relógio em movimento | Fonte explicitamente selecionada visível no outro PC | NÃO EXECUTADA |
| Parar tela | Todas as tracks de tela/áudio ended em <=1 s; estado remoto sem tela em <=8 s; voz preservada | NÃO EXECUTADA |
| Voz depois de parar tela, A→B e B→A | Repetir as duas medições, 5/5 frases em cada sentido | NÃO EXECUTADA |
| Loopback desligado | Mic silenciado e som contínuo de teste; o outro PC não recebe esse som ao compartilhar sem áudio | NÃO EXECUTADA |
| Novo compartilhamento com áudio consentido | Com mic ainda silenciado, o outro PC recebe o som identificável; registrar que o áudio é global | NÃO EXECUTADA |
| Parar loopback | Tracks de áudio ended e envio cessado em <=1 s; estado remoto atualizado em <=8 s | NÃO EXECUTADA |
| Sair e reentrar manualmente | Tracks locais ended e reprodução bloqueada em <=1 s; presença/vaga remota retirada em <=1 s após saída recebida; nenhuma fala nova da track antiga depois; nova tentativa funciona | NÃO EXECUTADA |

Usar, por exemplo, cinco frases curtas preparadas em cartões distintos para A e B; anotar acertos 0..5 de cada sentido no início e depois da tela. Não antecipar ao receptor qual frase será lida. Buffer já em trânsito não é nova captura. A perda silenciosa tem limite remoto de 60 s do último pong conforme A4, distinto da saída recebida.

Cada etapa deve receber PASS, FAIL ou inconclusiva com observação e medição. Qualquer falha, etapa omitida ou recurso ausente mantém T9 incompleta e impede aprovação física integral. “Ruído não reproduzido” vale somente para a configuração ensaiada; a causa original continua desconhecida sem investigação correspondente. Comparação com Discord só pode ser chamada observada se realmente executada/versionada pelos operadores, sem convites ou mudanças de conta por esta automação.

**Resultado atual: não executado.** Recurso necessário para avançar: dois PCs Windows na mesma LAN confiável com servidor v2 alcançável, dois operadores e fones/microfones reais, usando o mesmo portátil já validado. Nenhum resultado sintético preenche esta tabela.
