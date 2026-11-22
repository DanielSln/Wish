# Experimento SerpApi — ferramenta local isolada

Não é parte do aplicativo, backend ou integração. Não é importado por produção. Nenhuma dependência adicional. Requer Node com fetch/AbortSignal.timeout e SERPAPI_API_KEY já presente no ambiente; não passa a chave na linha de comando, não carrega .env e não imprime respostas brutas.

**Esta rodada foi encerrada. Não executar novas pesquisas sem autorização do proprietário.** Resultados e limitações em [PHASE-7-0-SERPAPI-POC.md](../../docs/PHASE-7-0-SERPAPI-POC.md).

## Operações

- Testes offline, sem API ou chave: `node --test experiments/serpapi-poc/guards.test.cjs`.
- Conta somente leitura, sem créditos de pesquisa: `node experiments/serpapi-poc/run.cjs account`.
- Pesquisa, somente com autorização: `node experiments/serpapi-poc/run.cjs search CASO google "CONSULTA_PUBLICA"` ou engine `google_shopping`.
- Detalhes: `node experiments/serpapi-poc/run.cjs immersive CASO ID_CACHE INDICE_TOKEN`.
- Inspeção local sem rede: `node experiments/serpapi-poc/run.cjs show ID_CACHE`. O ID é o hash local exibido pela ferramenta, não segredo ou Search ID do fornecedor. Tokens não são impressos.
- `capture-conditions CASO ID_CACHE INDICE_TOKEN` reinspeciona manualmente um resultado Immersive já conhecido após ampliar a projeção de campos. Evita apenas o cache local; contabiliza uma tentativa antes de enviar a requisição e respeita os mesmos limites. Não é retry automático ou garantia de cache grátis do fornecedor. Foi usado uma vez, como terceira tentativa do caso Magalu.

## Orçamento e estado privado

Estado em `.expo/serpapi-poc/state.json`, já ignorado pelo Git: reservas, projeções de campos públicos, tokens de produtos e snapshots filtrados de saldo/plano. Não contém a chave ou resposta bruta; **não publicar o arquivo ou sua pasta**. Projeções não são cópias completas da API. `direct.json` contém somente a medição local dos casos com o importador existente.

O teto absoluto de 40 tentativas é persistente e não reinicia na mudança de mês/hora; janela móvel de uma hora também limitada a 40 e cada CASO limitado a três tentativas no total. Uma reserva é gravada antes da chamada; erros/timeouts não devolvem orçamento. Conta Free ativa, preço zero, créditos extras zero, saldo e data de renovação conhecidos são pré-requisitos antes de pesquisas e cache via CLI. Não há compra, upgrade, renovação antecipada, paginação ou retry automáticos.

Lock exclusivo cobre leitura, reserva e resposta; concorrência falha fechado. Lock órfão não é removido automaticamente. Não apagar estado/lock para contornar limites. Se o estado for perdido/limpo pela pasta Expo, interromper e reconciliar manualmente o histórico/saldo antes de qualquer retomada. Este controle confia no operador local; não é segurança contra adulteração de arquivos nem autenticação de endpoint público. Permissões mode600 em Node não substituem ACL/encriptação no Windows. Usar conta Windows restrita.

Cache próprio de uma hora por parâmetros completos; repetições locais não chamam a Search API. Account API ainda é consultada por segurança, portanto o tempo de recuperação inclui esse preflight. Cache de erro/resposta incompleta também permanece até expirar: não usar como prova de inexistência de produto. Seleção de campos preserva condições explícitas quando presentes, sem recalcular ou escolher preços; arrays e strings são limitados e alguns atributos/variantes podem não ser retidos. Nunca inferir ausência de campo no fornecedor somente pela projeção.

Somente engine/host SerpApi fixos, redirects recusados. A chave é anexada em memória exclusivamente ao pedido HTTPS ao fornecedor, conforme contrato da API. URLs autenticados, detalhes de exceções e respostas brutas não são logados. Não usar proxy que registre query strings. Não usar esta ferramenta como serviço público; não há autenticação, DNS pinning de destinos de lojas ou quota compartilhada entre computadores. O comando `show` revela somente a projeção privada local, que deve continuar fora de commits/logs públicos.
