# Fase 6.1 — interface compacta e ofertas manuais

## Estado e autorização

Continuação de feature/android-preview-splash e PR #8, sem nova branch/PR, merge ou alteração de main/PR #5. O proprietário informou aprovação física 7/7 da primeira APK da Fase 6: splash nos temas claro/escuro, sem moldura cinza, independência de Metro/Expo Go, título/expansão, SQLite e fotos. Isso não valida as alterações desta fase.

Em resposta à proposta [de persistência](PHASE-6-1-OFFERS-PROPOSAL.md), o proprietário autorizou explicitamente SQLite v5 com backup e ofertas manuais. Após autorização posterior foi gerada uma única APK v2; [resultado, assinatura, cota e instalação](PHASE-6-1-APK-V2.md). Não houve acesso ao banco do celular. Migrações executadas nesta sessão somente em catálogos isolados de teste. As duas capturas mencionadas na solicitação não estavam anexadas ao texto; foram usados o código e os problemas descritos, além de capturas próprias com fixtures.

## Interface

- Inicial: hero 36/42 → 24/29, sem quebra de linha forçada; espaços 24 → 12, topo menor, cartão de link padding 20 → 12; busca/filtros próximos, cartões padding vertical 22 → 14. Textos, importação, filtros e abas preservados. Filtros mantêm toque mínimo de 44 e chips existentes não foram encolhidos.
- Detalhes: topo 16 → 4, gap 14 → 10, título 22/28 → 19/25 e três linhas com expansão; ações quebram em linhas conforme largura/fonte, com mínimo de 50 de altura. Removidas chaves duplicadas entre título/ofertas/notas, que causavam avisos do React.
- Imagem nos detalhes: quadro compacto até 200, alinhamento superior da foto, altura reduzida quando o enquadramento proporcional é menor; placeholder centralizado 120. A área fixa antiga de 260 com imagem centralizada somava espaço interno ao padding superior de 16. Prévia/formulário e cards preservam seus tamanhos. Proporção e proteção contra ampliação de miniaturas mantidas; nenhum arquivo/URL antigo foi trocado.
- Prioridades: coral, âmbar e verde conforme tema; texto continua presente em lista/comprados/detalhes e opções do formulário. Teste de contraste ≥4,5:1 contra fundo, card e soft nos dois temas. Não altera valores nem ordenação.
- Categorias: criação nas abas e no formulário, renomeação e confirmação de exclusão usam KeyboardDialog. Modal com KeyboardAvoidingView (iOS padding/Android height), ScrollView e insets; campo e salvar podem rolar juntos. Campo saiu do rodapé abaixo da lista. Não houve mudança global de windowSoftInputMode nem dependência nova. Não há dois ajustes Android sobrepostos no mesmo diálogo. Teclado Android real/gestos/botões ainda pendentes.

## Auditoria e preços efetivamente implementados

Antes: price_cents/loja/link únicos, sem histórico estruturado e sem data própria de verificação. desired_price_cents é meta. updated_at pode mudar por foto/nota/status; não prova verificação. offer_details é texto livre com possíveis PIX/cupons. Importador distingue original/promoção/condicional na revisão, mas não persiste uma coleção de vendedores. Nada disso foi reinterpretado como múltiplas ofertas.

Agora: seção Menores preços registrados antes das ações; cadastrar/editar/remover ofertas manuais vinculadas exclusivamente ao ID do desejo. UUID, loja, valor BRL em centavos, link HTTPS, variante/estado/kit/condições, flag condicional e data gerada no registro. Valores válidos ordenados crescentemente; menor sem condição destacado discretamente apenas se há mais de uma oferta nessa classificação. Uma oferta recebe aviso de que não há comparação entre lojas. PIX/cupom/condicionais ficam em grupo separado, sem competir com preços sem condição. Sem ofertas, estado vazio.

Data é de registro manual, explicitamente não verificada na loja. Editar atualiza o registro e a data, sem criar série histórica. Não existe histórico completo nem comparador automático, coleta em outras lojas, promessa de estoque/atualidade ou validação automática de identidade. Usuário precisa confirmar modelo/variante; sem agrupamento por nomes. Links HTTPS preservam query, rejeitam credenciais/IPs/hosts locais/portas alternativas usando política existente. Não há requisição HTTP de scraping ao salvar; Ver oferta abre navegador. A política não faz pinagem DNS e o navegador controla sua própria navegação/redirects.

Preço antigo permanece intacto como referência sem data própria, fora do ranking. Meta, preço riscado, notas e texto comercial não são convertidos. Importador/Youcom, descontos, cupons e imagens permanecem com as regras anteriores.

## SQLite v5 e backup

Migração aditiva autorizada: product_offers e índice, sem alterar produtos/categorias existentes. Remoção de ofertas é lógica; cada mutação exige ID do desejo e impede gravação em desejo apagado. Operações não atualizam preço/foto/notas do produto. SQL usa parâmetros.

Bancos 1/2/4 existentes exigem backup antes das migrações: API SQLite online backup para wish-pre-v5-<UUID>.db no mesmo armazenamento privado. Destino deve estar vazio, com UUID novo em cada tentativa; nunca sobrescreve backup anterior. Cópia verificada com integrity_check, user_version e contagem de produtos/categorias. Falha interrompe a atualização. Depois, transação v4→v5 cria tabela/índice, registra nome em app_settings.pre_v5_backup_name e confirma user_version=5. Falha dessa transação mantém banco v4 intacto e snapshot preservado. Migrações 1/2/4 anteriores mantidas, v3 separada continua recusada, versões >5 recusadas. Banco novo sem catálogo não precisa de backup.

Backup contém o catálogo e referências das fotos, que continuam no diretório privado; não duplica nem remove arquivos de fotos. Não há exportação/upload, sincronização ou limpeza automática de snapshots. Falta de espaço pode bloquear a migração com os dados preservados.

### Recuperação assistida, sem sobrescrever o catálogo

Não há restauração automática nem botão que substitua wish.db. Antes de recuperar, obter decisão explícita do proprietário, encerrar consultas/conexões do catálogo e preservar banco atual/fotos: snapshot antigo não contém alterações posteriores.

1. Identificar pre_v5_backup_name em app_settings quando a migração concluiu; se falhou, listar arquivos wish-pre-v5-*.db no diretório privado SQLite (ou armazenamento SQLite do navegador), sem limpar nada.
2. Em manutenção autorizada, prepareRecoveryCopy(nome) abre snapshot com versão 1/2/4 e usa a mesma cópia online verificada para gerar wish-recovery-<UUID>.db separado, nunca wish.db. Não chamar a função antes da decisão do proprietário.
3. Conferir integrity_check, user_version, produtos, categorias, notas e referências de foto na recuperação. Testes Node executam backup WAL e recuperação real e verificam que banco vivo e backup anterior não mudam.
4. Selecionar a cópia recuperada em uma versão de manutenção revisada/fechada antes de montá-la no SQLiteProvider; manter wish.db anterior intacto. A ativação/seleção da cópia não está exposta no aplicativo desta fase e deve ser feita de forma assistida. Não renomear/copiar banco aberto com WAL, não prometer restauração física testada no Android.

Código v4 não deve abrir banco v5. A APK anterior permanece v4 até instalar futura build. Não faça downgrade nem apague dados para contornar proteção de versão. Eventual atualização da branch Supabase exigirá conciliar seu próprio esquema; PR #5 foi preservado e não integrado.

## Verificações

- 67 testes Node/SQLite aprovados, zero falhas/skips: regressões, falhas/rollback de migração, cópia WAL real/recuperação, proibição de sobrescrever backup, ofertas CRUD/isolamento/remoção/reabertura, campos antigos intactos, valores/URLs inválidos e contraste.
- TypeScript e ESLint aprovados. Nenhuma dependência adicionada/atualizada no app.
- Web export de produção aprovado em .expo/phase61/web. Não é APK.
- Suíte tests/ui/phase61.cjs com Playwright/Chrome externos, contexto isolado e preços/modelos explicitamente fictícios: título longo/curto/médio e expansão; ofertas ordenadas/condicionais/edição/remoção/cancelamento/reload; campos de produto preservados; categorias no formulário e abas/renomeação; 320 px dark, CSS de texto 28 px sem overflow horizontal. Escala CSS não equivale ao fontScale nativo e não testa teclado Android. Verificações extras de link exato (incluindo query) e expansão com texto ampliado também aprovadas. A suíte final completa passou sobre o export de produção servido localmente por expo serve em 8095, sem pageErrors/HTTP errors.
- Durante testes, cache de módulos do Metro apresentou Requiring unknown module ao recarregar rotas; reiniciar com --clear não eliminou a intermitência do carregador SSR de desenvolvimento. O mesmo roteiro completo passou sobre export de produção local; não houve mudança de dependência/configuração para esconder isso. Limitação conhecida do ambiente de desenvolvimento a investigar separadamente se persistir; não afeta o resultado observado na suíte de produção.
- Expo Doctor 19/20: mesmos seis avisos de versões (expo, @expo/ui, file-system, router, sqlite e web-browser) descritos na Fase 6. Mantidas versões aprovadas, sem audit fix --force. Não ocultado aviso. Relatório de auditoria de vulnerabilidades não refeito nesta fase.
- Sem novo teste Android físico ou comprovação da API de backup Expo no aparelho. A APK v2 foi compilada após autorização; os testes de cópia real usam SQLite Node com driver equivalente, e o adaptador Expo ainda precisa de validação física nessa APK.

## Arquivos

Interface: wishlist.tsx, expandable-text.tsx, product-image.tsx, ui.tsx, priority-badge.tsx, keyboard-dialog.tsx, product-form.tsx, (tabs)/categories.tsx, products/[id].tsx, palette.ts.
Ofertas/dados: domain/offers.ts, components/product-offers.tsx, data/repository.ts, migrations.ts, initialize-database.ts, database-snapshot.ts, app/_layout.tsx e scripts/start-expo.mjs (branch/guard v5).
Testes: offers.test.mjs, products.test.mjs, image-management.test.mjs, startup.test.mjs e ui/phase61.cjs. Documentos: proposta, este relatório e README.

## Validação física da APK v2 — pendente

A APK original da Fase 6 não contém estas mudanças. A APK v2, autorizada posteriormente, foi concluída com versionCode 2 e certificado igual à v1; instruções no relatório de build. Instalar por cima sem desinstalar. Qualquer nova tentativa continua exigindo autorização e consulta de cota; não aceitar cobrança/upgrade.

Roteiro: preservar app instalado; atualizar sem desinstalar; conferir backup e passagem v4→v5, todos os desejos/fotos/notas/temas/comprados e reabertura offline. Testar hero/lista em tela pequena, título longo expandir/recolher, fonte máxima e temas. Categorias criar/renomear com teclado aberto/fechado, nomes 1–60 caracteres, salvar/cancelar, gestos/botões. Ofertas vazio/uma/várias/mesmo preço, PIX separado, preço/link inválidos, confirmar variante, cancelar edição/remoção, salvar/reabrir e link exato; conferir que preço original e imagens não mudaram. Repetir splash clara/escura apenas como regressão: arquivos W/splash não foram alterados.

Manter PR #8 aberto, sem merge. Pendência: validação física da APK v2; migração/CRUD e uma build já autorizados. Não afirmar comparação automática ou preços atuais.
