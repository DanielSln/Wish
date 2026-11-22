# Fase 6.1 — APK preview v2

## Escopo e autorização

O proprietário autorizou uma única build Android gratuita, sem repetição automática, cobrança, nova keystore, merge ou alteração da instalação existente. Branch feature/android-preview-splash, PR #8 aberto/em rascunho. main e PR #5 preservados.

## Pré-build

- Conta confirmada: danielsln. Projeto: @danielsln/wish, dea8d846-f32c-41e2-bf98-2a20f6fbe3d1.
- Plano oficial consultado pela API usada pelo EAS CLI: Free; antes da build 1/15 Android usadas (14 disponíveis); 1/30 total. Período informado termina em 01/12/2026 UTC. Não aceito pagamento/upgrade.
- Wish versionName 1.0.0 preservado; android.versionCode alterado somente de 1 para 2. Package com.danielsln.wish, owner, projectId, splash e W preservados.
- EAS preview resolvido: credentialsSource remote, distribution internal, buildType apk, developmentClient false; appVersionSource local. Bundle incluído, sem Metro/Expo Go.
- Metadados públicos da credencial padrão EAS conferidos, sem recuperar material privado. Certificado extraído da APK v1 tem o mesmo SHA-256 da credencial padrão: 14028f2c74032b191145bff7206d0c5caae227fa827dd802984e87a682e42103. A build será enviada com freeze-credentials e modo não interativo para impedir geração/troca de credencial; se isso falhar, interromper sem repetir.
- 67 testes Node/SQLite aprovados, zero falhas/skips; TypeScript e ESLint aprovados. Expo config e EAS config aprovados.
- Expo Doctor 19/20 pelos seis avisos já investigados (expo, @expo/ui, file-system, router, sqlite, web-browser). Dependências preservadas, sem audit fix --force. Não há falha crítica nova identificada.

## Revisão do banco

Apenas tabela/índice product_offers adicionados na v5. Não há alteração dos valores de produtos/categorias/notas/preços/referências de foto. Bancos existentes exigem backup online SQLite para destino privado novo, vazio e com UUID; integrity_check, versão e contagens conferidas antes da migração. Falha interrompe a inicialização com banco preservado. Transação cria estrutura, registra nome do backup e só então user_version=5; rollback preserva v4. Nenhuma exclusão automática de bancos/fotos/backups. Guardas de versão ativas, v3 separada e >5 recusadas.

Os testes exercitam cópia WAL e recuperação reais no SQLite Node, não a API nativa do Expo no Android. A v2 precisa de validação física ao atualizar sobre v1: instalar corretamente não prova que a migração/backup funcionaram no aparelho. Se falhar, não limpar dados, não desinstalar, não voltar ao código v4 sobre banco v5. [Procedimento assistido de recuperação](PHASE-6-1-REFINEMENTS.md).

## Compilação

Estado final: **FINISHED — sucesso**. Única build enviada: 24c1620d-c20b-4188-9d1a-82dce39fe741, commit d921df62fc163cf1e27084d231b21df11718ed47, preview/internal/APK, versão 1.0.0/versionCode 2. CLI confirmou reutilização de Build Credentials FFwe333Y-s (default), sem gerar keystore. Artefato oficial baixado e ZIP conferido: AndroidManifest.xml, classes.dex e assets/index.android.bundle (2.643.948 bytes). Não é apenas export nem AAB. Cópia local ignorada no Git: D:/Projetos/Wish/.expo/phase61-v2/Wish-1.0.0-v2.apk. Nenhuma segunda tentativa sem nova autorização.

Acompanhar: https://expo.dev/accounts/danielsln/projects/wish/builds/24c1620d-c20b-4188-9d1a-82dce39fe741

## Resultado e integridade

- [Baixar APK v2](https://expo.dev/artifacts/eas/GCqlO_war8piNQUMzXkKzgNlDyL_DpqC9T3js_EuooY.apk).
- Tamanho: 106.616.646 bytes (~101,68 MiB).
- SHA-256 do arquivo: 27dea69d74b076c06b4f06b6a864669b98a35e790b502f6237eeb668e517fedd.
- Certificado público extraído da APK v2 coincide exatamente com APK v1 e credencial padrão EAS: 14028f2c74032b191145bff7206d0c5caae227fa827dd802984e87a682e42103. Conferência de identidade do certificado não é teste de instalação/execução física.
- Cota oficial após conclusão: Free, 2/15 Android e 2/30 total; antes 1/15 e 1/30. Consumo desta tarefa: uma build Android. Restam 13 Android no período consultado. Nenhuma cobrança/plano pago ou segunda tentativa.
- APK, banco e material de assinatura não adicionados ao Git. Certificado público e hash podem ser registrados; nenhuma keystore/senha foi baixada ou exposta.
- Migração/backup Android, atualização real sobre v1 e checklist abaixo ainda aguardam proprietário. Sucesso de compilação e testes Node não aprovam v5 fisicamente.

## Atualização no celular

1. Manter Wish v1 instalado e preservar seu armazenamento.
2. Baixar apenas o link oficial da v2 registrado neste relatório quando disponível.
3. Instalar por cima da v1, com mesmo package/assinatura e versionCode maior. Não desinstalar nem limpar armazenamento/cache de dados.
4. Abrir normalmente, aguardar backup/migração e verificar seus desejos.
5. Se Android recusar por assinatura incompatível, interromper e informar a mensagem; não usar desinstalação como atalho.

Não houve acesso nem modificação manual dos arquivos privados do celular nesta sessão. A instalação/atualização e a migração real dependem do proprietário.

## Checklist físico pendente

- [ ] Instala sobre v1; abre sem erro SQLite.
- [ ] Desejos, categorias, notas, fotos locais, prioridades e comprados preservados.
- [ ] Reabrir app e conferir persistência/offline com Metro/Expo Go desligados.
- [ ] Inicial compacta, produtos aparecem antes, imagem próxima do cabeçalho e título legível/expansível.
- [ ] Cores de prioridade e temas claro/escuro; tela pequena e fontes ampliadas.
- [ ] Categorias: criar/salvar com teclado aberto, renomear/cancelar; conferir gestos/botões de navegação.
- [ ] Ofertas: vazio, uma e várias; ordem crescente, condicionais separadas, links HTTPS corretos, editar/remover/cancelar/reiniciar.
- [ ] Preço antigo do desejo intacto; sem dados fictícios automáticos.
- [ ] Splash clara/escura sem moldura, galeria e imagens continuam funcionando.

PR #8 permanece sem merge até revisão e validação física. Nenhuma aprovação da migração Android é presumida pelo sucesso da build.
