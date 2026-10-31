# PostgreSQL

A decisão AD-003 substitui SQLite como destino da integração Drocsid. O servidor acessará PostgreSQL; o cliente Electron usará a API e não receberá a URL ou senha do banco.

## Integration status

T3 entrega a camada de persistência tipada e seus testes reais; T4 entrega o importador somente leitura. A aplicação ainda usa o serviço SQLite anterior até T8 trocar esse proprietário. Não foi feita migração de dados do usuário nem deploy AWS.

## Server configuration

`DATABASE_URL` deve conter usuário, senha e banco explícitos. Não há senha padrão. Defina-a somente no ambiente do servidor, usando o gerenciador de segredos da implantação; não a coloque em preferências, bundle do renderer ou Git.

Conexões remotas exigem TLS com validação do certificado e hostname. `PG_CA_FILE` permite informar um arquivo PEM de CA confiável no servidor. O único parâmetro de URL aceito é `sslmode=verify-full`; outras opções de TLS ou overrides de host/usuário são recusadas. Loopback pode funcionar sem TLS para desenvolvimento local. Não se utiliza `rejectUnauthorized:false`.

O pool tem oito conexões, aquisição/statement de3s, lock de1s e inatividade em transação de3s. Cada pool recebe uma etiqueta aleatória própria. No shutdown, uma conexão de controle temporária encerra sessões dessa etiqueta com confirmação; sessões de outro pool permanecem intactas. O usuário do banco precisa poder encerrar suas próprias sessões, sem papel superuser de produção. As migrações precisam de permissão de DDL no schema `drocsid`; permissões separadas de migração/runtime na implantação AWS serão definidas antes do deploy.

As migrações são transacionais, versionadas e verificadas por checksum sob advisory lock. Schema futuro ou alteração de migração aplicada bloqueiam a inicialização. O schema `public` do upstream não é convertido nem removido automaticamente.

## Local verification

Execute `npm test`. O wrapper `scripts/with-test-postgres.mts` inicia um cluster PostgreSQL real isolado em loopback e porta livre, com senha aleatória e SCRAM. Os testes criam bancos próprios; o wrapper encerra o cluster mesmo quando o processo de teste falha. Os logs ficam em `test-results/postgres/`; os dados temporários são removidos depois da confirmação de shutdown.

Configure `DROCSID_PG_BIN` para a pasta que contém `initdb`, `pg_ctl` e os arquivos de uma instalação PostgreSQL completa. Nesta máquina há um cache local em `%TEMP%/conversa-postgresql-17.11-5/pgsql/bin`, detectado pelo wrapper. Uma alternativa é fornecer `DROCSID_TEST_DATABASE_URL` de um cluster **local isolado**, com permissão para criar/remover bancos `drocsid_test_*`. Não use um banco de produção. O helper só remove bancos aleatórios que ele próprio criou.

Sem PostgreSQL disponível, o teste falha com instrução de configuração. Não há banco emulado, skip nem fallback SQLite para aprovar o componente. A regressão anterior do serviço permanece separada até sua conversão em T8.

O cache foi obtido do [distribuidor EDB indicado pelo PostgreSQL](https://www.postgresql.org/download/windows/), versão17.11-5 Windows x64. SHA256 do ZIP: `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`. É ferramenta local de teste; não integra o portátil e não aprova infraestrutura AWS.

## Legacy migration

O importador é explícito e transacional. Configure `DATABASE_URL` no ambiente do servidor e execute:

```powershell
npm run import:sqlite -- --source "C:\caminho\conversa.sqlite"
```

Use uma cópia consistente com o serviço legado encerrado. Experimente primeiro em um destino de teste dedicado. Nenhum banco é descoberto ou importado automaticamente; este trabalho só ensaiou fixtures temporárias, sem autorização de migração de produção.

SQLite é aberto somente em leitura. O importador aceita os formatos0/1 conhecidos e recusa versão futura, dados inválidos, autores inválidos, inteiros fora do limite seguro e tabelas desconhecidas. IDs, ordem, datas, nomes e recibos são comparados no destino; nomes de convidados não criam contas. O original e preferências não são alterados.

A transação bloqueia escritores do destino durante a comparação/importação. Repetição idêntica não duplica; o fingerprint anterior não dispensa conferir conflitos atuais. IDs, posições, sequências ou recibos com dados diferentes provocam recusa sem sobrescrever o destino. Uma falha de banco depois da inserção das salas reverte toda a importação. Contadores PostgreSQL só avançam e podem ter lacunas, como em transações normais; as sequências importadas são preservadas.

O comando devolve contagens de salas/mensagens da origem e `reused` indicando snapshot já importado. Falha gera código de erro e exit1, sem URL, senha, SQL ou conteúdo de mensagem. O arquivo original é mantido para reversão explícita; não há dual-write.

## References

[Transações pg](https://node-postgres.com/features/transactions), [TLS pg](https://node-postgres.com/features/ssl), [encerramento de sessões PostgreSQL](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL).
