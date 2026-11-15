# Wish

Aplicativo pessoal de lista de desejos com React Native, Expo SDK 58, TypeScript e Expo Router. Projeto localizado em D:\Projetos\Wish.

## Executar

Requisitos: Node.js 22.13+ (Node 24 recomendado para rodar os testes SQLite) e npm disponíveis no terminal.

```powershell
cd D:\Projetos\Wish
npm ci
npm start
```

Para o celular Android com Expo Go compatível com SDK 58:

```powershell
npx expo start --tunnel ngrok --go
```

Abra o endereço exp:// exibido pelo Expo ou escaneie o QR Code. O link é temporário e só funciona enquanto o computador e o servidor estiverem ligados. O túnel não publica uma versão permanente em uma conta Expo. Sem túnel, use `npm start` com celular e computador na mesma rede. Se houver incompatibilidade de SDK, consulte https://expo.dev/go?device=true&platform=android&sdkVersion=58.

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

Banco wish.db, versão 1: produtos e categorias com IDs UUID, timestamps UTC ISO 8601 e deleted_at. Preços em centavos inteiros e NULL para preço desconhecido. Exclusões de produtos geram tombstones; o app não oferece restauração. Isso prepara um adaptador futuro para Supabase, mas NÃO implementa sincronização, contas ou transmissão de dados. Futuras migrações devem ser incrementais, preservar registros e atualizar a versão apenas dentro de uma transação concluída. Bancos de versões mais novas são recusados sem apagar dados. Não desinstale o app nem limpe seus dados se quiser manter o banco.

## Fase 3 — Importação por link

Na lista, toque em **Importar por link**, cole o endereço HTTPS de um produto e selecione **Buscar informações**. Confira a prévia e toque em **Revisar e escolher categoria**. O formulário permite corrigir nome, descrição, imagem, preço e loja, escolher categoria/prioridade e adicionar anotações. Apenas **Salvar desejo** grava no SQLite. A importação precisa de internet; o produto salvo continua disponível offline.

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

Roteiro de instalação, Expo Go, geração gratuita de APK sem Play Store, persistência, modo avião, categorias, comprados e temas: [docs/ANDROID-TESTING.md](docs/ANDROID-TESTING.md). A preparação do perfil APK está em chore/android-device-testing, em revisão separada; o aplicativo visual já está na main.

Prontidão da arquitetura para a próxima fase: [docs/PHASE-4-READINESS.md](docs/PHASE-4-READINESS.md). Supabase continua apenas planejado.
