# Motor experimental de confiança — Fase 7.1

Não integrado ao Wish. Sem SerpApi, rede, banco, interface, relógio global, dependências ou acesso a variáveis de ambiente. A entrada é **dado já normalizado**, não HTML, resultado bruto de fornecedor ou objeto JavaScript executável.

## Arquivos e API

- `contracts.ts`: contratos de produto, identificadores, evidências, oferta, preço, política e resultado.
- `normalize.ts`: fronteira de dados planos, limites, normalização conservadora, GTIN, datas, URLs e vocabulários locais.
- `identity.ts`: identidade do produto e anúncio em decisões separadas, com motivos/conflitos.
- `prices.ts`: interpretação sem descontos calculados, parsing monetário com moeda/locale explícitos e origem individual.
- `engine.ts`: `assess(input: unknown)` valida/clona a entrada, classifica candidatos/ofertas e produz sugestões/revisões/vazios. Essa é a fronteira pública para entrada não confiável. Funções auxiliares tipadas pressupõem contratos já validados.
- `fixtures.mjs`: fábricas **sintéticas** e extratos **reais sanitizados**, separados. Referências negativas construídas para teste não são observações reais da loja.
- `engine.test.mjs`: testes offline.
- `offline-only.cjs`: preloader de testes bloqueia `fetch`, HTTP/HTTPS e conexões TCP/TLS padrão do Node. Não é sandbox contra código arbitrário; o motor não executa código recebido.

```ts
import { assess } from './engine.ts';
// reference: Product; candidates: { id, product, offers }[].
// Each field/identifier has its own value, explicit flag and provenance.
const result = assess({
  reference,
  candidates,
  policy: {
    now: '2026-11-21T19:00:00Z', // required, supplied by caller
    currency: 'BRL',
    maxPriceAgeMs: 3_600_000,
    maxIdentityAgeMs: 86_400_000,
    purpose: 'original_listing', // or comparison, explicitly
  },
});
```

O exemplo usa variáveis do chamador; não é um script que faça consultas. `now` e limites são política explícita, não promessa universal de validade. Valores em `inputEvidence` e `prices` ficam disponíveis para auditoria, inclusive quando não elegíveis. `manualRequired` indica ausência de nome sugerível com identidade exata; não valida o formulário do app e não dispensa revisar as ofertas e os campos listados em `review`.

O resultado separa `eligibleOffers`, `conditionalOffers`, `reviewOffers` e `rejectedOffers`. Não ordena por menor valor, não grava dados e não salva um desejo. `group` identifica moeda, base do preço, condição/cupom e quantidade; nunca comparar bases/condições distintas como se fossem iguais. Ofertas de outros anúncios só podem ser consideradas no modo `comparison`; continuam proibidas para preencher o anúncio original automaticamente.

## Responsabilidade do produtor dos dados

`store_page` é uma declaração de procedência do normalizador/chamador, não autenticação criptográfica da loja. Somente atribuir `explicit=true`, moeda e `basis=product_total|delivered_total` com evidência explícita. O campo bruto `total` de um fornecedor **não** permite escolher essa base automaticamente; usar `unknown` quando não comprovado. Preservar texto em `rawText`, condições e fonte. Nenhum adaptador de fornecedor foi implementado nesta fase.

Namespaces de MPN são do fabricante; SKU, ASIN, catálogo e anúncio usam o domínio/escopo da plataforma. SKU de loja não é âncora universal. GTIN tem validação de tamanho/checksum, mas ela não certifica a atribuição real ao produto. País/escala fazem parte do tamanho (`BR:M`, `EU:42`) e unidades de capacidade não são convertidas. Diferenças como GB/GiB permanecem relevantes.

O parsing textual suporta apenas moedas de duas casas BRL/USD/EUR/GBP com locale explícito pt-BR/en-US, sem inferir símbolo, parcelas, desconto, juros ou cupom. Contratos monetários admitem BRL/USD/EUR/GBP/CAD/AUD/CHF/CNY/JPY em unidades menores da respectiva moeda; não há conversão cambial nem interpretação textual de JPY. Não usar os limites monetários como limites de preços do produto Wish; são apenas proteção do experimento.

Datas devem estar em UTC ISO com Z. Quando somente o dia for conhecido, usar `timePrecision=day` e meia-noite como representação canônica, nunca como horário real; essa precisão não certifica atualidade. Os extratos documentais reais usam dia; horários precisos das fábricas são sintéticos. Ausência de evidência, cache, índice de busca, dados antigos e source host incoerente não recebem promoção automática. Quantidade, condição, papel produto/acessório, loja e vendedor conhecidos são exigidos para elegibilidade automática de ofertas. Não existe selo de loja confiável.

## Executar sem rede

Na raiz do repositório, usando o Node e o TypeScript já instalados:

```powershell
node --require ./experiments/product-confidence/offline-only.cjs --experimental-strip-types --test experiments/product-confidence/engine.test.mjs
node --require ./experiments/product-confidence/offline-only.cjs --test experiments/serpapi-poc/guards.test.cjs
node --require ./experiments/product-confidence/offline-only.cjs --experimental-strip-types --test tests/*.test.mjs
npm run typecheck
npm run lint
```

Não executar `run.cjs account/search/immersive` da POC nesta fase. Importar suas funções pelos testes existentes não inicia a CLI ou lê a chave. Estado/cache privado `.expo/serpapi-poc` não é fixture pública e não é necessário para estes testes.

Os limites da fronteira são 4.096 unidades UTF-16 por string, 128.000 bytes UTF-8 somados de chaves/textos, 6.000 nós, profundidade 14, até 100 elementos por array, 30 candidatos, 30 ofertas/candidato e 40 fatos de preço/oferta, sempre sujeitos ao orçamento global. Não são medição de heap ou tamanho exato do JSON serializado. Getters, funções, protótipos personalizados, chaves de poluição, arrays esparsos, ciclos e valores não finitos são rejeitados. Objetos Proxy/hostis do próprio runtime não são fronteira de segurança suportada; receber JSON desserializado. Strings contendo HTML/instruções permanecem dados; uma interface futura deverá escapar texto e validar URLs sem execução.

`direct` em URL significa apenas formato HTTPS público aparente e ausência de intermediário reconhecido. Não verifica DNS, IP conectado, redirecionamentos, disponibilidade ou identidade do comerciante. Nenhum URL é aberto. O motor não substitui os controles de rede do importador ou futuro serviço.

Resultados e limites: [PHASE-7-1-PRODUCT-CONFIDENCE.md](../../docs/PHASE-7-1-PRODUCT-CONFIDENCE.md). Aguardar autorização antes de arquitetura de serviço intermediário ou integração ao aplicativo.
