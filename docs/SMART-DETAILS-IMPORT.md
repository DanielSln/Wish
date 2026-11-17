# Detalhes compactos, notas pessoais e importação — 16/11/2026

Branch feature/expo-go-readiness, PR #6. Main e PR #5 preservados, sem merge ou serviços pagos. SDK 58 mantido, sem dependências novas.

## Interface e notas

Seu desejo mantém foto, nome, categoria, prioridade, status, preços e descrição expansível. URLs e parâmetros não são renderizados como linhas técnicas. Ver na loja abre a URL armazenada; os campos original_url/image_url continuam no SQLite e no editor, sem apagar valores. As datas técnicas também deixaram o resumo principal.

Anotações pessoais tem lápis, Adicionar anotação quando vazia e editor integral inline com Salvar/Cancelar. Falha de gravação mantém o rascunho. Outros atalhos são desabilitados durante a edição e a navegação de saída é bloqueada até salvar/cancelar. Quebras de linha são preservadas. Nova importação não preenche notas pessoais.

Ofertas e condições usa o resumo expansível para referências anteriores, PIX, cupons e condições conhecidas da importação. O conteúdo comercial continua apenas informativo; preços/cupom não são calculados ou aplicados de forma nova.

## Migração segura: SQLite v2 → v4

A migração transacional acrescenta duas colunas TEXT NOT NULL DEFAULT '' em products: personal_notes e offer_details. Não modifica nem limpa notes antigo, UUIDs, imagens, URLs, categoria, preços, status, descrição ou aparência.

Não existe proveniência confiável nos textos antigos: o usuário podia ter editado as informações geradas pelo importador. Portanto, **nenhum prefixo ou palavra-chave é usado para classificá-los**. Todo notes anterior fica integralmente acessível no bloco neutro Texto preservado de versões anteriores. Revisar texto anterior nas minhas anotações abre uma cópia para decisão explícita; Cancelar não grava e o original continua preservado mesmo após Salvar. As notas novas são exclusivamente o que foi escrito/confirmado pelo usuário.

O número 3 já é utilizado na branch independente do Supabase. Esta branch não tenta reinterpretar esse esquema: um banco v3 é recusado sem remoção de dados. Volte à versão que o criou, sem reinstalar/limpar armazenamento. A integração futura do PR #5 precisará conciliar cumulativamente migrações e os novos campos; esse PR não foi modificado. Bancos acima de v4 também são recusados. Após migrar para v4, versões antigas do aplicativo que só leem v2 não devem ser usadas no mesmo banco.

## Mercado Livre e meli.la

Antes, meli.la não estava na lista exata de hosts e todos os redirecionamentos eram recusados. A consulta era rejeitada antes de fazer rede.

Agora só um fluxo iniciado em https://meli.la pode resolver redirects manualmente. Aceita no máximo quatro saltos, valida cada Location antes de consultar, detecta ciclos, exige HTTPS público sem credenciais/IP/portas fora do padrão e limita os destinos aos hosts exatos meli.la, mercadolivre.com.br, www.mercadolivre.com.br e produto.mercadolivre.com.br. A página final precisa ser do Mercado Livre. Não aceita outras lojas nem subdomínios arbitrários, IPs locais ou URLs semelhantes.

O transporte Expo SDK 58 Android foi inspecionado: redirect:manual desabilita followRedirects/followSslRedirects. Os hops compartilham o mesmo timeout total de 12 segundos; corpos dos redirects são cancelados. A página final mantém o limite de 2 MB e validações de HTML. Se o navegador devolver opaqueredirect sem Location/status inspecionável, falha de forma segura, sem usar follow como alternativa. As outras lojas continuam com redirect:error.

A URL real https://meli.la/1pXnAoY recebeu HTTP 403 na consulta sem seguir redirects deste ambiente. Não se afirma ter resolvido ou extraído esse produto real. O host passa a ser aceito pelo validador; a cadeia foi testada com respostas simuladas. Um bloqueio da loja não é contornado. Preencher manualmente conserva o link curto; em resolução bem-sucedida, conserva a URL final validada do produto. O botão Ver na loja pode abrir o endereço no navegador da escolha do usuário.

## Categoria sugerida

Regras locais sem IA/rede normalizam acentos e palavras. Nome é avaliado primeiro; categoria textual fornecida pelo Product JSON-LD e descrição podem ajudar na ausência de correspondência no nome. Headset/monitor/notebook sugerem Tecnologia, sofá sugere Casa e camiseta/tênis sugerem Roupas, desde que a categoria exista. Categorias específicas do usuário, como Headsets ou Periféricos, têm preferência quando há correspondência.

Nada é criado. Ambiguidade ou ausência de categoria compatível deixa a seleção vazia; como o banco exige categoria, o usuário escolhe antes de salvar. A sugestão fica visível nos chips. A primeira escolha manual (inclusive criar categoria) bloqueia mudanças automáticas posteriores. Edição de produto existente preserva a categoria, sem reclassificação por nome.

## Validação

35 testes Node/SQLite aprovados, zero falhas/skips. Incluem rollback após o primeiro ALTER, integridade de notas antigas mesmo com prefixo comercial, notas novas separadas, bloqueio do esquema experimental v3, categorias locais e customizadas, redirects válidos, ciclos, excesso de saltos, hosts/IPs inseguros, respostas opacas, HTTP 403 e limite de tamanho.

Cinco suítes Playwright aprovadas, sem page errors: navigation, promotions, expandable-description, import-flow e smart-details. A última cobre detalhes sem URLs, notas separadas, salvar/cancelar/quebras/reload, tema escuro, abertura da URL preservada, sugestão e escolha manual persistente, e fallback após short-link bloqueado. Fixtures não representam produto real. TypeScript, ESLint, Expo Doctor 20/20, compatibilidade Expo e export Android/Hermes aprovados. Não houve teste físico adicional ou APK.

## Testar no Expo Go

Com a versão atual do projeto/servidor acessível, usar Reload sem limpar dados. A migração aditiva acontece antes de abrir as telas. Conferir um desejo antigo: campos/valores e textos anteriores devem continuar presentes. Criar uma anotação, cancelar, salvar e reabrir. Conferir ofertas separadas nos próximos itens importados. Testar os nomes de exemplo, escolher outra categoria e mudar o nome novamente: a escolha deve permanecer. Tentar meli.la; se a loja bloquear ou o navegador não expuser redirects, usar cadastro manual. Testar claros/escuros, persistência e operações locais em modo avião. Links do servidor de desenvolvimento são temporários, sem promessa de disponibilidade após encerrar a tarefa.
