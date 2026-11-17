# Fase 5.1 — diagnóstico HTTPS e enquadramento de imagens

Branch feature/product-images-ux; atualização do PR #7 existente. Sem merge, branch nova, alteração da main ou do PR #5. SQLite permanece v4. Nenhuma mudança em migrações, preços, importador, fotos persistentes, deduplicação, permissões, PNGs, W ou splash.

## Validação anterior informada pelo proprietário

Sete fluxos foram aprovados no Android/Expo Go: cancelar, salvar foto da galeria, preservar outros campos, persistir após reiniciar, substituir, remover e exibir nas demais telas. Esses são resultados físicos relatados pelo proprietário antes desta revisão. Não houve novo teste físico pelo agente.

## Investigação da URL fornecida

O proprietário enviou um endereço HTTPS de encrypted-tbn0.gstatic.com/images (miniatura do Google). A URL exata foi testada sem remover q/s nem quaisquer parâmetros. Tanto o carregador anterior quanto o revisado aceitaram a resposta neste ambiente: HTTP 200, image/jpeg, 11448 bytes, sem redirecionamento; Access-Control-Allow-Origin: *. A assinatura JPEG e as dimensões passaram pela validação. Portanto não foi reproduzida aqui a falha específica do Android, e o limite de 8 MB não explica essa resposta observada. Não se afirma correção definitiva do caso no aparelho.

Foi confirmado um problema de diagnóstico: previewUrl capturava qualquer erro e exibia a mesma exigência de HTTPS/8 MB, incluindo falhas de rede, servidor ou cache local. Isso impedia identificar o motivo real.

Correções realizadas:
- Erros distintos para URL inválida/insegura, rede, tempo excedido, cancelamento, HTTP do servidor, redirecionamento, Content-Type sem imagem, tamanho, formato/dimensões e preparação do cache no aparelho.
- A interface mostra o motivo conhecido e orienta usar o arquivo da foto, não uma página de loja/busca. Se o arquivo chega, mas o decodificador não consegue exibi-lo, a mensagem informa essa etapa e impede confirmar a prévia inválida.
- Corrigida uma falsa rejeição reproduzível: Response.url pode normalizar caixa do host, porta HTTPS padrão e fragmento. A comparação agora usa endereços canônicos apenas para conferir identidade do recurso; o endereço original e parâmetros continuam preservados no banco. Alteração de origem/caminho/query continua recusada.
- Removida mensagem de tamanho enganosa para um arquivo vazio; esse caso agora é identificado como conteúdo vazio/inválido.

Proteções mantidas: HTTPS público, 2048 caracteres, sem IP literal/credenciais/porta não padrão/nomes locais conhecidos, credenciais omitidas, 12 segundos, stream até 8 MB, formatos JPEG/PNG/WebP/GIF e até 20 MP/8192 pixels por lado. Nada foi ampliado para aceitar arquivos inseguros ou ilimitados.

Nenhum redirect é seguido. O modo manual inspeciona a resposta 3xx/opaca e a recusa antes de acessar Location: até um destino HTTPS aparentemente seguro precisa ser colado como URL final pelo usuário. Redirect para HTTP/IP privado/file também é recusado. Não há bypass de HTTP 403, TLS, antibot ou CORS. Redirecionamentos automáticos inesperados e resposta em outro endereço falham de forma segura.

Uma PNG real do template oficial do Expo também respondeu HTTP 200, image/png, 799005 bytes, e foi aceita pelo carregador revisado. Como contraponto, https://reactnative.dev/img/tiny_logo.png respondeu com cabeçalho image/png, mas bytes de ICO (assinatura 00 00 01 00), 24838 bytes: foi corretamente recusada como formato não suportado. Isso demonstra por que extensão/Content-Type sozinhos não provam que um arquivo é PNG. Não foi adicionada conversão nem aceitação de ICO/SVG/HTML.

Os GETs reais foram verificações de transporte em Node, não execução Expo Go. No navegador, CORS pode impedir fetch de um servidor que não permita a origem; Android nativo não tem a mesma política de CORS do navegador. A URL do Google consultada permitia CORS nesta resposta. DNS, TLS, rede, resposta variável e cache no aparelho não foram diagnosticados no dispositivo; a mensagem nova deve orientar a próxima verificação, sem atribuição prematura ao tamanho.

## Refinamento visual

Mantidos quadros compactos de 98 dp na lista e 260 dp na área grande, sem aumentar os cartões nem mudar espaçamento de título/preço. Um único ProductImage atende Início, filtro por categoria, Comprados, detalhes e editor.

- Fotos suficientes para a densidade do aparelho usam cover no quadro compacto, com recorte central uniforme e retenção mínima de 60% da área. Cantos acompanham o quadro, sem padding interno ou borda dupla.
- Miniaturas sem pixels suficientes e fotos muito alongadas mantêm contain e proporção natural; não são ampliadas só para preencher o espaço.
- Em detalhes/prévia, cover exige aspecto próximo do quadro (mínimo 90% da área preservada); retratos altos continuam inteiros. O fundo de uma imagem disponível fica transparente, removendo a aparência de passe-partout/moldura cinza. O estado neutro só usa o fundo suave quando falta imagem ou ocorre erro.
- Margens já incorporadas aos pixels da foto não são removidas nem redesenhadas. A regra de cores usa os temas existentes e azul-claro, sem gradientes ou sombras novas.

O recorte é apenas de exibição: nenhum arquivo ou URL armazenado foi modificado. A aparência precisa de nova validação física.

## Splash e futura build independente

Configuração atual conferida: expo-splash-screen com W transparente, contain, imageWidth 128, fundo claro #F7FAFC e escuro #101A23. Ícones Android/iOS e package com.danielsln.wish mantidos. O perfil preview em eas.json é interno e configura android.buildType=apk, sem developmentClient.

Expo Go mostra seu próprio carregamento/ícone e não é a referência da splash nativa. A documentação oficial recomenda uma build preview/release para avaliar o resultado. Nada foi alterado por tentativa e erro. Nesta etapa NÃO foi gerada APK.

Em tarefa futura e após autorização específica: preparar o ambiente/conta de build, executar uma build preview independente (por exemplo, npx eas-cli@latest build --platform android --profile preview), instalar a APK de teste e observar um cold start fechando completamente o processo antes de abrir pelo launcher. Conferir claro/escuro, enquadramento do W e eventual moldura, diferenciando máscara do ícone do launcher da splash. Comparar captura dessa execução com Expo Go. Recarregar JavaScript no cliente não valida a splash nativa. Não desinstalar Expo Go nem limpar dados para esse teste; dados da APK e do projeto no Expo Go são armazenamentos distintos, sem transferência implementada.

Referência: https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/.

## Testes e preservação

A cobertura inclui URL HTTPS válida, HTTP/malformada rejeitados antes de rede, HTML/MIME/assinatura inválidos, arquivo vazio, limite por cabeçalho e stream, falha de rede, HTTP 403/404/500, timeout/cancelamento, erro de cache, redirects seguros/inseguros/opacos bloqueados e falsa diferença de URL canônica. SQLite real verifica que a URL remota exata persiste após reabrir, prévia cancelada não grava e fotos locais/compartilhadas e demais campos continuam intactos. Testes de proporção verificam cover controlado, miniaturas, panoramas e detalhes.

Os testes anteriores de galeria simulada, persistência de arquivos, cancelamento, substituição, remoção, v4, importação, preços e imagens permanecem na suíte. O teste de API/arquivos do Expo e a qualidade final no Android continuam dependentes de teste físico. Não foi reexecutada uma suíte visual de navegador nesta rodada.

## Roteiro no Expo Go

1. Abrir esta branch publicada, após parar o Metro anterior: npm start -- --go --tunnel ngrok --port 8082. Não trocar para código antigo nem limpar dados.
2. Editar produto → Alterar imagem → colar a mesma URL fornecida → Ver prévia do link. Se falhar, informar a mensagem nova exata; não é necessário repetir tentativas ou remover limites.
3. Testar um link direto válido e uma página HTML para conferir que os motivos diferem. Salvar a imagem válida e reabrir o desejo.
4. Conferir Início, categoria, Comprados, detalhes e prévia nos temas claro e escuro. Fotos adequadas devem preencher o quadro compacto; miniaturas e retratos altos podem manter espaço para evitar distorção/corte excessivo.
5. Repetir os sete fluxos antes aprovados: galeria, cancelar, salvar, reiniciar, substituir, remover e conferir demais campos/telas.

Aguardar essa validação e autorização explícita antes de integrar o PR #7. A branch não foi excluída e o PR #5 permanece fora do escopo.

## Resultado final da revisão

- 62 testes Node/SQLite aprovados, 0 falhas e 0 skipped, incluindo todas as regressões anteriores.
- TypeScript e ESLint aprovados; Expo Doctor 20/20; dependências compatíveis com SDK 58. Nenhuma dependência adicionada/atualizada.
- Bundle Android/Hermes gerado; não é APK nem prova de execução física.
- URL enviada: JPEG HTTP 200 de 11448 bytes, aceita antes e depois da revisão. PNG oficial do template Expo: HTTP 200, 799005 bytes, aceita pelo código revisado. Os testes reais não alteraram produtos.
- Nenhum novo teste físico Android nem novo teste visual de navegador foi executado nesta revisão. A validação no aparelho continua pendente para o diagnóstico específico e o novo recorte visual.
- Importador, regras de preço, esquema v4, armazenamento/deduplicação de fotos locais, splash/PNGs, main e PR #5 não foram alterados. Só o PR #7 existente recebe estes commits.
