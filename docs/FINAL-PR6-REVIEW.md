# Revisão final do PR #6 — 16/11/2026

> Encerramento posterior: o proprietário aprovou fisicamente a imagem Youcom. O preço vazio foi investigado e aceito como limitação não bloqueadora, assim como o carregamento do Expo Go. A recomendação final e os checks atuais estão em [PR6-MERGE-READINESS.md](PR6-MERGE-READINESS.md); as condições de aprovação abaixo registram a revisão anterior.

Branch: feature/expo-go-readiness. Base inspecionada: main 025429d. PR #5 (Supabase, esquema v3) preservado e fora do escopo. Não há login, sincronização ou merge automático nesta revisão.

## Incidente SQLite e preservação

O servidor Windows foi iniciado com feature/product-management 2b7f495, aceita v1, sem atualizar referências e conferir a branch usada anteriormente pelo aparelho. O celular já tinha banco v4. Em seguida foi iniciada main 025429d, que aceita apenas v2; continuou incompatível. Após informar Banco: 4, o proprietário confirmou que feature/expo-go-readiness f207275 carregou. A causa do incidente foi a seleção do código servido, não perda de dados nem necessidade de downgrade.

Comparação: main mantém migrações 0→1 (produtos/categorias) e 1→2 (app_settings). O PR conserva essas etapas e acrescenta 2→4: personal_notes e offer_details, TEXT NOT NULL com valor vazio, em transação. notes antigo não é reinterpretado e continua preservado integralmente. Banco v4 reabre sem ALTER; >4 é recusado. V3 é reservado ao PR #5 e recusado sem conversão. Nenhuma migração é alterada nesta revisão.

Os testes cobrem instalações novas, v1→v4, v2→v4, repetição, rollback após ALTER parcial, produtos/UUIDs/categorias/preferências/notas preservados, v3 e versões futuras recusados. Foi acrescentado teste de reabertura v4 que mantém inclusive uma URL antiga de miniatura, notas e link Mercado Livre.

Nova inicialização scripts/start-expo.mjs verifica branch/esquema e imprime pasta/commit antes de iniciar a CLI; npm start/android/ios/web usam esse caminho. Testes verificam main antiga recusada, branch errada recusada e códigos compatíveis aceitos. Veja EXPO-GO-TESTING.md para comandos e limites: chamadas diretas à CLI e cópias antigas fora deste wrapper continuam exigindo conferência manual.

## W na inicialização

Inspeção visual: icon.png e splash.png antigos têm bloco azul arredondado; adaptive-foreground.png é o W original escuro isolado com transparência; monochrome.png é a versão branca isolada. Os PNGs transparentes têm 1024×1024 e margens grandes (símbolo aproximadamente 476×374 px centrado). Não há stroke externo, círculo ou borda decorativa nesses dois arquivos.

A correção já presente no commit f207275 aponta expo.icon e splash clara para adaptive-foreground.png; splash escura usa monochrome.png, imageWidth 128 e contain. Não foi necessário redesenhar, recortar ou substituir o W nesta revisão. As referências iOS/launcher Android são próprias dessas plataformas e suas máscaras não devem ser confundidas com a splash.

O componente Mark tem um bloco de marca no cabeçalho/placeholder, mas não controla a tela nativa de inicialização. Não foi alterado para tentar corrigir uma tela externa. Expo Go mostra o app icon e não replica integralmente a splash nativa; pode fornecer cartão/máscara/fundo próprios. Sem captura do contorno do cliente ou build release não se pode atribuir todo contorno restante ao arquivo do Wish nem prometer sua eliminação. Fechar e reabrir o projeto atualiza o manifesto; não limpar dados/reinstalar. Validação final de splash exige build release, não realizado.

Fonte oficial: https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/.

## Imagem pixelada da Youcom

Página pública exata informada pelo proprietário (produto camiseta-comfort-great-stories-p1190860, variante pp=/44.3250/) respondeu HTTP 200. JSON-LD Product.image publica versões t2/s2/m2/l2/z2 da primeira foto, seguidas por outras fotos. OG e Twitter apontam l2, com dimensões 482×660. A galeria principal img (alt do produto, fetchpriority=high) referencia z2 por otimizador Next.js; a URL direta z2 também já está declarada no JSON-LD.

Foram consultadas somente as cinco URLs exatas publicadas, sem inventar caminhos, remover parâmetros ou seguir redirects. Dimensões reais WebP: t2 77×105 (4502 bytes), s2 285×390, m2 400×548, l2 482×660 e z2 1022×1400 (59294 bytes). O código anterior pegava sempre o primeiro item do array JSON-LD, descartando alternativas e OG. Isso selecionava a miniatura 77×105 e o Image contain a ampliava no quadro de 260 dp: causa confirmada da baixa resolução selecionada; efeito final no Android precisa de novo teste físico.

Correção: ImageObject/url/contentUrl e dimensões, múltiplos grupos OG e fallback Twitter são considerados. Uma imagem principal da galeria só ancora alternativas quando corresponde a candidato já declarado pelo produto; recomendações/banners não são varridos como produtos. srcset direto é considerado nesse elemento ancorado. Wrapper Next.js de mesma origem e caminho /_next/image só identifica URLs já declaradas; não é solicitado nem usado para inventar originais. URLs autorizadas e seus parâmetros são preservados; nada é transformado por sufixo t/s/z ou parâmetro width. Sem dimensões ou evidência de principal, ordem declarada é mantida; não se afirma descobrir resolução inexistente.

CDNs agora são conferidas também contra a família da loja: Youcom não recebe foto de Amazon/KaBuM como substituta. Não houve expansão de hosts autorizados. A extração sobre o HTML real passou a selecionar exatamente z2 publicada (1022×1400).

Exibição: contain mantém proporção; dimensões obtidas ao carregar e densidade do aparelho limitam ampliação além dos pixels da fonte. Imagens pequenas ficam menores no quadro e mostram aviso com orientação de substituição manual no formulário. O campo de URL continua editável. Isso melhora apresentação sem inventar detalhes. Produto/URL antiga não é alterado automaticamente; usuário precisa editar e salvar para substituir uma foto já cadastrada. Não há nova migração ou atualização em lote.

## Fluxos e evidência física

O proprietário confirmou no Android, antes desta revisão adicional: inicialização na branch compatível, cadastro, categorias, Youcom, detalhes/anotações, comprados e persistência. Mercado Livre não extraiu automaticamente e ofereceu manual. Teste adicional do repositório confirma que manualProductFromLink + save + get conserva o link exato, inclusive query. Os novos testes de resolução e proporção usam fixtures; a extração real Youcom foi conferida separadamente. Nenhum teste físico novo de imagem ou contorno foi realizado nesta revisão.

## Integração e risco

A branch parte da main atual; a disponibilidade de merge é conferida no GitHub ao publicar. O merge do PR #6 fará a main aceitar v4, portanto voltar à main anterior com o mesmo catálogo continuará sendo recusado. Guardar a versão usada por dispositivos é necessário; não alterar PR #5 para esconder isso. A integração futura de Supabase deverá reconciliar v3/v4 e novos campos, preservando dados. Não deve simplesmente reutilizar o número 4 nem ignorar a recusa de esquema.

Recomendação: tecnicamente revisável para merge após os checks finais e uma nova confirmação física da foto Youcom e do carregamento atual. A extração do Mercado Livre continua sendo melhor esforço com fallback manual, sem promessa de contornar bloqueios. O uso real pode ser aprovado com essa limitação documentada. Integração à main depende de autorização explícita do proprietário.

## Resultado final desta revisão

- 48 testes Node/SQLite: aprovados, 0 falhas e 0 skipped. Incluem resoluções, famílias de CDN, srcset, URLs preservadas, imagens pequenas/grandes, fallback manual salvável e proteção de inicialização.
- TypeScript: aprovado. ESLint em src e scripts: aprovado.
- Expo install --check: dependências compatíveis. Expo Doctor: 20/20.
- Expo config público: ícone ativo assets/brand/adaptive-foreground.png, transparente. Referências da splash conferidas.
- Expo export --platform all: web/WASM + bundles Hermes Android/iOS gerados. Não é APK/IPA, instalação nem teste físico.
- Extração sobre HTML real da camiseta informada: selecionou a URL z2 publicada. Dimensões reais 1022×1400, contra os 77×105 selecionados anteriormente.
- Tentativa de nova conferência de interface nesta sessão: ferramenta de navegador indisponível após timeout de navegação. As suítes de navegador existentes não foram reexecutadas nesta revisão; os resultados de etapas anteriores não são apresentados como novos. Não houve nova validação física do contorno ou da qualidade da foto Android.
- GitHub antes da publicação: PR #6 aberto, sem merge e mergeable=true; main é ancestral (0 commits exclusivos da main). PR #5 segue aberto, sem merge, no mesmo commit 4fa742a.

A recomendação permanece condicional ao novo teste físico das alterações visuais. Nenhuma autorização de merge foi presumida.
