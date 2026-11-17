# Fase 5 — imagens dos desejos

Base: main 6814190 (merge do PR #6). Branch feature/product-images-ux. SQLite continua v4, sem migração ou recriação de banco. PR #5/Supabase permanece separado e não foi alterado.

## Uso no celular

No desejo existente, abra Editar produto e toque em Alterar imagem (ou Adicionar imagem). O editor mostra a imagem atual, Escolher da galeria, Link direto da imagem e Remover imagem. Escolher um arquivo ou visualizar um link não altera o produto. Confira a prévia e toque em Salvar imagem para confirmar, ou Cancelar/voltar para manter a imagem anterior.

O salvamento de imagem é independente do restante do formulário e já persiste ao tocar em Salvar imagem. Alterações ainda não salvas no nome/preço/outros campos continuam como rascunho do formulário. O comando altera somente image_url e updated_at, com comparação da referência anterior para recusar edição concorrente. Não muda título, preço, categoria, descrição, notas, status ou link da loja. Remover deixa o produto sem imagem, após confirmação pelo botão Salvar imagem; não promete apagar fisicamente o arquivo privado.

Links do produto e da imagem são campos distintos. O endereço técnico da foto privada nunca é mostrado como campo de edição; a URL pode ser substituída pelo editor. Cadastro de produtos novos mantém o campo HTTPS opcional em Mais detalhes; a seleção da galeria desta entrega fica na edição de desejos existentes.

## Armazenamento e privacidade

Dependências compatíveis instaladas por expo install: expo-image-picker ~58.0.10 e expo-file-system ~58.0.13. expo-crypto já existia e é usado para SHA-256.

A galeria usa launchImageLibraryAsync, somente imagens, uma seleção, sem câmera, sem áudio, sem base64 e sem objeto EXIF. Não são chamadas APIs de permissão ampla. Preferimos o seletor do sistema, conforme SDK 58. A configuração bloqueia permissões de câmera, áudio e acesso amplo à biblioteca em builds próprios. Isso não altera permissões do aplicativo hospedeiro Expo Go; seleção e retomada após o seletor exigem teste no aparelho.

Arquivos aceitos: JPEG, PNG, WebP e GIF, até 8 MB, 20 MP e 8192 pixels por lado. Arquivos HEIC ou outros formatos precisam ser escolhidos/exportados em formato compatível; não foi adicionado conversor. Assinatura e dimensões são conferidas antes da prévia; o decodificador ainda pode recusar um arquivo danificado e exibir estado neutro, impedindo salvar uma prévia inválida.

A seleção temporária é lida com limite e recebe uma cópia de cache para a prévia. Apenas em Salvar imagem os bytes são gravados em Paths.document/wish-product-images, por arquivo temporário seguido de move, antes do UPDATE SQLite. A foto da galeria original não é alterada nem apagada. O SQLite guarda uma referência curta wish-image://<sha256>.<ext>, nunca base64 ou URI transitória do seletor. A referência é resolvida a partir do diretório privado atual, inclusive após reiniciar.

SHA-256 do conteúdo evita duplicar a mesma foto, inclusive entre produtos. Gravações simultâneas do mesmo conteúdo são agrupadas; cópias existentes são verificadas antes de reutilizar. Um arquivo danificado com o mesmo identificador pode ser reparado pela escolha explícita da mesma foto. A limpeza de temporários considera que File.move muda a URI do objeto, evitando apagar o destino persistente.

Não há exclusão automática de fotos persistentes, nem ao remover/substituir a imagem de um produto: outra referência (inclusive outro desejo ou tombstone) pode precisar do arquivo. Isso prioriza segurança. Uma falha no banco após gravar uma foto pode deixar um arquivo sem uso; limpeza/reconciliação futura exigirá análise própria. Não há backup/exportação/sincronização de fotos nesta fase. Desinstalar/limpar dados do app pode apagar as fotos privadas.

## Imagens remotas e apresentação

Novas referências remotas aceitam HTTPS público, até 2048 caracteres, sem credenciais, IP literal, porta não padrão, controles ou nomes locais conhecidos. A validação do endereço não prova seu conteúdo. O carregamento usa expo/fetch, credenciais omitidas, sem redirects, timeout de 12 segundos, stream limitado a 8 MB e assinatura/dimensões de raster validadas. Não baixa HTML/SVG nem usa fallback sem limite. Se houver erro, mostra estado neutro e permite substituição.

Nenhum host ou regra SSRF do importador foi alterado: src/services/product-import.ts, product-images.ts, import-policy.ts e import-prices.ts permanecem idênticos à main do PR #6. URLs manuais são uma ação explícita do usuário, não uma expansão de destinos para importação automática. Uma checagem textual não oferece pinagem DNS no cliente contra rebinding de um domínio público controlado por terceiros; não foi criado proxy nem alegada tal garantia. Não cole links de fontes não confiáveis.

Imagens baixadas para exibição usam cache descartável; a referência original HTTPS permanece no banco. Cache/Blob URLs são liberados ao sair ou trocar a prévia e não são salvos como dados do produto. Imagens remotas continuam dependendo de internet e das regras da loja, inclusive CORS no navegador. Não se garante exibição offline dessas imagens; as fotos privadas confirmadas funcionam sem rede.

O componente compartilhado de imagens atende Início, seleção por categoria, Comprados, detalhes e edição. Mantém contain/proporção, limite de ampliação por densidade e quadros compactos de 98 dp; detalhes usam quadro de 260 dp. Fotos pequenas continuam menores, sem inventar detalhes. Mantidos temas claro/escuro/automático e azul-claro #A9D8F4. O W e a splash não foram alterados; só foi acrescentado o ícone minimalista de imagem na ação de edição.

Referências antigas não são migradas ou substituídas automaticamente. URLs HTTP antigas são preservadas em edições comuns, mas o novo carregador não faz requisição HTTP insegura: mostra estado neutro até substituição explícita. Código anterior à Fase 5 pode não entender referências wish-image://, embora o banco siga v4; até integração, testar esta branch e não alternar para código antigo no mesmo catálogo.

## Como testar no Expo Go

```powershell
cd D:\Projetos\Wish
git status --short
git fetch origin
git switch feature/product-images-ux
git pull --ff-only
npm ci
node scripts/start-expo.mjs --check
npm start -- --go --tunnel ngrok --port 8082
```

Pare antes qualquer Metro antigo. Não limpar dados nem reinstalar Expo Go para trocar a versão do código. O seletor e FileSystem estão incluídos no Expo Go SDK 58; nenhuma APK foi criada.

Roteiro físico pendente:
1. Abra um desejo antigo e registre mentalmente nome, preço, notas, categoria e link.
2. Editar produto → Alterar imagem → Escolher da galeria. Confira a prévia, cancele e confirme que nada mudou.
3. Repita, salve a imagem e feche/reabra o Wish; confira a foto e os demais campos.
4. Use a mesma foto em outro desejo; remova a imagem somente do primeiro e confira que o segundo continua intacto.
5. Teste uma URL HTTPS direta válida; prévia, salvar, cancelar substituição e link inválido/HTML/redirect/arquivo grande.
6. Confira quadros compactos na lista/Comprados/categorias e proporção nos detalhes, nos três temas.
7. Fotos pequenas e antigas não devem ser ampliadas agressivamente nem substituídas sozinhas. A importação Youcom aprovada deve continuar selecionando a foto principal; o preço não confirmado continua vazio.

Navegador: URLs remotas têm suporte condicionado a CORS. Galeria persistente está desabilitada nessa plataforma, pois expo-file-system não oferece a mesma área privada de arquivos na web. O botão orienta usar Expo Go no celular; não há persistência enganosa de blob/URIs temporárias. Se Android encerrar a atividade durante a escolha, o rascunho não confirmado pode ser perdido; repita a seleção, sem alterar o produto salvo.

## Verificação automatizada

54 testes Node/SQLite aprovados, sem falhas/skips. Testes novos usam arquivos reais temporários e SQLite real com adaptadores simulados para o seletor/armazenamento Expo e transporte HTTP: seleção, prévia/cancelamento, hash/deduplicação, troca, remoção, compartilhamento, reinício, arquivo ausente/corrompido, limites, URL insegura, cancelamento do stream, alteração concorrente e preservação de todos os demais campos. Incluem regressão da mudança de URI em File.move. Os testes anteriores de imagem, preços/importação, esquema v4 e inicialização permanecem aprovados.

TypeScript, ESLint, Expo Doctor 20/20, dependências compatíveis e bundles web/Android/iOS foram verificados. O Android final foi reexportado após o reforço de escrita atômica. O carregador limitado aceitou a URL Youcom aprovada sem transformá-la (WebP, 59294 bytes). Isso é verificação técnica, não prova de qualidade física nesta nova fase.

Não houve teste físico do seletor, dos arquivos Expo ou da interface nova. Esses adaptadores precisam da validação Android acima. A suíte SQL/arquivos não substitui teste no aparelho. Os 10 alertas moderados já conhecidos continuam reportados pela instalação; nenhum SDK incompatível ou audit fix --force foi aplicado. PR #5 preservado; login, sincronização, pagamentos e serviços pagos não foram implementados.
