# Fase 7.0 — estudo de viabilidade da SerpApi

> Etapa posterior, 21/11/2026: [POC 7.0.1 executada e encerrada](PHASE-7-0-SERPAPI-POC.md), sem integração ao app. Este estudo preserva o estado anterior ao experimento.

Data da pesquisa: **21/11/2026**. Escopo: diagnóstico, documentação e planejamento; **nenhuma integração ou POC executada**. Base inspecionada: `319b077e884cb8cd16a745426f2cb957b9d8e94e`, branch `feature/android-preview-splash`, limpa e sincronizada após fetch. PR #8 aberto, em rascunho, sem merge. Wish 1.0.0 / versionCode 5 / SQLite v5 preservados.

## Parecer

**Viável experimentar de forma limitada; ainda não demonstrado como solução das falhas reais.** A SerpApi pode localizar candidatos e ofertas indexadas sem depender do HTML diretamente entregue pela loja ao Wish. Não transforma qualquer URL em produto confirmado, não garante cobertura das sete lojas e não confirma checkout, variante, estoque, PIX ou cupom. Uma POC separada deve medir esses limites antes de qualquer integração.

O custo mensal obrigatório do núcleo Wish deve continuar em **R$ 0,00**. A recomendação inicial é uma ferramenta isolada no computador, com cota rígida, sem chave na APK e sem alteração do aplicativo. Hospedagem gratuita é alternativa posterior, condicionada aos limites e à segurança; não representa promessa de gratuidade perpétua.

## 1. Evidências e alcance do diagnóstico

Foram examinados `src/app/products/import.tsx`, `src/services/product-import.ts`, `import-links.ts`, `import-policy.ts`, `import-messages.ts`, os módulos de identidade/preços e os relatórios anteriores. Esta sessão não consultou endpoints autenticados da SerpApi, não criou conta, não solicitou chave e não consumiu créditos.

Três classes de evidência devem permanecer distintas:

- **Código atual:** comportamento verificável na base acima.
- **Observação histórica:** respostas HTTP registradas na [Fase 6.4](PHASE-6-4-UNIVERSAL-IMPORT.md), de 20/11/2026; não são nova medição nem validação física.
- **Documentação/pesquisa pública atual:** capacidade anunciada do fornecedor e presença de páginas no índice público; não são respostas da SerpApi para os nossos casos. **Todos os casos SerpApi permanecem não testados.**

O proprietário relatou estabilidade/preservação de dados na APK v5 e falhas de importação Amazon, Mercado Livre e AliExpress. Isso não identifica, por si só, a etapa exata ou duração de cada falha. Não há telemetria Android de tempo por etapa nesta entrega.

### Fluxo e orçamento de tempo

1. O texto compartilhado é analisado localmente; múltiplos links exigem escolha. Wrappers Google `/url` reconhecidos são decodificados localmente, até três níveis. O original é preservado.
2. A tela aguarda **900 ms** antes da primeira tentativa automática. A referência `attempted` evita repetir automaticamente o mesmo URL; `active` impede consultas simultâneas.
3. Somente hosts exatos revisados recebem GET. Há **12 segundos globais** para a operação de rede, incluindo redirecionamentos e leitura; não são 12 segundos por salto. Até quatro redirecionamentos permitem no máximo cinco requisições. Não há retries automáticos, consultas a buscadores ou cascata de lojas alternativas.
4. O corpo HTML inteiro é lido antes da extração, limitado a **2.000.000 bytes**. Há custo de transferência, decodificação, procura de metadados e análise síncrona de JSON. Um timer JavaScript não interrompe processamento síncrono: 12 s não é garantia absoluta de latência total, nem substitui medir o transporte nativo.
5. A prévia aguarda `repo.categories()`, uma consulta local. No caminho de erro a mensagem é definida antes dessa consulta; a prévia manual e a liberação de `busy` vêm depois. Carregamento de imagem é uma etapa distinta e não prova atraso na identificação.

Uma tentativa que esgote o tempo pode, portanto, aproximar-se de **0,9 + 12 s, mais processamento/localização da prévia**, sem qualquer retry. Isso é inferência do código, não tempo medido no celular. Cancelamento/timeout compartilham erro interno; `TypeError` pode reunir conexão e bloqueio do navegador. Faltam tempos por etapa e motivo estruturado para atribuir o relato com precisão.

### Classificação das falhas

| Classe | Evidência/caminho atual | Implicação |
| --- | --- | --- |
| Política de segurança | Host fora de `importHosts`; HTTPS/credenciais/portas/destinos inválidos | Não é falha de internet. AliExpress e Shopee estão fora da consulta automática; cadastro manual continua disponível. |
| Redirecionamento | Ciclo, mais de quatro saltos, família diferente, destino não verificável ou resposta opaca | Recusa intencional; não seguir cegamente para ganhar cobertura. `a.co` e `meli.la` já pertencem às respectivas famílias revisadas. |
| Rede/tempo | Abort após 12 s, cancelamento ou erro do transporte | Pode atrasar o fallback. Navegador/CORS e Android precisam de medições separadas. |
| Proteção/indisponibilidade | HTTP 403/429; outros status não OK; intersticial de proteção | Um HTTP 200 também pode conter apenas um desafio. Não executar CAPTCHA, login, cookies autenticados ou proxy de evasão. |
| Dados indisponíveis | HTML sem Product/microdados/OG utilizável ou dependente de JavaScript | Resposta recebida não equivale a dados de produto. Não executar scripts da loja. |
| Extração/identidade | Múltiplos produtos, metadados conflitantes ou variante não confirmada | A mensagem “Informações do produto não confirmadas” também cobre esses casos; não prova timeout. |
| Preço | Produto identificável, mas preço ausente, indisponível ou condição sem total confirmado | Não inventar preço nem calcular desconto. Pode haver cadastro parcial válido. |

Para AliExpress, a política atual evita a espera de rede da loja. Sem o URL exato usado e sem tempos Android, não se atribui sua demora ao timeout do importador. A presença de uma CDN AliExpress autorizada para imagens **não** autoriza rede de páginas da loja.

### Oportunidades futuras, sem implementação

Medir debounce, conexão/headers, cada salto, leitura, parser e categorias; registrar apenas duração, código da falha e host, sem query publicitária ou dados privados. Oferecer fallback manual acessível desde cedo; avaliar menor orçamento direto e cancelamento. Cache negativo curto por motivo pode evitar repetição explícita inútil após bloqueio, com nova tentativa consciente. Não foi encontrada repetição automática a remover.

Não encadear silenciosamente uma espera direta de 12 s com várias consultas externas. Comparar, na POC, rotas sob demanda e prazo total com fallback disponível imediatamente. Não aumentar timeouts ou remover controles de segurança como suposta correção.

## 2. Plano gratuito, cadastro e contabilização

Na [tabela oficial de preços](https://serpapi.com/pricing), o Free anuncia **US$ 0/mês, 250 buscas/mês e 50 buscas/hora**. A página também descreve renovação antecipada automática como configuração de plano: não ativá-la, não comprar créditos e não selecionar modalidade paga. Esses números são a oferta pública atual, não saldo verificado de uma conta Wish.

O [cadastro oficial](https://serpapi.com/users/sign_up) oferece nome/e-mail/senha ou provedores GitHub/Google e exige aceitação de termos. O [artigo oficial de início](https://serpapi.com/blog/introducing-serpapis-claude-code-plugin/) informa que o nível gratuito não exige cartão. Nenhum cadastro foi iniciado; verificações adicionais de elegibilidade que apareçam no fluxo real precisam ser revistas depois, sem pressupor aprovação automática.

A cota é mensal. A data exata do próximo ciclo, fuso de fechamento e eventual acúmulo de saldo gratuito **não foram confirmados para uma conta real**. Não presumir dia 1, rollover ou reposição antecipada gratuita. A [Account API](https://serpapi.com/account-api) expõe plano, consumo, saldo, `plan_renewal_date` e limite horário, sem descontar buscas. Seus resultados também podem conter chave/e-mail: futuramente extrair somente números e datas necessários, sem registrar a resposta bruta. Conferir antes da POC se a conta é Free, preço mensal zero, renovação e saldo; se indefinido, interromper.

A [explicação oficial de consumo](https://serpapi.com/blog/calculating-search-credit-usage-with-serpapi/) distingue falha de execução de busca bem-sucedida sem resultados: esta última pode gastar um crédito mesmo contendo `error`. Cada página ou consulta complementar pode consumir outra unidade; quantidade de itens de uma resposta não multiplica o crédito. Falhas e respostas servidas do cache do fornecedor não descontam buscas. Não estimar consumo somente por HTTP 200 ou pela presença de `error`; reconciliar o saldo.

Ao esgotar buscas ou ultrapassar throughput, a documentação de [status e erros](https://serpapi.com/api-status-and-error-codes) prevê **HTTP 429**. Tratar motivos separadamente, bloquear novas consultas e continuar manual/offline; não fazer retry em laço nem upgrade. Cache documentado de uma hora exige consulta e parâmetros idênticos, com `no_cache=false`; não pressupor cache hit para autorizar orçamento. Fonte: [Search API](https://serpapi.com/search-api).

## 3. APIs e cobertura brasileira

| API | Papel proposto | Dados úteis e limitações |
| --- | --- | --- |
| [Google Search](https://serpapi.com/search-api), engine `google` | Localizar candidato a partir de identificador/nome e domínio | Resultados orgânicos podem oferecer título, link e snippet; blocos de produto são opcionais. Consulta textual não é uma API de resolução de ASIN/MLB. Preço em snippet não confirma checkout. |
| [Google Shopping](https://serpapi.com/google-shopping-api), engine `google_shopping` | Descobrir produtos e referências de preço | Exemplos incluem título, fonte, preço textual/extraído, thumbnail, `product_link` e token Immersive quando disponível. Há layouts inline, categorizados e de shopping; não pressupor um único array. Link pode levar ao catálogo Google, não diretamente à loja. |
| [Google Immersive Product](https://serpapi.com/google-immersive-product-api), engine `google_immersive_product` | Obter detalhes/lojas do candidato selecionado | Exige `page_token`, normalmente obtido em busca anterior; não recebe diretamente ASIN ou URL da loja como substituto. `product_results.stores` pode conter loja, link, título, preço, frete e total. Padrão de 3–5 lojas; `more_stores=true` pode trazer até 13, conforme disponibilidade, numa busca. Paginação por `stores_next_page_token` exige nova chamada. Campos são opcionais. |

Para Search/Shopping, planejar `gl=br`, `hl=pt` e domínio Google brasileiro quando suportado, com localização pública consistente, sem enviar endereço residencial. **Brasil consta explicitamente na [lista Shopping GL](https://serpapi.com/google-shopping-countries)**. Immersive deve usar o token originado do resultado localizado; não inventar token nem assumir parâmetros não documentados. A documentação apresenta exemplo de loja Magazine Luiza, mas isso não comprova cobertura dos nossos produtos nem sucesso em todas as lojas brasileiras.

Um produto pode exigir uma chamada Shopping; duas com detalhes Immersive; três se Search for necessário para descobrir o nome/modelo antes de Shopping. Sem candidato ou token, não há garantia de completar a cadeia. Não paginar ou consultar todas as lojas por padrão. Não usar contratos antigos da Google Product API como se fossem os do Immersive; o [tutorial oficial atualizado](https://serpapi.com/blog/web-scraping-google-shopping-product-online-sellers-with-nodejs/) informa a substituição do serviço antigo.

### Identidade e condições comerciais

Nome genérico é evidência fraca. Preferir marca + MPN/modelo + variante; ASIN e SKU local só ajudam se o índice os expuser. GTIN/EAN deve vir de fonte confiável e ter formato/dígito verificador válido; nenhum GTIN foi identificado para os casos abaixo e nenhum será fabricado. SKU da loja, ASIN, código MLB e ID Google são identificadores de namespaces diferentes.

Exigir correspondência de geração, cor, capacidade/tamanho, quantidade, condição e região. Cloud III não é Earbuds II; `727A9AA` não é automaticamente `727A8AA`; Earbuds II preto `70N24AA` não é vermelho `705L8AA`. Identificadores conflitantes impedem confirmação automática. Resultado aproximado pode ser candidato para escolha humana, nunca preenchimento silencioso.

Preço de buscador deve ser rotulado como **encontrado no buscador**, com origem/data/moeda/condição. Não sobrescrever preço original, oferta manual ou registro existente. Só classificar como confirmado na loja mediante evidência direta compatível, ou confirmação expressa do proprietário com procedência distinta. Sem total final explícito, não converter percentual/cupom em preço; não comparar parcela com total nem moeda estrangeira com BRL. CEP, frete, seller, estoque, login e promoções pessoais podem mudar a oferta. Não há garantia documentada de PIX/cupom completo para cada resultado.

## 4. Matriz dos casos reais e plano de consultas

**Resultados SerpApi: não testados em todas as linhas.** As respostas HTTP abaixo são históricas, não novas requisições nesta fase. A matriz propõe investigação futura; sucesso simulado não comprovará compatibilidade real.

| Caso e entrada conhecida | Evidência disponível / importador atual | Identificação a avaliar e critério |
| --- | --- | --- |
| [Amazon a.co](https://a.co/d/0foLGgI8) | Antes: 301 para Amazon Brasil `/dp/B0GRWJ9QBR`, depois HTTP 200 com intersticial, sem Product. Host curto já autorizado; conteúdo não confirmado. | Buscar ASIN no domínio brasileiro; confirmar manualmente qual produto o compartilhamento representa antes de associá-lo a Earbuds II. Nunca deduzir modelo apenas pelo contexto da conversa. Search→Shopping→Immersive: até 3 chamadas, interrompendo sem correspondência. |
| [Mercado Livre exato](https://www.mercadolivre.com.br/fones-de-ouvido-com-fio-para-jogos-hyperx-cloud-earbuds-ii-d/up/MLBU4871586876?pdp_filters=item_id%3AMLB5097782981) | Com `pdp_filters` e sem query: antes HTTP 403. Não existe outro original publicitário fornecido. | `MLBU4871586876` é catálogo; `MLB5097782981` é anúncio. Pesquisar separadamente se necessário, sem confundir produto com seller/variante. Preservar filtro no original. Search+Shopping+detalhes pode consumir 3 ou mais; teto deve impedir expansão indiscriminada. |
| AliExpress | Falha física relatada; somente homepage `https://pt.aliexpress.com/` documentada, sem URL exato do produto/encurtador. Consulta automática da loja não habilitada. | Obter amostra real antes da POC; ID do item, variante e procedência devem ser confirmados. Não inventar identificador ou fixture representando produto real. A busca por nome pode retornar outro vendedor/kit. Caso bloqueado por falta de amostra. |
| [Shopee Earbuds II](https://shopee.com.br/Fone-de-Ouvido-Gamer-HyperX-Cloud-Earbuds-II-com-Microfone-Preto-70N24AA-i.301983687.20699569312) | Antes HTTP 200, shell JavaScript sem metadados utilizáveis. Consulta automática do app não habilitada. | Loja `301983687`, item `20699569312`; pesquisar `HyperX 70N24AA` e comparar com a oferta exata. Nome não identifica vendedor. Oficialidade/destino de eventual encurtador requer amostra, não wildcard. |
| [KaBuM 467535](https://www.kabum.com.br/produto/467535/headset-gamer-hyperx-cloud-iii-dts-drivers-53mm-usb-pc-ps5-ps4-xbox-series-x-s-xbox-one-nintendo-switch-mobile-preto-e-vermelho-727a9aa) | Antes HTTP 200, JSON-LD/NEXT utilizáveis; PIX explícito, cupom sem total não calculado. Não reproduzir preço histórico como atual. | SKU local `467535`, MPN `727A9AA`. Comparar modelo/cor e condição comercial, não somente título HyperX. Shopping+Immersive: até 2 chamadas. Controle positivo de metadados diretos, não prova SerpApi. |
| [KaBuM 483040](https://www.kabum.com.br/produto/483040/fone-de-ouvido-gamer-hyperx-cloud-earbuds-ii-driver-14mm-nintendo-switch-e-mobile-preto-70n24aa) | Antes nome/imagem, sem estoque/preço válido. Nesta pesquisa o índice público voltou a localizar a página e seu modelo `70N24AA`; isso não atualiza estoque/preço no Wish. | Caso de busca por MPN; rejeitar preço de variante/condição diferente. Divergência temporal entre índice e consulta anterior precisa ser medida, não resolvida escolhendo o menor número. |
| [Magalu aa0aaec2da](https://www.magazineluiza.com.br/fone-de-ouvido-gamer-hyperx-cloud-earbuds-ii-driver-14mm-nintendo-switch-e-mobile-preto-70n24aa/p/aa0aaec2da/ea/fngm/) | Antes HTTP 403. Página de produto real conhecida. | `70N24AA` + domínio; preservar código e eventual `seller_id`. Confirmar seller e oferta, não tratar catálogo agregado como anúncio original. |
| Casas Bahia | Antes somente homepage `https://www.casasbahia.com.br/` com HTTP 200; nenhum link de produto real utilizável. | Obter URL/sku e variante reais. Depois pesquisar modelo + domínio. Homepage/CDN não comprovam importação de produto. Caso bloqueado por falta de amostra. |

O Cloud III KaBuM `543665` / `727A8AA` continua apenas como fixture histórica, separada de preço atual. Consultas públicas por identificadores nesta pesquisa não substituem requisições à SerpApi: ausência de resultado não prova ausência no Google, e referências externas ao ASIN não confirmam o produto Amazon Brasil. Encurtadores Shopee/AliExpress não tiveram amostra real fornecida; não prometer resolução universal.

## 5. Arquitetura proposta e proteção da chave

Fluxo futuro: **ação explícita → serviço intermediário privado → cache/controle de cota → SerpApi → candidatos com procedência → confirmação**. Lista, edição, cadastro manual, imagens locais e SQLite continuam independentes da rede. Não usar SerpApi para abrir a lista ou salvar um desejo. Falha, indisponibilidade ou fim do gratuito desabilitam apenas a consulta opcional.

| Alternativa | Proteção/custo | Limite e recomendação |
| --- | --- | --- |
| Ferramenta local no computador, sem endpoint público | Chave apenas no processo servidor; arquivo de orçamento/cache separado do catálogo. Sem mensalidade de hospedagem; usa computador/conexão existentes. | Melhor primeira POC. Não oferece comparação permanente no celular quando o computador está desligado. Não abrir porta pública para contornar essa limitação. |
| Relay local para dispositivo de teste | Mesma chave fora da APK; pareamento revogável e rede restrita, TLS/canal seguro ainda precisam de desenho. | Etapa posterior, não parte da pesquisa. Segredo fixo embutido no app não autentica de modo confiável um serviço público. |
| Cloudflare Workers Free + contador durável | Candidata sem servidor pago obrigatório, com secrets no servidor e cota central. [Workers](https://developers.cloudflare.com/workers/platform/limits/) anuncia 100.000 requisições/dia no Free; [Durable Objects](https://developers.cloudflare.com/durable-objects/) permite armazenamento SQLite no Free, separado do SQLite Wish. | Requer conta/autorização futura, revisão de limites de CPU/storage/requests, configuração exclusivamente Free e autenticação. Quota de hospedagem não é quota SerpApi. Não contratar nem pressupor disponibilidade eterna. |
| Chave na APK, `EXPO_PUBLIC`, SQLite, GitHub ou frontend estático | Recuperável pelo cliente; não protege segredo nem consumo. | Rejeitada. Obfuscação não resolve. GitHub Actions não será usado como proxy público para buscas do celular. |

Os [secrets Workers](https://developers.cloudflare.com/workers/configuration/secrets/) são bindings cifrados, distintos de variáveis públicas de configuração. A [tarifação Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/) deve ser reconferida antes de escolher hospedagem. Não confundir o SQLite remoto do contador com proposta de migração/sincronização do banco do aplicativo. Nenhuma hospedagem foi criada.

### Controles obrigatórios antes de qualquer endpoint público

- Chave somente no servidor; nunca em logs, URLs de diagnóstico, respostas ao app ou commits. Account API e links de arquivo do fornecedor podem expor informações sensíveis; reduzir e filtrar respostas. Não enviar notas, desejos completos ou dados pessoais. Consultar apenas identificadores públicos necessários.
- Autenticação individual/pareamento revogável, limite por dispositivo e **global**, proteção contra replay e concorrência. CORS não é autenticação. Um token compartilhado compilado na APK continua extraível; não aprovar implantação pública com essa única barreira.
- Contador durável com reserva **atômica antes da chamada**, idempotência e uma única consulta em voo por chave de cache. Não confiar em contagem do cliente, memória descartável ou cache eventualmente consistente para o teto global.
- Proposta conservadora: teto **200 chamadas por ciclo**, **40 em janela móvel de uma hora**, até **3 por ação**, sem renovação antecipada, compra de créditos ou upgrade. Confirmar saldo Free real antes de liberar orçamento. Todas as chamadas tentadas são reservadas localmente; timeout após envio não devolve crédito automaticamente. Em incerteza, conservar reserva e reconciliar saldo, pois cancelar cliente não garante cancelar cobrança.
- Plano/saldo/ciclo desconhecido, contador indisponível, cota insuficiente, credencial inválida ou HTTP 429: falhar fechado, sem retry automático. Não resetar contador por relógio do celular ou na virada arbitrária do mês. Uso externo da mesma conta deve entrar no saldo; idealmente reservar a conta exclusivamente à POC.
- Endpoint aceita consulta curta estruturada/identificadores, engines permitidos e quantidade fixa de páginas. Não buscar URL arbitrário enviado pelo cliente. Construir chamadas no host SerpApi fixo; não seguir `serpapi_link`, redirects ou links de loja sem validação. Mantêm-se controles de destino, SSRF, tamanho e tempo. Nenhum mecanismo de proteção da loja será contornado.

Cache próprio proposto: chave por engine, identificador/modelo/variante, país/idioma/localização, página e versão da consulta; deduplicar URLs sem apagar seller/variante. Identidade candidata por até 24 h; preço até 1 h; negativo por 5 min, todos como parâmetros experimentais a revisar. Mostrar procedência/data mesmo após cache; dados antigos podem ser referência offline, não oferta atual. Atualização somente sob demanda; sem polling, pré-busca ao digitar ou varredura automática da lista.

A [política legal SerpApi](https://serpapi.com/legal) prevê retenção normal das buscas por 31 dias; não se assume ZeroTrace incluído no Free. Minimizar consultas/logs e avaliar direitos de imagens/conteúdo antes de armazenar ou redistribuir respostas. SerpApi é serviço terceiro, não API oficial do Google ou das lojas. Disponibilidade, termos e planos podem mudar; usar adaptador substituível e fallback manual permanente.

## 6. Estimativas mensais

Modelo conservador: toda chamada nova pode custar um crédito, sem contar descontos de cache/falha. `produtos = floor((cota − outras consultas) / chamadas por produto)`. Comparações futuras e paginações usam **o mesmo saldo**, não uma cota adicional.

| Chamadas por produto | Exemplo | Limite teórico com 250 | Orçamento sugerido de 200 |
| --- | --- | ---: | ---: |
| 1 | Shopping suficiente | 250 | 200 |
| 2 | Shopping + Immersive | 125 | 100 |
| 3 | Search + Shopping + Immersive | 83 | 66 |
| 4 | Cadeia de 3 + uma comparação/atualização | 62 | 50 |
| 5 | Descoberta + detalhes + consultas adicionais | 50 | 40 |
| 7 | 3 iniciais + 4 atualizações | 35 | 28 |

Exemplos: 50 produtos × 3 chamadas = 150; mais 25 comparações × 2 = 50, total **200**, com 50 de margem não liberada automaticamente. Cem produtos × 3 = **300**, excedendo Free em 50. Se toda semana quatro atualizações de duas chamadas forem feitas para cada um de 20 produtos, só as atualizações gastam **160**, antes de qualquer descoberta. Não renovar ofertas em segundo plano para sustentar uma comparação que o usuário não solicitou.

Com 50 créditos/hora e 3 chamadas por produto, o teto teórico é 16 produtos completos/hora; com o limite interno proposto de 40, são 13. Latência, respostas vazias e demais usos reduzem capacidade útil. Cache pode melhorar esses números, mas não integra a garantia de orçamento. Não há saldo de conta real nem data de renovação consultados nesta etapa.

## 7. Roteiro da POC — depende de nova autorização

1. **Preparar amostras/verdade de referência:** reunir URLs exatos faltantes de AliExpress e Casas Bahia; validar destino/modelo do a.co; registrar anúncio/seller/variante dos demais, nomes, MPN e GTIN apenas se comprovados. Separar exemplos positivos, negativos e sem preço. Não usar dados privados do catálogo.
2. **Autorizar ambiente e conta separadamente:** proprietário confirma Free sem cartão/compra/renovação antecipada. Conferir termos e saldo/renovação com Account API sem registrar resposta bruta. Chave fora do app/Git, fornecida apenas pelo mecanismo seguro do ambiente autorizado. Nenhuma alteração de SQLite, APK ou produção é necessária para essa POC local.
3. **Teto experimental:** no máximo **40 tentativas de busca no total**, dentro do saldo gratuito e de janela horária conservadora; até 3 por caso inicialmente. Matriz de oito linhas completas usaria até 24, deixando 16 para controles/duplicatas e comparação. Não iniciar linhas sem amostra nem consumir margem automaticamente. Parar no menor dos tetos local/conta e não substituir conta para superar limite.
4. **Executar cadeia mínima:** Search somente quando faltar identidade; Shopping localizado; Immersive apenas com candidato/token compatível. Separar chamadas de descoberta, detalhes, comparação, cache e paginação. Registrar engine, parâmetros públicos saneados, resultado/motivo, tempo, saldo antes/depois e crédito reservado. Ausência de candidato/token é resultado, não razão para consultas ilimitadas.
5. **Validar identidade e preço:** modelo/variante/seller/região corretos; controles Cloud III versus Earbuds II, vermelho versus preto, novo versus usado, kit versus unidade. Avaliar nome conhecido, somente ASIN/MLB e link opaco. Comparar moedas, frete, total, parcelas, estoque, PIX e cupom sem total. Preservar divergências e classificar preço como buscador, loja ou manual; não escolher menor preço de produto diferente.
6. **Validar segurança/custo e falhas:** consultas repetidas/concomitantes, cache, erro, timeout após envio, saldo zerado, HTTP 429/401, contador indisponível, mudança de ciclo e tentativa de URL arbitrário. Simulações comprovam somente controles locais; não contam como cobertura de loja real.
7. **Medir experiência:** tempos por etapa e p50/p95 de casos repetidos, incluindo aquecimento/cache e caminho manual. Comparar com o fluxo direto, sem prometer ganho antecipado. Meta experimental: fallback sempre disponível e primeira resposta útil em até 5 s na maioria dos casos; exceder a meta não deve ocultar erro nem alongar cascata. Amostra pequena não sustenta SLA.
8. **Critérios de decisão:** zero associação automática incorreta nos negativos; 100% de respeito aos tetos e segredo; relatório por loja com numerador/denominador de produto e variante corretos, cobertura de ofertas/links, latência, chamadas úteis e preços divergentes. Em ambiguidade, escolha humana/manual. Se custo, identidade ou proteção falharem, não promover integração. Sucesso técnico local ainda exige futura validação Android e autorização de alteração do app.

## 8. Entrega, verificações e preservação

Esta fase altera somente este relatório e uma referência no estudo anterior. Não executa POC, não adiciona dependências e não testa compatibilidade SerpApi real por loja. A validação documental inclui conferência do diff e das estimativas. **`npm run typecheck` e `npm run lint` aprovados nesta entrega**, sem erros ou avisos de código. Testes Node/SQLite, UI, Expo Doctor e Android não foram reexecutados por esta pesquisa documental; não se atribui nova aprovação a esses fluxos.

Não foram abertos bancos privados ou alterados dados, SQLite v5/migrações/backup, importação/preços, temas, package, assinatura, versão ou versionCode 5. Não há conta/chave criada, EAS Build, APK, cobrança, merge ou alteração da main/PR #5. PR #8 permanece em rascunho. Próxima ação permitida: somente após autorização explícita da POC.
