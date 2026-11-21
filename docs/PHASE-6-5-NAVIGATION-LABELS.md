# Encerramento visual 6.5 — rótulos da navegação inferior

O proprietário avaliou favoravelmente a galeria da Fase 6.5 e autorizou exclusivamente corrigir os rótulos cortados com fontes ampliadas, preservando a estética. Base: 87fd2869c62fdca13264d91e355e6ca7b35647f1, branch feature/android-preview-splash, conferida limpa/sincronizada antes de alterar.

## Causa e correção restrita

A barra tinha altura fixa de 72 + safe-area inferior; o Label padrão da navegação limitava o texto a uma linha. Aumentar a fonte mantinha o espaço insuficiente. SDK58/Expo Router instalado foi inspecionado: BottomTabItem, Label e BottomTabBar, sem modificá-los. Somente APIs públicas de expo-router e React Native são utilizadas no app.

- Mantido o mesmo Tabs, com os cinco destinos, ícones SymbolView existentes, cores, seleção, press/long-press, links e navegação padrão. Não há novo navegador nem barra substituta.
- Em escala normal, mantidos o estilo, fonte 10/peso 600, posição automática dos rótulos, linha única e altura originais. As reticências normais preexistentes em espaço estreito também foram preservadas, conforme o pedido de não mudar a aparência normal. Os nomes acessíveis são completos em qualquer escala.
- Com fonte ampliada, o rótulo permite quantas linhas precisar, sem reduzir ou desativar a fonte. A altura cresce conforme a medição real do texto, incluindo uma pequena separação dos ícones; não acumula crescimentos após voltar à escala normal.
- Quando ampliado, o texto fica sob o ícone também em paisagem/tablet, aproveitando a largura e evitando uma barra excessiva em telas baixas. Em escala normal, o comportamento automático anterior é mantido.
- React Native usa useWindowDimensions().fontScale; allowFontScaling permanece explicitamente habilitado, sem limitar multiplicador. Na web, uma medição invisível de linha única detecta também o aumento somente de texto/CSS, que não altera fontScale. A medição não participa do layout, toque ou árvore acessível e fica contida na largura disponível.
- Cada destino recebe tabBarAccessibilityLabel com o nome integral: Início, Categorias, Adicionar, Comprados e Configurações. Não são abreviados nem substituídos por ícones sem rótulo.

Arquivos de produção alterados/criados: src/app/(tabs)/_layout.tsx, src/components/scalable-tab-label.tsx e src/components/tab-label-layout.ts. Não houve alteração de qualquer outra tela, design system, modelo, preço, importador ou SQLite.

## Evidência visual

[Galeria de antes/depois](phase-6-5/navigation/index.html) · [Índice com PNGs](phase-6-5/navigation/CAPTURES.md) · [12 comparações normais e hashes](phase-6-5/navigation/normal-comparison.json) · [Matriz de 72 casos](phase-6-5/navigation/matrix.json).

Foram capturadas barras em 320/360/412/640 (paisagem)/768/1024, claro e escuro, antes e depois. **As 12 comparações normais têm PNGs idênticos byte a byte e a mesma altura de 72 px**, no Chrome utilizado, com safe-area web zero. Isso não é uma comparação conceitual: as imagens vêm do app executado em contextos isolados. A reprodução original de CSS global 26 px agora mostra os cinco textos inteiros. Há exemplos adicionais de fontes CSS equivalentes a 1,6/2,6/3,2 em diferentes larguras. São 38 capturas, sem dados pessoais.

## Verificações

- **127 testes Node/SQLite aprovados**, 0 falhas/skips/cancelados: 122 anteriores +5 de geometria de navegação (dimensão normal, expansão, paisagem, safe-area/entradas transitórias e retorno da escala).
- **Quatro suítes web aprovadas** nesta correção: tab-labels, navigation, phase62 e phase65; sem pageErrors. As demais suítes da Fase 6.5 não foram reexecutadas porque a mudança é exclusivamente de navegação; o resultado histórico de 12 suítes continua no relatório anterior.
- A nova suíte tab-labels executa **72 combinações**: seis larguras, seis escalas (1/1,3/1,6/2/2,6/3,2) e dois temas. Confere nomes integrais, texto sem corte vertical/horizontal, ausência de sobreposição, cinco destinos, seleção/rota após toque, retorno a 72 e áreas de toque de pelo menos 44×44 px.
- A matriz manteve pelo menos 57,7% da altura para o conteúdo no pior caso testado. Barras ampliadas variaram conforme o texto, chegando a 241 px no maior caso; sem esconder destinos ou reduzir fontes.
- TypeScript e ESLint aprovados. Export web de produção aprovado (--max-workers 2, saída conclusiva). Nenhuma dependência alterada. Expo Doctor não foi repetido nesta correção: os 19/20 e seis avisos de versão anteriores permanecem documentados, sem atualização ou ocultação.

As primeiras tentativas detectaram crescimento desnecessário em escala normal e uma medição invisível que estava sendo comprimida. Ambos foram corrigidos antes da entrega; a comparação final é idêntica e a matriz final passou. Nenhum teste foi desabilitado nem uma regra funcional flexibilizada.

Reproduzir: npm test; npm run typecheck; npm run lint. Para a web, usar Playwright/Chrome externos já existentes, WISH_TEST_URL/WISH_PLAYWRIGHT_MODULE/WISH_CHROMIUM_PATH e executar node tests/ui/tab-labels.cjs. Capturas via node tests/ui/tab-label-captures.cjs after, saída .expo/nav-label-review ou WISH_NAV_OUTPUT. O modo before precisa rodar no código de baseline; ele não recria uma versão antiga sozinho.

## Limites, preservação e encerramento

A comprovação de fonte ampliada é web/CSS e geometria automatizada; **não é validação física de Android fontScale, TalkBack, teclado, safe areas ou gestos**. A lógica nativa usa as métricas RN/área segura, sem desativar escalonamento; deverá ser conferida no aparelho quando autorizado um meio de validação. Não houve APK ou EAS Build. Não se afirma cobertura de escalas infinitas ou de todas as combinações de dispositivo/fonte.

No intervalo testado não foi necessário comprometer a navegação ou propor outra organização: todos os cinco destinos continuam visíveis e clicáveis. A estética normal está preservada. Nada foi refeito em outras telas. SQLite v5, migrações/backup, importador, preços/PIX/cupons, dependências, versionCode5, package, assinatura, main e PR #5 intactos. Sem merge, serviços ou custos novos.

Publicação exclusivamente na branch existente, com commits separados para correção, testes e documentação/capturas; hashes registrados no relatório final e no PR #8. Manter PR aberto/em rascunho. **Trabalho visual encerrado dentro do escopo; aguardar autorização explícita para iniciar a Fase 7.0 — estudo de viabilidade da SerpApi. Nenhum estudo/integração SerpApi foi iniciado nesta entrega.**
