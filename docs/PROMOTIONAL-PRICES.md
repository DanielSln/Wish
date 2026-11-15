# Refinamento visual e preços promocionais — 15/11/2026

Entrega na branch feature/expo-go-readiness, dentro do PR #6 ainda aberto. Main, PR #5/Supabase, esquema SQLite v2, slug e logotipo W preservados. Sem novas dependências, migração, conta, scraping por endpoints privados ou alteração dos limites de importação.

## Problemas observados no Android

O proprietário informou que abriu o Wish em Android real pelo link experimental e observou indicador vertical, marca com inicial minúscula e divergência no valor esperado de produtos com desconto. Esse relato é a primeira confirmação de execução física **pelo proprietário**. Os testes adicionais desta entrega foram automatizados e em navegador; não houve novo teste físico pelo desenvolvedor.

Os ScrollView verticais e a FlatList compartilhada de Início/Comprados não desativavam o indicador padrão do React Native. Não foi encontrado componente manual desenhando uma barra lateral. Foram acrescentadas propriedades showsVerticalScrollIndicator=false nas telas de lista, categorias, adicionar, configurações, importação, formulário e detalhes. Rolagem, acessibilidade, virtualização e indicadores horizontais não foram desabilitados. A confirmação final no mesmo Android continua necessária, pois não houve captura do indicador original neste ambiente.

O texto minúsculo estava em src/components/brand.tsx, usado pelos cabeçalhos. Passou a Wish. O desenho W, tokens de cor e identificadores nativos não mudaram.

## Extração e escolha dos preços

Antes, o importador lia basicamente offers.price do JSON-LD ou product:price:amount do Open Graph. Não distinguia preço de referência, SalePrice, desconto condicionado, nem os campos públicos adicionais da KaBuM.

Agora:

- JSON-LD: preço explicitamente marcado SalePrice é priorizado quando único, em BRL, vigente e sem condições detectadas. ListPrice/StrikethroughPrice são referências anteriores; MSRP não vira preço atual. Não se escolhe o menor número entre variantes ou vendedores. Conflitos entre promoções ficam sem preço.
- Open Graph: product:sale_price:amount/currency e product:original_price:amount/currency são separados; datas explícitas da promoção são verificadas. Um preço reconhecido como original não é reutilizado como atual quando a promoção está vencida. Moeda não confirmada não é convertida.
- KaBuM: adaptador específico lê somente o JSON público __NEXT_DATA__ já contido no HTML solicitado. Confere o ID da URL, SKU do JSON-LD, ID do produto embutido, vendedor próprio, disponibilidade, restrições e datas da campanha antes de usar prices.price, prices.oldPrice e prices.priceWithDiscount. Marketplace, produto diferente, oferta vencida/futura ou exclusividade reconhecida exigem revisão manual. Não há chamada a API adicional, execução de scripts ou acesso autenticado à loja.
- O desconto PIX é apresentado separadamente. O preço comum não é substituído silenciosamente por ele. O botão Revisar usando o preço PIX leva esse valor ao formulário por escolha explícita; ainda pode ser editado.
- A prévia mostra preço anterior riscado quando comparável com o atual, preço informado e condições. Referências anteriores, opção PIX e cupom são preservados nas anotações existentes do produto, editáveis em Mais detalhes e categorias. Não são novos campos de banco nem uma cotação atualizável. O valor efetivamente salvo é o revisado no campo de preço.

Não há atualização retroativa dos produtos existentes. O histórico em anotações registra a informação da página na importação, não garante sua vigência futura.

## Cupons: o que é e não é identificado

Cupons nunca são aplicados por cálculo automático. Isso evita subtrair duas vezes um desconto que a página já incorporou ou presumir base de cálculo, acúmulo e elegibilidade.

São reconhecidos:

1. Um preço final explicitamente anunciado em priceSpecification do mesmo Offer, com nome no formato “Com cupom CÓDIGO”, preço em BRL e validade verificável quando declarada. É mostrado como valor anunciado sujeito às condições, separado do preço comum. Não garante que o usuário seja elegível.
2. Na KaBuM validada pelo adaptador, o aviso público “Use o cupom CÓDIGO e ganhe N% OFF neste item” ou desconto explicitamente em reais. Percentual e valor fixo ficam distintos. São exibidos código e condições, sem estimar preço final.
3. Requisitos estruturados como compra mínima, quantidade, região ou membro são sinalizados. Cupons vencidos/futuros ou com validade inválida não fornecem preço final. Vários cupons não são escolhidos por suposição.

Cupons só do aplicativo, personalizados, exclusivos de login, dependentes de pagamento/ativação, com base de cálculo incerta ou sem condições públicas completas continuam exigindo conferência na loja e edição manual. Campos arbitrários de scripts ou um texto genérico “cupom” não bastam. Não existe promessa de cobrir todos os formatos de cupons de todos os e-commerces.

## Página fornecida pelo proprietário

Foi lido, com HTTP 200 e sem login, o HTML público do [headset KaBuM código 467535](https://www.kabum.com.br/produto/467535/headset-gamer-hyperx-cloud-iii-dts-drivers-53mm-usb-pc-ps5-ps4-xbox-series-x-s-xbox-one-nintendo-switch-mobile-preto-e-vermelho-727a9aa), sem os parâmetros de publicidade do link recebido. Nenhum desses parâmetros foi publicado.

Na captura de 15/11/2026, os campos indicavam preço anterior de R$ 589,46, preço comum de R$ 421,04 e R$ 399,99 à vista no PIX. O aviso anunciava HYPERX15, 15% OFF, quantidade limitada e consulta às condições completas. Não havia preço final verificável com esse cupom nos metadados examinados. Esses números são uma observação datada, **não uma oferta atual garantida**.

O JSON-LD dessa captura já informava R$ 399,99. Portanto, não foi reproduzida nessa captura a importação de R$ 589,46; o comportamento da execução anterior pode ter envolvido metadados diferentes ou a expectativa do valor após cupom. A correção reconhece as fontes antes ignoradas e deixa clara a diferença entre preço comum, PIX e cupom, sem inventar resultado final.

## Validação

- 28 testes Node/SQLite aprovados, zero falhas/skips. Incluem original versus promoção, referência sem preço atual, Open Graph, moeda, cupom com valor anunciado, compra mínima/membro/pagamento, validade, percentual versus reais, ausência de preço, ambiguidade, SKU divergente, marketplace e campanha vencida. Testes de segurança/transporte anteriores continuam aprovados.
- TypeScript e ESLint aprovados, sem avisos de lint; Expo Doctor 20/20 e expo install --check aprovados.
- Export Android/Hermes gerado, sem mudança de SDK 58 ou dependências. Não é APK nem prova de teste físico.
- Playwright: navigation.cjs, import-flow.cjs e promotions.mjs aprovados, sem page errors. A nova suíte verifica Wish, rolagem funcional sem indicador no navegador, preço anterior riscado, PIX separado, cupom não aplicado, escolha explícita do PIX, edição manual do valor e persistência SQLite do preço/anotações.
- As fixtures são sintéticas; o HTML real completo, cookies, parâmetros publicitários, logs e bundles não fazem parte do Git. A leitura pública da página não valida resgate de cupom nem checkout.

## Como conferir no Expo Go

Com o projeto da branch feature/expo-go-readiness já aberto e o servidor acessível, use Reload no menu do Expo Go. Não limpe dados, reinstale ou troque o banco para atualizar JavaScript. Links experimentais dependem do processo de desenvolvimento e não têm disponibilidade permanente garantida.

1. Confirmar Wish nos cabeçalhos e rolar listas, formulário, detalhes e configurações. A rolagem deve continuar funcionando, sem indicador lateral padrão.
2. Colar o link do produto, aguardar prévia e comparar os valores que a loja disponibilizar **naquele momento**. O preço atual pode mudar desde a captura documentada.
3. Conferir referência anterior, opção PIX e eventual aviso de cupom. Usar o botão PIX somente se desejar essa forma de pagamento.
4. Para cupom, conferir disponibilidade e condições na loja. Na revisão, preencher manualmente o preço confirmado. Nenhum campo extra é obrigatório.
5. Salvar um item de teste, fechar/reabrir, conferir preço e anotações. Testar temas e operações locais offline. Produtos já salvos não têm valores alterados automaticamente; para conferi-los, abrir Editar sem duplicá-los.

Referências: [PriceTypeEnumeration](https://schema.org/PriceTypeEnumeration), [Offer](https://schema.org/Offer), [ScrollView](https://reactnative.dev/docs/scrollview#showsverticalscrollindicator).
