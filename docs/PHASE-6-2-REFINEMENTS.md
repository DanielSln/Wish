# Wish — Fase 6.2

## Base e validação recebida

Branch existente feature/android-preview-splash, PR #8, base de trabalho 661c52f. Etapa A realizada sem editar; proprietário autorizou B/C/D/E. Não houve nova branch, PR, rebase, merge ou alteração de main/PR #5.

O proprietário informou 20 testes físicos aprovados, 3 não realizados e 0 reprovados na APK v2 (código d921df6, 1.0.0/versionCode 2). Pendentes fisicamente: várias ofertas ordenadas, condicionais separadas e preço original preservado. Esses cenários já tinham testes e foram reexecutados nesta fase, inclusive no navegador. A v1 foi desinstalada antes da v2: instalação limpa NÃO validou a migração v4→v5 em Android. Não foi acessado banco do celular nesta tarefa.

## Implementação

### Teclado — Adicionar, importação e revisão

KeyboardScrollView é local às três superfícies; não altera configuração global Android, abas ou diálogos de categorias aprovados. Mede o limite real da superfície e reserva somente o trecho ainda coberto pelo teclado após eventual resize nativo. Se o sistema já reduziu a janela, o overlap fica zero: não subtrai uma segunda altura de teclado. Usa eventos keyboardDidShow/Hide, nova medição em layout, referências públicas da versão instalada do RN e rolagem até o campo em foco com margem de 16.

A superfície tem flex:1, rolagem com teclado aberto, toques tratados nos botões, keyboardDismissMode none e ajuste automático adicional desativado. Insets inferiores entram no padding de conteúdo sem somar offsets globais. O wrapper iOS anterior do ProductForm foi substituído, não empilhado. Modais KeyboardDialog continuam separados e inalterados. Fechar teclado não altera estados de URL/nome/formulário; cancelar consulta mantém URL e libera campo.

Teste puro cobre overlap, janela já redimensionada, ausência de teclado e métricas inválidas. Teste web cobre foco/blur/rolagem/cancelar e preservação dos campos. Isso NÃO comprova IME, coordenadas/insets, gestos ou botões Android; precisa de futura APK autorizada e teste físico. Algumas versões antigas de Android não emitem eventos quando adjustResize está ativo; nesse caso o layout nativo redimensionado continua sendo respeitado, mas isso não foi testado no aparelho.

### Telas compactas

Adicionar, Categorias e Configurações usam gap 12, topo 12 e títulos 24/30 em vez dos estilos genéricos 32/gap22/topo24. Importação reduz padding e repetições, preservando aviso visível de prévia automática pela conexão do usuário e revisão antes de gravar. Explicação completa permanece acessível em Como funciona a importação. Prévia usa a opção compacta existente da imagem, sem distorção ou substituir arquivos.

Cartão de link usa padding14/gap10, preserva CTA e campo. Categorias mantêm linhas separadas com menos padding e ações de toque mínimo44; abrir lista de produtos, criar, renomear/excluir e confirmações permanecem. Configurações aproxima aparência/sobre e remove apenas o W decorativo repetido do bloco Sobre; logo do cabeçalho, marca, textos, temas e persistência mantidos. Não alterada navegação inferior.

### Detalhes e ofertas

Ordem escolhida: imagem/nome → resumo de preços → ações principais → ofertas por loja expansíveis e cadastro → condições comerciais expansíveis → informações do desejo expansíveis → descrição e notas. Ações ficam dentro do componente de resumo como conteúdo recebido da tela; nenhuma duplicação de consulta/repositório ou mudança de estado comercial.

Sem ofertas: frase discreta e botão Registrar oferta de uma loja, sem explicações repetidas. Com ofertas: menor sem condição e menor condicionado em linhas separadas; aviso curto de registro manual/não tempo real; lista integral em Ofertas por loja (N), com data/condições/links/editar/remover preservados. Uma oferta não sugere comparação de várias lojas. Referência do desejo permanece identificada como não verificada e fora das ofertas. Não se atribui data de verificação a updated_at.

Condições e informações podem ser expandidas/recolhidas, com aria-expanded e estado nativo de acessibilidade; controles mínimos48. Descrição continua expansível e notas ficam acessíveis sem precisar abrir metadados. Nome completo/edição preservados. Nenhum dado é resumido permanentemente ou removido do SQLite.

### PIX

ImportPriceSummary usa apenas PriceEvidence já estruturado: current_cents, original_cents e conditional com seu rótulo. Compara preço comum e condicional válidos; destaca o PIX se numericamente menor, sempre com condição visível. Empate ou PIX maior não recebe destaque de menor. O cabeçalho delimita que cupons não foram aplicados. Preço anterior e cupom não viram candidatos a preço atual. Dados ausentes/inválidos continuam desconhecidos.

O caminho Revisar e escolher categoria conserva o preço comum. Somente Revisar usando o preço PIX altera explicitamente o rascunho, com registro da escolha no texto comercial, como já ocorria antes. Gravar ainda exige revisão/confirmação do formulário. Não alterado parser, regras financeiras, modelo de ofertas ou esquema. Nenhum PIX é extraído retrospectivamente de offer_details/texto livre de desejos antigos: isso exigiria evidência estruturada ou proposta de persistência, não autorizada aqui.

## Pesquisa de APIs

[Relatório separado e fontes oficiais](phase-6-2-price-api-research.md): Mercado Livre, Amazon Creators API, Awin, VTEX, Magalu, Google Merchant API, GS1 e material legado Buscapé. Avalia cobertura/identidade, acesso/afiliado/credenciais, custos/quotas desconhecidos, atualidade, backend/privacidade e contratos.

Conclusão documental: nenhuma alternativa gratuita/irrestrita e multiloja confirmada para a APK pessoal atual. Não é prova de inexistência de APIs; acesso e permissões precisam ser confirmados por provedor. Não houve criação de conta/chave, contratação ou integração. Arquitetura futura é apenas proposta no documento.

## Verificações

- 70 testes Node/SQLite aprovados, 0 falhas/skips. Incluem regressões de imagens/CRUD/migração/recuperação e os três cenários de ofertas ainda não realizados no Android; novos casos de layout de teclado e apresentação PIX sem mutação.
- TypeScript e ESLint aprovados sobre o código final.
- Export web de produção aprovado em .expo/phase62/web, servido localmente com expo serve. Nenhuma APK gerada, nenhum EAS Build iniciado.
- Suíte phase61.cjs adaptada para abrir ofertas recolhidas: títulos curtos/médios/longos, expansão, CRUD/order/condicionais/reload/link exato, campos de produto intactos, categorias/renomeação, 320px/tema escuro/CSS28px sem overflow horizontal; sem pageErrors.
- Suíte phase62.cjs: 320px claro/escuro e CSS26px em Configurações, URL com foco/blur/rolagem preservada, cadastro manual com URL exata, expansão de informações, temas persistentes e automático disponível, cancelar categoria sem gravação, fixture de PIX estruturada, preço comum padrão, PIX só por escolha, cancelamento de importação com URL mantida; sem pageErrors. Dados/lojas/preços das suítes são fixtures em contextos isolados, nunca catálogo do proprietário. CSS ampliado não equivale ao fontScale nativo.
- Regressão adicional store-readiness.cjs aprovada: loja HTTPS não revisada salva sem consulta automática, URL/domínio exatos, reload SQLite, Youcom por metadados genéricos e fallback Mercado Livre. Seletor antigo de título atualizado para heading acessível, evitando a cópia oculta de medição.
- Capturas inspecionadas de Adicionar/claro, Configurações/escuro com texto ampliado e prévia PIX. Navegador não substitui Android nem teclado físico.
- Expo Doctor continua 19/20: expo 58.0.25→~58.0.26, @expo/ui 58.0.28→~58.0.29, expo-file-system 58.0.13→~58.0.14, expo-router 58.0.31→~58.0.32, expo-sqlite 58.0.17→~58.0.18, expo-web-browser 58.0.8→~58.1.0. Avisos preservados, sem upgrade ou exclusão do check. npm audit não refeito nesta fase.

## Preservação e arquivos

Sem diferenças em src/data, src/services, app.json, eas.json, package.json/package-lock.json e assets: SQLite v5, backups, importador, regras de preços, identidade/assinatura/versionCode2, marca/splash e dependências preservados. Nenhum banco/snapshot/imagem apagado.

Alterados:
- src/app/(tabs)/add.tsx, categories.tsx e settings.tsx.
- src/app/products/import.tsx e [id].tsx.
- src/components/product-form.tsx e product-offers.tsx.
- tests/ui/phase61.cjs, store-readiness.cjs e README.md.

Criados:
- src/components/keyboard-scroll-view.tsx, disclosure.tsx e import-price-summary.tsx.
- src/domain/keyboard-layout.ts e price-presentation.ts.
- tests/phase62.test.mjs e tests/ui/phase62.cjs.
- docs/phase-6-2-price-api-research.md e este relatório.

README aponta para a branch atual/PR8, esquema v5 e resultado da APK v2. Orientações antigas de branch de imagens/preparação APK e status de APK adiada corrigidas, mantendo comandos/fluxo existentes. Históricos de fases continuam distinguíveis.

## Pendências e próxima APK

A APK v2 existente não contém a Fase 6.2. Não há autorização de compilação nesta tarefa; versionCode/package/projectId/assinatura não foram alterados. Recomendo revisar este PR, autorizar separadamente uma nova APK e só então preparar a identificação da próxima build/consultar cota; não compilar nem aceitar custo automaticamente.

No aparelho: validar teclado em Adicionar/importação/revisão com campos altos/baixos, texto longo, fechar/reabrir, rolar e salvar/cancelar; gestos e botões; fonte ampliada/320dp nos temas; navegação/galeria/prioridades/comprados/offline; seções abertas/fechadas sem perder notas; registrar várias ofertas em ordem crescente, PIX/cupom separados e preço original intacto; prévia KaBuM com comum/PIX/anterior e revisão explícita. Os três testes de ofertas continuam pendentes fisicamente até relato do proprietário. Migração Android v4→v5 segue não validada; não desinstalar para testar nem limpar dados.

PR #8 deve permanecer aberto/em rascunho, sem merge. main e PR #5 não modificados. Nenhuma integração automática, migração ou nova dependência foi necessária.
