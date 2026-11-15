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

Consultas têm cancelamento e limite de tempo de 12 segundos. Respostas HTTP de erro, páginas sem metadados, conteúdo não HTML e páginas acima de 2 milhões de caracteres são tratados com mensagem e alternativa manual. O cabeçalho Content-Length também é verificado; quando ausente, o corpo é recebido antes de verificar seu tamanho. Não há consulta periódica de preço ou garantia de suporte a uma loja específica. Páginas dinâmicas e bloqueios CORS no navegador podem impedir a importação; nesse caso, **Preencher manualmente** preserva o link HTTPS válido. Cadastros sem rede continuam disponíveis pelo botão **Novo desejo**.

Os dados existentes e a versão do banco não mudaram. Supabase e comparação/histórico de preços continuam para as próximas fases. Esta branch parte da Fase 2 do PR #1, ainda não incorporada à main; o PR da Fase 3 inclui essa base, sem merge automático.

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
