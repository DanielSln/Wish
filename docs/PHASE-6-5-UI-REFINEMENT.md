# Fase 6.5 — consolidação visual do Wish

Implementação e revisão em 21/11/2026, exclusivamente em feature/android-preview-splash, PR #8 aberto/em rascunho. Base local/remota conferida limpa: 5a95361991b8e4aa73c664e1ceea3e1fa5578333. Esta fase não está na APK v5: a APK anterior contém a Fase 6.4. Não houve preparação ou compilação de outra APK.

## Resultado executivo

O desejo passa a ser o centro da tela de detalhes: imagem, categoria/nome, preço/prioridade e condição principal antecedem as ações. Ver na loja recebe destaque primário; edição e exclusão saem do bloco de botões grandes. Ofertas manuais, descrição e anotações continuam disponíveis, com hierarquia e divulgação progressiva. Na lista, somente o escopo solicitado foi aplicado: remoção de dois textos, cards mais compactos, prioridade junto ao preço e retirada de Pendente.

A paleta azul, o W, cores de prioridade, abas e fluxos existentes foram preservados. Não se declara aprovação estética definitiva. O parecer técnico é favorável à revisão do proprietário, com limites de acessibilidade/web descritos abaixo e validação física pendente.

## Auditoria inicial e decisões

Antes de modificar a interface foram revisados Wishlist, detalhes, ProductOffers, PersonalNotes, ProductForm, descrição expansível, categorias, aparência, imagens, diálogos, estados vazios/erro/carregamento e as suítes existentes. Foram capturados início/detalhes nos dois temas sobre a base 5a95361, num catálogo sintético isolado.

| Achado inicial | Decisão implementada |
| --- | --- |
| Nome seguido de resumo de ofertas e referência de preço, sem preço principal claro | Preço salvo em destaque de 28, sem substituí-lo pelo menor registro manual |
| Compra, edição, loja, registro de oferta e exclusão como botões grandes concorrentes | Loja primária, compra secundária; lápis e menu no cabeçalho; adicionar oferta por ícone |
| Categoria/prioridade/loja repetidas em Informações do desejo | Categoria aparece uma vez; prioridade acompanha preço; seção adicional somente se houver preço desejado |
| Metadados Origem/Consulta e URLs misturados às condições | Apresentação comercial separada, somente leitura; evidência integral permanece armazenada e acessível na revisão existente |
| Descrição e notas competindo com ações e preço | Descrição curta por padrão, expansão preservada; notas com lápis e ação textual |
| Muitas molduras e blocos independentes nos detalhes | Fluxo contínuo com divisores discretos, sem envolver cada seção em um card |
| Cards com imagem 98, gaps e status redundante | Imagem 88 (redução de 10,2%), gap 12→11, gap interno 7→6, padding vertical 14→12; status Pendente oculto |
| Seleção de aparência dispersa em chips | Segmentos com ícone/rótulo, contorno e peso selecionado, sem depender somente da cor |
| Ação Excluir categoria com área pequena | Alvo mínimo de 44, sem mudar criação/edição/exclusão |

Tokens nomeiam dimensões já existentes: espaços 4/8/12/16/24; raios 12/14/16; campos 52, botões 50 e ações compactas 44. Isso não altera globalmente busca/filtros/abas. Componentes novos IconButton, TextButton, SectionHeading, PricePriority e ThemeControl reutilizam useUI e expo-symbols já instalado. Nenhuma fonte, biblioteca ou dependência nova.

Tipografia: corpo 15/23 e campos 16 mantidos; nome dos detalhes 19/25 com até três linhas e Ver nome completo; preço principal 28; preço do card 19 em negrito; prioridade compacta 13, com rótulo de acessibilidade completo. Valores não usam numberOfLines nem redução automática de fonte; podem ocupar mais linhas em espaço extremo. A imagem continua com proporção/cálculo de resolução originais, mudando apenas a dimensão opcional da miniatura.

Medições de contraste calculadas sobre as cores existentes (não certificação de acessibilidade):

| Par | Claro | Escuro |
| --- | ---: | ---: |
| Texto/fundo | 14,03:1 | 15,92:1 |
| Texto secundário/fundo | 5,33:1 | 9,33:1 |
| Texto do botão primário/fundo do botão | 4,57:1 | 8,64:1 |
| Prioridade alta/fundo | 6,48:1 | 9,64:1 |
| Prioridade média/fundo | 6,07:1 | 10,83:1 |
| Prioridade baixa/fundo | 6,72:1 | 10,23:1 |

O azul primário original sobre o fundo claro mede 4,36:1. O preço da lista permanece azul, agora em 19/negrito; o título pequeno O que vem a seguir mantém a cor/estilo existentes por escopo. Não se declara conformidade integral WCAG. Uma eventual alteração global dessa cor/eyebrow fica como oportunidade separada, sem alteração silenciosa da tela inicial.

## Alterações por tela

### Início e cards

Removidos UM DESEJO DE CADA VEZ e Espaço para seus próximos planos. Mantidos O que vem a seguir, Guarde o que faz sentido. Compre no seu tempo., convite por link, Seus desejos, busca, seleção de categorias, filtros/status/ordenação, contagem, estado vazio e navegação existentes. Não se alterou a consulta da lista.

Preço e prioridade compartilham linha com quebra quando necessário: R$399,99 · ● Média. Alta/Média/Baixa mantêm as cores e o rótulo Prioridade correspondente; não dependem somente de um ponto colorido. Pendente desaparece dos cards, sem mudar status, filtros ou dados. Comprado continua disponível nos itens comprados. Nome completo continua no rótulo do card e na tela/edição, embora a lista preserve as duas linhas existentes.

### Detalhes

Cabeçalho sem Seu desejo, com voltar, lápis e menu. O botão nativo de voltar permanece disponível durante carregamento; no produto carregado entram os controles compactos. Exclusão está somente no menu, com a confirmação preservada. Ícones medidos na web: alvos de pelo menos 44×44, sem sobreposição. Edição e navegação são protegidas enquanto há anotação não salva, como no fluxo anterior.

Ordem: imagem → categoria → nome → preço/prioridade → condição/loja → Ver na loja → compra/restauração → ofertas → descrição → condições → informações adicionais opcionais → anotações. O link só aparece como ação se isHttpUrl aprovar o endereço existente; não há botão enganoso para ausência/link inválido.

PricePriority apresenta exatamente product.price_cents. Não calcula menor oferta, desconto, conversão nem cotação atual. O novo commercialDisplay é um formatador de leitura: reconhece apenas a linha explícita Preço selecionado que corresponde ao valor salvo para expor a condição principal. PIX/cupom e requisitos explícitos desse marcador permanecem próximos do preço; ajuste manual ganha indicação própria, sem afirmar que o novo valor tem a condição antiga. Não interpreta números/PIX de notas livres antigas. Dados sem marcador confiável continuam na seção de condições, sem atribuição automática ao preço.

Na visualização, são omitidos Origem/Consulta, marcadores de preço repetidos, placeholders sem condição e tokens de URL. O valor original de offer_details/notes não é modificado: as regressões conferem a evidência completa ao editar. Descrição integral, nome integral, preço desejado e notas permanecem salvos. Descrição e informações adicionais sem conteúdo não criam seções vazias.

### Ofertas e anotações

Ofertas registradas tem ícone de adicionar, com o mesmo formulário, validações de modelo/variante, gravação e confirmação de remoção. Vazio mostra somente Nenhuma oferta registrada. Quando há dados, a lista expansível mantém comuns e condicionais separados, ordenação e informações de registro manual/não verificado. O menor registro não substitui o preço salvo do desejo. Referência duplicada no topo e botão grande de registro foram removidos.

Durante os testes foi corrigida uma regressão da nova composição: o Disclosure era desmontado ao recarregar ofertas, fechando após editar. Agora permanece montado com os dados anteriores durante a leitura, preservando a expansão. Não se alteraram repositório, ordenação ou regras de ofertas.

Anotações pessoais preserva o lápis, edição, salvar/cancelar, texto legado e proteção de saída. Adicionar anotação e revisar texto anterior usam ações textuais compactas com alvo confortável, sem botões grandes permanentes. Os campos e a lógica de gravação não mudaram.

### Categorias, Adicionar, Comprados e Configurações

- Categorias: removido somente Organize seus desejos…; estrutura e ações preservadas, com alvo consistente de exclusão.
- Adicionar: O próximo desejo é o único título introdutório; removido Comece pelo que…; campos, entrada por link/nome/manual e fluxo de revisão permanecem.
- Comprados: somente Suas conquistas na introdução. Vazio mostra exatamente Quando você marcar um desejo como comprado, ele aparece aqui, sem marca/frase extra no estado vazio. Quando preenchida, essa mensagem não aparece. Catálogo e restauração intactos.
- Configurações: retirados Do seu jeito, Pequenas escolhas… e Menos impulso…. Claro/sol, Escuro/lua e Automático/smartphone usam a biblioteca existente; contorno/peso e estado acessível indicam seleção. Em largura estreita os segmentos podem ocupar duas linhas para não fragmentar rótulos ampliados. Preferência persiste e Automático acompanha o sistema.
- Cadastro/edição, descrição, imagens, prévia, modais e confirmações reutilizam campos/botões/paleta existentes; não tiveram grande reformulação de fluxo. O importador e a seleção financeira não mudaram.

## Capturas e comparações reais

**44 PNGs da aplicação: 4 antes e 40 depois**, mais uma imagem de prévia da galeria. São capturas da interface executada, não mockups. Imagem ilustrativa e preços de teste são declarados e controlados, em contextos novos do navegador com SQLite isolado; não foi utilizado catálogo pessoal.

- [Galeria local interativa](phase-6-5/index.html): comparação lado a lado, filtro por tema/responsivo e abertura do PNG integral.
- [Índice/antes e depois em Markdown](phase-6-5/CAPTURES.md): acessível também pela visualização de arquivos do GitHub.
- [Manifesto com arquivos, dimensões e SHA-256](phase-6-5/manifest.json).
- [Visão da galeria](phase-6-5/overview.png).

Os cenários solicitados estão nos dois temas: início com vários produtos, detalhes PIX, nome/descrição longos, sem preço/imagem/descrição, ofertas registradas, categorias, adicionar, prévia, comprados vazio/preenchido, configurações, menu e edição. Há também descrição expandida, cadastro de oferta e edição de anotações, casos de 320 px/CSS26 e início a 1024 px. Comparações do produto PIX usam o mesmo produto e zero ofertas de ambos os lados; a galeria separa o exemplo posterior com três ofertas.

As capturas de aparência foram atualizadas após o ajuste responsivo final; as demais correspondem aos mesmos componentes renderizados no código entregue. O manifesto fornece os hashes de fonte normalizados em LF para rastreio. A galeria foi aberta e testada: 48 imagens decodificadas (alguns PNGs aparecem novamente nas comparações), 40 capturas implementadas, filtro responsivo com seis exemplos e nenhum pageError.

Reprodução sem instalar dependências no projeto: configurar WISH_PLAYWRIGHT_MODULE/WISH_CHROMIUM_PATH para o ambiente externo já disponível, iniciar npm start -- --port 8097 e definir WISH_TEST_URL. Executar node tests/ui/phase65-review.cjs after, node tests/ui/phase65-review.cjs settings e node tests/ui/phase65-cards.cjs. Saída padrão .expo/phase65-review, ou WISH_REVIEW_OUTPUT. O modo before serve para uma baseline antes de alterar código; não recria historicamente o código antigo. Os PNGs antes desta entrega foram capturados de fato na base 5a95361.

## Resultados técnicos finais

| Verificação | Resultado |
| --- | --- |
| Node/SQLite | 122 aprovados; 0 falhas, skips ou cancelamentos. 115 anteriores + 7 de apresentação |
| TypeScript | Aprovado |
| ESLint | Aprovado, sem erros ou avisos de código |
| Suítes web | 12/12 aprovadas na rodada consolidada final; sem pageErrors |
| Export web de produção | Aprovado, saída conclusiva Exported, --max-workers 2 |
| Expo Doctor | 19/20, mesmos avisos de versões, sem atualizar/ocultar |
| Galeria e capturas extras | Aprovadas com dados sintéticos; não equivalem a Android físico |

Suítes: phase65, phase64, phase63, phase63-images, navigation, import-flow, store-readiness, smart-details, promotions, expandable-description, phase61 e phase62. Mantidas verificações de CRUD/importação, totais explícitos PIX/cupom, edição, categorias, exclusão protegida, ofertas ordenadas e separadas, notas, compra/restauração, persistência, imagens, temas, navegação e offline com telas previamente carregadas.

A suíte nova cobre cabeçalho/áreas de toque, menu/confirmar/cancelar exclusão, preço salvo independente de oferta manual mais barata, condição essencial do cupom visível, proveniência oculta sem apagar evidência, descrição integral/edição, notas e bloqueio de saída, compra/restauração, ausências de campos opcionais, larguras 320/412/1024 e temas persistentes com rótulos ampliados. Os sete testes de apresentação cobrem ausência de inferência a partir de PIX livre/igualdade, correspondência de valor, ajuste manual, requisitos do cupom, URLs técnicas ocultas e seções vazias.

As primeiras rodadas encontraram seletores de textos removidos/renomeados, nós de medição invisíveis de ExpandableText e telas anteriores mantidas pelo Router. Asserções foram direcionadas aos controles acessíveis e ao conteúdo real visível, mantendo comparação exata e a evidência ao editar. Uma fixture nova passou a declarar a descrição sem espaço terminal, compatível com o parser já aprovado; o parser não foi alterado. Nenhum teste foi desabilitado, cobertura funcional eliminada ou regra financeira flexibilizada.

Avisos Doctor preservados: @expo/ui 58.0.28→~58.0.29, expo 58.0.25→~58.0.26, expo-file-system 58.0.13→~58.0.14, expo-router 58.0.31→~58.0.32, expo-sqlite 58.0.17→~58.0.18 e expo-web-browser 58.0.8→~58.1.0. Não houve atualização de pacote nem nova auditoria npm. Avisos Node de módulo experimental e conversão LF/CRLF do Git não são falhas dos testes.

Comandos executados: npm test; npm run typecheck; npm run lint; Expo Doctor já disponível no ambiente; node node_modules/expo/bin/cli export --platform web --output-dir .expo/phase65-export --max-workers 2. Playwright/Chrome externos já instalados, sem mudança de dependências. Logs e catálogos temporários em .expo ficam fora do Git.

## Arquivos e commits

Produção (16 arquivos): src/theme/tokens.ts; src/components/ui.tsx, brand.tsx, theme-control.tsx, price-priority.tsx, priority-badge.tsx, product-image.tsx, wishlist.tsx, product-offers.tsx, personal-notes.tsx; src/domain/commercial-display.ts; src/app/_layout.tsx, products/[id].tsx, (tabs)/add.tsx, (tabs)/categories.tsx, (tabs)/settings.tsx.

Testes (10): tests/phase65-display.test.mjs; tests/ui/phase65.cjs, phase65-review.cjs, phase65-cards.cjs; ajustes de seletores/assertivas em navigation.cjs, phase61.cjs, phase62.cjs, phase63.cjs, promotions.mjs e smart-details.cjs. Documentação: README, este relatório, índice/galeria/manifesto e PNGs em docs/phase-6-5.

Commits reais por responsabilidade, na branch existente:
- 6c510f49a5c2c692e861cf6f3fd476ea6321974d — refactor(ui): consolidate visual tokens and accessible theme control.
- 29bb299e2406f4949145f050034c31bb4c6f6859 — refactor(home): compact wishlist cards and remove requested copy.
- 587578dd7370ffb25dbbb4025f48f0fde92e2085 — refactor(details): prioritize product price and compact secondary actions.
- 4a35c7e0310c03dc8b003388540ac80b7f055b2d — test(ui): validate visual refinement and preserve existing regressions.
- Commit documental posterior: docs: document phase 6.5 visual consolidation and real captures. O hash do próprio commit consta no relatório final/PR, evitando autorreferência.

A identidade local de autoria é a identidade pública noreply correspondente a DanielSln, preservada sem alterar configurações. A associação efetiva será conferida no metadado do GitHub após publicar. Não foram criados commits vazios nem reescrito o histórico.

## Limitações, preservação e roteiro físico

Sem diferenças em src/data, migrações/backup, src/services/importador, regras de preço/PIX/cupom/ofertas, dependências/lockfile, assets/logotipo, app.json/eas.json, package, assinatura ou versionCode5. commercialDisplay apenas apresenta campos existentes; não modifica banco/seleção/importação. SQLite v5 e dados pessoais intactos. Nenhum EAS Build, APK, API, Supabase, SerpApi, serviço/custo obrigatório novo, merge ou alteração de main/PR #5.

Limites conhecidos, sem aprovações indevidas:
- Web/CSS26 não são fontScale/TalkBack/teclado/gestos Android. A simulação global também amplia o texto da barra inferior preexistente e evidencia corte dos rótulos nas capturas reduzidas. A navegação inferior foi preservada por restrição; validar fisicamente antes de propor uma correção específica, sem redesenhá-la nesta entrega. Não se ocultou esse limite das capturas nem se desativou escalonamento de fontes.
- Em espaço extremo, o valor monetário do card quebra em mais de uma linha, conservando todos os dígitos. Categoria e nome podem ocupar mais linhas; o nome completo continua acessível nos detalhes/edição.
- O pequeno título azul existente no início tem o contraste medido acima; eventual revisão global de contraste/tamanho fora das mudanças listadas da home fica separada. Não há certificação completa de acessibilidade/leitor de tela.
- Condições antigas sem marcador explícito confiável não recebem classificação automática junto ao preço; o texto disponível continua na seção expandida. Nenhum registro antigo é reinterpretado.
- Não há inicialização web fria/PWA offline; testes offline cobrem app e rotas já carregados. As limitações reais de importação da Fase 6.4 continuam, sem novas promessas de lojas compatíveis.
- Migração histórica SQLite v4→v5 e a interface desta fase não recebem aprovação física nesta sessão.

Checklist recomendado ao proprietário, após revisar a galeria e autorizar separadamente uma futura preview:
1. Julgar comparações de início/detalhes e os dois temas; confirmar densidade, contraste, títulos, ícones, prioridades e rótulos.
2. Testar fontes grandes/TalkBack e alvos reais, sobretudo barra inferior, nomes/preços extensos e seletor responsivo.
3. Conferir teclado, rolagem e safe areas em edição, notas e modais de oferta/categoria; gestos e botão voltar durante carregamento/edição.
4. Ver na loja, compra/restauração, menu de exclusão e cancelamento/confirmar.
5. PIX/cupons e ajuste manual: valor salvo intacto, condição essencial visível, texto integral preservado; oferta manual mais barata não altera o desejo.
6. Criar/editar/remover ofertas comuns/condicionais e conferir ordem, expansão e links.
7. Nomes/descrições completos, expandir/recolher, notas, categorias, fotos privadas, imagens ausentes e preço não informado.
8. Atualizar eventual APK sobre v5 sem desinstalar/limpar; conferir catálogo/tema e reabrir offline. Não testar migrações com dados pessoais sem roteiro próprio.

Parecer: a hierarquia principal está mais consistente e adequada a uma lista pessoal, com menos competição entre informações e ações. É uma candidata à revisão estética final do proprietário, não uma aprovação visual definitiva ou autorização de build. **Aguardar revisão e autorização explícita antes de preparar nova APK. Manter PR #8 em rascunho e sem merge.**
