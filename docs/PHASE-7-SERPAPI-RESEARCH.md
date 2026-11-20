# SerpApi — candidata à Fase 7.0

Pesquisa da Etapa A consolidada em 20/11/2026. **Somente documentação**; sem conta, chave, integração, assinatura, requisição à API ou prova de conceito.

## Custo e limites

O plano Free anunciado é US$ 0/mês com 250 consultas/mês. A regra de throughput publicada para esse volume equivale a 50 consultas/hora. Não garante gratuidade permanente ou capacidade futura. Fontes: https://serpapi.com/pricing e https://serpapi.com/faq.

Uma busca bem-sucedida consome um crédito, mesmo com zero resultados; quantidade de itens retornados não altera esse crédito. Falhas de execução e cache não contam. Uma mensagem de erro por ausência de resultados pode acompanhar uma busca contabilizada; não inferir consumo apenas da existência de error no JSON. Paginação e consultas complementares podem gastar novas unidades. Fontes: https://serpapi.com/faq e https://serpapi.com/blog/calculating-search-credit-usage-with-serpapi/.

Cache do serviço dura uma hora e exige todos os parâmetros iguais; no_cache evita esse reaproveitamento. A Account API permite consultar limite, saldo/renovação e throughput sem consumir buscas. Fontes: https://serpapi.com/google-shopping-api e https://serpapi.com/account-api.

## Cobertura e qualidade

Google Shopping aceita busca textual q e configuração de país/idioma/localização; Brasil é suportado por gl=br. Nome, modelo, SKU, MPN, EAN e GTIN podem compor a consulta textual, mas isso não oferece correspondência exata garantida. Cor, tamanho, capacidade, condição, vendedor e produto similar precisam de verificação própria. Fontes: https://serpapi.com/google-shopping-api e https://serpapi.com/google-shopping-countries.

Resultados podem fornecer loja, preço, preço anterior, parcelas, entrega, descrições e links. Algumas URLs apontam ao produto no Google e exigem consulta complementar para ofertas de lojas. Immersive Product oferece detalhes/lojas e paginação; não há garantia de todas as lojas ou de link direto em cada item. Fontes: https://serpapi.com/shopping-results e https://serpapi.com/google-immersive-product-api.

Não foi confirmada garantia de campos completos de PIX, cupom ou valor elegível para uma sessão. O preço do buscador não é confirmação direta na loja. A precisão por Tecnologia/Casa/Roupas, identificação de variantes, alcance de lojas e atualização efetiva exigem POC posterior. Mostrar data da consulta e tratar resultados antigos como referência.

## Termos, cache e arquitetura

SerpApi é serviço terceiro, não API oficial do Google Shopping. Os termos consultados não garantem serviço contínuo/sem erros, e atribuem ao usuário responsabilidade pelo uso lícito dos dados. Não foi estabelecida licença irrestrita de armazenamento/redistribuição de conteúdo das lojas: revisar termos/direitos no desenho da POC. O arquivo de busca do fornecedor é retido por 31 dias; não substitui persistência local. Fonte: https://serpapi.com/legal.

Proposta futura: backend opcional para proteger chave privada, autenticar o cliente, aplicar limite rígido e oferecer cache sob demanda. Nunca incluir segredo na APK, EXPO_PUBLIC, SQLite, logs ou GitHub. APK não oferece proteção adequada a uma chave secreta de serviço. Backend gratuito precisa ser escolhido/avaliado posteriormente; nenhum servidor pago obrigatório é aceitável.

Persistir no futuro somente dados necessários, origem e timestamp; não enviar anotações pessoais. Ao atingir cota/erro/descontinuação, continuar com dados locais e ofertas manuais. Sem contratação, excedente pago ou upgrade automático. A existência de cota gratuita não garante custo zero permanente para uma integração: manter serviço substituível/opcional. O núcleo local do Wish deve manter custo mensal obrigatório R$ 0.

## POC futura — requer autorização própria

Comparar precisão de identidade/variantes, lojas e links, moedas, PIX/cupom, validade, consumo real por desejo/paginação, cache e retenção. Estimar orçamento antes de consultar, interromper no teto gratuito e medir ausência de resultados. Não implementar esta POC como parte da Fase 6.3, não criar migração por antecipação e não alterar ofertas manuais.
