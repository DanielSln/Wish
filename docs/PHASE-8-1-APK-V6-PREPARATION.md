# Fase 8.1 — preparação segura da APK preview v6

Data: **22/11/2026**, America/Sao_Paulo. Base conferida: `e7f2c010ee185a31e7b176f35a0073df13ace683`, conclusão da Fase 8.0.

## Parecer

**APROVADA a preparação documental e a reutilização da configuração/credencial existentes.** Não foi identificado impedimento técnico para uma futura alteração isolada de versionCode 5 para 6. **O versionCode permanece 5 e a compilação NÃO está autorizada nesta etapa.**

A identidade pública do certificado da APK v5 coincide com a credencial padrão atual do EAS e com as APKs v2–v4. Há evidência para esperar atualização sobre a v5 mantendo package e assinatura. Isso não aprova a assinatura de um artefato v6 ainda inexistente nem garante seu funcionamento ou preservação de dados sem teste físico.

Única alteração versionada desta etapa: este documento. Nenhum código, configuração, dependência, SQLite, imagem ou credencial foi modificado. Nenhuma APK foi gerada ou baixada integralmente. Nenhuma instalação, EAS Build, consumo de cota de compilação, SerpApi, Cloudflare, Supabase, merge ou rebase.

## 1. Estado do repositório

- Branch: `feature/android-preview-splash`, limpa e sincronizada com origin no início, HEAD `e7f2c01`.
- PR #8: aberto, em rascunho, sem merge, GitHub `mergeable: true`.
- Main preservada em `29dea24eeddbb2cb4f04caf48b70c1f35e710f11`.
- PR #5 / `feature/supabase-backup` preservado em `4fa742acfcf1d74adadcbe1d5bda320ce3f16cde`.
- Conferência dos refs com `git ls-remote`; comparação dos arquivos de produção/configuração contra `e7f2c01` sem diferenças.

Publicação autorizada somente deste conteúdo documental novo; branch/PR existentes, sem alteração de histórico. O hash do commit documental e a nova sincronização são apresentados na entrega.

## 2. Configuração conferida

| Item | Estado atual / reutilização prevista |
| --- | --- |
| App / slug | Wish / wish |
| Expo | SDK **58**, dependência `~58.0.25`, instalada `58.0.25` |
| VersionName | **1.0.0**; deve permanecer |
| VersionCode | **5**; proposta futura **6**, ainda não aplicada |
| Package Android | `com.danielsln.wish`; deve permanecer |
| SQLite | **v5**, migrações/backup/repositório intactos |
| EAS owner / projeto | `@danielsln/wish` |
| Project ID | `dea8d846-f32c-41e2-bf98-2a20f6fbe3d1` |
| Perfil | `preview` |
| Distribuição | `internal` |
| Android buildType | `apk`, não AAB |
| Development client | `false`; aplicativo instalado independente do Metro/Expo Go |
| Credenciais | `remote`, padrão resolvido pelo EAS CLI já instalado |
| Fonte da versão | `cli.appVersionSource: local` |
| Incremento automático | Não configurado; mudança futura será explícita em app.json |
| Ambiente EAS | `preview`, selecionado automaticamente por internal + developmentClient false |
| Image / Node remoto | Não fixados no eas.json; seleção automática do EAS, sem promessa de reprodução exata da imagem anterior |
| Config nativa | Sem pastas android/ios versionadas, workflow customizado ou override de Gradle para este perfil |

Perfil resolvido com a biblioteca `@expo/eas-json` já disponível no EAS CLI **27.11.0** em cache, sem instalar ferramentas e sem acionar comando de build. Foram retornados `credentialsSource: remote`, `distribution: internal`, `developmentClient: false`, `buildType: apk`.

Não foi necessário alterar eas.json. O ambiente automático preview foi confirmado no código instalado do CLI e na [documentação oficial de ambientes](https://docs.expo.dev/eas/environment-variables/usage/). O [perfil APK](https://docs.expo.dev/build-reference/apk/) mantém o formato instalável solicitado.

## 3. Histórico remoto das APKs

Consulta autenticada **somente leitura** ao EAS, em 22/11/2026 às 15:44:51 de São Paulo. Foram solicitados até 50 registros Android; retornaram cinco. Todos: **FINISHED**, perfil **preview**, distribuição **INTERNAL**, SDK **58.0.0**, versão **1.0.0** e package `com.danielsln.wish`.

| APK / versionCode | Build ID | Commit |
| --- | --- | --- |
| v1 / 1 | `11b50d96-9fa9-43ab-b216-2b654093c6c4` | `1e3ed3f8677b42669b7ee331f4c4bb8392e4218b` |
| v2 / 2 | `24c1620d-c20b-4188-9d1a-82dce39fe741` | `d921df62fc163cf1e27084d231b21df11718ed47` |
| v3 / 3 | `d66874a8-2cd9-4d32-a767-70dd0bf43465` | `885f77979ce69a4d9345918954530660521b5196` |
| v4 / 4 | `8f024119-ee70-46f2-8748-bc0b3221ac79` | `bce9227b7e00c1561bf3c71d93761a7fe29dae84` |
| v5 / 5 | `e2818ddd-5a9d-4bb0-b4ad-f67d814572dc` | `5a95361991b8e4aa73c664e1ceea3e1fa5578333` |

[Registro oficial da v5](https://expo.dev/accounts/danielsln/projects/wish/builds/e2818ddd-5a9d-4bb0-b4ad-f67d814572dc). Não houve build com versionCode 6 nesse histórico consultado; não é reserva desse número. Reconfirmar antes de uma futura alteração/compilação autorizada.

## 4. Evidência de assinatura e atualização

Credencial remota padrão atual: **Build Credentials FFwe333Y-s**, vinculada ao mesmo projeto/package. Metadados indicam a mesma keystore criada em 19/11/2026, sem atualização posterior registrada. A consulta selecionou somente identificação, indicador de padrão, datas e fingerprint pública; **não requisitou keystore, senha, alias ou chave privada**.

SHA-256 **do certificado público**:

```text
14028f2c74032b191145bff7206d0c5caae227fa827dd802984e87a682e42103
```

| Evidência conferida nesta etapa | Resultado |
| --- | --- |
| Credencial padrão atual do EAS | Fingerprint acima |
| Certificado presente na APK v5 oficial | Idêntico |
| Certificados das APKs v2, v3 e v4 locais existentes | Idênticos, extraídos novamente |
| Certificado da futura APK v6 | **Ainda não existe / não verificado** |

A v5 foi examinada por três leituras HTTPS parciais (`Range`, respostas 206) do artefato oficial, totalizando **81.965 bytes** de um arquivo de **106.671.750 bytes**. Foram localizados o diretório ZIP, o APK Signing Block e o certificado X.509 do assinante v2 conforme o [formato oficial Android](https://source.android.com/docs/security/features/apksigning/v2). Não foi criado arquivo APK novo ou baixado o artefato completo. As APKs v2–v4 já existentes também foram abertas apenas para leitura de certificado.

**Limite da prova:** extrair/comparar a identidade do certificado não é verificação criptográfica integral da assinatura/conteúdo da APK por apksigner. Não se confundiu fingerprint do certificado com hash SHA-256 do arquivo APK. Também não se conferiu o certificado diretamente do aplicativo instalado no telefone; a expectativa pressupõe que ele seja a v5 oficial examinada.

A [regra Android de continuidade da assinatura](https://developer.android.com/studio/publish/app-signing#considerations), package preservado, versão maior e ausência de mudança no esquema permitem **esperar** instalação como atualização, sem desinstalar. Após uma eventual build autorizada, confirmar certificado/manifest do artefato final antes de instalar e validar a preservação no aparelho. Se houver incompatibilidade, interromper; não desinstalar nem limpar dados para contornar.

## 5. Ambiente, segredos e isolamento

- Consulta ao EAS selecionou **somente nomes/visibilidade**, sem valores: zero variáveis no ambiente `preview` do projeto e zero compartilhadas pela conta nessa consulta. Nenhuma variável foi criada, alterada ou baixada para arquivo .env.
- app.json não tem credencial SerpApi em extra; src/app/package não integram SerpApi ou gateway.
- Reinspecionado o bundle Android local existente da Fase 8.0, cujo código de produção permanece inalterado: **1.395 fontes**, zero módulos dos experimentos 7.x e zero ocorrências de `serpapi` no source map/bytecode. O resultado é evidência do bundle local examinado, não auditoria de uma futura APK.
- Bundle examinado: `entry-903f37149a4f80220a49b2441acc7fec.hbc`; SHA-256 **do bundle**, não do certificado nem de APK: `b9617130ee19d57060eb172538bcffe0f0e6beca698ca51382491fbeaed67909`.
- Conferidos os ignores para .env, caches .expo, estados, ferramentas e credenciais locais dos experimentos. Nenhum desses caminhos está versionado. Nenhum material privado será publicado com este relatório.
- **Distinção importante:** não há .easignore; o upload EAS usa os .gitignore. Fontes experimentais versionadas podem fazer parte do arquivo de fontes enviado ao EAS, embora não entrem no bundle do aplicativo. Ferramentas/estados/segredos locais permanecem ignorados. Caso se queira excluir também todas as fontes de laboratório do upload, solicitar autorização para uma política .easignore separada, preservando as regras de segurança existentes; não alterada nesta etapa documental. [Referência oficial](https://docs.expo.dev/build-reference/easignore/).
- O parecer remoto do gateway continua **NO-GO**; não houve integração, teste remoto, deploy, consulta SerpApi ou acesso a Supabase.

Os resultados brutos sanitizados de metadados públicos/certificados, resolução de perfil e auditoria ficaram em `.expo/phase81/`, ignorados. Sessão autenticada usada internamente pelo CLI, sem impressão/publicação de token. Não se afirma uma garantia absoluta de ausência de qualquer segredo codificado por simples busca textual; as evidências combinam código, configuração, ambiente e módulos efetivamente incluídos.

## 6. Alteração de versão proposta, não aplicada

Foi simulada **em memória** uma cópia de app.json com android.versionCode = 6. A comparação recursiva encontrou exatamente uma diferença: `android.versionCode`. Nenhum arquivo foi escrito com a versão candidata.

Após nova autorização, é viável alterar exclusivamente **5 → 6**, conservar `expo.version: 1.0.0`, package, owner, projectId, credencial, dependências e SQLite, criar commit isolado e reconferir o remoto. A [gestão local de versões](https://docs.expo.dev/build-reference/app-versions/) já está configurada; não precisa mudar para remote ou ativar autoIncrement.

**Não compilar o estado atual como v6: app.json ainda contém versionCode 5.** A autorização desta fase não autoriza a alteração nem a execução posterior de build.

## 7. Verificações e riscos antes da compilação

TypeScript e ESLint **reexecutados e aprovados** nesta etapa. As **428 aprovações**, 16 suítes web e exports locais da Fase 8.0 são evidências anteriores documentadas em [PHASE-8-0-IMPORT-UX.md](PHASE-8-0-IMPORT-UX.md); não foram reapresentadas como novos testes desta fase. Não foram reexecutados testes de interface, Android físico, exportação, Expo Doctor ou compilação.

Sem diferenças em src, assets, package/lockfile, app.json, eas.json, SQLite/migrações ou experimentos. Riscos/pendências:

1. **Autorizações pendentes:** alterar versionCode e compilar exigem nova autorização. Nenhuma cota foi reservada/consumida por build.
2. **Cota/preço futuros:** plano/saldo EAS não foram reconsultados nesta etapa. Antes de qualquer build, reconfirmar gratuidade/saldo e interromper se houver risco de cobrança; não reutilizar números históricos como saldo atual.
3. **Assinatura futura:** manter a credencial padrão existente, sem gerar/substituir chave. Reconfirmar a fingerprint antes da build e no artefato final; a v6 não foi assinada aqui.
4. **Ambiente remoto automático:** image/Node não estão fixados no perfil. Reconfirmar seleção e compatibilidade na etapa de compilação; não prometer ambiente bit a bit idêntico à v5. Nenhuma atualização de dependência foi feita.
5. **Doctor conhecido:** permanece o resultado anterior **19/20**, por seis divergências de versões (@expo/ui, expo, file-system, router, sqlite e web-browser), sem nova execução, upgrade ou supressão. Não impede esta análise documental, mas deve constar da decisão de build.
6. **Android não validado:** teclado, galeria, acessibilidade/fontScale/TalkBack, suspensão e atualização real v5→v6 dependem de aparelho. A migração histórica SQLite v4→v5 continua sem validação física.
7. **Importação:** lojas podem bloquear ou depender de JavaScript; Shopee/AliExpress continuam manuais. A preparação não melhora suporte real nem autoriza SerpApi. Imagens remotas precisam de rede; fotos locais não. Fotos confirmadas em rascunhos abandonados podem permanecer privadas, conforme política conservadora existente.

## 8. Checklist Android compacto — futura APK v6

Executar somente após autorização e obtenção da APK correta. Registrar aparelho/Android, APK/build/commit e resultado de cada item; distinguir erro da loja de falha do Wish.

- [ ] **Antes/depois da atualização:** registrar contagens e amostras de desejos, categorias personalizadas, imagens privadas, ofertas, notas, comprados e tema; instalar sobre a v5 oficial sem desinstalar/limpar dados; fechar e reabrir e comparar.
- [ ] **Consulta lenta:** colar link, preencher nome/categoria/prioridade durante o carregamento; campos e Desejar acessíveis com teclado aberto.
- [ ] **Cancelar/trocar link:** cancelar conserva o rascunho; nova consulta funciona; trocar A por B não recebe nome/imagem/preço tardios de A.
- [ ] **Resposta atrasada:** editar manualmente nome/categoria/imagem; resposta não sobrescreve escolhas. Salvar/navegar/suspender/retornar não reabre nem modifica desejo por callback antigo.
- [ ] **Desejar:** salva uma vez com toques consecutivos, retorna à lista e confirma; permite preço/imagem ausentes; falha conserva campos e permite retry. Nome/categoria obrigatórios continuam validados.
- [ ] **Edição opcional:** nome novo não troca categoria escolhida; cancelar restaura a prévia; concluir salva sem outra revisão obrigatória.
- [ ] **Galeria:** escolher/cancelar/confirmar/substituir/remover; reabrir app e conferir imagem correspondente, proporção e foto local sem rede; manter dados antigos.
- [ ] **Comprados:** marcar retira de Início/Categorias e coloca em Comprados; reverter retorna à categoria correta; confirmar persistência.
- [ ] **PIX/cupons/ofertas:** conferir condição e valor explícito na loja; não converter parcela/cupom percentual em total. Ofertas manuais comuns ordenadas, condicionais separadas, preço original intacto; editar nota e reabrir.
- [ ] **Temas/teclado/acessibilidade:** claro/escuro/automático, fonte ampliada/TalkBack, cinco destinos e textos completos, tela pequena, rolagem e ações sem sobreposição do teclado.
- [ ] **Offline/reinício:** em modo avião, abrir APK, lista/categorias/detalhes/fotos locais, editar e salvar, conferir notas/ofertas/comprados/tema após encerrar/reabrir. Importação/imagens remotas não são requisito offline.

Em perda aparente de dados, falha de banco ou assinatura incompatível: parar, preservar a instalação e relatar. Não desinstalar, limpar armazenamento, reduzir versão do banco ou tentar APK antiga sobre banco incompatível.

**Conclusão: preparação APROVADA, com limites explicitados. Aguardar autorização para mudar versionCode e, separadamente ou de forma explícita conjunta, executar uma futura build.**
