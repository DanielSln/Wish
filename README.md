# Wish

Fase 6.5 na branch `feature/android-preview-splash` (PR #8 aberto/em rascunho): consolidação visual, cards compactos, preço/prioridade juntos, detalhes reorganizados e controle de aparência responsivo. **122 testes Node/SQLite e 12 suítes web aprovados**, TypeScript/ESLint/export web aprovados; Expo Doctor 19/20 pelos avisos conhecidos. [Relatório e limites](docs/PHASE-6-5-UI-REFINEMENT.md) · [44 capturas reais e comparações](docs/phase-6-5/CAPTURES.md) · [Galeria local](docs/phase-6-5/index.html). A APK v5 anterior contém a Fase 6.4, sem estes ajustes. SQLite v5, Wish1.0.0/versionCode5, importador, regras financeiras e dependências preservados. Sem nova APK/EAS Build ou merge. Aguardar revisão estética e autorização antes de preparar outra preview. Fontes/teclado/TalkBack Android e os limites CSS da barra inferior permanecem para validação física. [Matriz de importação universal e segurança](docs/PHASE-6-4-UNIVERSAL-IMPORT.md) continua válida; nenhum serviço foi integrado.

Aplicativo pessoal de lista de desejos com React Native, Expo SDK 58, TypeScript e Expo Router.

## Executar no Android com Expo Go

Recomendado: Node.js 24 LTS, npm, Git e Expo Go Android compatível com **SDK 58**. Não precisa de Android Studio, APK próprio ou login no Wish.

```powershell
git clone https://github.com/DanielSln/Wish.git
cd Wish
git fetch origin
git switch --track origin/feature/android-preview-splash
npm ci
npm start -- --go
```

Esta é a branch de revisão atual (PR #8). Não alterne para `main` ou branches anteriores com catálogo v5 sem confirmar compatibilidade; esta fase não faz merge. Em uma cópia existente, preserve alterações locais, entre na pasta Wish e siga o guia antes de trocar de branch. Abra o QR Code no Expo Go, com celular e computador na mesma rede. Alternativa de conexão: `npm start -- --go --tunnel` (o túnel padrão desta CLI exige conta Expo). A CLI também aceita `--tunnel ngrok` como opção legada; sua disponibilidade depende da rede e do serviço.

Consulte [o guia completo para Windows e Expo Go](docs/EXPO-GO-TESTING.md): instalação da versão compatível, atualização, rede, testes e limites de uso offline. O servidor do Codex Web não é o servidor do seu computador. A [APK preview v2](docs/PHASE-6-1-APK-V2.md) já foi gerada; Supabase permanece adiado; o [PR #5](https://github.com/DanielSln/Wish/pull/5) permanece separado e não é necessário para testar.

Navegador: `npm run web`. O SQLite web é experimental e precisa de contexto seguro (localhost ou HTTPS), WebAssembly, SharedArrayBuffer e dos cabeçalhos COOP/COEP configurados em metro.config.js. Em hospedagem, os mesmos cabeçalhos precisam ser enviados pelo servidor. Dados de navegador e celular ficam em bancos separados.

## Fase 2

- Cadastro manual, edição, detalhes e exclusão com confirmação.
- Nome obrigatório, URLs HTTP(S), preços em reais com duas casas, limites de tamanho e mensagens de erro.
- Imagem por URL opcional e placeholder para imagem ausente ou indisponível.
- Categorias Casa, Tecnologia e Roupas, além de categorias personalizadas.
- Busca por nome, filtros de categoria e status, ordenação por preço, prioridade e data.
- Marcar como comprado ou reverter para pendente; editar anotações e abrir o link da loja.
- Persistência SQLite local, inclusive ao reabrir; consultas e alterações funcionam offline. Imagens remotas e links da loja precisam de rede. A primeira carga em Expo Go depende do servidor; um binário instalado é necessário para uso autônomo sem servidor de desenvolvimento.

## Arquitetura e banco

`src/domain/product.ts`: tipos, validação e moeda.
`src/data/migrations.ts`: esquema e migrações transacionais via PRAGMA user_version.
`src/data/repository.ts`: operações parametrizadas e filtros, independente da UI.
`src/data/use-products.ts`: adaptação Expo SQLite e UUIDs de expo-crypto.
`src/components/`: formulário, imagem e elementos visuais compartilhados.
`src/app/products/`: rotas de cadastro, edição e detalhes.

Banco wish.db, esquema v5 (v1: produtos/categorias; v2: app_settings para aparência; v4: personal_notes e offer_details, sem alterar notes antigo; v5: product_offers, aditiva e com backup prévio verificado; v3 é reservado à branch separada do Supabase e recusado): produtos e categorias com IDs UUID, timestamps UTC ISO 8601 e deleted_at. Preços em centavos inteiros e NULL para preço desconhecido. Exclusões de produtos geram tombstones; o app não oferece restauração. Isso prepara um adaptador futuro para Supabase, mas NÃO implementa sincronização, contas ou transmissão de dados. Futuras migrações devem ser incrementais, preservar registros e atualizar a versão apenas dentro de uma transação concluída. Bancos de versões mais novas são recusados sem apagar dados. Não desinstale o app nem limpe seus dados se quiser manter o banco.

## Fase 3 — Importação por link

Em **Adicionar**, cole o endereço HTTPS no campo em destaque e toque em **Adicionar por link**. A prévia é consultada automaticamente para lojas habilitadas; **Buscar informações** permite tentar novamente. Confira a prévia e toque em **Revisar e escolher categoria**. O formulário mostra categoria, prioridade e preço opcional; os campos adicionais ficam recolhidos em **Mais detalhes e categorias**, onde você pode revisar descrição, imagem, loja, URL e anotações. Preços com validade vencida, futura ou inválida não são preenchidos. Um valor informado pela página não é garantia de preço atual. Apenas **Salvar desejo** grava no SQLite. A importação precisa de internet; o produto salvo continua disponível offline.

O serviço `src/services/product-import.ts` lê metadados JSON-LD (Product/Offer) e Open Graph disponibilizados no HTML. Não executa scripts da loja nem utiliza proxy, login, contorno de CAPTCHA/bloqueios ou serviços pagos. Imagens relativas são resolvidas em relação à página. Preços precisam de moeda BRL explícita e valor válido; moeda estrangeira, ofertas múltiplas e preços agregados ficam sem valor para revisão manual. Páginas com vários produtos são recusadas para evitar selecionar um produto arbitrariamente.

Consultas têm cancelamento e limite de tempo de 12 segundos. O transporte expo/fetch bloqueia redirecionamentos e limita a leitura em streaming a 2 milhões de bytes, mesmo sem Content-Length. HTTP de erro, conteúdo não HTML, stream indisponível e ausência de metadados têm mensagem e alternativa manual. Não há consulta periódica de preço ou garantia de suporte a uma loja específica. Páginas dinâmicas e bloqueios CORS no navegador podem impedir a importação; nesse caso, **Preencher manualmente** preserva o link HTTPS válido. Cadastros sem rede continuam disponíveis pelo botão **Novo desejo**.

Consultas automáticas são restritas aos hosts exatos de Amazon Brasil, Mercado Livre, Magalu, KaBuM! e Casas Bahia definidos em src/services/import-policy.ts; imagens extraídas usam apenas CDNs explícitos. Links encurtados, redirects e outras lojas usam cadastro manual. A restrição reduz acesso a destinos arbitrários, mas não equivale a isolamento completo de DNS/IP. Veja [docs/PHASE-3-INTEGRATION.md](docs/PHASE-3-INTEGRATION.md) para os controles, riscos residuais e validação atual, e [docs/PHASE-2-INTEGRATION.md](docs/PHASE-2-INTEGRATION.md) para a revisão da base.

Os dados existentes e a versão do banco não mudaram. Supabase e comparação/histórico de preços continuam para as próximas fases. A Fase 2 do [PR #1](https://github.com/DanielSln/Wish/pull/1) foi integrada à main no commit 0c36cbaff599ba4f5c826877f011f4ab54321133, mediante autorização do proprietário. Esta branch foi sincronizada com essa main preservando os commits. A Fase 3 do [PR #2](https://github.com/DanielSln/Wish/pull/2) também foi integrada à main mediante autorização, no commit 278bb1180afd34b9c6de428bcb2623b2f1b37078. A reformulação visual do PR #3 foi integrada à main no commit d615495c1b4c403432a58f984f68045477123f7c após autorização e validação final.

Revisão das fases e pendências: [docs/PHASE-2-3-REVIEW.md](docs/PHASE-2-3-REVIEW.md). Auditoria atual por dependência: [docs/SECURITY-REVIEW-2026-11-15.md](docs/SECURITY-REVIEW-2026-11-15.md). Plano técnico da Fase 4, ainda não implementada: [docs/PHASE-4-PLAN.md](docs/PHASE-4-PLAN.md).

## Verificação

```powershell
npm test
npm run typecheck
npm run lint
npx expo install --check
npx expo-doctor@latest
npx expo export --platform web
npx expo export --platform android --output-dir dist-android
```

Os testes executam o mesmo repositório e as mesmas migrações usando SQLite real do Node: CRUD, categorias, filtros combinados, ordenações, status, validação, persistência após reabrir, migração repetida, rollback e proteção de versão futura. Eles não substituem testes em um aparelho Android/iOS.

Roteiro no celular: cadastre um produto, crie uma categoria, pesquise e filtre, edite preços/anotações, marque e reverta a compra, cancele uma exclusão e confirme outra, feche e reabra para conferir persistência. Após a primeira carga, confira os fluxos básicos sem internet.

Auditoria de segurança: veja docs/SECURITY-AUDIT.md. Permanecem oito alertas moderados originais e dois adicionais na ferramenta de túnel de desenvolvimento, sem atualização incompatível ou `audit fix --force`.

Arquivos .env, credenciais, bancos SQLite, node_modules e exportações são ignorados pelo Git.

## Nova identidade e navegação

A identidade visual foi integrada pelo PR #3 (d615495), após a Fase 3. O aplicativo usa a paleta azul confirmada, símbolo W próprio, ícones expo-symbols e temas claro/escuro/automático persistidos. As abas são Início, Categorias, Adicionar, Comprados e Configurações. A gestão de categorias protege vínculos existentes; Comprados usa o mesmo catálogo. A entrada por nome inicia cadastro manual, sem sugestões fictícias. Banco v2 adiciona somente preferências de aparência, preservando os dados v1. O plano de sincronização futura passa a prever migração v2→v3.

Detalhes, prévias, testes e limites: [docs/VISUAL-REFRESH.md](docs/VISUAL-REFRESH.md). Supabase não foi implementado nesta reformulação.

## Testar em Android real

Roteiro de instalação, Expo Go, geração gratuita de APK sem Play Store, persistência, modo avião, categorias, comprados e temas: [docs/ANDROID-TESTING.md](docs/ANDROID-TESTING.md). A configuração atual e a APK v2 estão em `feature/android-preview-splash`, PR #8; [resultado e instalação](docs/PHASE-6-1-APK-V2.md). Não gerar outra build sem autorização.

Prontidão da arquitetura para a próxima fase: [docs/PHASE-4-READINESS.md](docs/PHASE-4-READINESS.md). Supabase continua apenas planejado.

### Preços promocionais e cupons

A prévia distingue preço anterior, promoção explícita e opção condicionada ao PIX quando identificáveis. Cupons não são calculados nem aplicados automaticamente: o valor anunciado e as condições são apresentados para revisão. O preço pode ser corrigido manualmente e as referências ficam nas anotações, sem mudança do SQLite. Consulte [formatos suportados, caso KaBuM e validação](docs/PROMOTIONAL-PRICES.md).

### Descrições compactas

Prévia e detalhes mostram até quatro linhas, com Ver mais... / Ver menos somente quando necessário. No cadastro/edição, Editar descrição abre o campo com todo o conteúdo. Descrições e especificações contidas no texto não são cortadas no SQLite. Consulte [comportamento e testes](docs/EXPANDABLE-DESCRIPTIONS.md).

### Detalhes simples e importação assistida

Ver na loja substitui URLs técnicas na tela de detalhes. Notas pessoais têm editor com salvar/cancelar, ofertas ficam separadas e textos anteriores são preservados sem classificação automática. meli.la aceita resolução restrita ao Mercado Livre; bloqueios continuam com alternativa manual. Categorias são sugeridas por regras locais, respeitando a escolha manual. Consulte [migração, segurança e testes](docs/SMART-DETAILS-IMPORT.md).

### Cadastro em outras lojas e carregamento

Youcom usa o parser genérico nos hosts revisados. Lojas HTTPS não revisadas recebem prévia manual compacta com **Desejar**, mantendo URL/domínio e solicitando apenas os dados obrigatórios ausentes. Textos compartilhados e escolha entre vários links são suportados. Não há consulta arbitrária sem proteção de DNS no cliente. O ícone de carregamento passa a usar o W transparente existente; molduras próprias do Expo Go não são controladas pelo Wish. Consulte [limitações, investigação e testes](docs/STORES-SPLASH.md).

### Primeira APK e título compacto

Preparação da Fase 6, auditoria da splash, situação da build e roteiro físico: [docs/PHASE-6-ANDROID-PREVIEW.md](docs/PHASE-6-ANDROID-PREVIEW.md). Conta Expo e perfil preview conferidos; situação da assinatura/build e validação física atualizada no relatório.

### Fase 6.1 — ofertas e interface compacta

[Relatório, backup v5 autorizado e roteiro físico](docs/PHASE-6-1-REFINEMENTS.md). Cadastro manual de ofertas por desejo, sem busca automática ou garantia de preço atual. A [APK v2 autorizada e concluída](docs/PHASE-6-1-APK-V2.md) inclui esta fase; instalar sobre a v1 sem desinstalar. O proprietário informou 20 testes físicos aprovados, 3 não realizados e nenhum reprovado na instalação limpa da v2. A migração Android v4→v5 permanece sem validação física. Não abrir o banco v5 com código v4.

### Fase 6.2

[Implementação, testes e pendências](docs/PHASE-6-2-REFINEMENTS.md) · [Pesquisa documental de APIs](docs/phase-6-2-price-api-research.md). Sem nova APK, migração, integração externa ou alteração da identidade Android.
