# Fase 6 — APK Android independente e splash

## Estado em 18/11/2026

Base: main 29dea24, merge aprovado do PR #7. Branch: feature/android-preview-splash.
A Fase 5/5.1 foi aprovada fisicamente pelo proprietário conforme solicitação desta fase; isso não valida a nova APK.

**APK ainda não gerada.** EAS CLI 27.10.0, Node 24.22.1. Login confirmado na conta danielsln. Após autorização explícita, criado e vinculado @danielsln/wish (projectId público dea8d846-f32c-41e2-bf98-2a20f6fbe3d1). eas config preview Android aprovado, sem variáveis remotas de ambiente configuradas. Consulta de plano/cota por métodos oficiais do EAS: Free, 0/15 builds Android usadas, período até 01/12/2026 UTC (cota pode mudar). Nenhum custo aceito. Aguardando confirmação da geração gerenciada de assinatura e inexistência de APK anterior. Build ID, commit de build e link APK: pendentes.

## Configuração auditada

- Wish 1.0.0; Android com.danielsln.wish, versionCode 1.
- Expo SDK 58; eas.json usa appVersionSource local.
- preview: distribution internal, android.buildType apk, developmentClient false explícito. Objetivo: release com bundle incluído, sem Metro/Expo Go, sem publicação Play Store.
- Nenhum APK/AAB no Git; padrões já ignorados, assim como keystores, credentials.json, variáveis privadas e bancos.
- app.json recebeu somente owner danielsln e extra.eas.projectId público para associar o projeto autorizado. Splash/ícones, versão e package preservados.

## Auditoria visual e diferenças de inicialização

A configuração real confirma imageWidth 128, resizeMode contain; claro #F7FAFC, escuro #101A23. Imagens adaptive-foreground.png e monochrome.png são PNG RGBA 1024×1024, cantos transparentes. O W original foi inspecionado visualmente: sem quadro branco/cinza ou sombra decorativa. Os arquivos e cores foram preservados.

1. Launcher: ícone Android adaptativo, máscara e fundo aplicados pelo sistema; não é a splash.
2. Splash nativa: plugin expo-splash-screen e recursos gerados durante a build, conforme tema do Android.
3. Expo Go: apresentação do hospedeiro; não reproduz fielmente a splash release.
4. Android 12+: sistema aplica sua própria apresentação inicial; verificar em cold start da APK real antes de atribuir eventual contorno ao arquivo W.

Não foi comprovado nesta fase que a moldura desaparece. Não houve teste físico da APK nem alteração de marca por suposição.
Referência: https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/

## Ajuste adicional do título

Somente detalhes: fonte 32 → 22, linha 28; três linhas iniciais, sem altura mínima fixa no título. Espaço geral vertical 22 → 14 e topo 24 → 16. Nome completo continua disponível pelo controle Ver nome completo / Ver menos, mostrado após medição de transbordamento. Cores seguem os dois temas, fontes continuam escaláveis, sem limitar fontScale. Medição reinicia quando largura, escala ou texto mudam. A expansão não usa substring e não grava no banco. Formulário de edição continua recebendo o valor integral.

## Testes e limites atuais

- 62 testes Node/SQLite aprovados, zero falhas/skips.
- TypeScript e ESLint aprovados após ajuste do título.
- Expo config local resolvido com sucesso.
- Expo Doctor: **19/20**, dependências **não** totalmente em dia. Novas recomendações: @expo/ui ~58.0.29 (instalado 58.0.28), expo ~58.0.26 (58.0.25), expo-file-system ~58.0.14 (58.0.13), expo-router ~58.0.32 (58.0.31), expo-sqlite ~58.0.18 (58.0.17), expo-web-browser ~58.1.0 (58.0.8). Mantidas versões fisicamente aprovadas para não misturar upgrades com primeira APK. Não ocultado o alerta nem usado audit fix --force. Não há incompatibilidade comprovada em execução; a build ainda não valida essas versões.
- Bundle Android/Hermes gerado com sucesso em .expo/phase6/android, entry-1d7e878e9b111e2731db7191094a5679.hbc (~3,2 MB, 1385 módulos). Exportação não é APK.
- Validação visual nova em tela pequena/fontes ampliadas e APIs da APK: pendente no aparelho; testes existentes não simulam layout nativo.
- SQLite v4, migrações, dados, importador, preços, notas/categorias, persistência de fotos e PR #5 intactos.

## Próximos passos para a primeira build

1. Proprietário entra na conta pelo PowerShell em D:\Projetos\Wish: npx eas-cli@latest login. Nunca enviar senha/token no chat.
2. Conferir identidade, projeto EAS e plano/cota da conta. Plano gratuito tem builds limitadas de baixa prioridade e não cobra excedente; não supor saldo disponível. Não aceitar upgrade/pagamento.
3. Vincular o projeto correto; se precisar criar projeto EAS, confirmar proprietário e registrar projectId público na configuração. Não inventar identificador.
4. Assinatura Android exige keystore. Se já existe APK instalada com com.danielsln.wish, confirmar assinatura/versionCode antes. Reutilizar credencial correta quando existente. Se primeira instalação, proprietário pode aprovar geração gerenciada pelo EAS; guardar acesso em conta, nunca no Git/chat. Interação de credenciais deve aguardar proprietário.
5. Validar eas config --platform android --profile preview; commit limpo e atualizado, sem arquivos privados incluídos.
6. Só então executar UMA build: npx eas-cli@latest build --platform android --profile preview. Registrar ID, commit, versão, status final e link real. Não repetir build que falhar sem investigar, nem consumir nova build após alteração de splash sem autorização.

Referências: https://docs.expo.dev/build-reference/apk/ e https://docs.expo.dev/billing/plans/

## Instalação e preservação

Baixar somente a APK da build registrada, autorizar instalação dessa origem quando Android solicitar e abrir pelo launcher. Não é preciso desinstalar ou limpar Expo Go. A APK usa sandbox e SQLite próprios: desejos/fotos no Expo Go não migram automaticamente e ficam preservados lá; a instalação nova pode começar vazia. Não copiar arquivos privados do Expo Go e não implementar sincronização/backup nesta fase. Se já houver app independente, não desinstalar nem substituir antes de conferir assinatura e preservação.

## Roteiro físico — pendente

- Splash: tema claro do Android, abrir pelo ícone, observar do primeiro instante, encerrar processo e repetir; depois tema escuro. Comparar W, proporção, fundo, moldura/sombra/quadro com Expo Go. Registrar Android/modelo, tema, build e captura/gravação se houver problema. Separar launcher da splash. Só concluir exclusividade do Expo Go após evidência.
- Independência: encerrar Metro, abrir APK pelo ícone; testar em modo avião criar/editar desejo, categorias, comprado, reinício/persistência SQLite e galeria/foto local. URL remota exige internet.
- Título: nomes curtos (Tênis), médios (Camiseta comfort great stories) e longos importados com várias palavras/quebras; conferir três linhas, expansão completa, recolher, edição integral e retorno sem alteração do dado. Testar temas claro/escuro, tela de 320–360 dp e maior tamanho de fonte do Android. Verificar ausência de sobreposição/cortes, controle alcançável e rolagem. Expansão pode ocupar espaço intencionalmente para mostrar tudo; imagem/preço permanecem alcançáveis pela rolagem.
- Repetir salvar/cancelar/remover/trocar foto, URL HTTPS e reinício. Não presumir sucesso da APK com base no Expo Go.

## Integração

PR da Fase 6 deve permanecer aberto sem merge. main e PR #5 não modificados. APK aguarda confirmação de assinatura; splash e título aguardam execução física; integração exige autorização explícita.
