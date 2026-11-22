/** Reconstructed format fixtures, not raw API responses or live store evidence. */
export const fixtures = {
    google: { organic_results: [{ title: 'HyperX Cloud Earbuds III vermelho', link: 'https://www.amazon.com.br/HyperX-Cloud-Earbuds-III-vermelho/dp/B0GRWJ9QBR', snippet: 'ASIN B0GRWJ9QBR.' }] },
    google_shopping: { shopping_results: [{ title: 'Fone de Ouvido Gamer HyperX Cloud Earbuds II, Preto, Modelo: 70N24AA', brand: 'HyperX', source: 'Google Shopping catalog', price: 'R$ 79,90', product_link: 'https://www.google.com.br/search?ibp=oshop&q=70N24AA', immersive_product_page_token: 'synthetic-fixture-token-not-a-provider-token' }] },
    google_immersive_product: { product_results: { title: 'Fone HyperX Cloud Earbuds II', brand: 'HyperX', stores: [
                { name: 'Mercado Livre', title: 'Fones de ouvido HyperX Cloud EARBUDS II 70N24AA pretos', link: 'https://www.mercadolivre.com.br/fones-de-ouvido-intra-auriculares-para-jogos-hyperx-cloud-earbuds-ii-70n24aa-pretos/p/MLB29277855?pdp_filters=item_id%3AMLB3923893355', price: 'R$ 27,39', total: 'R$ 279,99', monthly_payment_duration: 12, installments_description: '12x de R$ 27,39 (com juros)', shipping: 'Grátis', details_and_offers: ['Em estoque on-line'] },
                { name: 'KaBuM!', title: 'Fone de Ouvido Gamer HyperX Cloud Earbuds II, Preto - 70N24AA', price: 'R$ 27,05', total: 'R$ 229,99', monthly_payment_duration: 10, installments_description: '10x de R$ 27,05 (com juros)', additional_costs: '+frete', details_and_offers: ['Esgotado on-line'] },
            ] } },
} as const;
// Shopping title/brand/token arrangement is synthetic reconstruction. Commercial
// numbers/identifiers above come from PHASE-7-0-SERPAPI-POC.md. No extra facts
// such as a seller, shipping total or verified full-price basis are invented.
