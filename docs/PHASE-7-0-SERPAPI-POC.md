# Fase 7.0.1 — prova de conceito SerpApi

Experimento real em **21/11/2026**, Windows/Node, isolado do Wish. Base: `b5708b8ea183380baf81a65145b0504e1ddd5d38`, branch `feature/android-preview-splash`, inicialmente limpa/sincronizada. PR #8 permanece aberto/em rascunho. Nenhuma integração ao app ou nova compilação.

## Resultado executivo

**Útil para descoberta assistida; insuficiente para importação universal ou comparação automática confiável sem revisão.** Search recuperou referências indexadas coerentes para Amazon/ASIN, KaBuM/MPN e Magalu/código. Não confirmou os anúncios originais Mercado Livre e Shopee. Shopping/Immersive trouxeram lojas e preços, mas também variantes erradas, produtos diferentes, parcelas em `price`, ofertas esgotadas e links indiretos.

Foram realizadas **15 tentativas de pesquisa**, debitados **14 créditos gratuitos**, com saldo final **236/250**. Três recuperações do cache local não enviaram novas pesquisas. Nenhum caso excedeu três tentativas. Não houve retry automático, compra, upgrade, renovação antecipada, serviço em nuvem ou cobrança contratada.

Não se recomenda integrar o preenchimento automático irrestrito ou “menor preço” ao Wish com base neste experimento. Uma próxima etapa, se autorizada, deve restringir-se a candidatos revisáveis e critérios de identidade/preço/procedência, mantendo manual/offline.

## 1. Conta e segurança inicial

A variável `SERPAPI_API_KEY` foi verificada como presente, sem exibir valor. A Account API retornou os campos filtrados abaixo; nenhuma resposta bruta foi impressa ou armazenada.

| Campo | Início | Encerramento |
| --- | --- | --- |
| Status / plano | Active / free / Free Plan | Mesmo |
| Preço mensal | US$ 0 | US$ 0 |
| Cota mensal | 250 | 250 |
| Buscas consumidas | 0 | 14 |
| Buscas restantes | 250 | 236 |
| Créditos extras | 0 | 0 |
| Renovação | 21/12/2026 | 21/12/2026 |
| Limite horário da conta | 250 | 250 |

**Divergência confirmada:** a [página pública de preços](https://serpapi.com/pricing) anuncia Free com 250/mês e **50/hora**; o painel informado pelo proprietário e `account_rate_limit_per_hour` retornaram **250/hora** nesta conta. Não se conclui que todas as contas tenham essa exceção. A ferramenta aplicou o menor teto autorizado: **40 tentativas no total e em janela móvel de uma hora**.

O campo final `this_hour_searches` mostrou 9, enquanto `this_month_usage` mostrou 14. Não se reinterpretou o contador horário como saldo nem se usou isso para ampliar consultas. O ledger local conservou todas as 15 reservas. A [Account API](https://serpapi.com/account-api) é documentada como gratuita e não consome a cota de buscas.

Plano Free ativo, preço zero, saldo positivo e extras zero foram reconfirmados antes das consultas. Nenhuma função de compra/assinatura foi chamada. A API não forneceu aqui um comprovante de configuração de renovação antecipada ou fatura: não se declara auditoria completa de billing. O experimento não ativou recursos pagos e permaneceu no saldo gratuito.

## 2. Método, ferramenta e limites

[Ferramenta experimental](../experiments/serpapi-poc/README.md), sem dependências novas e sem importar produção. Search/Shopping usaram `google_domain=google.com.br`, `gl=br`, `hl=pt`. Immersive recebeu tokens reais dos candidatos Shopping brasileiros e `more_stores=true`; não foram inventados tokens, ASINs, GTINs ou preços. Nenhum endereço residencial/CEP foi enviado. Suporte brasileiro é documentado na [lista Shopping GL](https://serpapi.com/google-shopping-countries).

- Um pedido por decisão explícita; sem loops de retry, paginação ou varredura automática.
- Reserva persistida **antes** de enviar cada pesquisa, incluindo uma reinspeção do mesmo resultado. Falhas não devolvem orçamento automaticamente.
- Lock exclusivo, gravação por arquivo temporário/rename, limite global 40, janela móvel 40/h e até três tentativas por caso, inclusive na reinspeção.
- Cache local de uma hora por parâmetros completos; consultas iguais entre casos compartilham o resultado. Preflight Account API permanece mesmo no caminho de cache.
- Somente projeções de campos públicos/condições selecionadas foram retidas em `.expo/serpapi-poc`, já ignorada pelo Git. Chave e resposta bruta não foram gravadas. Tokens de produto/cache ficam privados. O relatório contém sínteses selecionadas, não dumps.
- Primeira projeção não incluía todos os campos de condições/descrição. Foi ampliada e feita **uma reinspeção manual**, dentro da terceira tentativa Magalu, com os mesmos parâmetros Immersive. Saldo não caiu nessa reinspeção, comportamento consistente com cache do fornecedor; não se assume que repetições futuras sejam grátis.

Não foram contornados login, CAPTCHA, bloqueios ou CORS das lojas. Consultar resultados do buscador não equivale a liberar o domínio no importador ou confirmar a página comercial. Nenhuma imagem foi baixada/validada fisicamente. Não foram pesquisados produtos inventados AliExpress/Casas Bahia.

## 3. Consultas reais e tempos

Tempos medidos com `performance.now()` do envio da **Search API** até leitura/parse da resposta. Excluem o preflight Account API, inicialização do processo e tempo humano entre decisões. Não são tempo de interface, Android ou SLA. As primeiras 14 buscas ocorreram aproximadamente entre 15:27 e 15:30, America/Sao_Paulo; a reinspeção foi posterior na mesma sessão/janela de orçamento.

| Nº | Caso | Engine / consulta | Tempo | Resultado avaliado |
| ---: | --- | --- | ---: | --- |
| 1 | Amazon | Search: `https://a.co/d/0foLGgI8` | 503 ms | Sem candidato. |
| 2 | Amazon | Search: `B0GRWJ9QBR site:amazon.com.br` | 768 ms | Página Amazon com mesmo ASIN, título Earbuds **III vermelho**. |
| 3 | Amazon | Shopping: `HyperX Cloud Earbuds III vermelho` | 989 ms | Mistura III/II, acessórios e headsets; nenhum preço vinculado com segurança ao ASIN original. |
| 4 | Mercado Livre | Search: URL original MLBU com `pdp_filters` MLB | 1.058 ms | Sem candidato. URL integral é a documentada no estudo de viabilidade. |
| 5 | Mercado Livre | Search: `MLBU4871586876 MLB5097782981` | 2.367 ms | Resultados irrelevantes, inclusive conteúdo financeiro; rejeitados. |
| 6 | Mercado Livre | Search: `"MLB5097782981" site:mercadolivre.com.br` | 1.838 ms | Sem candidato. |
| 7 | Shopee/modelo | Shopping: `HyperX Cloud Earbuds II 70N24AA` | 3.109 ms | Candidatos de várias lojas; também gerações/modelos incorretos. |
| 8 | Shopee/modelo | Search: `"70N24AA" site:shopee.com.br` | 984 ms | Nenhum anúncio Shopee original confirmado; resultados devolvidos incluíram outros domínios. Não confiar no operador `site:` como filtro de segurança. |
| 9 | Shopee/modelo | Immersive: primeiro candidato da busca 7 | 2.795 ms | Nove lojas; várias mencionam 70N24AA preto. Não encontrou o anúncio Shopee fornecido. |
| 10 | KaBuM | Shopping: `HyperX Cloud III 727A9AA` | 1.247 ms | Produtos/cores/gerações diferentes. |
| 11 | KaBuM | Search: `"727A9AA" site:kabum.com.br/produto/467535` | 1.842 ms | URL, marca e modelo coerentes com a referência original. |
| 12 | KaBuM | Immersive: candidato “Headset Gamer HyperX Cloud III 727a”, índice 5 da busca 10 | 1.902 ms | Treze lojas, com ofertas explícitas de **727A8AA**; catálogo não pode confirmar a variante solicitada. |
| 13 | Magalu | Search: URL original `aa0aaec2da` | 1.101 ms | Página Magalu correspondente, mais resultado de afiliado. |
| 14 | Magalu | Search: `"70N24AA" "aa0aaec2da"` | 3.720 ms | Modelo, cor e código no resultado; snippet de afiliado com PIX, sem confirmação direta. |
| 15 | Magalu/condições | Immersive: mesmos parâmetros da busca 9, projeção ampliada | 49 ms | Capturou parcelas, estoque, descrição e custos adicionais. Saldo permaneceu 236. |

As três buscas sem candidatos (1, 4, 6) retornaram HTTP 200/Success com `error`, mas não deixaram de consumir crédito. Todos os pedidos responderam HTTP 200; **isso não significa identidade correta**. Foram nove Search, três Shopping e três Immersive, sendo a última repetição manual. A [regra oficial de créditos](https://serpapi.com/blog/calculating-search-credit-usage-with-serpapi/) explica que busca concluída sem resultados pode ser debitada.

### Identidade e utilidade por caso

| Caso | Correspondência com referência original | Tempo acumulado de pedidos para primeira identidade indexada coerente | Pesquisas / soma dos tempos de pesquisa |
| --- | --- | ---: | ---: |
| Amazon | **ASIN exato no índice Amazon**, apontando Earbuds III vermelho; contraria a suposição histórica Earbuds II. Oferta/seller atual não confirmados. | 1.271 ms, duas buscas | 3 / 2.260 ms |
| Mercado Livre | Não confirmado o catálogo/anúncio original. Outras ofertas ML não substituem MLB5097782981. | Não identificado | 3 / 5.263 ms |
| Shopee | Não confirmado item 20699569312 / loja 301983687. Identificação do modelo em outras lojas é distinta desse objetivo. | Não identificado o anúncio | 3 / 6.888 ms |
| KaBuM | **MPN e URL exatos no índice**, reforçados pela consulta direta atual. Immersive escolhido mistura variantes e não confirma oferta 727A9AA. | 3.089 ms, duas buscas na ordem executada | 3 / 4.991 ms |
| Magalu | **Código aa0aaec2da e modelo 70N24AA coerentes no índice**; seller/checkout original não confirmados. Outra oferta Magalu encontrada tem código e seller diferentes. | 1.101 ms, uma busca; refinamento posterior | 3 / 4.870 ms |

Assim, **3/5 casos tiveram identidade indexada coerente com identificador/link**, não cinco importações aprovadas. Custo global exploratório: **14/3 ≈ 4,67 créditos por caso com identidade útil**; esse quociente inclui buscas improdutivas e investigação de ofertas, não é promessa de custo mínimo. Não foi confirmada oferta completa, atual e de variante/vendedor original para os cinco casos. Shopee/Amazon/ML não recebem selo de compatibilidade de importação automática.

## 4. Campos observados e exemplos comerciais

| Campo | Evidência real / limite |
| --- | --- |
| Nome | Títulos em Search/Shopping/Immersive; variam e podem rotular produto com fio como “sem fio”. Não bastam para confirmar. |
| Marca | HyperX no `product_results.brand` dos dois catálogos Immersive. |
| Modelo/variante | MPN e cor em títulos/snippets/URLs selecionados; não se obteve mapeamento estruturado confiável para todas as ofertas. Campo de variantes incluía grupo “Cor”; projeção não preserva todas as opções. |
| Imagem | `thumbnail`/`thumbnails` presentes; disponibilidade de URL não comprova resolução, correspondência ou qualidade Android. Não baixar imagens de outra variante. |
| Descrição | `about_the_product.description` presente no catálogo Earbuds II após ampliar projeção; snippets parciais em Search. Não comprovada descrição completa em todas as lojas. |
| Preço/moeda | Textos `R$`, números extraídos e `total` presentes. BRL é interpretação contextual do símbolo/localização, não campo ISO uniforme confirmado para cada resultado. Há lojas estrangeiras mesmo com país brasileiro. |
| Loja/vendedor | Loja/fonte em `source`/`stores.name`; seller parcial em título/URL (`smid`, `seller_id`). Fonte “Amazon Seller” não identifica plenamente o vendedor. |
| Disponibilidade | `details_and_offers` trouxe estoque/esgotado no catálogo Earbuds II. Continua sendo informação do buscador, sujeita a atraso. |
| Link comercial | Alguns absolutos para loja; outros `/goto?...` relativos ao Google e links do catálogo. Não se resolveram cadeias opacas, nem se declarou sucesso de abertura de todos os links. |
| Pagamento/frete | `installments_description`, duração mensal, `shipping`, `additional_costs` e `total`. Não há confirmação completa de PIX/cupom elegível nos casos. |

Exemplos selecionados do catálogo Earbuds II, **referências do buscador em 21/11/2026, não cotações confirmadas na loja**:

| Oferta observada | Valor exibido / total | Condição e procedência |
| --- | --- | --- |
| Kalunga, título com 70N24AA preto | R$ 79,90 / R$ 79,90 | Indicada em estoque, mas `additional_costs=+frete`; não é total entregue ao endereço do usuário. [Link comercial retornado](https://www.kalunga.com.br/prod/fone-de-ouvido-gamer-intraauricular-cloud-ii-preto-70n24aa-hyperx-cx-1-un/672309). |
| Mercado Livre, 70N24AA preto | R$ 27,39 / R$ 279,99 | `price` corresponde à parcela anunciada de 12x com juros; frete indicado grátis. [Outro catálogo/anúncio retornado](https://www.mercadolivre.com.br/fones-de-ouvido-intra-auriculares-para-jogos-hyperx-cloud-earbuds-ii-70n24aa-pretos/p/MLB29277855?pdp_filters=item_id%3AMLB3923893355). **Não é** o catálogo/anúncio original. Link documental mantém os identificadores essenciais; parâmetros publicitários do retorno não foram usados para novas consultas nem alterados em registros Wish. |
| Magalu, produto dd02de40cg | R$ 51,24 / R$ 342,65 | 7x com juros, frete indicado grátis; seller `nocnocestadosunidos`, anúncio diferente da referência aa0aaec2da. [Link comercial retornado, sem rastreador documental](https://www.magazineluiza.com.br/fones-de-ouvido-hyperx-cloud-ii-com-microfone-14mm-pretos-com-estojo/p/dd02de40cg/ea/hecf/?seller_id=nocnocestadosunidos). Identidade exata deste anúncio continua candidata. |
| Pichau, título com 70N24AA | R$ 269,99 / R$ 269,99 | Marcado esgotado, frete adicional; link indireto Google. Não é oferta disponível recomendada. |
| KaBuM, título com 70N24AA | R$ 27,05 / R$ 229,99 | 10x com juros, esgotado, frete adicional, link indireto. Não transformar R$ 27,05 em preço do produto. |

Para o Cloud III, o catálogo retornou oferta KaBuM **727A8AA preto**, `price` R$ 42,10 e `total` R$ 340,00: **rejeitada para o pedido 727A9AA preto/vermelho**. As condições detalhadas dessa primeira projeção não foram todas retidas; não se inventa explicação aritmética ou condição PIX para esses números. Uma oferta Amazon no mesmo catálogo tinha `price` R$ 65,54, `total` R$ 663,67 e frete R$ 8,90; também não é prova do anúncio KaBuM solicitado.

Os valores de parcelas e total por vezes não coincidem por multiplicação simples. Foram preservados como informados, sem calcular valor final, desconto ou juros. A [documentação Immersive](https://serpapi.com/google-immersive-product-api) prevê separadamente parcelas, total, estoque, cupom e custos: deve-se avaliar toda a evidência, não o menor número isolado.

O resultado de afiliado Magalu da busca 14 mencionou R$ 229,99 no PIX e duas parcelas de R$ 135,29. Isso permanece **snippet indexado de afiliado**, não preço confirmado da página original. Não foi convertido em oferta Wish nem combinado com cupom. Nenhuma regra de PIX/cupom existente foi alterada.

## 5. Cache, orçamento e desempenho

Antes da reinspeção de condições, três recuperações idênticas foram feitas em processos separados, comprovando persistência entre execuções:

| Cache local | Pedido original | Leitura do arquivo | Recuperação incluindo Account API |
| --- | ---: | ---: | ---: |
| Shopping Earbuds II | 3.109 ms | 1,929 ms | 239 ms |
| Immersive Earbuds II | 2.795 ms | 2,078 ms | 241 ms |
| Search ASIN Amazon | 768 ms | 1,855 ms | 265 ms |

**3 hits locais / 18 solicitações lógicas = 16,7%** nesta sequência experimental (15 tentativas externas + 3 hits locais). Cache evitou três pesquisas externas; não significa desconto de 16,7% garantido no uso futuro. A reinspeção externa de 49 ms não é um hit local; saldo antes/depois inalterado é consistente com cache do fornecedor. Não foi testada expiração de uma hora, reboot Windows ou reset mensal. As leituras mantiveram o saldo em 236.

Nas 14 primeiras consultas: mínimo 503 ms, mediana **1.542,5 ms**, p95 por posição mais próxima **3.720 ms**, máximo 3.720 ms. Incluindo a reinspeção de 49 ms: mediana **1.247 ms**, p95 3.720 ms. Amostra pequena, decisões adaptativas e possibilidade de cache do fornecedor impedem generalizar. Não há garantia de resposta em cinco segundos no celular; a cadeia Shopee/modelo somou quase sete segundos de Search API, sem confirmar o anúncio.

### Comparação atual com o importador existente

Executada uma tentativa por amostra, em Node `fetch`, importando o serviço TypeScript existente **sem modificá-lo**, com seus próprios limites de redirecionamento/tempo e sem cookies. Não é `expo/fetch`, teste de UI ou Android:

| Caso | Tentativa direta atual | Resultado |
| --- | ---: | --- |
| Amazon a.co | 649 ms, duas requisições | Proteção/intersticial; sem produto. |
| Mercado Livre original | 33 ms, uma requisição | HTTP 403. |
| Shopee original | 0 ms arredondado, zero rede | Fallback por política de host, não falha de conexão. |
| KaBuM 467535 | 268 ms, uma requisição | Nome/MPN corretos e preço 39.999 centavos retornados pelo importador. Dado daquela consulta, não preço garantido atual. |
| Magalu original | 133 ms, uma requisição | HTTP 403. |

O fornecedor melhora **dados obtidos** para parte das páginas bloqueadas, mas não se mostrou universalmente mais rápido. KaBuM direto foi mais simples e rápido nesta medição. As falhas diretas aqui foram rápidas; não reproduziram a espera física de até 12 s. Somar automaticamente tentativa direta + Search + Shopping + Immersive pioraria a espera. O debounce de 900 ms e etapas locais da tela não fazem parte deste benchmark.

Node emitiu aviso `MODULE_TYPELESS_PACKAGE_JSON` ao carregar o serviço TypeScript como ESM; não se alterou package.json para silenciá-lo. Não afeta a conclusão sobre o transporte físico, que continua não testado.

## 6. Resultados reais versus testes simulados

**Reais:** Account API, 15 pedidos Search API, três hits de cache local, cinco caminhos do importador existente em Node (cinco GETs efetivos), campos/links/condições acima e diferença de saldo. A ferramenta não acessou bancos privados ou imagens existentes.

**Simulados/offline:** cinco testes da ferramenta aprovados, zero falhas: plano gratuito/saldo conhecido; teto absoluto persistido representado no ledger; teto por caso/horário do fornecedor; remoção de campos sensíveis; preservação de parcela/total/estoque/descrição sem cálculo. Esses testes não comprovam disponibilidade de loja. Não se provocou esgotamento real de créditos nem 429 e não se chamou API paga para testar proteção.

`npm run typecheck` e `npm run lint` aprovados; verificações finais repetidas após concluir os arquivos experimentais. Nenhum teste de interface/Android, Expo Doctor, APK ou regressão física foi executado nesta POC. Os testes Node/SQLite anteriores do aplicativo não recebem nova aprovação por esta pesquisa.

## 7. Limitações e segurança

- Identidade indexada não confirma estoque, seller, variante ou checkout atual. A busca pelo link encurtado isolado falhou; o ASIN veio do diagnóstico anterior. Não foi demonstrado resolver qualquer link a.co desconhecido apenas com SerpApi.
- `site:` não é barreira de segurança; resultados fora do domínio devem ser recusados por código futuro. Não foi atribuído preço a resultados irrelevantes.
- Chaves de descrição/condições não incluídas na primeira projeção limitaram a análise inicial. A ampliação foi validada no catálogo Earbuds II; não se afirma ausência de todos esses campos no catálogo Cloud III. Projeções truncam strings/arrays e não são espelho completo da API.
- Imagens retornadas podem ser thumbnails e de variante diferente; não foram avaliadas dimensões/qualidade. Campos ISO de moeda, seller estruturado, GTIN e mapeamento completo de variantes não foram demonstrados uniformemente.
- Links Google relativos/opacos não foram seguidos automaticamente. Qualquer resolução futura exige validação de HTTPS/destino/SSRF e não pode liberar todos os hosts. Anúncios alternativos não substituem os IDs originais.
- Estado/cache em pasta ignorada não são criptografia; proteger o usuário Windows. Não apagar ledger para “renovar” orçamento. Perda do arquivo exige interromper/reconciliar. O script é local e confia no operador; não oferece autenticação, resistência a adulteração ou cota distribuída para serviço público.
- A chave é usada somente em memória no HTTPS ao host fixo do fornecedor. Exceções e respostas autenticadas não são impressas. Configuração de proxy que registre query strings seria um risco e não deve ser usada. Nenhum secret, cache, token, resposta bruta ou credencial integra o commit.
- Não foi criada hospedagem gratuita/paga. A [política legal](https://serpapi.com/legal) prevê retenção normal de buscas por 31 dias; não foi presumido ZeroTrace Free. Consultas só incluíram referências públicas de produtos.
- AliExpress e Casas Bahia aguardam amostras reais do proprietário. Encontrar nome AliExpress numa busca genérica não aprova o caso de importação AliExpress.

## 8. Recomendação e retomada

Recomenda-se manter SerpApi como **fonte opcional de candidatos com confirmação humana**, não substituto automático de preço/identidade. “Onde comprar” é tecnicamente plausível como lista de referências datadas, após filtrar MPN/variante/estoque/moeda/seller e separar total, parcela, frete e condições. Neste lote, o anúncio original permaneceu não confirmado em 2/5 casos; mesmo nos demais, ofertas agregadas exigem revisão.

Antes de integrar: definir contrato de confiança de candidatos; validar campos completos e seleção de variantes; autenticar relay sem chave na APK; manter orçamento central/cache e fallback; obter amostras faltantes; medir outros produtos/rede/latências e validar os links comerciais sob controles de segurança. Nenhuma dessas alterações está implementada ou automaticamente autorizada por esta entrega.

Arquivos publicados: `experiments/serpapi-poc/run.cjs`, `guards.test.cjs`, `README.md`, este relatório e referência no estudo anterior. Estado privado fica somente em `.expo/serpapi-poc`, fora do Git. Código de produção, importação, preços/PIX/cupom, SQLite v5, dependências, estética, package/assinatura e versionCode 5 preservados. main e PR #5 intactos; sem merge, APK, EAS Build, Supabase ou serviços em nuvem.

**Rodada encerrada: 15/40 tentativas reservadas, 14 créditos utilizados, 236 restantes. Não utilizar as 25 tentativas remanescentes automaticamente. Aguardar nova autorização do proprietário.**
