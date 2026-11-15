# Wish no Expo Go — Windows e Android

Revisão: 15/11/2026. Prioridade atual: Expo Go gratuito; APK independente e Supabase adiados.

## Estado preservado do projeto

- `main`: `025429d4b885641be757915c5aff392f4b5ceb94`, com as Fases 1–3, identidade azul e preparação Android (PRs #1–#4 integrados).
- [PR #5](https://github.com/DanielSln/Wish/pull/5), `feature/supabase-backup`, permanece aberto e preservado, sem alterações ou integração nesta tarefa. Não use essa branch para este roteiro. O Wish desta entrega não exige conta nem configuração Supabase.
- A branch `chore/android-device-testing`, `eas.json` e [o guia de APK](ANDROID-TESTING.md) foram preservados. A tentativa anterior de build não gerou APK por falta de espaço; não há APK novo nesta entrega. Não foi encontrada branch ou PR adicional de backup local. Não existe backup local exportável implementado aqui.
- Esta entrega está em `feature/expo-go-readiness`, criada diretamente da main. Não modifica esquema, nome do banco, UUIDs ou migrações: SQLite permanece v2.

## Requisitos

- Windows com **Node.js 24 LTS**, npm e Git disponíveis no PowerShell/Terminal. O SDK 58 requer Node 22.13+; Node 24 é recomendado também para os testes com node:sqlite.
- Android compatível com SDK 58 (a documentação do SDK indica Android 7+), espaço disponível e acesso à internet para instalação/primeira carga.
- **Expo Go compatível com SDK 58**. A dependência do Wish continua `expo ~58.0.25`, sem upgrade de SDK. Cada build de Expo Go suporta uma versão de SDK; a versão da Play Store pode não corresponder.
- Instale o cliente indicado na [página oficial para Android/SDK 58](https://expo.dev/go?device=true&platform=android&sdkVersion=58). Na consulta oficial de 15/11/2026, o cliente Android indicado era **Expo Go 58.0.5**. Prefira sempre o download oficial correspondente ao SDK 58, não APK de terceiros. Se a Play Store já fornecer a versão compatível, pode usá-la.
- Computador e celular na mesma rede Wi-Fi para LAN. Não precisa de Android Studio, Java, emulador, conta Play Store de desenvolvedor ou build EAS para esse fluxo. O aplicativo Wish não exige login. O serviço de túnel pode solicitar autenticação própria da ferramenta Expo/ngrok conforme disponibilidade; não é uma conta no Wish.

Verifique no PowerShell:

```powershell
node --version
npm --version
git --version
```

## Primeira instalação no computador

Escolha uma pasta de projetos. O caminho abaixo é um exemplo relativo, sem depender da estrutura do computador do desenvolvedor:

```powershell
git clone https://github.com/DanielSln/Wish.git
cd Wish
git fetch origin
git switch --track origin/feature/expo-go-readiness
npm ci
npx expo start --go
```

Use a branch de revisão acima enquanto o novo PR estiver aberto. **Depois da integração autorizada**, pode executar na main:

```powershell
git switch main
git pull --ff-only
npm ci
npx expo start --go
```

Não execute os dois blocos ao mesmo tempo. O comando usa a CLI local do projeto; não é preciso instalar expo-cli global. `npm ci` usa package-lock.json e foi validado nesta revisão. O servidor continua aberto no terminal até Ctrl+C.

## Se já tem uma cópia do Wish

Se você já executou o PR #5 no mesmo armazenamento do Expo Go, ele pode ter migrado o banco para v3. Esta branch usa v2 e recusa versões futuras **sem apagar o banco**. Nesse caso, não limpe dados nem reinstale para contornar: volte à branch que criou o banco e planeje uma transferência explícita em tarefa separada. Não há downgrade automático. Essa limitação não afeta a atualização normal da main v2 para esta branch v2.

Entre na pasta existente e confira alterações antes de trocar de branch. Não clone por cima nem apague arquivos:

```powershell
git status
git fetch origin
```

Se houver alterações próprias, preserve-as em commit/branch antes de continuar; não use reset --hard, clean ou force push. Se a branch ainda não existe localmente:

```powershell
git switch --track origin/feature/expo-go-readiness
npm ci
npx expo start --go
```

Se ela já existe localmente:

```powershell
git switch feature/expo-go-readiness
git pull --ff-only
npm ci
npx expo start --go
```

## Abrir pelo QR Code

1. Abra Expo Go compatível no Android. Coloque celular e computador na mesma rede Wi-Fi.
2. No computador execute `npx expo start --go` na pasta Wish. O terminal deve indicar Expo Go e mostrar QR Code/URL `exp://...`.
3. Use **Scan QR Code** no Expo Go e escaneie o QR do seu terminal. Autorize a câmera apenas se o leitor solicitar. Essa permissão pertence ao Expo Go; o Wish não usa câmera, fotos, contatos ou localização.
4. Aguarde baixar o bundle. O Wish abre diretamente na lista, com Início, Categorias, Adicionar, Comprados e Configurações.

O app usa rede para carregar o JavaScript durante o desenvolvimento, importar páginas e baixar imagens. Não precisa de permissão Android para gerenciar armazenamento: SQLite fica na área privada do projeto no Expo Go.

**O endereço do servidor Codex Web não é o endereço do seu computador.** Os testes desta entrega rodaram apenas no ambiente de desenvolvimento; não foi disponibilizado um QR remoto para seu celular. Execute o servidor no Windows e use o QR gerado ali.

## Problemas comuns

| Sintoma | O que fazer |
| --- | --- |
| “Project is incompatible with this version of Expo Go” | Instalar Expo Go correspondente ao SDK 58 pela página oficial. Não atualizar o SDK do Wish ou versões React Native isoladamente para eliminar a mensagem. |
| QR não abre / timeout / “Unable to load script” | Confirmar mesmo Wi-Fi, evitar rede de convidados com isolamento, conferir endereço LAN do computador e manter Metro aberto. Verificar VPN/proxy. No Firewall do Windows, permitir Node.js na rede privada; não desligar o firewall inteiro. |
| LAN não funciona | Parar Metro com Ctrl+C e tentar o túnel abaixo. Tunnel precisa de internet e serviço de terceiros disponível. |
| npm.ps1/npx.ps1 bloqueado pelo PowerShell | Usar `npm.cmd ci` e `npx.cmd expo start --go`, ou abrir Prompt de Comando. Não precisa mudar a política global de execução. |
| porta 8081 ocupada | Parar outro Metro ou usar `npx expo start --go --port 8082`; escanear o novo QR. |
| cache antigo após atualizar a branch | Parar Metro e usar `npx expo start --go --clear`. Cache de Metro é diferente do banco SQLite; não limpar dados do Expo Go. |
| módulo nativo ausente / “React Native version mismatch” | Conferir checkout correto, rodar `npm ci`, instalar o Expo Go SDK 58 e reiniciar Metro com --clear. Não instalar dependências nativas aleatórias. |
| HTTP 403/429, login da loja ou ausência de metadados | Respeitar o bloqueio; preencher manualmente. Túnel do Expo não é proxy de scraping e não contorna bloqueios da loja. |
| navegador recusa importação por CORS | É limitação do acesso web à loja; o resultado pode diferir no Android. Não usar proxy público para contornar. Cadastro manual continua disponível. |

Alternativa gratuita de rede:

```powershell
npx expo start --go --tunnel
```

`@expo/ngrok` já consta no lockfile. O comando acima usa o túnel padrão da CLI, que nesta versão exige autenticação Expo. A opção legada `npx expo start --go --tunnel ngrok` também é válida; neste ambiente ela terminou com timeout. Essa autenticação da ferramenta não adiciona login ao Wish. O túnel temporário pode sofrer fila, bloqueio da rede ou indisponibilidade. Não foi validado um túnel acessível por celular nesta entrega e não é necessário contratar serviço pago. Se falhar, retorne à LAN ou tente outra rede confiável.

## Roteiro de uso e persistência

1. **Categorias:** a lista inicial vem automaticamente do SQLite: Casa, Roupas e Tecnologia, além das categorias já criadas. Não há classificação de produtos por IA. Criar/renomear uma categoria mantém referências; excluir categoria com produtos ativos, inclusive comprados, deve ser impedido.
2. **Manual:** Adicionar → digitar só o nome → Continuar com esse nome. Escolher categoria e prioridade; preço é opcional. Campos de URL, descrição, loja, anotações e nova categoria ficam em Mais detalhes e categorias. Salvar e conferir detalhes. Editar, pesquisar, filtrar e ordenar.
3. **Link:** em Adicionar, colar um link direto HTTPS da loja escolhida e tocar Adicionar por link. Para host habilitado, a prévia inicia após cerca de 900 ms sem edição; Buscar informações permite tentar novamente. Conferir nome, imagem, descrição, loja, preço informado pela página e URL. Em Revisar e escolher categoria, editar o necessário e salvar. Nenhum item é salvo apenas por consultar uma prévia.
4. **Limites de importação:** somente os hosts exatos de Amazon Brasil, Mercado Livre, Magalu, KaBuM! e Casas Bahia em import-policy.ts. A presença na lista não garante que a loja entregue metadados. Links encurtados, redirecionamentos, hosts não habilitados, páginas excessivas, login e bloqueios continuam recusados. Não há busca em outras lojas, execução de scripts da página ou contorno de bloqueios. Imagens só são preenchidas de CDNs habilitadas; na ausência ou falha de imagem aparece o W.
5. **Preço:** é um valor informado nos metadados, não cotação ao vivo. Conferir vendedor, variante e frete na loja. Preço ausente, moeda não confirmada, oferta agregada/ambígua ou validade vencida/futura/inválida fica em branco. Não é atualizado automaticamente depois de salvar.
6. **Falha de extração:** tocar Preencher manualmente. Um link HTTPS público válido é preservado como URL original, inclusive de outra loja. Nome/preço/imagem não são inventados. URL insegura é recusada para consulta e não é copiada para o formulário por esse fluxo.
7. **Comprados:** marcar um desejo como comprado e abrir Comprados; deve aparecer no mesmo catálogo, sem criar outro banco. Reverter se desejar.
8. **Temas:** em Configurações escolher Claro/Escuro/Automático. No automático, alterar o tema do Android e conferir o resultado. Fechar o Wish, reabrir o mesmo projeto no Expo Go com Metro acessível e verificar produto, categoria, status e aparência persistidos.
9. **Modo avião:** primeiro carregar o Wish com conexão. Sem recarregar o bundle, ativar modo avião; criar/editar desejo, mudar prioridade/status e consultar catálogo. Essas operações são locais. Importação e imagens não carregadas antes podem falhar. Depois reconectar, fechar/reabrir o projeto e conferir que as alterações persistiram.

Expo Go é um cliente de desenvolvimento. Não garante iniciar o projeto do zero em modo avião após encerrar o processo, apagar cache ou perder o bundle. Recarregar/abrir de novo pode precisar do computador e Metro. Não confundir isso com perda de persistência SQLite.

## Limites e preservação dos dados

O banco continua wish.db/v2, sem migração nesta entrega. Cada sandbox (navegador, projeto no Expo Go, APK próprio) tem dados separados. Trocar host/origem de desenvolvimento ou reinstalar/trocar o cliente pode afetar o acesso ao armazenamento do projeto. Mantenha a mesma pasta/slug/configuração e reabra o mesmo projeto; não desinstale Expo Go, limpe seus dados ou mude de SDK para testar persistência. Não há exportação/restauração automática entre essas sandboxes, nem backup em nuvem nesta branch. Evite usar o ambiente de desenvolvimento como única cópia de dados insubstituíveis.

Ícone próprio, splash e configurações nativas de um APK podem aparecer diferentes no Expo Go; não são critérios para validar o APK adiado. Para uso independente de Metro no futuro, retomar o perfil APK preservado em uma tarefa separada. Supabase permanece no PR #5 para revisão futura.

## Evidências e o que falta testar

- Automatizados: testes de parser/transporte e SQLite (cadastro, edição, categorias, filtros, comprados, tombstones, migração e aparência). Novas regressões cobrem validade de preço.
- Estática/compatibilidade: npm ci, TypeScript, ESLint, Expo Doctor, expo install --check; SDK 58 mantido. SQLite, Symbols e os demais módulos nativos existentes têm suporte no Expo Go correspondente; não foi adicionada biblioteca nativa.
- Servidor: `expo start --go` iniciou e entregou manifesto Android `runtimeVersion=exposdk:58.0.0`, com expoGo e bundle Android. Isso confirma o caminho da CLI, não execução no aparelho.
- Navegador: suítes Playwright em tests/ui, usando metadados/imagens de fixture para importação. Não são resultados reais de lojas nem testes físicos.
- **Ainda pendente:** abrir QR no Android físico/Expo Go 58, testar SQLite após encerrar o processo, teclado/rolagem/botão voltar, ícones, temas com sistema Android, modo avião com app carregado, limites reais das lojas e URLs de imagens. Não há dispositivo Android disponível nesta entrega.

Verificações locais opcionais no computador (nenhuma delas exige Supabase):

```powershell
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo install --check
```

As suítes de navegador são opcionais e precisam de Playwright/Chromium fornecidos pelo ambiente, sem incluí-los no app. Com Metro web ativo, executar tests/ui/navigation.cjs e tests/ui/import-flow.cjs, definindo WISH_TEST_URL quando a porta não for 8082/8093. WISH_PLAYWRIGHT_MODULE e WISH_CHROMIUM_PATH aceitam instalações externas.

Referências: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo Go incompatível](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/), [CLI e túnel](https://docs.expo.dev/more/expo-cli/), [SQLite SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/).
