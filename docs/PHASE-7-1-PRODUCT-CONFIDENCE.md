# Fase 7.1 — motor experimental de confiança de produtos e ofertas

Implementação/validação offline em **21/11/2026**, base `9fb920359ff595f368223bdff5748fae0e91e68f`, branch `feature/android-preview-splash`. Base local/remota conferida limpa/sincronizada. PR #8 permanece aberto/em rascunho, sem merge.

## 1. Resumo e escopo

Criado módulo TypeScript isolado em [experiments/product-confidence](../experiments/product-confidence/README.md), independente da SerpApi e da interface, sem serviços externos ou dependências novas. O motor recebe dados normalizados, conserva evidências por campo e separa **produto**, **anúncio original** e **elegibilidade comercial**.

Não foi integrado ao aplicativo, importador, comparador ou banco. Nenhuma chamada SerpApi/Account API foi feita, mesmo com variável configurada. **Zero consultas, zero créditos adicionais e zero builds EAS** nesta fase. Os 236 créditos restantes são o último saldo observado na POC anterior, não saldo reconsultado agora. Nenhum código de produção, SQLite v5, dependência, estética, preço/PIX/cupom, package, assinatura ou versionCode 5 foi alterado.

Referências locais: [viabilidade](PHASE-7-0-SERPAPI-FEASIBILITY.md), [POC real](PHASE-7-0-SERPAPI-POC.md) e testes da [ferramenta anterior](../experiments/serpapi-poc/README.md). Não houve nova pesquisa externa de produtos ou condições comerciais.

## 2. Arquitetura e contratos

| Arquivo experimental | Responsabilidade |
| --- | --- |
| `contracts.ts` | Tipos de produto/identificador, evidência, procedência, preço/oferta, política, motivos e resultado. |
| `normalize.ts` | Fronteira de dados planos, limites, normalização conservadora de valores/escopos, GTIN, datas e inspeção sintática de URL. |
| `identity.ts` | Classifica produto e anúncio separadamente; conflito explícito prevalece sobre identificador/nome semelhante. |
| `prices.ts` | Centavos/unidades menores, parsing com locale/moeda explícitos, interpretação sem cálculo promocional e grupos comerciais separados. |
| `engine.ts` | `assess(input: unknown)`: valida/clona dados, avalia campos/ofertas, deduplica conservadoramente e retorna decisões auditáveis. |
| `fixtures.mjs` | Fábricas sintéticas e extratos sanitizados documentados, identificados separadamente. |
| `engine.test.mjs` | Suíte offline do motor. |
| `offline-only.cjs` | Bloqueio dos clientes de rede padrão do Node durante os testes. |
| `README.md` | Contratos, uso, comandos e limites operacionais. |

Cada campo contém `value`, `explicit` e `provenance`: tipo de fonte, identificador da fonte, data UTC e URL quando conhecida. Fontes: página da loja, índice de busca, manual, cache ou insuficiente. `cachedFrom` preserva contexto sem promover cache a confirmação atual. `timePrecision=day` conserva uma data conhecida apenas pelo dia, sem inventar horário ou certificar atualidade; meia-noite é somente representação canônica desse dia. As transcrições documentais usam essa precisão, enquanto controles sintéticos têm horários de teste explícitos. Produto inclui nome, marca, modelo, cor, variante, geração, capacidade, tamanho, quantidade, condição, papel produto/acessório, conectividade, categoria, loja, vendedor, URL, descrição e imagem.

Identificadores têm `scheme`, namespace e sua própria evidência: GTIN global, MPN por fabricante, SKU de loja, ASIN por plataforma, catálogo e anúncio. Um ASIN não confirma seller; catálogo pode agregar variantes; SKU de uma loja não equivale a SKU de outra. GTIN válido por checksum não prova que foi corretamente atribuído na origem.

Não se usa score ou probabilidade estatística. A política exige `now` explícito, moeda, limites de idade e finalidade (`original_listing` ou `comparison`); não se consulta relógio global. O resultado é determinístico para a mesma entrada/política e não altera os objetos do chamador.

`inputEvidence` conserva dados de identidade/procedência; `prices` conserva os fatos monetários mesmo rejeitados. Cada candidato retorna motivos, conflitos, âncoras, campos sugeríveis, campos para revisão e campos que devem permanecer vazios. Nenhum campo de preço é preenchido por mera confiança no nome ou identificador.

## 3. Critérios de identidade

| Classe | Regra |
| --- | --- |
| Exata | Âncora coincidente GTIN/MPN/ASIN com escopo correto, evidência explícita/fresca declarada direta ou manual, atributos relevantes cobertos e ausência de conflito. Não implica anúncio ou preço exatos. |
| Provável | Evidências coerentes, como âncora apenas indexada/antiga, catálogo coincidente ou marca/modelo, sem conflito explícito suficiente para rejeitar. Exige revisão. |
| Ambígua | Atributos relevantes faltantes, identificadores inválidos/múltiplos conflitantes ou apenas nome igual sem âncora. Nunca selecionada automaticamente. |
| Incompatível | Divergência explícita de identificador comparável ou atributo essencial, inclusive geração, modelo, variante, quantidade, condição e papel produto/acessório. |
| Não confirmada | Dados insuficientes para sustentar correspondência. Fallback manual preservado. |

As mesmas classificações não são confundidas com anúncio. Anúncio exato exige ID coincidente no mesmo namespace, loja/vendedor coerentes e evidências adequadas desses campos. IDs diferentes e seller/loja conflitantes impedem preencher o anúncio original. No modo comparação, outra oferta pode ser analisada como outro anúncio, mas nunca substituir silenciosamente o original.

Valores explícitos incompatíveis prevalecem mesmo com GTIN/MPN ou nomes semelhantes. Dados ausentes não são confirmação. Evidência indexada de cor/variante não herda confiança de identificador direto. Um identificador confirmado não promove descrição, imagem, preço ou estoque automaticamente.

Normalização usa NFKC, espaços e comparação de caixa, aliases pequenos/declaráveis de cor/condição/conectividade e separação numérica/unidade de capacidade. GB e GiB não são convertidos; BR:42 e EU:42 permanecem diferentes. Hífens significativos de códigos não são apagados genericamente. Um detector limitado de geração romana em nomes de base igual e de conectividade/acessório explícitos funciona como veto conservador; não é identificação geral de linguagem natural.

## 4. Regras monetárias e comerciais

Fatos separam preço anunciado, total informado, parcela, número de parcelas, à vista, PIX, final explícito com cupom, condicionado, anterior, frete e custos adicionais. Cada valor carrega moeda/procedência/data; `rawText` pode conservar texto não interpretável. Inteiros seguros em unidades menores: BRL em centavos, sem floats monetários aceitos como centavos.

`basis` deve ser explicitamente `product_total`, `delivered_total` ou `unknown`. **O nome bruto `price` ou `total` do fornecedor não determina essa base.** O produtor dos dados deve conservar `unknown` sem evidência. Não se calcula desconto, cupom percentual, juros, parcela vezes quantidade ou total entregue. Não há conversão de moeda.

Exemplos:

- **Real sanitizado ML:** parcela 2.739 centavos, 12 parcelas com juros e total informado 27.999 centavos são preservados separadamente. A base de preço à vista/entregue permanece desconhecida; R$ 27,39 nunca vira preço integral e R$ 279,99 não vira PIX ou à vista automaticamente.
- **Real sanitizado Magalu alternativo:** parcela 5.124 centavos e total informado 34.265 centavos não são atribuídos ao produto/código original aa0aaec2da. Mantidos contexto e seller do anúncio dd02de40cg.
- **Sintético de controle:** comum R$ 100,00, PIX R$ 90,00 e final explícito PIX+cupom R$ 85,00 geram um grupo comum e dois condicionais; não se escolhe o menor para sobrescrever os demais.
- **Sintético de cupom sem final:** código SAVE15 sem valor final não gera R$ 85,00 ou outro desconto calculado; preço comum confiável permanece independente.
- **Sintético conflitante:** dois preços integrais diferentes no mesmo grupo ficam para revisão; não há `min()` para resolver conflito.

Elegibilidade exige produto exato/variante compatível, integral interpretável, moeda comparável, evidência direta fresca de preço/estoque/contexto comercial, disponibilidade em estoque, quantidade/condição/papel conhecidos, loja/vendedor conhecidos e link comercial direto aparente. Frete de base `product_total` precisa de informação explícita; custos desconhecidos ou moedas conflitantes impedem ranking automático. Base de produto e base entregue nunca compartilham grupo.

PIX, cupom e condições adicionais têm grupos separados e exigem condições explícitas. Parcelas, preço anterior e cupons sem final não são preços integrais. Produto esgotado ou incompatível é rejeitado; índice, cache, fonte manual, informação antiga ou incompleta não entram automaticamente em comparação. Fonte manual continua útil para revisão, sem selo de confirmação de loja.

Não há ordenação de preços ou interface: somente listas de elegibilidade. Não existe selo de loja confiável. `direct` é classificação sintática da URL, não prova de comerciante, DNS, abertura, disponibilidade ou segurança de download.

## 5. Matriz de casos reproduzidos

As observações sanitizadas são transcrições/extrações do relatório anterior, não novas respostas da API. Não há seller, GTIN, estoque ou condição inventados para completar casos reais. Referências negativas ou dados auxiliares construídos para testar invariantes são marcados como **sintéticos/híbridos** nos testes.

| Caso | Tipo de evidência | Resultado esperado e validado |
| --- | --- | --- |
| Amazon B0GRWJ9QBR, Earbuds III vermelho | Candidato real indexado; referência negativa II construída para teste | ASIN indexado permanece provável/revisável. Expectativa II contra III é incompatível mesmo com ASIN igual. Nenhum preço de outro anúncio é atribuído. |
| ML original MLBU4871586876 / MLB5097782981 versus catálogo/anúncio retornado MLB29277855 / MLB3923893355 | Referência no link do proprietário e oferta real sanitizada | Anúncio incompatível; produto/variante insuficientes para confirmação; oferta não preenche o original. Parcela 27,39 e total 279,99 preservados. |
| KaBuM solicitado 727A9AA versus candidato 727A8AA | Variante incompatível real; preço baixo artificial apenas como teste negativo | Incompatível/rejeitado independentemente do preço. Não promove outra cor/modelo. |
| KaBuM: PIX explícito, cupom sem final, parcela, esgotado | Controles sintéticos das condições, sem afirmar nova disponibilidade real da loja | PIX separado; cupom sem total não calculado; parcela não integral; esgotado fora da comparação. As regras são genéricas, não adaptador fixo KaBuM. |
| Shopee, modelo 70N24AA e ID original documentado 301983687.20699569312 | Cenário sintético de mesmo modelo sem anúncio confirmado | Produto pode ser exato sob os dados sintéticos; anúncio permanece não confirmado e preço não preenche o original. Não comprova novo resultado Shopee real. |
| Magalu aa0aaec2da / 70N24AA | Candidato real indexado | Provável/revisável por modelo/catálogo; anúncio original não confirmado. |
| Magalu oferta alternativa dd02de40cg / seller nocnocestadosunidos | Oferta real sanitizada, identidade/variante incompletas | Sem atribuir preço ao aa0aaec2da; valores 51,24/342,65 conservados para auditoria. |
| Roupas: tamanhos/cor e escala regional | Sintético | BR:M versus BR:L ou EU:42 versus BR:42 incompatíveis. |
| Casa: recipientes, capacidade e kit/unidades | Sintético | Quantidade/capacidade diferentes incompatíveis, mesmo identificador textual semelhante. |

Nenhuma oferta real indexada deste lote foi promovida a oferta diretamente confirmada/elegível. Isso é resultado deliberadamente conservador, não falha mascarada por fixtures. Positivos elegíveis/condicionais usam dados **sintéticos completos** para validar as regras, não para alegar compatibilidade com loja.

## 6. Duplicação, procedência e saídas

Uma oferta pode ser do produto correto e ainda ser inadequada comercialmente. As saídas separam `eligibleOffers`, `conditionalOffers`, `reviewOffers` e `rejectedOffers`. Cada quote preserva moeda, base, condição/cupom, quantidade e grupo; tipos distintos não são misturados. Nenhum resultado salva ou modifica desejo.

Duplicatas idênticas não entram duas vezes. Cópias da mesma URL/contexto com valores, disponibilidade ou evidências conflitantes vão para revisão; esgotado continua rejeitado. IDs repetidos de oferta não permitem introduzir uma segunda cotação elegível. Essa revisão corrigiu um risco em que a primeira cópia em estoque poderia sobreviver a outra cópia contraditória.

`fields.suggest` contém evidência individual adequada de candidato exato; `review` conserva necessidade de revisão sem promoção da fonte; `empty` impede sugestões inválidas/incompatíveis. `inputEvidence` permite auditar também campos revisáveis. A URL original não é silenciosamente substituída pelo link de outro anúncio. `manualRequired` não equivale a validação do formulário Wish ou autorização de salvamento: indica ausência de nome sugerível com produto exato.

## 7. Segurança e validação

A fronteira `assess` aceita dados planos, clona sem invocar getters e rejeita funções, protótipos personalizados, chaves de poluição, arrays esparsos, ciclos, NaN, Infinity e BigInt. Valida enums sem coerção de objetos. Strings com HTML/instruções não são executadas; não há eval, interpretador, comando de sistema ou cliente de rede no motor.

Limites: string de 4.096 unidades UTF-16; 128.000 bytes UTF-8 somados de chaves/textos; 6.000 nós; profundidade 14; até 100 elementos/array; 30 candidatos; 30 ofertas/candidato; 40 fatos de preço/oferta. Inteiros monetários até 10^12 unidades menores, quantidade até 10.000 e parcelas até 360. São limites experimentais de processamento, não alteração dos limites do app ou medida exata de heap/JSON. Datas UTC inválidas/futuras e dados antigos não recebem confiança atual.

O preloader offline bloqueou clientes padrão `fetch`, HTTP/HTTPS e TCP/TLS durante os testes. Não é sandbox contra código JavaScript hostil no próprio runtime; o contrato esperado é JSON desserializado, não Proxy/objeto executável. Uma futura UI deverá escapar texto e uma futura camada de rede deverá validar DNS/IP/redirecionamentos. Esta fase não implementa essa arquitetura.

Validação final:

| Verificação | Resultado |
| --- | --- |
| Motor experimental | 103 testes aprovados |
| Testes existentes da POC | 5 aprovados, sem iniciar CLI/API |
| Regressões Node/SQLite existentes | 127 aprovados |
| Total | **235 aprovados, 0 falhas, 0 pulados/cancelados** |
| TypeScript | Aprovado |
| ESLint | Aprovado, sem erros/avisos de código |

Cobertura: equivalência/conflito/escopo de IDs, dados ausentes, gerações, fio/sem fio, cor, tamanho/capacidade, novo/usado/recondicionado, principal/acessório, unidades/kits, anúncio/seller, preços e condições, frete, estoque, moeda inválida/estrangeira, duplicatas, cache/idade, links indiretos/inválidos, dados adversariais, coerção/getters, limites e determinismo/imutabilidade. Casos positivos, negativos e ambíguos permanecem separados.

O TypeScript inicialmente encontrou um erro no tipo de `cachedFrom`, corrigido sem relaxar os contratos. A validação final passou após as correções adicionais. Node mantém o aviso conhecido `MODULE_TYPELESS_PACKAGE_JSON` ao carregar TypeScript via strip-types; package.json não foi modificado para ocultá-lo. Log local de testes em `.expo/phase71-offline-tests.log`, ignorado no Git.

Não executados: navegador/UI, Expo Doctor, APK, testes físicos Android ou nova validação de lojas. Esses fluxos não recebem aprovação por esta entrega.

Comando consolidado reproduzível, na raiz:

```powershell
node --require ./experiments/product-confidence/offline-only.cjs --experimental-strip-types --test experiments/product-confidence/engine.test.mjs experiments/serpapi-poc/guards.test.cjs tests/*.test.mjs
npm run typecheck
npm run lint
```

## 8. Publicação e preservação

Dez arquivos desta entrega: os nove do módulo descritos na arquitetura e este relatório. Commits separados por responsabilidade: motor/contratos; fixtures e validação offline; documentação. Hashes finais e autoria associada a DanielSln são conferidos no GitHub e registrados na entrega/PR, sem autorreferência de hash no próprio commit.

Nenhuma resposta bruta, chave, token ou cache privado é publicado. Arquivos revisados antes do commit; logs temporários permanecem ignorados. Nenhuma diferença em produção, SQLite/migrações/backup, dependências, app.json/eas.json, assets ou configuração Android. Não se leu/alterou catálogo privado do aplicativo. main e PR #5 preservados, sem reescrita de histórico ou merge.

## 9. Limitações e parecer

O motor aplica regras ao que o normalizador declara. Não autentica a origem, verifica página ao vivo, certifica GTIN/MPN atribuído ou prova que `store_page` é verdadeiro. Essa fronteira de confiança precisa ser resolvida pelo produtor futuro, não pela confiança textual do payload. Índice e manual permanecem fontes distintas da confirmação direta comercial.

Vocabulários/heurísticas são limitados, não um identificador universal de linguagem natural. Não há conversão de unidades, equivalência universal de tamanhos, câmbio, catálogo global, identificação por imagem ou adaptação SerpApi. Moedas suportadas são explicitamente limitadas; parsing textual de duas casas não cobre moedas de escalas diferentes. Identidade e oferta podem exigir mais revisão do que a experiência final desejada; não se reduz o rigor para aumentar resultados.

**Pronto como componente experimental validado offline; não pronto para integração automática irrestrita.** Recomendada uma revisão futura do contrato do produtor e dos critérios de evidência por campo, seguida de testes autorizados de adaptadores/normalizadores antes de qualquer interface ou serviço intermediário. Ofertas condicionais devem continuar separadas e a lista local/manual independente da rede.

**Aguardar autorização explícita antes de iniciar arquitetura de serviço intermediário ou integrar qualquer componente ao Wish.**
