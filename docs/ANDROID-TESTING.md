# Wish no Android — instalação, APK e roteiro de teste

Revisão: 15/11/2026. O PR #3 foi integrado à main com autorização, no commit d615495c1b4c403432a58f984f68045477123f7c. O catálogo continua em wish.db, esquema v2, sem Supabase.

Prioridade atual: [Expo Go no Windows/Android](EXPO-GO-TESTING.md). APK independente está adiado. A preparação do PR #4 foi integrada na main em 025429d4b885641be757915c5aff392f4b5ceb94; eas.json e este roteiro foram preservados. A tentativa anterior de APK não gerou artefato instalável. Não existe PR separado de backup local nesta revisão.

## 1. Caminho mais rápido: Expo Go

Gratuito, adequado para conferir telas e fluxos enquanto o computador está disponível. Requer Expo Go Android compatível com SDK 58. Se a versão da Play Store não for compatível, consulte a versão indicada na página oficial https://expo.dev/go?device=true&platform=android&sdkVersion=58 ou use o APK próprio descrito abaixo.

No computador, com Node.js 24 e npm:

```powershell
git clone https://github.com/DanielSln/Wish.git
cd Wish
git switch main
npm ci
npx expo start --go
```

Se o projeto já existe, entre na pasta dele e use git fetch origin, git switch main e git pull --ff-only, sem clonar outro projeto ou descartar alterações locais. Instale/abra Expo Go no Android, coloque celular e computador na mesma rede Wi-Fi e escaneie o QR Code. Se a LAN não funcionar, a ferramenta de túnel já existe como dependência de desenvolvimento:

```powershell
npx expo start --tunnel --go
```

O túnel é temporário e depende de rede e servidor ligados. Expo Go não é um APK próprio do Wish e não é o método recomendado para comprovar abertura independente do computador em modo avião. Os bancos do navegador, Expo Go e APK instalado pertencem a sandboxes diferentes; não há transferência automática entre eles nesta fase.

## 2. APK próprio sem Play Store — EAS Build

O perfil preview de eas.json usa distribuição interna e android.buildType=apk, sem developmentClient. O resultado esperado é um app com JavaScript incluído, que abre pelo próprio ícone sem Metro. Não gera AAB e não exige conta de desenvolvedor da Play Store.

Esta é a opção mais simples para quem usa Windows e não quer instalar todo o Android SDK. Precisa de uma conta Expo gratuita e da cota disponível do plano Free; confirme cotas/fila atuais antes de iniciar. Não é necessário contratar plano pago. Se a cota gratuita estiver indisponível, aguarde a renovação ou use o build local da seção seguinte.

```powershell
git fetch origin
git switch chore/android-device-testing
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview
```

Se a branch não existir localmente, git switch --track origin/chore/android-device-testing. Depois que o PR de preparação for integrado, os mesmos arquivos estarão na main. O comando init vincula o projeto à conta Expo escolhida e grava o projectId real; ele não foi inventado nem pré-configurado neste repositório. Revise alterações em app.json antes de commitá-las. Não adicione tokens, senhas ou arquivos de assinatura ao Git.

Na primeira build, permita que o EAS gere/gerencie a chave Android se ainda não houver uma. Preserve essa assinatura para atualizações futuras. O identificador preparado é com.danielsln.wish, com versionCode inicial 1; aumente versionCode em versões seguintes e mantenha o package/assinatura para atualizar sem apagar dados.

Ao terminar, o EAS mostra a página da build e o link de download do APK. Abra esse link no Android, baixe o arquivo, permita instalação pela origem utilizada quando o sistema solicitar e toque em Instalar. Abra o Wish pelo ícone W. Não há submissão à Play Store. Se preferir USB com adb instalado:

```powershell
adb devices
adb install -r caminho\wish.apk
```

Uma versão assinada com outra chave pode ser recusada ao atualizar. Não desinstale nem limpe dados para contornar isso se houver produtos a preservar; mantenha o canal/assinatura de origem. Expo Go não é atualizado por esse APK e seus dados não são importados automaticamente.

## 3. Alternativa local gratuita, sem conta Expo

Instale Android Studio, um JDK completo compatível com o Gradle gerado (JDK 17 foi utilizado nesta preparação), Android SDK, Platform Tools e os componentes SDK/NDK solicitados pelo Expo SDK 58. Configure JAVA_HOME e ANDROID_HOME conforme a documentação oficial e aceite as licenças no seu ambiente. Use o projeto gerado pelo Expo, sem criar/editar android/ manualmente.

Para compilar e instalar por USB, habilite opções de desenvolvedor/depuração USB no aparelho e autorize o computador:

```powershell
npm ci
npx expo run:android --variant release --device
```

Para somente gerar o arquivo, no Windows/PowerShell:

```powershell
npx expo prebuild --platform android
cd android
.\gradlew.bat :app:assembleRelease
```

Em Linux/macOS, use ./gradlew :app:assembleRelease dentro de android/. O caminho padrão do artefato é android/app/build/outputs/apk/release/app-release.apk; confira a saída real da tarefa. Esse arquivo só existe se o build terminar com sucesso. Não confunda expo export --platform android (bundle Hermes) com APK.

O template pode usar assinatura de desenvolvimento na variante release local. Isso serve para teste pessoal, mas não representa configuração de assinatura de produção e pode não atualizar uma build EAS. Para consistência de assinatura entre instalações, prefira o mesmo fluxo EAS ou configure sua própria assinatura conforme a documentação, fora do Git. Não versione android/, keystores, APKs ou credenciais. O EAS --local também existe, mas exige conta Expo e ferramentas locais; não resolve a ausência de JDK/SDK. No Windows, o fluxo nativo Gradle acima evita depender do EAS local em WSL.

## 4. Roteiro no aparelho

Use um catálogo de teste identificado por você; os valores digitados manualmente não são cotações automáticas. Registre versão do Android, modelo, tipo de instalação e versão do Wish para tornar eventuais erros reproduzíveis.

### Cadastro manual e edição

1. Abra Adicionar → Preencher manualmente, ou digite um nome e toque em Continuar com esse nome. Não há sugestões automáticas reais por nome.
2. Preencha nome, categoria e, se desejar, um preço conhecido por você. Salve e confira os detalhes.
3. Edite nome/categoria. Em Mais detalhes e categorias, confira prioridade, preço desejado, loja, URL/imagem e anotações; salve e confirme os valores.
4. Confira pesquisa, filtros e ordenação na aba Início. Tente salvar sem nome: deve mostrar validação sem apagar os campos.

### Importação por link

1. Com internet, abra Adicionar por link e cole o endereço HTTPS direto de um produto em um dos hosts permitidos: Amazon Brasil, Mercado Livre, Magalu, KaBuM! ou Casas Bahia.
2. Confira nome, imagem, loja e preço quando disponíveis. Não considere o preço uma garantia de oferta: variantes, frete, vendedor e promoções podem mudar.
3. Toque em Revisar e escolher categoria; corrija os campos, escolha categoria e salve. Antes de Salvar desejo nada deve ser gravado.
4. Teste link inválido, link encurtado/redirect e outra loja. Deve recusar a consulta e oferecer preenchimento manual, preservando um link HTTPS válido. Não deve tentar contornar bloqueios da loja.
5. Preço ausente, estrangeiro, agregado ou não confirmado deve continuar sem preço confirmado. Não espere sucesso em toda página de uma loja permitida; HTML dinâmico e bloqueios podem impedir extração.

### Categorias e Comprados

1. Em Categorias, crie e renomeie uma categoria. Escolha-a para conferir os produtos associados.
2. Marque um produto como comprado nos detalhes; confira que aparece em Comprados sem criar outro registro. Reverta para pendente e confira que deixa essa seleção.
3. Tente excluir a categoria com esse produto, tanto pendente como comprado: deve recusar e manter os dados.
4. Mova o produto para outra categoria; depois exclua a categoria vazia com confirmação. Recriar o mesmo nome deve funcionar.
5. Cancele uma exclusão de produto e confira que ele permanece. Confirme a exclusão de outro registro de teste e confira que não aparece nas listas.

### Persistência após encerrar

1. Com produtos/categorias/anotações já salvos, anote o que espera encontrar e escolha um tema explícito.
2. Remova o Wish dos recentes e, para uma verificação mais forte, use Configurações do Android → Apps → Wish → Forçar parada. Não use Limpar armazenamento nem Desinstalar.
3. Reabra pelo ícone: produtos, categorias, status comprado, anotações e preferência de aparência devem permanecer.
4. Se possível, reinicie o Android e repita a conferência. Isso é um teste a executar no aparelho, não um resultado já comprovado aqui.

### Modo avião — usar APK próprio

1. Instale e abra o APK ao menos uma vez. Depois ative modo avião, confira que Wi-Fi também está desligado e encerre/reabra o Wish pelo ícone.
2. Liste, pesquise, cadastre manualmente, edite, crie/renomeie categoria e marque/reverta uma compra. Os fluxos locais devem continuar funcionando.
3. Encerre e reabra ainda offline: confira persistência das alterações. Teste uma exclusão de registro de teste com confirmação.
4. Imagens remotas não carregadas/cacheadas podem ficar indisponíveis; o placeholder é esperado. Consulta de loja e importação precisam de internet e devem falhar de forma recuperável, permitindo cadastro manual.
5. Restaure a rede e tente outra importação. Não espere backup remoto: Supabase ainda não existe.

### Temas

1. Em Configurações → Aparência, escolha Claro, feche/reabra e confira a preferência.
2. Repita com Escuro; confira textos, inputs, detalhes, modais e barra inferior.
3. Escolha Automático, alterne o tema nas configurações do Android e retorne ao Wish: deve acompanhar o aparelho. Repita após reabrir.
4. Confira também ícone W, splash e barra de status. Ícone/splash exigem nova build própria para refletir mudanças nativas; Expo Go mantém sua própria identidade de aplicativo.

## 5. Situação do artefato e limites desta entrega — sem APK disponível

O código foi validado por testes, TypeScript, ESLint, Expo Doctor e navegador. O prebuild Android foi executado com sucesso em cópia isolada; a árvore nativa gerada não foi versionada. Inicialmente o ambiente possuía somente Java 21 Runtime, sem compilador/SDK. Foram provisionados SDK/NDK e um JDK completo temporariamente no workspace, sem mudar dependências do app. Tentativas reais de assembleRelease foram executadas; houve correções de proxy, diretórios graváveis e truststore do JDK, mantendo a validação TLS. Resultado final: nenhum APK foi gerado. A compilação ARM64 chegou a 170 tarefas e falhou em :expo-modules-core:compileReleaseKotlin ao criar diretórios de cache Gradle (java.io.IOException: Couldn't create directory). O disco chegou a 99% de ocupação, com cerca de 135 MiB livres após limpeza parcial; a tentativa não concluiu. Os caches/SDK temporários foram removidos ao final para liberar o workspace. Os logs e o código foram preservados. Isso não comprova instalação, assinatura ou execução de um APK no telefone; use a configuração EAS gratuita ou o build local em ambiente com mais espaço. Nenhum APK deve ser tratado como disponível sem artefato validado.

Nenhum aparelho físico foi conectado/testado, nem houve teste real de modo avião. A suíte de navegador usa fixtures de importação; não certifica lojas reais ou comportamento nativo. A preservação de dados existente foi verificada em SQLite real e na interface web, não em atualização de APK no telefone do proprietário. Para backup/autenticação futura, consultar PHASE-4-PLAN.md; não há Supabase implementado.

Referências: https://docs.expo.dev/build-reference/apk/ ; https://docs.expo.dev/build-reference/local-builds/ ; https://docs.expo.dev/get-started/set-up-your-environment/ ; https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/ .
