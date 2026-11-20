# Fase 6.3 — validação e correções

20/11/2026. Branch feature/android-preview-splash, base local/remota conferida f368324e39f666b7dff900cbc772bf9215bb59d2. Árvore inicialmente limpa. PR #8 aberto/em rascunho, sem merge. Esta sessão foi autorizada a testar, corrigir e publicar somente a Fase 6.3.

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| Todos os testes Node/SQLite (npm test) | **89 aprovados, 0 reprovados, 0 pulados/cancelados** |
| TypeScript (npm run typecheck) | Aprovado, sem erros |
| ESLint (npm run lint) | Aprovado, sem erros/avisos |
| Expo Doctor 1.21.8, executável já disponível | **19/20**, uma verificação de versões falhou, mantida visível |
| Export web de produção, código final | Aprovado: .expo/phase63-export |
| Navegador Chrome/Playwright isolado | **10 suítes aprovadas, 0 reprovadas; pageErrors vazio em todas** |
| Inspeção de capturas | Prévia clara/escura, 320px, CSS com fontes ampliadas, imagens pequenas/grandes |
| Android físico / APK nova | Não executados; não foi preparada nem compilada APK v4 |

As dez suítes são phase63-images.cjs, phase63.cjs, navigation.cjs, import-flow.cjs, store-readiness.cjs, smart-details.cjs, promotions.mjs, expandable-description.cjs, phase61.cjs e phase62.cjs, em tests/ui. Os números de navegador contam suítes, não somam suas várias assertivas como se fossem testes Node.

## Problemas encontrados e correções

1. A rodada inicial Node teve 84 aprovações e duas falhas. A fixture definia price=500 por destructuring mesmo quando o caso explicitamente passava undefined para testar ausência de preço. Agora diferencia propriedade ausente de preço explicitamente omitido. As assertivas de preço ausente permaneceram iguais; não houve relaxamento de parser ou teste pulado.
2. A prévia com imagem lançava TypeError ao desestruturar e.nativeEvent.source. react-native-web encaminha um evento DOM e o alvo pode desaparecer depois do decode assíncrono. ProductImage agora usa **expo-image já instalado**, cujo onLoad entrega dimensões decodificadas consistentes. imageLoadDimensions valida tamanho/limite de 20 MP. Não foi adicionada dependência. Mantidos gerenciador de imagens, URI exata, liberação de recursos, proporção e política de não ampliar excessivamente imagens pequenas. Dimensões repetidas não provocam novos estados iguais; imagem recebe acessibilidade explícita.
3. A confirmação Desejo salvo não atualiza mais parâmetros da navegação global pelo temporizador; apenas oculta a mensagem local. Isso evita interferir quando o usuário abre detalhes logo após salvar. A regressão mantém o endereço dos detalhes por mais de 3,5 segundos.
4. Regressores antigos procuravam campos antes de abrir o diálogo de categorias, títulos/condições no local anterior, elementos ocultos de outras rotas e conteúdo expansível sem distinguir descrição de condições. Foram adaptados ao fluxo atual preservando verificações de CRUD, conteúdo integral, persistência, rolagem e temas. Reabertura espera a navegação terminar; imagens são localizadas pelo papel e nome acessíveis. A rolagem é exercitada num viewport que exige rolar, sem exigir espaço vazio de uma tela compacta.

Houve tentativas intermediárias afetadas pelo início/reinício do servidor e pela exportação concorrente. A rodada final utilizou um servidor estável, sem exportações concorrentes. O servidor criado para testes foi encerrado antes da exportação final. Uma tentativa de exportação não produziu marcador de conclusão e não foi usada como aprovação; a execução final direta da CLI com --max-workers 2 terminou com código 0 e Exported: .expo/phase63-export, com log completo. Não foram ocultadas sobreposições de erro, forçados cliques através delas, desabilitados testes ou atualizados pacotes para obter aprovação.

## Preços e fluxo Desejar

Confirmados por fixtures: preço comum/promocional, PIX inferior/superior, cupom final explícito, PIX + cupom, banner que preserva final/validade, cupom percentual sem cálculo, sessão exclusiva, conflitos, variantes/indisponibilidade, referências/parcelas/frete/cashback e ausência de preço. O HyperX é exclusivamente uma fixture histórica; nenhum valor dessa promoção foi incorporado à produção ou tratado como preço atual da loja. Não foram consultadas sessões privadas, carrinhos ou contornados bloqueios.

No navegador, o preço selecionado foi conferido na prévia, formulário e SQLite reaberto. Um ajuste manual permaneceu salvo e indicado nas condições, mantendo a evidência original. Categoria sugerida válida, prioridade Média, nome/categoria ausentes inline, preço/imagem opcionais, expansão de descrição/condições, editar/cancelar e retorno à lista foram exercitados.

A falha de gravação foi injetada somente pelo teste no canal do worker SQLite, antes de executar INSERT: a interface exibiu erro, preservou a prévia e permitiu retry. Não existe gancho de falha na produção. Duas pressões no mesmo turno salvaram um registro. Reabertura de página, reload e operações offline mantiveram dados do banco isolado de navegador. Isso não equivale a reiniciar um processo Android.

Regressões cobrem imagens importadas de 1×1 e 1600×1200 com proporção, imagem após salvar/recarregar, categorias personalizadas/criação/renomeação, exclusão protegida, notas, comprados, ofertas manuais CRUD/ordenação/condições, descrição completa, temas claro/escuro/automático e foco/blur/rolagem. Não há dados pessoais do proprietário nas fixtures.

## Avisos mantidos

Expo Doctor mantém seis recomendações de versão, sem correção automática ou exclusão de verificação:

| Pacote | Instalado | Esperado pelo Doctor |
| --- | --- | --- |
| @expo/ui | 58.0.28 | ~58.0.29 |
| expo | 58.0.25 | ~58.0.26 |
| expo-file-system | 58.0.13 | ~58.0.14 |
| expo-router | 58.0.31 | ~58.0.32 |
| expo-sqlite | 58.0.17 | ~58.0.18 |
| expo-web-browser | 58.0.8 | ~58.1.0 |

O npx --no-install inicial não localizou expo-doctor no projeto; foi executada a cópia 1.21.8 já presente no cache, sem instalação/atualização. O Node avisa sobre módulos TypeScript sem type:module; não foi alterado package.json para suprimir esse aviso. Avisos NO_COLOR/FORCE_COLOR do empacotador não impediram exportação. npm audit não foi repetido nesta sessão.

## Preservação e arquivos

SQLite v5, migrações, backup, repositório, dados existentes, assets, package/lockfile, app.json/eas.json e credenciais permanecem intactos. Wish 1.0.0/versionCode3 e package com.danielsln.wish preservados. Nenhuma chamada EAS Build, APK, consumo de cota, integração SerpApi, conta nova, cobrança, mudança de main/PR #5 ou merge.

Código alterado: src/components/product-image.tsx; src/domain/image-layout.ts; src/app/(tabs)/index.tsx.

Testes alterados: tests/fixtures/phase63-prices.mjs; tests/ui/navigation.cjs; tests/ui/import-flow.cjs; tests/ui/store-readiness.cjs; tests/ui/smart-details.cjs; tests/ui/promotions.mjs; tests/ui/expandable-description.cjs; tests/ui/phase62.cjs; tests/ui/phase63.cjs. Novos: tests/phase63-image.test.mjs e tests/ui/phase63-images.cjs. Documentação: este relatório, PHASE-6-3-IMPORT.md e README.md.

Logs/capturas ficam ignorados em .expo: phase63-node.log, phase63-browser-results.json, phase63-final-*.log, phase63-web-export-final.log e phase63-*.png. Somente código/testes/documentação são publicados.

## Pendências e recomendação sobre v4

Recomendo a **preparação da preview v4 em etapa posterior autorizada**, com os avisos conhecidos explicitados. Estes resultados não autorizam preparar identificação, modificar versionCode ou compilar agora. PR #8 permanece em rascunho e sem merge.

Após autorização própria e eventual APK, validar fisicamente no Android: teclado/foco/rolagem na importação e edição; toques e leitor de tela; fontes ampliadas e três temas; Desejar, cancelar/editar, falta de preço/imagem, falha/retry; imagem nova e fotos privadas existentes; ofertas/notas/categorias/comprados; atualização sobre v3 sem desinstalar/limpar dados; persistência após fechar/reabrir e offline. A mudança do componente de imagem precisa desse retorno nativo.

Os 12/12 testes físicos históricos da v3 não aprovam esta versão. Migração histórica SQLite v4→v5 continua sem validação física. Cópia nativa de cupom permanece pendente; não foi adicionado expo-clipboard. Preço de promoção restrita a sessão pode continuar indisponível e deve oferecer edição manual. SerpApi permanece documental para eventual Fase 7.0, não iniciada.
