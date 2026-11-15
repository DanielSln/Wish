# Revisão de publicação das Fases 2 e 3

Data: 15/11/2026. Revisão de código e testes; não constitui aprovação/merge automático.

## Estado recuperado e organização

- main: 56c49d8; feature/product-management: 2b7f495; PR #1 aberto para main.
- Checkout /workspace/Wish íntegro e sem alterações não commitadas ao iniciar. Recuperados os objetos originais c21b035 e 1dd5961, além de uma cópia Git bundle disponível no workspace. Não houve reimplementação do projeto.
- feature/link-import é descendente de feature/product-management. O push dos dois commits originais funcionou; a permissão de publicação foi comprovada por uma operação real.
- PR #2: https://github.com/DanielSln/Wish/pull/2, base feature/product-management. Assim, não duplica a Fase 2 no diff.
- Revisar/integrar manualmente #1 primeiro, então conferir a base e o diff de #2 antes de retarget para main. Caso #1 seja integrado por squash, os hashes podem divergir e exigir resolução explícita; não presumir que um simples retarget ficará limpo. Não excluir a branch-base antes de verificar o efeito em #2. Não houve merge, rebase destrutivo ou force push.

## Fase 2 — resultado da revisão

| Requisito | Evidência examinada |
| --- | --- |
| Cadastro manual e validação | ProductForm, validateProduct, parsePrice; erros preservam campos; preço em centavos ou NULL |
| SQLite e integridade | migração v1 com transação, foreign_keys, índices, proteção contra downgrade; consultas parametrizadas |
| Categorias | três padrões, criação personalizada e rejeição de nome vazio/repetido; FK de produto |
| Prioridades | baixa/média/alta no formulário, detalhes e ordenação |
| Pesquisa/filtros | nome com escaping de LIKE, categoria/status combinados e ordenação por preço/prioridade/data |
| Detalhes/edição/exclusão | rotas existentes, anotações, abrir loja, comprado/pendente, confirmação de exclusão e tombstone |
| Persistência/offline | teste com arquivo SQLite reaberto, sem serviço remoto no repositório; imagens e links continuam dependentes de rede |

Os três testes existentes passaram novamente dentro da suíte completa: CRUD, categorias, filtros, ordenação, status, tombstone, reabertura, rollback e bloqueio de banco futuro. Também foi extraído um snapshot exato de origin/feature/product-management para um diretório de revisão isolado: os três testes, TypeScript e lint passaram nessa base, usando as dependências instaladas do mesmo lockfile. Código SQLite/domínio/testes da Fase 2 permanece igual ao PR #1; a mudança no formulário acrescenta preenchimento inicial opcional e mantém o caminho manual/edição.

Não foi encontrada regressão bloqueante nos fluxos locais examinados. Limites antes da integração: teste Android/iOS físico e modo avião pendentes; SQLite web experimental; LIKE/NOCASE padrão do SQLite não faz normalização Unicode completa (busca com acentos/capitalização pode diferir). A checagem de prioridade usa operador in, que também aceita nomes herdados de Object.prototype em chamadas programáticas; o CHECK SQLite rejeita valores inválidos, e a UI atual só fornece as três opções. Endurecer validação/whitelist antes de aceitar dados remotos na Fase 4. Não há autenticação, fila, cursor, propriedade de dados ou conflitos implementados.

## Fase 3 — resultado da revisão

- JSON-LD Product/Offer, graphs/mainEntity e fallback Open Graph; metadados malformados são opcionais, sem execução de scripts.
- Prévia em estado local; revisão pelo formulário e gravação somente em Salvar desejo, usando o mesmo repositório SQLite.
- Links inválidos/inseguros, timeout/cancelamento, erro HTTP, rede/CORS, conteúdo incompatível e ausência de dados têm mensagem e opção manual.
- Oferta múltipla, preço ausente/inválido/estrangeiro ou agregado não fornece preço confirmado. Não há histórico/consulta periódica de preço.
- Revisão encontrou e corrigiu URLs locais com ponto DNS final e AggregateOffer com @type em array/URI. Casos reproduzidos antes da correção e acrescentados aos testes existentes.
- As alterações não modificam banco, dados persistidos, dependências ou CRUD offline. Consultar loja exige internet.
- Proteção HTTPS não garante isolamento de DNS/redirects nativos. Sem Content-Length confiável, limite de corpo é checado após leitura. Não há garantia de suporte a lojas específicas; interface foi validada anteriormente com fixtures, não preços reais.

## Verificações desta publicação

- npm test: 8/8 passaram antes e depois das correções, incluindo os casos de regressão novos dentro dos testes de importação.
- npm run typecheck e npm run lint: passaram antes e depois das correções.
- git diff --check: passou.
- expo install --check: compatível com SDK 58; Expo Doctor: 20/20.
- Auditoria nova: 10 moderadas, 0 altas/críticas; detalhes por pacote em SECURITY-REVIEW-2026-11-15.md.
- Exportações web e Android repetidas nesta publicação: ambas passaram após a correção do importador, incluindo rota de importação/SQLite WASM e bundle Hermes. Exportação não equivale a APK instalado nem a teste em aparelho.
- Não foram repetidos os testes de interface Playwright nesta publicação; a execução anterior está registrada em PHASE-3-VALIDATION.md. Nenhum teste físico foi realizado.

## Preparação da Fase 4

A estrutura modular, UUIDs, centavos, timestamps e tombstones oferecem base para planejamento, mas o esquema v1 NÃO está pronto para sincronização direta. É necessária migração e protocolo próprios, especialmente para fila atômica, propriedade por conta, categorias padrão com IDs fixos, idempotência, cursores sem perda e conflitos. O plano proposto está em PHASE-4-PLAN.md. Não foram instalados clientes Supabase, criadas contas/projetos ou executadas migrações remotas. A próxima ação é revisão humana dos PRs e teste Android antes de autorizar a implementação desse plano.
