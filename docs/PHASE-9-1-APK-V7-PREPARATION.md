# Fase 9.1 — Preparação segura da APK preview v7

**Parecer: PREPARAÇÃO APROVADA para futura autorização de versionCode/build, com as condições abaixo. Não é autorização para compilar nem aprovação física do backup.**

Data: 22/11/2026, America/Sao_Paulo. Base: `687b465bfafc9aa2425914aac631739776d89bff`, Fase 9.0. Nesta etapa, somente este documento é publicado. Nenhuma alteração de código, configuração, dependência, credencial ou banco; nenhuma APK/EAS Build.

## 1. Repositório e configuração

Antes da preparação, árvore limpa e branch `feature/android-preview-splash` sincronizada com origin em `687b465`. Consulta GitHub: PR #8 aberto, **draft=true, merged=false, mergeable=true**. Depois do commit documental, o HEAD naturalmente passa a ser esse novo commit; a base de produção continua a mesma.

| Item | Evidência conferida |
| --- | --- |
| Expo | SDK 58; instalado 58.0.25, dependência declarada preservada |
| Versão | `expo.version = 1.0.0` |
| Android | `com.danielsln.wish`, **versionCode 6** |
| Banco | SQLite v5; `migrations.ts` e implementação do backup exigem v5, sem nova migração |
| Projeto EAS | `@danielsln/wish`, `dea8d846-f32c-41e2-bf98-2a20f6fbe3d1` |
| Perfil resolvido | `preview`, `distribution: internal`, `buildType: apk`, `developmentClient: false`, `credentialsSource: remote` |
| Versões EAS | `appVersionSource: local`, sem autoIncrement ativado |
| Ambiente | Preview automático; imagem/Node remotos não fixados no eas.json |
| Ferramenta de consulta | EAS CLI 27.11.0 já em cache; nenhuma instalação |

Perfil resolvido pela biblioteca `@expo/eas-json` do CLI existente, sem executar comando de build. Formato esperado é APK instalável, não AAB/dev client. Não há mudança necessária em eas.json para esta preparação. A alteração **6→7 foi apenas simulada em memória**: exatamente uma diferença, `android.versionCode`; app.json permanece em 6.

Referências preservadas: main `29dea24eeddbb2cb4f04caf48b70c1f35e710f11`; branch do PR #5 `feature/supabase-backup` em `4fa742acfcf1d74adadcbe1d5bda320ce3f16cde`. Sem merge, rebase ou alterações nesses destinos.

## 2. Cota gratuita atual — não histórica

Consulta autenticada, somente leitura, ao EAS **22/11/2026 às 17:37:42 de São Paulo** (`2026-11-22T20:37:42Z`). Comando de consulta: `account:usage danielsln --json --non-interactive`, pelo CLI já instalado, sem npx/instalação.

| Informação retornada | Resultado |
| --- | --- |
| Conta / plano | `danielsln` / **Free** |
| Android | **6 de 15 utilizadas; 9 disponíveis** |
| Total de builds | **6 de 30 utilizadas; 24 disponíveis** |
| Ciclo | 01/11/2026 00:00 UTC até 01/12/2026 00:00 UTC |
| Renovação em São Paulo | **30/11/2026 às 21h** |
| Builds excedentes / custo | 0 / US$ 0 |
| Estimativa de cobrança retornada | US$ 0 |
| Addons | Nenhum |
| Builds iniciadas nesta etapa | **Zero** |

Uma build Android cabe no saldo consultado. Isso não reserva crédito nem garante o saldo numa data futura: reconfirmar imediatamente antes da eventual compilação autorizada. A [política oficial do plano Free](https://docs.expo.dev/billing/plans/) informa renovação mensal e ausência de cobrança excedente automática para contas Free. Nenhum plano, método de pagamento, compra, upgrade ou cobrança foi aceito/criado. Se o plano/saldo mudar ou não puder ser consultado com confiança, bloquear a compilação.

## 3. Assinatura, histórico e atualização

Consulta remota somente leitura em **17:37:43**, selecionando apenas metadados/fingerprint pública: credencial padrão **Build Credentials FFwe333Y-s**, vinculada a `com.danielsln.wish` no mesmo projeto. Keystore criada/atualizada em 19/11/2026, sem modificação posterior registrada. Não foram solicitados arquivo keystore, senha, alias privado ou chave.

Certificado público SHA-256:

```text
14028f2c74032b191145bff7206d0c5caae227fa827dd802984e87a682e42103
```

A fingerprint foi **extraída novamente** do bloco de assinatura v2 da APK v6 existente localmente, em leitura, e é idêntica à credencial remota atual. Não é o hash do arquivo APK.

Referência v6: build **`fa5a4f81-6b19-4231-b269-2464f8b7828b`**, commit `b0ce343ff271ba62df29789d31ce96d6b428890f`, 1.0.0 / versionCode 6, package `com.danielsln.wish`. [Registro oficial](https://expo.dev/accounts/danielsln/projects/wish/builds/fa5a4f81-6b19-4231-b269-2464f8b7828b). Histórico EAS atual retornou seis builds Android, todas FINISHED, códigos 1 a 6, perfil preview; nenhum código 7 nessa consulta.

**Evidência suficiente de continuidade da credencial configurada com a APK v6 examinada; não há ainda certificado de uma APK v7.** Após uma eventual compilação, conferir package, versionName, versionCode 7, fingerprint e assinatura do artefato final antes de recomendar instalação. Não houve verificação criptográfica integral por apksigner/jarsigner nesta etapa; essas ferramentas não foram localizadas no PATH. Extração de certificado não substitui essa verificação.

Mantendo mesmo package/assinante, versionCode maior e SQLite v5, é **esperada** a atualização sobre a v6 sem desinstalação, conforme a [regra Android de assinatura](https://developer.android.com/studio/publish/app-signing#considerations). A preservação real de dados v6→v7 continua pendente de teste físico; não foi verificado o aplicativo instalado no telefone. Em conflito de assinatura, interromper: nunca desinstalar ou limpar dados para contornar.

## 4. Auditoria do bundle e ambiente

Reexaminado o export Android local final da Fase 9.0, correspondente ao código de produção inalterado desta base, sem gerar novo export/APK nesta etapa:

- 1.405 fontes no source map; **zero fontes experimentais** (`experiments`, gateway, confiança, SerpApi).
- Zero ocorrências de SerpApi no mapa/bytecode; app extra sem credencial/integração SerpApi. Nenhum import de laboratórios foi acrescentado.
- Bundle `entry-37e05bf3a00e44f8fe368f9b55da4748.hbc`, 2.800.428 bytes; SHA-256 **do bundle** `cb094222a565b01d8edf491c61100446150615a4ed197d2b053b48f1a2d4ea8f`.
- Consulta atual ao EAS apenas nomes/visibilidade: zero variáveis no ambiente preview do projeto e zero compartilhadas pela conta nesse ambiente; nenhum valor secreto foi consultado/gravado.
- Não há `.easignore`: fontes experimentais versionadas podem entrar no arquivo de fontes enviado ao EAS, embora **não entrem no bundle**. Ferramentas, caches, estados e credenciais permanecem ignorados. Não foi criada política nova de upload nesta etapa.
- Busca de fontes/configuração/ambiente é evidência limitada, não prova matemática de ausência de todo segredo possível. Repetir auditoria do artefato final após build autorizada.
- Gateway continua **NO-GO**, sem integração ou implantação; SerpApi e Supabase não foram consultados/integrados.

Resultados sanitizados das consultas e auditorias em `.expo/phase91/`, ignorados pelo Git. Não publicar APKs existentes, bancos, tokens, caches ou logs privados.

## 5. Revisão do backup — contrato e limites reais

Revisão estática das implementações da Fase 9.0 e do código da dependência nativa instalada, sem tocar no catálogo do proprietário. [Formato, implementação, testes e evidências anteriores](PHASE-9-0-LOCAL-BACKUP.md).

| Área | Evidência e limite |
| --- | --- |
| Seletor de arquivo | `File.pickFileAsync({mimeTypes:['*/*']})` usa o contrato atual `{canceled,result}`. Android usa ACTION_OPEN_DOCUMENT; não depende de permissionamento amplo de mídia/armazenamento. |
| Seletor de pasta | `Directory.pickDirectoryAsync` usa ACTION_OPEN_DOCUMENT_TREE; seleção concede acesso ao URI escolhido. Não é folha de compartilhamento nem integração de nuvem. |
| Escrita SAF | `Directory.createFile(name,mimeType)` cria saída nova; handle explícito `FileMode.Truncate` (`wt`), leitura posterior `ReadOnly` (`r`). Não usa File.create em content URI nem modo read/write incompatível. |
| Restrições Android | Em Android 11+, algumas raízes, Download e Android/data/obb não são selecionáveis como árvore. Preferir uma pasta criada pelo usuário, como Documents/Wish Backups, **se o provedor permitir**, sem prometer suporte universal. |
| Provedor | Handles dependem de posição/tamanho; provedor não seekable, arquivo virtual/tamanho desconhecido ou permissão não persistível pode falhar. Falha não vira sucesso. O wrapper File.pickFileAsync instalado transforma exceções em canceled; erro de provedor pode aparecer como nenhum arquivo selecionado. Não altera o catálogo. |
| Consistência | Transação de leitura SQLite/WAL + gate de manutenção para repositório/tema. Não copia wish.db ativo como arquivo bruto. Fotos locais imutáveis por hash; referências remotas permanecem como texto. |
| Restauração | Arquivo inteiro validado antes; cópia anterior completa persistida/relida/verificada; fotos instaladas por hash, sem apagar antigas; transação substitui linhas e confirma integridade/referências/conteúdo. |
| Interrupção/rollback | Journal e hashes do catálogo anterior/esperado; reinício verifica cópia e fotos, aceita somente estado anterior ou esperado. Divergência falha fechado. Erro recuperável pós-commit repõe e verifica o anterior. |
| Limites | **128 MiB**, **512 fotos**, 8 MiB/foto, 20 MP/8192 px por lado; manifesto 256 KiB, catálogo 8 MiB; 10.000 produtos/1.000 categorias/20.000 ofertas. |
| Corrupção | Formato/versão/tipos/UUIDs/FKs/hash/bytes exatos/fotos validados. Conteúdo truncado, excedente, incompatível ou corrompido é rejeitado; sem downgrade/migração ou execução de código. |
| Cancelamento/concorrência | Cancelamento cooperativo antes do commit; fechamento/verificação final não são interrompidos no meio. Uma operação de manutenção por conexão; formulários anteriores à restauração são invalidados. |
| Armazenamento cheio | Verifica espaço privado quando disponível com margem de 16 MiB; staging pede 2× tamanho, cópia anterior também verifica espaço. Capacidade externa SAF pode ser desconhecida: erros de gravação/fechamento/releitura impedem confirmação. Falha de journal/rollback não confirmada bloqueia operações e preserva evidência/cópia. |
| Retenção | Não apaga fotos antigas/compartilhadas, cópias anteriores nem temporários abandonados por encerramento. Pode acumular espaço. Não oferecer limpeza automática como existente. |
| Offline | Caminho de backup não faz pesquisa/download de imagem remota, não exige internet/conta/API; Image decodifica arquivo privado. O provedor escolhido precisa oferecer o arquivo localmente — armazenamento remoto indisponível não é offline garantido. |

[Documentação oficial do SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/) e [Android SAF](https://developer.android.com/training/data-storage/shared/documents-files) sustentam os contratos; os seletores, permissões e provedores ainda precisam de execução nativa. As permissões amplas bloqueadas no app.json não impedem o acesso explícito pelo SAF.

**SHA-256 é verificação de integridade, não criptografia nem autenticação.** O arquivo é legível, contém dados pessoais e pode ser adulterado por quem recalcular hashes. Guardar fora do Wish, em local seguro; para perda do aparelho, manter outra cópia fora dele. Não há senha, assinatura do arquivo, nuvem ou sincronização.

### Riscos residuais que não foram mascarados

1. Android SAF/decodificador/pouco espaço/interrupção **não executados fisicamente** nesta fase. Compilação local anterior não demonstra esses fluxos nativos.
2. Teste anterior matou um processo SQLite em transação/WAL e verificou reabertura; **não demonstrou corte de energia, fsync ou atomicidade física de hardware**. Estado desconhecido continua bloqueado, sem reparo destrutivo automático.
3. Se não for possível validar/copiar integralmente o estado atual (foto/banco corrompidos), a UI não contorna essa proteção para restaurar. Preservar instalação/cópias e pedir recuperação assistida, sem limpar dados.
4. Margem de espaço não é reserva; ENOSPC pode ocorrer depois. Risco maior com catálogo próximo dos limites, fotos órfãs e cópias acumuladas. Não encher o armazenamento real para testar.
5. Erros de seletor podem ser indistinguíveis de cancelamento pela API instalada; a mensagem neutra não confirma um backup. Não foi encontrada necessidade de correção de código obrigatória para esta preparação; limitações estão documentadas, sem alteração não autorizada.
6. URLs legadas com usuário/senha ou fotos privadas ausentes podem impedir exportação completa, sem omissão silenciosa. Se o primeiro backup falhar, parar e relatar; não editar/apagar catálogo para forçar sucesso.

## 6. Plano de validação física sem sacrificar o catálogo real

**Não há isolamento de catálogo dentro do Wish. Backup da produção não autoriza experimentar restauração sobre ela.** Não se deve confiar na primeira exportação ainda não validada como único resgate para um teste destrutivo.

### A. Pré-condição para testes destrutivos

Usar **outro aparelho Android sem dados do proprietário**, ou **outro usuário/perfil Android com armazenamento de aplicativo realmente separado** e suporte confirmado. Alternativa: emulador Android isolado já disponível/autorizado; isso é validação em emulador, não aparelho físico. Não instalar ferramentas, criar perfil ou configurar dispositivo nesta etapa.

- Verificar que a instalação de teste está vazia, que não é o perfil principal e que não compartilha as pastas privadas do Wish. Não importar cópia do catálogo real nesse ambiente.
- Para testar atualização, instalar a APK v6 oficial no ambiente isolado, criar apenas catálogo/fotos/ofertas/notas sintéticos e, futuramente, atualizar com a v7 verificada usando a mesma assinatura. Não é necessário mudar package ou criar outra build.
- Se não houver aparelho/perfil/emulador com isolamento confirmado, **BLOQUEAR testes de restauração, exclusão, interrupção e armazenamento cheio**. Alternativa: validar apenas atualização/exportação não destrutiva e manter as evidências sintéticas Node/web, deixando o restante pendente. Não tratar isso como aprovação nativa.
- Este ambiente de trabalho não tem adb/emulator disponível no PATH e nenhum dispositivo foi examinado. A disponibilidade de isolamento do proprietário permanece **não confirmada**; nenhum teste destrutivo está autorizado no perfil real.

### B. Checklist sintético isolado — preferir antes do uso no catálogo real

- [ ] Registrar aparelho/Android/perfil, build/commit e confirmar isolamento; criar desejos/comprados, categorias próprias, foto local compartilhada entre produtos, referência remota, oferta comum/condicional, PIX/cupom, notas e tema.
- [ ] Atualizar v6→v7 no ambiente isolado, sem desinstalar nem limpar dados; comparar conteúdos após reinício.
- [ ] Exportar com rede desligada para pasta externa local suportada; fechar/reabrir seletor; conferir arquivo no gerenciador do Android.
- [ ] Copiar o arquivo para outro local seguro; comparar tamanho/hash da cópia e validar o conteúdo. Hash não prova que o catálogo está completo: conferir contagens e amostras contra a referência sintética.
- [ ] Cancelar seleção, exportação e prévia; tentar operação concorrente; verificar que não há falso sucesso nem mutação.
- [ ] Criar outro desejo sintético, restaurar o backup original em modo avião, confirmar substituição conscientemente e conferir catálogo completo, fotos, ofertas, notas, IDs/datas e aparência após reiniciar.
- [ ] Inspecionar e restaurar a cópia anterior pelo fluxo explícito; verificar o desejo criado depois do backup e fotos compartilhadas.
- [ ] Rejeitar cópias sintéticas corrompidas/incompletas/futuras, quantidade/tamanho excessivos e referências inválidas; conferir catálogo intacto.
- [ ] Somente no ambiente descartável, reproduzir interrupção controlada e pouco espaço, com cópia externa sintética verificada. Não usar queda de energia improvisada ou preencher todo o telefone real. Registrar limites de reprodutibilidade de ENOSPC nativo.
- [ ] Verificar cancelamento pré-commit, commit protegido, estado anterior/novo após reabertura ou bloqueio conservador; preservar as cópias/journal em falha, sem limpar dados para obter aprovação.
- [ ] Testar fonte ampliada, rolagem, claro/escuro/automático, leitor de tela e confirmação acessível.

### C. Catálogo real — somente fluxo conservador, pelo proprietário

1. Antes de atualizar, registrar privadamente contagens/amostras e tema, sem enviar dados pessoais ao agente. A v6 não tem esta tela de backup; não prometer exportação pelo Wish antes da atualização.
2. Somente após futura build autorizada e verificação do artefato, atualizar sobre a v6 **sem desinstalar/limpar dados**. Preferir que o roteiro sintético nativo acima já tenha passado. Se assinatura/instalação falhar, parar; não contornar.
3. Conferir dados existentes e executar **exportação inicial**, operação de leitura do catálogo, para pasta externa suportada. Não selecionar Confirmar substituição no catálogo real.
4. Conferir confirmação, arquivo não vazio e cópia em outro local seguro fora do aparelho. A inspeção somente leitura da prévia pode conferir formato/contagens/fotos; cancelar a restauração. Não enviar o backup ao GitHub/chat público.
5. Preservar o arquivo original e verificar a cópia por tamanho/hash e conteúdo. Para demonstrar restaurabilidade, usar ambiente isolado com dados sintéticos; não levar o catálogo real para o laboratório desta etapa.
6. Se exportação ou cópia falhar, interromper; manter a instalação e dados intactos. Restauração real futura exige necessidade concreta, cópia independente verificada e decisão explícita, não é um teste de rotina.

## 7. Verificações desta etapa versus evidências anteriores

**Reexecutados agora:** TypeScript (`npm run typecheck`) e ESLint (`npm run lint`), ambos exit 0, sem avisos de lint. Auditorias de configuração/perfil/bundle, consultas atuais EAS e nova extração do certificado v6 executadas acima.

**Evidências anteriores, não reexecutadas nesta preparação documental:** Fase 9.0 com **477 testes Node/runtime** (428 regressões anteriores + 49 novos), **17 suítes web**, exports locais web/Android e Expo Doctor **19/20**. Seis avisos de versões conhecidos permanecem sem atualização/supressão. Android físico do backup continua pendente; 10/10 físicos da v6 referem-se à Fase 8.1, que ainda não tinha backup local.

Nenhum catálogo real foi acessado, APK gerado, EAS Build executado, credencial modificada, pacote instalado, versionCode alterado, serviço integrado, recurso remoto criado ou cobrança aceita. Consultas remotas foram exclusivamente EAS/GitHub/documentação oficial, dentro da auditoria autorizada; zero consulta SerpApi/Cloudflare/Supabase.

## 8. Condições para a próxima autorização

- Preparação técnica/documental **APROVADA**, sem falha nova de código que exija alteração nesta etapa.
- Autorização futura deve permitir explicitamente **versionCode 6→7** e **uma única build preview**; saldo/gratuidade e estado do repositório/PR/credencial precisam ser reconfirmados antes da execução.
- Reutilizar credencial padrão existente, não gerar/rotacionar chave. Conferir manifesto/certificado do artefato v7 antes de recomendar instalação.
- Manter os testes destrutivos bloqueados no perfil real e em qualquer ambiente sem isolamento confirmado. Isso não é impeditivo para documentar/preparar a futura build; impede declarar validada a restauração nativa.
- Sem merge ou nova fase automática. PR #8 permanece em rascunho; main, PR #5, SQLite v5, dependências, **versionCode 6** e NO-GO do gateway preservados.
