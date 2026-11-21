# Fase 6.4 — cadastro universal e importação assistida

Implementação e validação técnica em 20/11/2026, na branch feature/android-preview-splash, PR #8 aberto/em rascunho. Base conferida limpa e sincronizada: bce9227b7e00c1561bf3c71d93761a7fe29dae84. A aprovação física 20/22 da APK v4 é informação do proprietário e antecede este código. Não aprova a Fase 6.4.

## Resultado e alcance

Qualquer loja com endereço HTTPS público válido pode seguir com cadastro compacto, sem editar o endereço manualmente. Consulta automática permanece restrita aos destinos exatos revisados: o cliente não oferece inspeção/pinning de DNS/IP. Esta é a alternativa de segurança expressamente autorizada, não uma promessa de extração automática de todas as lojas.

- Texto compartilhado: encontra URLs, remove apenas delimitadores externos reconhecíveis, mantém parâmetros, apresenta escolha explícita quando há mais de um link; nenhum destino é consultado antes da escolha. Limites: 16.384 caracteres de entrada, 20 candidatos e 8.192 caracteres por URL. Imagens continuam com o limite anterior de URL.
- Links Google com wrapper explícito /url e um único destino q/url são decodificados localmente, até três níveis, sem consultar o Google. Outros formatos de Shopping permanecem manuais. O endereço Google original continua preservado. Cobertura deste wrapper é simulada; não houve amostra real fornecida desse formato.
- original_url recebe o link original escolhido, incluindo parâmetros e fragmento. O endereço HTTP consultado não envia fragmento; aparece em resolved_url transitório e em Origem, dentro de offer_details já existente. Nenhuma coluna ou migração nova. Não se removem parâmetros publicitários ou essenciais automaticamente, nem se reescrevem registros antigos.
- Prévia completa, parcial ou manual mantém Desejar, preço/imagem opcionais, nome e categoria obrigatórios, sugestão válida e prioridade Média, edição opcional, cancelar sem alterar a prévia, trava contra duplo toque e recuperação de falha de gravação. A categoria escolhida manualmente prevalece sobre novas sugestões do nome.
- Falhas de política, redirecionamento não verificável, HTTP 403/429, indisponibilidade, conexão, JavaScript, ausência de metadados e identidade não confirmada têm mensagens próprias; o preenchimento manual simplificado conserva o link. Há nova tentativa explícita para a consulta, sem retries automáticos de bloqueios.

## Arquitetura e segurança

import-links separa reconhecimento/normalização da autorização de rede. import-policy contém destinos exatos, famílias de redirecionamento e CDNs revisadas; não é uma lista obrigatória de adaptadores. product-import usa parser genérico e só consulta destinos aprovados; extractPrices mantém o adaptador KaBuM quando o JSON público exige tratamento específico.

Todos os redirecionamentos usam modo manual: HTTPS, sem credenciais/portas não padrão, família original preservada, no máximo quatro saltos, ciclos recusados, Location obrigatório e status 301/302/303/307/308. a.co só segue na família Amazon Brasil; meli.la somente Mercado Livre. Resposta que mudou de endereço sem validação é rejeitada. Limites mantidos: 12 segundos globais, HTML até 2.000.000 bytes por streaming, cancelamento e liberação do reader, sem fallback de buffering irrestrito. Sem cookies, login, CAPTCHA, proxy de evasão ou execução de scripts.

No SDK instalado, expo/android/src/main/java/expo/modules/fetch/NativeRequest.kt desativa followRedirects e followSslRedirects para modo diferente de FOLLOW; também usa NO_COOKIES quando credentials não é INCLUDE. A inspeção do código do SDK sustenta a estratégia, mas não substitui teste físico do transporte. Na web, redirecionamento opaco ou CORS que impeça verificar o destino falha fechado e oferece cadastro manual; não é habilitado follow como atalho.

O JavaScript de expo/fetch e do navegador não expõe o conjunto de IPs resolvidos nem o IP efetivamente conectado, e não permite fixar resolução e conexão numa operação atômica. Consultar DNS separadamente não elimina TOCTOU/rebinding. Rejeitar IP literal, localhost e sufixos locais é apenas uma camada, não proteção suficiente para hosts arbitrários. Portanto hosts desconhecidos, inclusive nomes públicos que poderiam resolver para redes privadas, NÃO são consultados automaticamente. Destinos revisados/CDNs ainda dependem de DNS/TLS do sistema e da confiança nos operadores; não se declara proteção absoluta contra DNS rebinding. Uma ampliação irrestrita exigiria arquitetura/controle de transporte adicionais e outra autorização.

Shopee shope.ee/s.shopee.com.br e AliExpress a.aliexpress.com/s.click.aliexpress.com não foram habilitados. A ajuda oficial da Shopee confirma Copiar Link/Copiar Informações, mas não forneceu nesta consulta uma cadeia real desses hosts para revisão. A página pública AliExpress tampouco forneceu uma amostra utilizável de encurtador. Permanecem cadastro manual e investigação futura com link real; nenhuma URL/token foi inventada ou simulada como comprovação real.

## Extração, identidade e imagens

JSON-LD Product/Offer, @graph, mainEntity, ProductGroup.hasVariant, Open Graph, microdados HTML e JSON público __NEXT_DATA__ são lidos sem executar conteúdo. O novo leitor de microdados honra aspas, content/href/src/datetime, escopos aninhados e múltiplas propriedades; limites de 64 níveis, 30.000 tokens, 100 produtos, tag de 16 KiB e texto por nó de 10.000 caracteres. Ignora itemref externo, scripts e chaves de protótipo; não é um navegador/DOM completo.

Múltiplos produtos só são selecionados quando há um único identificador/endereço compatível. ASIN, ID KaBuM, produto MLBU, anúncio MLB e parâmetros explícitos sku/variant/variantId/seller_id/item_id são considerados sem apagar os originais. Produto de catálogo e anúncio Mercado Livre são identidades separadas. Identidade conflitante não fornece preço; lista ambígua pode conservar título/descrição da página, mas não imagem ou preço arbitrário. Quando um registro entre vários é escolhido, valores e imagens globais OG não são emprestados de outra variante. Ausência de identificadores/evidência não permite confirmar variantes ou vendedores por adivinhação.

Mantidos seletor de resoluções declaradas, proporção, carregamento, editor, fotos privadas, armazenamento e imagens antigas. Nenhuma foto já salva foi substituída. Novos hosts exatos revisados: imgs.casasbahia.com.br e www.casasbahia-imagens.com.br (HTML da homepage oficial), ae-pic-a1.aliexpress-media.com (homepage AliExpress), wx.mlcdn.com.br (resposta pública Magalu). Só podem ser usados por metadados do produto da própria família; não se aceitam sufixos genéricos ou imagens de outra loja. A observação de um host no HTML não comprova uma imagem de produto funcionando no Android. Shopee não apresentou CDN de produto verificável neste HTML; imagens de screenshots da central de ajuda não foram promovidas a CDN de produto. AliExpress continua manual em rede, apesar de seu parser reconhecer o host de imagem revisado.

## PIX, cupom, moeda e divergências

O adaptador KaBuM aceitava priceWithDiscount apenas quando menor que price. Agora aceita igualdade quando a condição visível à vista no PIX está presente e os demais requisitos de produto, vendedor, estoque, moeda, datas e elegibilidade passam. Igualdade sozinha não cria condição PIX. A apresentação mantém o rótulo explícito em empate; cupom empatado não substitui o preço incondicionado. Não há cálculo percentual, combinação presumida ou conversão de moeda. Moeda estrangeira fica registrada como evidência, sem preencher preço em BRL. Totais explícitos com cupom/PIX + cupom e evidências de banners continuam cobertos pelas regressões 6.3.

Na consulta real, 467535 anunciou R$399,99 e o campo PIX também R$399,99, com texto explícito PIX. O resultado preservou essa condição. HYPERX15 apareceu como cupom anunciado, mas sem total final confirmado: price_cents do cupom permaneceu nulo. Isso NÃO confirma que toda divergência numérica física foi corrigida; faltam os pares exatos de valores e condições mostrados no aparelho/loja durante as reprovações. Nenhum valor histórico foi incorporado ao código de produção.

## Consultas públicas reais — separadas dos testes

Observação: 2026-11-21T02:09:00Z = 20/11/2026 23:09 America/Sao_Paulo. GET público limitado em Node, sem cookies nem renderização JavaScript; não é expo/fetch Android e não está sujeito ao mesmo CORS do navegador. Resultados podem mudar. O resumo sanitizado ficou em .expo/phase64-real-observations.json, ignorado pelo Git. Não foram armazenados cookies, sessões, HTML privado ou identificadores publicitários do usuário.

| Loja/caso | Resposta real | Estado desta implementação |
| --- | --- | --- |
| Amazon a.co/d/0foLGgI8 | 301 para www.amazon.com.br/dp/B0GRWJ9QBR; 200/3.905 bytes, Continuar comprando, sem Product/OG de produto | Resolução restrita implementada; intersticial identificado e cadastro compacto manual. Produto/variante não confirmados. |
| Mercado Livre MLBU4871586876 + pdp_filters item_id:MLB5097782981 | Com e sem pdp_filters: 403/2.585 bytes | Preserva filtro essencial; simplificar não removeu o bloqueio. Não há comprovação de importação automática real. meli.la coberto por testes de transporte simulados, sem amostra curta real nova. |
| KaBuM 467535, Cloud III 727A9AA | 200/132.987 bytes; JSON-LD, dados públicos, imagem, preço e PIX R$399,99; cupom sem total | Extração real parcial/completa dos campos confirmados; classificação PIX igual corrigida. Aplicação de cupom não verificada. |
| KaBuM 483040, Earbuds II 70N24AA | 200/115.567 bytes; nome/imagem, oferta indisponível | Importação parcial, preço não preenchido; não promove preço de item sem estoque. |
| KaBuM 543665, Cloud III 727A8AA | Não consultado como preço atual | Somente fixture histórica de regressão preservada. |
| Shopee Earbuds II, loja 301983687/anúncio 20699569312 | 200/210.180 bytes; Please enable JavaScript, sem Product/OG utilizável | Manual universal; extração automática NÃO comprovada e host de rede não habilitado. Sem execução/bypass. |
| Magalu Earbuds II aa0aaec2da | 403/1.242 bytes | Destino revisado, bloqueado nesta consulta; manual. CDN observada não equivale a produto importado. |
| Casas Bahia | Homepage oficial 200/341.991 bytes; não foi obtido link utilizável de produto nesse HTML | CDNs específicas revisadas; produto real não testado, cadastro manual disponível. |
| AliExpress | Homepage pt.aliexpress.com 200/415.496 bytes; sem amostra utilizável de produto/encurtador | CDN específica revisada; rede automática não habilitada; manual. |
| Youcom | Sem nova consulta real nesta sessão | Parser/regressões anteriores e microdados simulados aprovados; isso não comprova todos os produtos atuais. |
| Outra loja HTTPS pública | Nenhuma consulta arbitrária | Cadastro universal compacto, URL/domínio preservados; sem promessa de extração automática. |

Fontes reais: [Amazon compartilhado](https://a.co/d/0foLGgI8), [Mercado Livre exato fornecido](https://www.mercadolivre.com.br/fones-de-ouvido-com-fio-para-jogos-hyperx-cloud-earbuds-ii-d/up/MLBU4871586876?pdp_filters=item_id%3AMLB5097782981), [KaBuM 467535](https://www.kabum.com.br/produto/467535/headset-gamer-hyperx-cloud-iii-dts-drivers-53mm-usb-pc-ps5-ps4-xbox-series-x-s-xbox-one-nintendo-switch-mobile-preto-e-vermelho-727a9aa), [KaBuM 483040](https://www.kabum.com.br/produto/483040/fone-de-ouvido-gamer-hyperx-cloud-earbuds-ii-driver-14mm-nintendo-switch-e-mobile-preto-70n24aa), [Shopee](https://shopee.com.br/Fone-de-Ouvido-Gamer-HyperX-Cloud-Earbuds-II-com-Microfone-Preto-70N24AA-i.301983687.20699569312), [Magalu](https://www.magazineluiza.com.br/fone-de-ouvido-gamer-hyperx-cloud-earbuds-ii-driver-14mm-nintendo-switch-e-mobile-preto-70n24aa/p/aa0aaec2da/ea/fngm/), [Casas Bahia homepage](https://www.casasbahia.com.br/), [AliExpress homepage](https://pt.aliexpress.com/).

O Mercado Livre usado foi exatamente o informado pelo proprietário; não há outro original com matt_*/gclid para comparar. Não foram inventados esses parâmetros. No diagnóstico anterior, as formas com publicidade e simplificada da KaBuM retornaram os mesmos campos; nesta implementação a nova consulta usou o endereço sem publicidade. O app mantém integralmente os parâmetros fornecidos.

## Validação técnica

- 115 testes Node/SQLite aprovados; 0 reprovados, pulados ou cancelados no resultado final. Baseline 89 preservada + 26 novos testes. SQLite real de teste isolado, sem abrir o catálogo do proprietário.
- TypeScript e ESLint aprovados, sem erros/avisos no código final.
- 11 suítes Playwright/Chrome aprovadas nos resultados finais após reexecuções: phase64, phase63, phase63-images, navigation, import-flow, store-readiness, smart-details, promotions, expandable-description, phase61 e phase62. Sem pageErrors nos resultados aprovados.
- Export web de produção aprovado: node node_modules/expo/bin/cli export --platform web --output-dir .expo/phase64-export --max-workers 2; saída conclusiva Exported. Não gera APK nem usa EAS.
- Expo Doctor 19/20. Mesma verificação de versões pendente: @expo/ui 58.0.28→~58.0.29, expo 58.0.25→~58.0.26, expo-file-system 58.0.13→~58.0.14, expo-router 58.0.31→~58.0.32, expo-sqlite 58.0.17→~58.0.18 e expo-web-browser 58.0.8→~58.1.0. Sem atualização ou ocultação.

Novas regressões: texto compartilhado/múltiplos links, wrappers, fragmentos e parâmetros essenciais, URL longa, zero rede em host desconhecido, a.co e famílias de redirects, limites/ciclos/privados/protocolo, microdados e limites do parser, parcial sem nome, múltiplos produtos/variantes/identidade ML, não emprestar OG de outra variante, intersticiais/JS, mensagens 403/429/conexão, PIX igual com/sem evidência, cupom sem total, moeda estrangeira, indisponibilidade, CDNs por família e chaves de protótipo. Regressões anteriores mantêm banners, totais com cupom/PIX + cupom, conflitos, falha de gravação/retry, duplicação, edição/cancelamento, imagens pequenas/grandes, fotos, notas, categorias, ofertas, comprados, SQLite após reabrir, temas claro/escuro/automático e funcionamento offline com app carregado.

As primeiras execuções revelaram expectativas antigas de redirect/original_url/mensagens, corrigidas para o comportamento autorizado sem remover assertivas de segurança/persistência. Lint detectou dependência derivada não estável; seleção de links passou a usar useMemo. O novo cenário offline tentou abrir módulos web ainda não baixados do servidor Expo; a boundary exibiu a mensagem genérica de banco. O roteiro final carrega lista/detalhes/edição online antes do modo offline e verifica cadastro/detalhes/persistência. Inicialização web fria ou rota ainda não carregada sem rede NÃO foi aprovada nem corrigida: o app web de desenvolvimento não é um PWA offline. Não se mudou o banco ou a boundary para esconder a falha. Esse limite não comprova um erro no SQLite nativo nem aprova execução no Android.

Capturas locais ignoradas em .expo incluem phase64-manual-dark-320-scaled, phase63-light-320 e cenários anteriores. Inspeção visual e asserções de viewport não encontraram sobreposição/overflow horizontal. CSS ampliado e foco/rolagem web não equivalem a fontScale, leitor de tela, teclado Android ou gestos físicos. Playwright/Chrome já disponíveis no ambiente externo foram usados sem instalar dependências no projeto.

Repetir: npm test; npm run typecheck; npm run lint; npx expo-doctor; export web acima. As suítes tests/ui exigem Chrome/Playwright externos e WISH_TEST_URL, WISH_PLAYWRIGHT_MODULE, WISH_CHROMIUM_PATH configurados. Servir a branch compatível via npm start, usar perfis de teste isolados e nunca o banco do usuário. Os logs/exportações/capturas estão em .expo, fora do Git.

## Arquivos e commits

Produção:
- src/services/import-links.ts, import-identity.ts, import-messages.ts e product-microdata.ts: novos módulos.
- src/services/product-import.ts, import-policy.ts e import-prices.ts: integração, transporte, CDNs e PIX/moeda.
- src/domain/price-presentation.ts e product.ts: condição em empate e limite do link original.
- src/app/products/import.tsx, src/app/(tabs)/add.tsx e src/components/product-form.tsx: entrada compartilhada, escolha, fallback compacto e link longo na edição.

Testes:
- tests/phase64-universal.test.mjs e tests/ui/phase64.cjs: novos.
- tests/import.test.mjs, tests/smart-import.test.mjs; tests/ui/import-flow.cjs, phase62.cjs, smart-details.cjs e store-readiness.cjs: adaptação de expectativas/seletor, preservando verificações anteriores.
- README.md e este relatório: estado atual, limites e roteiro.

Commits da entrega, exclusivamente na branch existente:
- 4a6e2e94b05f386e23cfa5a8472d2e6a0c8f85e8 — feat: support shared product links and safe universal import fallback.
- 6e42071ded053d77d866be04906382400ba2608b — test: cover universal imports redirects variants and equal PIX prices.
- Commit documental posterior, contendo este relatório e README: docs: record universal import validation and store limitations. O hash fica no histórico e no relatório final do PR, evitando autorreferência de hash no próprio commit.

## Preservação e próxima validação

Sem alterações em src/data, migrações, backup, dependências/lockfile, app.json/eas.json, assets, package, assinatura ou versionCode. Wish 1.0.0/versionCode4 e SQLite v5 mantidos. Não se abriu/reescreveu/apagou o catálogo privado, imagens, preferências ou registros antigos. main permanece 29dea24eeddbb2cb4f04caf48b70c1f35e710f11 e PR #5/feature/supabase-backup permanece 4fa742acfcf1d74adadcbe1d5bda320ce3f16cde na conferência de entrega. Sem migração, nova dependência, conta/chave, serviço pago, SerpApi/Supabase, EAS Build, APK ou merge. Custo obrigatório novo: R$0.

Checklist físico, ainda pendente:
- Colar links/textos de apps e Google Shopping; escolher corretamente entre vários; conferir anúncio, vendedor, variante e link aberto na loja.
- a.co/meli.la no transporte Android: saltos aprovados ou fallback claro; bloqueios sem insistência/bypass.
- KaBuM 467535: registrar valores atuais da loja e do Wish, PIX igual e cupom sem total; 483040 indisponível sem preço inventado; final explícito com cupom/PIX + cupom quando disponível. Não exigir valores históricos fixos.
- Desejar completo/parcial/manual, obrigatório ausente, duplo toque, edição/cancelamento, falha/retry, categoria manual e prioridade.
- Teclado/rolagem Android, 320px equivalente, fontScale ampliado, TalkBack, temas e seções expansíveis.
- Imagens/CDNs realmente disponíveis e fotos privadas antigas; sem troca automática.
- Instalar eventual atualização sobre v4 sem desinstalar/limpar, conferir desejos/categorias/ofertas/notas/comprados/tema e reabrir em modo avião. Migração histórica v4→v5 continua sem aprovação física.

É razoável solicitar autorização separada para preparar a futura preview v5, com estes limites aceitos e o roteiro físico acima. Esta entrega NÃO prepara versionCode5 nem compila. A disponibilidade automática de todas as lojas e as divergências físicas numéricas ainda não confirmadas não são critérios já aprovados. PR #8 permanece aberto/em rascunho e sem merge; aguardar autorização explícita antes de preparar ou compilar a próxima APK.

Referências: [Expo SDK58/fetch](https://docs.expo.dev/versions/v58.0.0/sdk/expo/), [Schema.org Product](https://schema.org/Product), [Offer](https://schema.org/Offer), [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [compartilhar produto Shopee](https://help.shopee.com.br/portal/4/article/76199-). Documentação não é autorização para contornar bloqueios nem comprovação de importação em loja real.
