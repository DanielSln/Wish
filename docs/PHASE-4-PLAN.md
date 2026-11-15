# Fase 4 — plano técnico de backup e sincronização

Status: proposta para revisão; nenhuma integração Supabase, dependência, credencial ou migração desta fase foi implementada. Base examinada: Fase 2 em 2b7f495 e Fase 3 em c21b035/1dd5961, com correções de revisão posteriores.

## Objetivo e pré-requisitos

SQLite continua sendo a fonte imediata de leitura e escrita do aplicativo. Sem conexão, conta ou sessão válida, as funcionalidades locais não podem depender do Supabase. Backup remoto é opcional e explícito; não inclui pagamentos, assinatura, comparação de preços nem armazenamento de arquivos de imagem. Sincronizar URLs das imagens, não copiar imagens de terceiros.

Antes de implementar: revisar o PR #1, depois o PR #2; testar Android físico, persistência após encerrar o processo e modo avião; resolver ou aceitar explicitamente as limitações registradas em PHASE-2-3-REVIEW.md. Confirmar condições e cotas atuais do plano gratuito Supabase e a disponibilidade de envio de e-mail. Não contratar serviços pagos automaticamente.

## Esquema existente e migração local

O banco wish.db usa PRAGMA user_version=1. categories e products têm UUID textual, created_at/updated_at UTC e deleted_at. products referencia category_id; preços são inteiros em centavos ou NULL. As três categorias iniciais têm UUIDs fixos compartilhados por todas as instalações. A exclusão de produto já deixa tombstone. Ainda não existem proprietário, fila, versão remota, cursor ou resolução de conflitos; updated_at local sozinho não prova que um registro foi sincronizado.

Planejar migração incremental v1→v2, transacional, preservando todas as linhas e IDs, inclusive tombstones. Não editar retrospectivamente o SQL v1. A nova versão do esquema só será gravada após sucesso. Banco de versão futura continua recusado sem exclusão.

Tabelas auxiliares propostas (sem SQL executável nesta entrega):

| Tabela | Finalidade / campos essenciais |
| --- | --- |
| sync_state | account_id vinculado ao banco, device_id aleatório, cursor remoto confirmado, estado da recuperação inicial, último sucesso/erro sem dados pessoais |
| sync_entities | entity_type + entity_id, server_version conhecida, local_revision monotônica, versão/payload remoto de base para conflito |
| sync_outbox | op_id UUID único, entidade/ID, local_revision, base_server_version, operação, snapshot do payload, tentativas, próximo retry, estado |
| sync_conflicts | entidade, operação local, snapshot remoto e versões para revisão explícita |
| sync_import_checkpoint | progresso da vinculação inicial/recuperação para retomada idempotente |

Todas as mutações do repositório (save, setStatus, remove e addCategory) deverão gravar a alteração, incrementar local_revision e enfileirar o snapshot na MESMA transação SQLite. Falha ao enfileirar deve reverter a mutação. Aplicar mudanças recebidas do servidor por caminho separado, sem gerar outbox novamente. Usar escritor local serializado; avaliar withExclusiveTransactionAsync nas plataformas suportadas e a alternativa serializada no web, conforme documentação do SDK 58. A transação genérica atual não deve receber consultas concorrentes fora do worker de escrita.

## Conta, autenticação e sessão

Proposta inicial: e-mail e senha, confirmação de e-mail e recuperação de senha; sem login social. Usar Supabase Auth com persistSession, renovação de tokens e lock de concorrência suportado pelo SDK. Retomar renovação ao voltar para foreground; pausar ao sair para background. Validar qualquer deep link de confirmação/recuperação por esquema/rota esperados; não registrar fragmentos de token. Configurar allowlist de redirecionamento no painel.

Criar adaptador de armazenamento de sessão testado no Android/iOS: token persistido cifrado, com chave protegida pelo sistema via Expo SecureStore. Não pressupor que uma sessão arbitrariamente grande caiba em uma única entrada SecureStore. Escolher adapter cifrado ou estratégia de divisão com limites testados antes da implementação; não persistir refresh token em texto puro no SQLite do catálogo. Na web, usar armazenamento por origem com avaliação explícita de XSS e diferença de proteção em relação ao sistema nativo. Nunca colocar tokens em URLs do aplicativo além dos callbacks esperados, logs ou Git.

Token expirado/offline pausa somente a sincronização. Mudanças locais continuam entrando na fila. Erro 401 tenta renovação uma vez; se falhar, pede nova autenticação, preservando fila e banco. Não apagar produtos ao expirar sessão ou trocar senha.

O banco legado começa desvinculado. Oferecer “Ativar backup” e pedir consentimento antes de enviar dados locais. Ao autenticar, vincular o banco a um único account_id; nunca reaproveitar a fila para outra conta. Para alternar contas, usar bancos separados e caminho de logout que preserve ou remova a cópia local apenas por escolha explícita. Acesso offline à cópia vinculada após logout deve ser uma escolha informada; a sessão expirada por falta de rede não equivale a logout. Nenhuma mescla silenciosa entre catálogos de contas diferentes.

As restrições do provedor padrão de e-mail (destinatários, limites, confirmação e recuperação) precisam ser verificadas. Não prometer entrega ilimitada gratuita; configurar e testar a conta pessoal permitida e, se necessário, um SMTP compatível com os limites gratuitos, somente após escolha do proprietário.

## Modelo remoto e isolamento

Postgres terá categories e products com os campos atuais, mais user_id UUID obrigatório, server_version BIGINT e carimbo de atualização definido no servidor. Preservar created_at original como metadado; não usar o relógio do celular para decidir vencedor. Validar nome, enumerações, tamanho de textos/URLs e preços inteiros não negativos também no servidor.

Chave primária composta (user_id, id) em AMBAS as tabelas. Isso é necessário porque os IDs das categorias padrão são iguais em todas as instalações. FK composta products(user_id, category_id) → categories(user_id, id) impede referência à categoria de outra conta. Índices para user_id, versões e tombstones. Usar BIGINT para centavos e versões, com conversão segura no cliente dentro de Number.MAX_SAFE_INTEGER; rejeitar valores fora do limite.

Categorias personalizadas vindas de dispositivos diferentes podem ter o mesmo nome e UUIDs distintos. Não deduplicar produtos por nome/link: desejos intencionais podem se repetir. Para categorias, normalizar nomes de maneira definida (trim, Unicode NFC e case folding compatível) e resolver colisão explicitamente, escolhendo categoria canônica e remapeando referências/outbox em transação; nunca simplesmente remover a categoria referenciada. A regra UNIQUE/NOCASE atual do SQLite precisa ser compatibilizada na migração antes de aplicar restauração multi-dispositivo.

Habilitar RLS em tabelas de catálogo e em QUALQUER tabela auxiliar exposta. Políticas SELECT/UPDATE/DELETE com auth.uid() = user_id e INSERT/UPDATE com WITH CHECK equivalente. Sem políticas permissivas para anon. O aplicativo não pode alterar user_id de um registro. Testar isolamento com duas contas e token ausente/expirado, inclusive tentativa de FK cruzada.

Mutações remotas por RPC transacional devem derivar user_id de auth.uid(), verificar versão e registrar operação aplicada. Preferir SECURITY INVOKER com RLS; se privilégios exigirem SECURITY DEFINER, fixar search_path, qualificar tabelas, validar identidade, revogar EXECUTE de PUBLIC/anon e conceder somente a authenticated. Bloquear DML direto que permitiria ignorar o protocolo de versões; testar explicitamente esses grants com JWTs comuns. Nenhum acesso privilegiado no aplicativo.

## Protocolo de envio, fila e conflitos

Um worker por conta, sem execuções sobrepostas. Enviar categorias antes de produtos e respeitar dependências. Cada requisição leva op_id, base_server_version e payload do snapshot enfileirado. Registro remoto inexistente aceita criação; existente exige versão esperada. Tombstone é uma alteração versionada, não DELETE físico.

O servidor registra op_id e resultado na mesma transação da mutação. Repetir operação após perda de conexão retorna o mesmo resultado, sem duplicar ou incrementar a versão novamente. Garantia de idempotência deve durar enquanto uma operação puder reaparecer; não apagar recibos arbitrariamente. O cliente não usa upsert incondicional para sobrescrever uma versão desconhecida.

Ao receber confirmação, atualizar apenas o op_id confirmado e a base da entidade em transação. Se a entidade foi editada durante a requisição, não substituir o estado local mais recente nem remover as operações posteriores. Rebasear a próxima operação local na versão confirmada, mantendo a ordem por entidade. Não condensar operações em voo; eventual compactação só pode atingir snapshots ainda não enviados.

Conflito de versão gera registro em sync_conflicts e conserva os dois snapshots. Política inicial: excluir vence uma atualização obsoleta, mas manter a cópia local recuperável para restauração explícita como nova operação/novo ID. Em edição×edição, oferecer manter local, usar remoto ou editar uma combinação; nada de “última data do celular vence”. Outras entidades podem continuar sincronizando, exceto produtos que dependem de categoria em conflito.

Retries com backoff exponencial e jitter para rede, 429 (respeitar Retry-After) e 5xx. Erros de validação/permissão não entram em loop; mostrar ação necessária. Retomar no foreground, após reconexão e após alterações locais com debounce, além de botão “Sincronizar agora”. Não depender de background contínuo, que Android/iOS não garantem. Realtime pode ser um sinal futuro, nunca a única forma de receber alterações.

## Recebimento, cursores e recuperação

Não usar apenas updated_at > último_sync ou um BIGSERIAL global como cursor: transações podem confirmar fora de ordem e fazer alterações serem ignoradas. Proposta: contador e log de alterações por conta, atualizados dentro de transações serializadas pelo MESMO bloqueio de linha da conta. Cada evento guarda o snapshot imutável após a alteração, versão e tombstone; não reconstruir uma página antiga lendo apenas a linha atual mutável. RPCs de leitura obtêm limite confirmado sob essa disciplina e devolvem páginas ordenadas até esse limite fixo. Nenhuma escrita direta pode contornar essa regra. A validação futura precisa provar que commits concorrentes, rollback e paginação não perdem eventos.

Aplicar cada página e avançar cursor em uma transação SQLite. Se houver alteração local pendente, atualizar a base ou abrir conflito sem apagar o trabalho local. Retentar página após crash é idempotente. Preservar IDs e importar categorias antes dos produtos; se necessário, estágio local antes da aplicação de referências.

Na primeira vinculação, baixar o estado remoto e reconciliar por UUID antes do primeiro envio. IDs padrão convergem por conta; UUIDs iguais com conteúdo inesperadamente divergente exigem conflito, não sobrescrita. Enfileirar os registros locais nunca sincronizados, inclusive exclusões quando necessárias para impedir ressurreição. Persistir checkpoints para retomar sem duplicação.

Em instalação nova, restaurar catálogo após autenticação. Falha parcial deve deixar cursor/checkpoint consistente e permitir retomada; sucesso só é exibido após commit local. Na restauração sobre catálogo existente, fazer snapshot local e revisão, sem substituição destrutiva automática.

Conservar tombstones e log até haver política testada para dispositivos antigos. Se houver retenção limitada, usar epoch do servidor e obrigar ressincronização completa de clientes com cursor vencido, protegendo suas edições locais; nunca aceitar que uma cópia antiga recrie silenciosamente um produto excluído.

## Backup, gratuidade e credenciais

Exibir estado real: desativado, aguardando rede, N alterações pendentes, sincronizando, conflito/erro e último sucesso. “Backup concluído” exige fila confirmada e recebimento concluído, não somente login bem-sucedido. A sincronização replica exclusões e erros humanos: não substitui histórico restaurável independente. Não prometer PITR/backups gerenciados gratuitos; confirmar condições do plano e projetar exportação local opcional com escolha de destino, sem enviar catálogo a terceiros.

Monitorar cotas de banco, tráfego, autenticação e eventual pausa do projeto gratuito. Erro de quota/projeto pausado preserva operações locais e informa o usuário. Usar lotes pequenos, paginação e envio somente de alterações; não adicionar assinaturas, Edge Functions pagas ou SMTP pago como requisito implícito.

EXPO_PUBLIC_SUPABASE_URL e publishable key (ou anon key legada) são configuração pública do cliente, protegida por RLS e grants, não segredos ocultáveis no bundle. Disponibilizar apenas placeholders em .env.example quando a implementação for autorizada. service_role/secret key, senha Postgres, SMTP e refresh tokens jamais entram no bundle/Git/PR. Scripts administrativos futuros usam segredos do ambiente apropriado; nenhum é necessário neste plano. Logs mostram códigos e contagens, sem e-mail, links privados, anotações ou tokens.

## Sequência futura e critérios de aceite

1. Migração local/fila e testes de preservação v1→v2, rollback, crash e atomicidade, ainda sem rede.
2. Esquema remoto, constraints, RLS/grants e testes com contas A/B e acesso anônimo.
3. Autenticação/sessão, confirmação/recuperação por e-mail, refresh, logout e isolamento por conta.
4. Push idempotente e pull paginado, confirmação perdida, edições em voo, categorias/IDs fixos e duplicação de requests.
5. Conflitos, exclusão×edição, restauração e checkpoints sob interrupções.
6. Indicadores de backup, limites gratuitos e teste Android real em modo avião/retomada.

Testes obrigatórios: duas instalações simuladas, relógios divergentes, confirmação remota perdida, envio repetido, rede oscilando, sessão expirada, 429/5xx, permissão negada, quota excedida, crash em cada ponto de commit, paginação concorrente e troca de conta. Repetir TypeScript, lint, testes, Expo Doctor e exportações web/Android. Validar acessibilidade e nenhuma dependência da rede para CRUD local. Implementar uma etapa por PR, somente após autorização para a Fase 4.

## Referências consultadas

- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/auth/auth-smtp
