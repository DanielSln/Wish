# Fase 4 — configuração e validação do backup opcional

## Estado desta entrega

Código preparado, migração SQLite v3 e protocolo remoto testados localmente. **Não há projeto Supabase criado/configurado e o backup remoto não foi validado numa instância real.** Sem variáveis, o Wish abre normalmente como convidado; Configurações informa que falta configuração. Não existe login obrigatório.

PR #4 integrado na main em `025429d4b885641be757915c5aff392f4b5ceb94`. A Fase 4 deve ser revisada em PR separado, sem merge automático. Este documento substitui as escolhas provisórias do plano inicial, especialmente senha: o fluxo implementado usa código OTP por e-mail.

## O que o proprietário precisa fazer

1. Criar um projeto no plano gratuito em https://supabase.com/dashboard. Não habilitar recursos pagos. Conferir cotas, política de pausa/inatividade e limites de e-mail atuais no painel; o plano gratuito não garante disponibilidade contínua.
2. No SQL Editor, executar **uma vez**, integralmente, [a migração](../supabase/migrations/202611150001_wish_backup.sql). Ela usa uma transação; erro reverte toda a instalação. Guardar o arquivo no histórico de migrações. Não executar alterações destrutivas nem repetir CREATE TABLE sobre instalação existente.
3. Em Authentication → Providers, habilitar Email e cadastro por e-mail. Em Email Templates → **Magic Link**, incluir `{{ .Token }}` no corpo para que o usuário receba o código numérico, em vez de depender de um link. O cliente chama `/auth/v1/otp` e `/auth/v1/verify` com `type=email`. Não é necessário configurar deep link para esse fluxo.
4. Verificar no painel os destinatários permitidos e limites do serviço de e-mail padrão. O envio embutido pode ficar restrito a endereços autorizados da equipe. Validar primeiro com o próprio e-mail. Se o provedor exigir SMTP para outros destinatários, usar somente uma opção gratuita explicitamente escolhida pelo proprietário; não há contratação automática ou credencial SMTP no aplicativo. Validar o template recebido no projeto real antes de distribuir.
5. Copiar `.env.example` para `.env.local`. Preencher `EXPO_PUBLIC_SUPABASE_URL` com a origem HTTPS do projeto e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a **publishable key** pública (a anon key legada também é aceita). **Não usar service_role, sb_secret, senha de banco ou chave SMTP.** Não enviar `.env.local` ao Git. As variáveis EXPO_PUBLIC são incorporadas ao bundle e devem ser públicas.
6. Reiniciar o Metro com cache limpo ou gerar novo build/export. Um APK antigo não ganha essas variáveis automaticamente. Consultar [o guia Android](ANDROID-TESTING.md) para execução/build gratuito.
7. Validar o roteiro abaixo em dois dispositivos/perfis e com dois usuários reais. Só depois considerar o backup operacional.

Não é necessário fornecer segredos ao desenvolvedor. Para configurar o cliente, bastam URL pública e publishable key; a senha do banco e service role permanecem com o proprietário.

Referências oficiais: [OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [limites Auth](https://supabase.com/docs/guides/auth/rate-limits), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/).

## Arquitetura implementada

- A interface lê SQLite. A migração v3 acrescenta tabelas auxiliares, sem recriar products/categories/app_settings, alterar IDs ou apagar linhas antigas. Todas as escritas compartilham uma fila por conexão. Mutações de catálogo + incremento de revisão + outbox são transacionais; fila indisponível reverte a mutação.
- Sem sessão, nenhuma operação de backup. Antes da primeira associação há confirmação com contagem de produtos/categorias. O vínculo ao par **projeto + usuário** e os snapshots iniciais são transacionais. O registro de arquivos recupera também interrupção entre vínculo e registro.
- O primeiro catálogo continua em wish.db. Após associá-lo, ele fica reservado à conta; sair preserva o arquivo e abre um catálogo de convidado separado. Voltar à mesma conta reabre seu catálogo, inclusive offline com sessão em cache. Outra conta nunca reutiliza o arquivo associado. Produtos criados no convidado posterior não são mesclados automaticamente numa conta que já possui catálogo local: permanecem preservados nesse convidado. A aparência é persistida por catálogo.
- Sessão nativa em Expo SecureStore, dividida em blocos pequenos com manifesto de commit; nenhum token no SQLite. Refresh único compartilha a promessa entre chamadas e persiste rotação antes de publicar a nova sessão. Falhas de rede preservam acesso local; sessão rejeitada pausa backup e pede novo OTP. Logout remove primeiro a sessão local e interrompe o worker; tenta revogar a sessão remota. Offline, informa explicitamente que a revogação não foi confirmada. Tokens em trânsito não ressuscitam a sessão após logout.
- O cliente usa Auth REST e RPC PostgREST por um adaptador tipado, sem dependência adicional supabase-js. Somente a origem configurada recebe a chave pública e bearer; respostas têm timeout/limite e redirecionamentos são recusados. Autorização é derivada exclusivamente de auth.uid() no servidor.
- Cada operação leva op_id UUID e base_version, congelados no primeiro envio. Recibos armazenam hash do pedido + resposta, logo uma confirmação perdida pode ser repetida sem duplicação. Um op_id reutilizado com outro conteúdo é recusado. Registro desconhecido tem base 0; alterações antigas geram conflito explícito.
- Contador por usuário protegido por row lock serializa escrita/versão/histórico/recibo na mesma transação. Pull lê histórico imutável em páginas de até 100, com limite superior fixo por ciclo. Inbox e cursor SQLite avançam juntos; referências pendentes aguardam categorias. Não se usa relógio do cliente nem sequência global com risco de commit fora de ordem.
- Um worker por catálogo, cancelado ao trocar/sair. Retentativas persistidas com backoff e jitter, respeitando Retry-After. Reage a rede, foreground, mutações e timer de 30s enquanto ativo. Não exige execução contínua em segundo plano. Execuções grandes continuam em ciclos seguintes (até 200 uploads por ciclo).
- Exclusões são tombstones. Categorias com produtos ativos não podem ser apagadas. IDs se mantêm entre dispositivos; categorias de mesmo nome e IDs diferentes exigem unificação explícita ou novo nome. Produtos distintos com mesmo nome não são deduplicados por suposição.
- Conflitos não substituem silenciosamente mudanças locais. O usuário escolhe a versão; cópias anteriores ficam em sync_archive. Configurações permite consultar/copiar as 30 mais recentes, sem apagar as antigas. Não há restauração automática de histórico nem sincronização desse arquivo de preservação.

## RLS e privilégios

As cinco tabelas remotas habilitam RLS e políticas SELECT/INSERT/UPDATE/DELETE com user_id=auth.uid(), incluindo WITH CHECK. A chave pública sem sessão não acessa dados nem RPC. O papel authenticated tem **SELECT apenas** nas tabelas: escritas diretas são revogadas para impedir que um cliente ignore versões, cursores ou idempotência. Escritas passam pelos dois RPC autorizados, SECURITY DEFINER com search_path vazio, auth.uid obrigatório, filtros explícitos de proprietário e FK composta (user_id,category_id). O helper interno não tem EXECUTE público.

A função nunca aceita user_id do cliente como autoridade. Não há chaves secretas, bucket ou upload de imagens. Sincronizam-se URLs e campos do catálogo. Tombstones, recibos e histórico não têm limpeza automática, pois removê-los sem protocolo de ressincronização poderia reintroduzir exclusões ou quebrar dispositivos offline. Monitorar uso/cotas no painel; definir compactação com checkpoint em etapa futura.

## Roteiro de teste real, após configurar

1. Sem login: criar desejo manual/categoria, importar link permitido, filtrar, editar, marcar comprado, alternar aparência; fechar/reabrir. Em modo avião, CRUD, categorias, comprados e aparência devem funcionar. Importação por URL precisa de rede e mantém alternativa manual.
2. Configurações → Ativar backup → e-mail → Enviar código → Confirmar código. Antes de confirmar associação, verificar que o catálogo continua igual e não existe backup declarado concluído.
3. Confirmar associação. Observar Sincronizando, pendências e último sucesso apenas após respostas do servidor. Conferir linhas próprias no painel. Reiniciar o aplicativo e confirmar sessão persistida no Android.
4. No segundo dispositivo/perfil com a mesma conta, confirmar o catálogo inicial e recuperar os produtos. Rever colisões explícitas, sobretudo categorias personalizadas de mesmo nome; não enviar manualmente SQL para sobrescrever dados.
5. Desconectar, editar/criar/excluir; reiniciar offline; reconectar e deixar app ativo. Verificar retomada, contagens, ausência de duplicações e exclusões no outro dispositivo.
6. Editar o mesmo produto offline em dois dispositivos; sincronizar ambos. O segundo deve apresentar conflito. Conferir cópia local/recebida, escolher uma e verificar cópias preservadas e convergência.
7. Sair; confirmar catálogo de convidado separado e dados remotos intactos. Entrar com outro usuário; não pode exibir catálogo anterior. Voltar à primeira conta recupera o arquivo preservado. Testar também sessão expirada/revogada e novo OTP.
8. Com JWT de A, tentar SELECT de dados B e escrita direta: deve retornar zero/negado. Sem sessão, RPC negado. Essa validação do projeto real é necessária mesmo com os testes locais aprovados.

## Testes automatizados e limites

`npm test`, `npm run typecheck`, `npm run lint`, `npx expo-doctor` e `npx expo install --check`. Testes usam node:sqlite para persistência real local, servidor de sincronização simulado e Auth/HTTP/armazenamento seguro simulados.

Teste SQL opcional, sem dependência no app (requer Node 24):

```bash
npm install --prefix /tmp/wish-pg-tests --no-save @electric-sql/pglite
WISH_PGLITE_MODULE=/tmp/wish-pg-tests/node_modules/@electric-sql/pglite/dist/index.js npm test
```

Esse teste executa a migração, RPC, grants e RLS num PostgreSQL WASM local com auth.uid simulado. Sem a variável, o caso SQL é explicitamente skipped. Não testa o gateway Supabase, entrega OTP, políticas reais configuradas no painel ou SecureStore no aparelho.

No navegador, a sessão fica em sessionStorage e dura só a sessão da aba; não oferece a mesma proteção/persistência do SecureStore Android/iOS. Catálogo SQLite web depende de contexto seguro e headers COOP/COEP já configurados. Imagens externas podem não estar em cache offline. APK/teste físico e integração real Supabase não foram realizados nesta fase. Não há promessa de backup Android em segundo plano, entrega ilimitada de e-mail ou disponibilidade permanente do plano gratuito.

As suítes de interface opcionais ficam em `tests/ui/navigation.cjs` (app sem configuração) e `tests/ui/backup.mjs` (apenas backend simulado). Exigem Playwright/Chromium fornecidos pelo ambiente, sem adicioná-los ao aplicativo. Para a segunda, iniciar Metro em porta separada com URL reservada `https://wish-test.example` e chave fictícia `sb_publishable_testfixture` **somente no processo de teste**, executar com Node `--experimental-transform-types` e `WISH_TEST_URL` apontando para esse Metro. O Playwright intercepta integralmente esse host; não há servidor/conta real. Nunca distribuir um build com a configuração fictícia. `WISH_PLAYWRIGHT_MODULE` e `WISH_CHROMIUM_PATH` permitem apontar instalações externas. A primeira suíte aceita `WISH_EXPECT_UNCONFIGURED=1` para verificar a mensagem de configuração pendente.
