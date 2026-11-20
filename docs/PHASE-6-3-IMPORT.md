# Fase 6.3 — importação de preços e cadastro rápido

Status em 20/11/2026: **89 testes Node/SQLite e 10 suítes web aprovados; Android físico pendente**. Veja [resultados, correções e limitações](PHASE-6-3-VALIDATION.md).
Branch exclusiva: feature/android-preview-splash. PR #8 continua aberto/em rascunho, sem merge.
Base autorizada: 885f77979ce69a4d9345918954530660521b5196.

## Histórico da publicação inicial sem validação

Na publicação inicial, o proprietário autorizou implementar, preparar testes, criar commits e publicar nesta branch, mas determinou adiar TODA execução de testes e validação. A sessão posterior autorizou a execução e correção; seus resultados estão no relatório de validação vinculado acima. Essa instrução prevalece sobre a orientação genérica de AGENTS.md para executar lint/typecheck antes de concluir. Nenhum teste Node/SQLite, TypeScript, ESLint, Expo Doctor, navegador, inspeção visual em execução, bundle, APK ou EAS Build foi executado nesta implementação. Não há resultado de aprovação da Fase 6.3. Leitura do código/diff e conferência Git não equivalem a essas validações.

A APK preview v3 instalada continua sendo a versão anterior, versionCode 3. Os 12/12 testes físicos e a atualização v2→v3 sem perda são evidências anteriores informadas pelo proprietário; não validam este código. A migração histórica v4→v5 continua sem validação física.

## Diagnóstico e alcance da correção

O resumo anterior comparava apenas comum/PIX e ignorava finais explícitos com cupom. O banner percentual da KaBuM! podia substituir o preço final estruturado por null. A causa exata dos R$ 421,05 históricos não foi comprovada: o link completo não ficou acessível e a consulta pública sem parâmetros retornou HTTP 403 na Etapa A. Não houve contorno de bloqueio, sessão, aplicação de cupom ou checkout.

O parser agora mantém alternativas explicitamente descritas como PIX, Com cupom, PIX com cupom, PIX + cupom ou Com cupom … no PIX em priceSpecification. Exige valor total BRL válido e condições identificáveis; verifica validade e rejeita componentes, referências, parcelas, frete/cashback e divergências explícitas de variante. Cupons de condições diferentes são alternativas; preços diferentes para a mesma condição/código são considerados conflitantes. Banners complementam a evidência sem apagar preço final/validade. Não são inventados campos de hidratação para promoções não observadas.

A seleção compara comum/promocional, PIX e finais explícitos de cupom/PIX+cupom. Empates preferem o preço comum. Não calcula percentuais, não combina descontos e não promove preço anterior a atual. PIX conflitante entre fontes é recusado. O preço selecionado alimenta o produto importado, a prévia, o formulário opcional e repository.save.

O preço significa valor anunciado, sujeito à condição; não garante elegibilidade, estoque futuro ou compra. Oferta disponível apenas na sessão/carrinho pode continuar inacessível: usar valores públicos confiáveis ou edição manual. O caso HyperX existe somente como fixture histórica, sem parâmetros pessoais nem uso no código de produção.

## Fluxo

Link → consulta → prévia compacta → Desejar → lista, com aviso discreto. Importar não salva.

A prévia mostra imagem/fallback, nome, loja, preço, condição, cupom, categoria e prioridade. Descrição e condições/origem ficam recolhidas. Categoria sugerida precisa existir; prioridade inicial Média. Nome/categoria obrigatórios ausentes são solicitados inline. Preço e imagem podem faltar. Sem categorias disponíveis, o formulário existente permite criar uma. A categoria é conferida novamente no salvamento.

Desejar utiliza repository.save e validação do domínio. Uma trava síncrona impede gravações duplicadas; após sucesso fica fechada até sair do fluxo, e após falha libera nova tentativa, mantendo o rascunho. A edição opcional recebe uma cópia; cancelar mantém a prévia e suas seleções. Salvar no formulário vai direto à lista. Alteração manual do preço acrescenta uma indicação, preservando a evidência importada.

Copiar cupom por botão está **pendente**: não foi adicionada dependência ou API alternativa incompatível. O código fica como texto selecionável; isso não deve ser apresentado como ação de cópia validada.

## Persistência e preservação

SQLite continua v5. Nenhuma migração, alteração de schema/repositório, reinterpretação de texto antigo ou atualização retroativa de produtos. price_cents guarda o valor escolhido; offer_details preserva preço/condições, fonte e instante da consulta; original_url mantém o endereço do produto. Dados extensos continuam sujeitos ao limite de validação de 10.000 caracteres: bloqueio explícito em vez de truncamento silencioso para salvar.

O modelo textual atende esta fase, mas não oferece histórico/consultas estruturadas de cupons. Comparação automática futura pode exigir proposta de estrutura e autorização própria. Ofertas manuais, backup, imagens privadas, notas e preferências permanecem com a arquitetura existente. Nenhuma dependência, asset, assinatura, package, versionCode ou configuração EAS alterada.

## Arquivos

Implementação: src/services/import-prices.ts; src/services/product-import.ts; src/domain/price-presentation.ts; novo src/domain/import-draft.ts; src/app/products/import.tsx; src/components/import-price-summary.tsx; src/components/product-form.tsx; src/components/ui.tsx; src/components/brand.tsx; src/app/(tabs)/index.tsx.

Testes preparados: tests/phase63-prices.test.mjs; tests/phase63-save.test.mjs; tests/fixtures/phase63-prices.mjs; tests/ui/phase63.cjs. Expectativas Node anteriores e scripts de navegação/importação/descrição/promoções/detalhes/readiness foram adaptados ao novo fluxo; não foram executados. Documentação: este relatório, pesquisa SerpApi e README.

## Roteiro original — resultados da execução posterior no relatório de validação

1. Confirmar branch/HEAD/árvore limpa e revisar os commits antes de testar.
2. Executar npm test; npm run typecheck; npm run lint; npx expo-doctor. O histórico Doctor 19/20 não é aprovação atual nem autorização para atualizar pacotes.
3. Após autorização, iniciar web no ambiente de teste e executar tests/ui/phase63.cjs e regressões existentes, com banco de navegador isolado. Playwright já utilizado pelo projeto, sem adicionar dependências. WISH_TEST_URL e caminhos de navegador/módulo são os parâmetros existentes.
4. Validar comum/promoção, PIX menor/maior, cupom final, PIX+cupom, percentual sem final, expiração, sessão, conflitos, variante/produto incorreto, parcela, preço anterior, frete/cashback, ausência de preço e preservação da condição no formulário/SQLite. Confirmar perdas de cupom por banner e duas alternativas explícitas.
5. Validar Desejar, prioridade Média, categoria válida/ausente/removida, sem nome/preço/imagem, duas pressões consecutivas, erro de persistência e retry, edição/cancelamento e retorno à lista. Simular falha real da escrita no ambiente isolado; a fixture Node da trava não substitui essa validação de UI.
6. Testar temas claro/escuro/automático, 320px, fontes ampliadas, leitor de tela, focos, rolagem, áreas de toque e descrições/condições inicialmente recolhidas. Conferir URLs, imagens, categorias personalizadas, notas, comprados e ofertas manuais.
7. Testar offline e reinício real em banco isolado. O teste Node reabre o repositório sobre SQLite em memória; não comprova reinício Android nem armazenamento físico entre processos.
8. Somente com autorização específica posterior, preparar eventual APK e validar teclado Android, atualização sem desinstalar/limpar dados e persistência no aparelho. Não gerar build como consequência automática destes testes. Migração v4→v5 exige cenário físico próprio preservando dados.

## Limitações restantes

A execução posterior aprovou testes, tipos, lint, exportação e navegador; comportamento nativo ainda exige validação física. Expo Doctor mantém 19/20 por recomendações conhecidas de versões. As fixtures não são evidência de que a página atual da KaBuM! expõe o preço promocional. Nenhuma nova consulta a lojas/integração foi necessária para esta implementação. Pesquisa SerpApi permanece documental, candidata à Fase 7.0.
