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

Estado: preparada, ainda sem resultado final. Build ID, commit exato, artefato, tamanho/hash e cota depois serão registrados ao terminar. Nenhuma segunda tentativa sem nova autorização.

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
