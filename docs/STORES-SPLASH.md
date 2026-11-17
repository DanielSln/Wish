# Lojas, Mercado Livre e ícone de carregamento — 16/11/2026

Branch feature/expo-go-readiness, PR #6. SDK 58 e SQLite v4 preservados, sem migração, login, Supabase, dependências ou serviços pagos. Main e PR #5 não alterados.

## Mercado Livre: etapa da falha

A mensagem anterior “A loja não disponibilizou dados do produto” era emitida pelo parser depois de obter HTML, quando não encontrava nome em Product JSON-LD nem og:title. O relato no Android indica esse caminho, mas não revela se o HTML era a página final, um conteúdo intermediário, uma página carregada por JavaScript ou uma restrição apresentada com HTTP 200. Não se afirma qual dessas hipóteses ocorreu sem o HTML daquela execução.

Uma nova consulta ao link https://meli.la/1pXnAoY, sem seguir redirecionamentos automaticamente, recebeu HTTP 403 neste ambiente. Não foi possível obter a página final ou seus metadados; o bloqueio não foi contornado e não se afirma sucesso real da extração desse produto.

A resolução meli.la continua limitada a quatro saltos inspecionados e aos hosts exatos do Mercado Livre, com timeout total e tamanho máximo preservados. Agora a ausência de metadados possui código METADATA_UNAVAILABLE e mensagem transitória: “A página respondeu, mas não disponibilizou informações do produto nesta consulta”. HTTP e URL inválida têm mensagens distintas. Preencher manualmente mantém o endereço e identifica o domínio da loja; não transforma uma falha de prévia em impedimento ao cadastro.

O parser genérico também aceita application/ld+json com parâmetros MIME, ProductGroup com variante única e um Product que só forneça parte dos dados. Não escolhe entre várias variantes. Quando um Product identificado informa preço/imagem, mas não nome, a revisão mantém nome vazio para o usuário preencher, sem inventá-lo. Uma homepage ou og:type=website sem Product não vira automaticamente produto por ter o nome da loja no título.

## Youcom e lojas não revisadas

O proprietário informou a marca Youcom. A página oficial https://www.youcom.com.br respondeu HTTP 200 e identificou a marca e seu host de imagens img.youcom.com.br. Os hosts exatos youcom.com.br/www.youcom.com.br foram habilitados para o **mesmo parser genérico** JSON-LD/Open Graph, sem extrator ou API específica; o host de imagens dedicado foi incluído, somente para URLs HTTPS. Imagens HTTP e CDNs desconhecidas não são importadas automaticamente. Sem URL específica da camiseta, não se afirma extração real desse item; os formatos foram validados com fixtures.

Qualquer loja com URL HTTPS sintaticamente válida pode continuar o cadastro: o botão Continuar cadastro abre formulário com URL e domínio preservados, nome/preço/imagem sem invenção, categoria local sugerida conforme o nome informado e revisão antes de salvar. Não aparece mais uma recusa de cadastro por “loja não configurada”.

**Limitação de segurança explícita:** não foi habilitado fetch arbitrário para todos os hosts. No Expo Go, este cliente não dispõe de resolução DNS validável e pinagem de IP por conexão para impedir que um domínio desconhecido resolva/revincule a IP interno. Uma checagem textual da URL, CORS ou um serviço público de DNS não resolveria isso. Portanto, a prévia automática permanece em hosts revisados; para os demais, o formulário manual é a alternativa segura. Nenhum proxy público, DNS externo, endpoint privado ou contorno de anti-bot foi adicionado.

Localhost, IPs literais, credenciais, protocolos inseguros e sufixos internos conhecidos são recusados. As proteções anteriores de redirects, timeout de 12s e resposta de 2MB continuam. Mesmo em loja habilitada, metadados podem não estar disponíveis; o link e o cadastro manual permanecem acessíveis.

## Origem da moldura e referências visuais

A inspeção dos arquivos mostrou que assets/brand/icon.png e splash.png contêm o bloco azul arredondado em torno do W. Não é apenas uma borda de layout. Já existiam arquivos de alta resolução com o mesmo símbolo isolado e transparência: adaptive-foreground.png (W escuro) e monochrome.png (W branco). Foram reutilizados, sem editar ou redesenhar imagens.

app.json agora aponta expo.icon para o W transparente, pois **Expo Go SDK 58 exibe o ícone do aplicativo no carregamento, não reproduz a splash nativa completa**. A splash configurada usa W escuro em #F7FAFC, W branco em #101A23, resizeMode contain e imageWidth 128 para compensar as margens transparentes existentes. Slug, package, banco, ícones adaptativos Android e ícone iOS específicos continuam preservados.

A camada de apresentação do Expo Go pode aplicar máscara/cartão/fundo próprios. Não se promete eliminar esses elementos externos; somente o quadrado embutido no arquivo selecionado foi removido dessa referência. Configurações da splash nativa requerem um build próprio para validação final, adiado nesta tarefa. Ícones de launcher podem legitimamente ter máscara e fundo definidos pelo sistema.

Verificação de arquivos: os dois PNGs reutilizados são RGBA, 1024×1024, com cantos transparentes e limites do W centrados em (274,325)–(750,699). Nenhum novo asset ou dependência foi necessário. Expo config público e Expo Doctor validaram as referências.

## Validação e teste no Android

40 testes Node/SQLite aprovados. Cobrem lojas não revisadas sem rede automática, Youcom genérica com metadados, campos parciais, ausência de metadados, links inválidos/internos, redirecionamentos, fallback com link preservado e regressões anteriores. Seis suítes de navegador aprovadas, incluindo store-readiness, que salva e reabre uma camiseta de uma loja não revisada, importa uma fixture Youcom e confere fallback do Mercado Livre sem metadados. Fixtures não são resultados reais das lojas.

TypeScript e ESLint aprovados, Expo Doctor 20/20, compatibilidade Expo e export Android/Hermes aprovados. Não houve teste físico adicional, APK ou validação visual da apresentação própria do Expo Go no aparelho.

Para conferir: usar Reload no projeto atual com servidor acessível. Tentar o link específico da Youcom, revisar dados ou continuar manualmente se necessário. Para outra loja, Continuar cadastro conserva URL/domínio e permite salvar. No Mercado Livre, conferir a mensagem e o cadastro manual quando os metadados não vierem. Para o ícone, fechar e reabrir o projeto no Expo Go, solicitando um novo manifesto; Reload apenas do JavaScript pode não atualizar a imagem de carregamento em cache. Não limpar dados/reinstalar o Expo Go para atualizar. O servidor e links experimentais não têm disponibilidade permanente garantida.

Referência: [SplashScreen SDK 58 e limitações do Expo Go](https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/).
