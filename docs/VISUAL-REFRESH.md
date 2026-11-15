# Identidade e navegação do Wish

15/11/2026. Branch feature/visual-refresh, criada após o merge autorizado do PR #2 em main (278bb1180afd34b9c6de428bcb2623b2f1b37078). Este trabalho será revisado em PR próprio; nenhuma integração automática desta branch.

## Identidade

Paleta confirmada pelo proprietário: #A9D8F4 (azul-claro), #287BB5 (ações/ícones ativos), #F7FAFC (fundo), #FFFFFF (superfícies), #1D2939 (texto). Tokens centralizados em src/theme/palette.ts, com equivalentes de contraste para escuro. Aparência clara/escura/automática em Configurações, persistida no SQLite e acompanhando o tema do aparelho quando automática. Botões usam texto branco sobre azul de ação; o azul-claro não recebe texto branco de baixo contraste.

W geométrico próprio, traços arredondados e legibilidade em tamanhos pequenos. SVG fonte e PNGs de ícone, splash, favicon e adaptive/monochrome Android em assets/brand. Símbolo na interface com a mesma geometria. Ícones de expo-symbols, já instalado, usando SF Symbols/Material Symbols por plataforma. Sem novo pacote, fonte externa, gradientes ou sombras fortes.

Prévia clara: [wish-light.png](previews/wish-light.png). Prévia escura: [wish-dark.png](previews/wish-dark.png). Telas vazias reais, sem produtos fictícios pré-cadastrados. Imagens capturadas no navegador em 412×915; não são capturas de Android físico.

## Fluxos

- Início: lista, pesquisa, chips de categorias e filtros/ordenação expansíveis. Produtos em linhas leves com imagem, preço conhecido e prioridade. Detalhes, edição, compra/reversão e exclusão continuam disponíveis.
- Categorias: cadastro automático das categorias existentes na tela, criação, renomeação e exclusão confirmada. Seleção abre a lista filtrada. Excluir categoria com produto pendente OU comprado é recusado; mover/excluir produtos libera a ação. Exclusão é lógica, mantendo FKs e histórico. Recriar nome excluído reutiliza o UUID da categoria, evitando colisão com a unicidade legada.
- Adicionar: por link, por nome ou manual. Nome apenas preenche o formulário; não executa pesquisa automática nem oferece resultados fictícios. Importação preserva as proteções da Fase 3 (hosts/CDNs explícitos, sem redirects, limite de stream e timeout). Metadados/preços só aparecem quando disponíveis; revisão precede qualquer gravação.
- Cadastro: nome, categoria e preço ficam à frente; campos completos em Mais detalhes e categorias (prioridade, loja, URL/imagem, descrição, anotações e preço desejado). Campos inválidos abrem os detalhes para correção. Imagem/loja importadas são mostradas quando disponíveis.
- Comprados: consulta o MESMO banco com status=purchased, atualizada ao focar a aba; excluídos não reaparecem. Estado vazio antes da primeira compra, sem banco paralelo.
- Configurações: aparência e Sobre. Sem gerenciamento de armazenamento local, login ou sincronização aparentando estar disponíveis. Conta/backup só poderão entrar quando a Fase 4 existir.
- Abas inativas são ocultadas também de interação/acessibilidade; barra inferior respeita safe area e exibe todos os rótulos.

## Preservação do banco

wish.db permanece o mesmo arquivo. Migração v1→v2 adiciona app_settings em transação, sem apagar/reescrever produtos ou categorias; falha preserva a versão anterior e permite retry. Preferência de tema não altera dados de produtos. Renomear categoria mantém IDs/referências. Inserções/edições de produto só efetivam em uma categoria ativa, inclusive na condição do próprio comando SQL, impedindo vínculo a categoria removida entre validação e gravação.

O plano da Fase 4 foi atualizado para partir do esquema v2 e prever migração futura v2→v3. Não há cliente Supabase, autenticação, backup remoto ou sincronização implementados. Não desinstale/limpe dados do app se quiser preservar wish.db.

## Validação

- npm test: 17/17 passaram; inclui os 13 anteriores de catálogo/importação e quatro testes novos de categorias, comprados, migração com rollback/preservação e resolução de tema.
- npm run typecheck e npm run lint: passaram, sem erros/avisos de lint na versão final.
- expo install --check: compatível; Expo Doctor: 20/20.
- expo export --platform web e expo export --platform android: passaram; Android/Hermes exportado não é APK instalado.
- Playwright/Chromium em 412×915: cinco abas, vazio de comprados, criar/renomear/selecionar categorias, cadastro por nome, salvar/marcar compra, produto na aba Comprados, exclusão protegida de categoria em uso, exclusão de categoria vazia, tema persistente após reload, tema automático acompanhando media, importação/revisão/salvamento e persistência SQLite passaram sem page errors.
- git diff --check: passou.

Teste opcional de interface versionado em tests/ui/navigation.cjs. O ambiente de teste precisa fornecer Playwright e Chromium; nenhum dos dois foi adicionado como dependência do app. Inicie o web (npm run web -- --port 8082), defina WISH_TEST_URL se usar outra URL e execute node tests/ui/navigation.cjs. WISH_PLAYWRIGHT_MODULE/WISH_CHROMIUM_PATH podem apontar à instalação do ambiente. O teste usa um contexto de navegador isolado; a resposta de importação é uma fixture interceptada, não uma oferta real nem uma semente do catálogo de produção.

## Limites e próxima etapa

Android/iOS físico e modo avião não foram testados. Ícones/splash nativos precisam de nova build para atualizar no aparelho. Expo SQLite web continua experimental e exige os headers COOP/COEP já configurados. Permanecem as limitações de DNS/TLS/lojas da importação e os alertas de dependências documentados; nenhuma atualização forçada foi aplicada. Sugestões por nome dependem de uma fonte confiável, ainda não integrada.

Próximo passo: revisar este PR, validar no Android a identidade, navegação, categorias, persistência e importação; depois autorizar a Fase 4 em etapas conforme PHASE-4-PLAN.md, preservando SQLite offline-first e RLS/isolamento de contas no futuro backend.
