# Prontidão arquitetural para a Fase 4

15/11/2026. Revisão após integração autorizada do PR #3 em main: d615495c1b4c403432a58f984f68045477123f7c. Nenhuma integração Supabase foi implementada nesta entrega.

## Conclusão

A base atual é adequada para iniciar a Fase 4 em etapas, após autorização e validação Android. Não está pronta para apenas adicionar uma chave Supabase e fazer upserts diretos: faltam propriedade por usuário, fila transacional, versões remotas, idempotência, conflitos e RLS. O plano detalhado continua em PHASE-4-PLAN.md e parte do esquema v2 para uma futura migração v2→v3.

## O que já favorece a evolução

- Catálogo local em wish.db; UI consulta o repositório, não um serviço remoto.
- UUIDs, timestamps UTC, centavos inteiros/NULL e tombstones em produtos/categorias.
- Migrações incrementais com transação, proteção de versão futura e testes de rollback/preservação.
- Categorias mantêm referências e não podem ser removidas com produtos ativos, inclusive comprados. Comprados é um filtro do mesmo catálogo.
- app_settings persiste aparência de forma independente do catálogo; preferência automática acompanha o sistema. Não enviar essas preferências para a nuvem por padrão sem definir esse comportamento.
- Testes de CRUD, persistência, categorias, status, importação e navegação disponíveis. Não há dependência de autenticação para os fluxos locais.

## Trabalho necessário antes de sincronizar dados reais

1. Definir vínculo e isolamento por conta: consentimento para enviar catálogo local, política de logout/troca de conta e nenhuma mistura silenciosa entre usuários.
2. Projetar migração v2→v3: fila/outbox, revisões locais, base remota, cursores e conflitos, preservando todo o catálogo e app_settings. Gravar alteração e fila na mesma transação; as mutações atuais ainda não fazem isso porque não há sincronização.
3. Autenticação por e-mail, confirmação/recuperação, sessão persistida com proteção apropriada e renovação/lock de concorrência. Expiração/offline deve pausar só a rede e preservar CRUD/fila.
4. Esquema Postgres com user_id, versões e FKs compostas. As categorias padrão usam UUIDs fixos entre instalações: a identidade remota precisa incluir o usuário para evitar colisões e referências cruzadas.
5. RLS/grants e RPCs transacionais com testes de contas A/B e acesso anônimo. publishable key é pública; service_role, senha de banco e tokens de sessão nunca entram no bundle/Git.
6. Push idempotente por op_id, detecção de versão, confirmação sem apagar edições em voo e tratamento explícito de conflitos/exclusões.
7. Pull/recuperação paginados com cursor que não perca commits concorrentes, aplicação e checkpoint atômicos, retomada após crash e proteção contra ressurreição por clientes antigos.
8. Estado honesto de backup, limites gratuitos/SMTP, repetição de requisições, 429/5xx, falta de rede/quota e projeto pausado. Replicação não é histórico de backup independente.

## Critérios pendentes

- Teste Android físico: instalação, encerramento real, reabertura offline, migração de versão no mesmo package/assinatura, temas e importação.
- Solução/aceitação dos alertas de dependências já registrados; não introduzir correções incompatíveis para ocultar avisos.
- Validar transportes/armazenamento seguro e bibliotecas compatíveis com Expo SDK 58 antes de adicioná-las. Nenhuma dependência Supabase foi instalada nesta tarefa.
- Manter importação de loja no cliente enquanto não houver desenho próprio de proteção de rede para backend; hosts confiados no cliente não equivalem a isolamento SSRF de um serviço servidor.

Próxima implementação recomendada, quando autorizada: migração local/fila e testes de atomicidade primeiro; depois esquema/RLS, autenticação, sincronização, conflitos e recuperação. Não implementar todas as partes em um único PR.
