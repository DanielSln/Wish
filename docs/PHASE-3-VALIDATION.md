# Fase 3 — revisão e validação

Data: 15/11/2026.

Atualização de publicação: os commits c21b035 e 1dd5961 foram recuperados e publicados em feature/link-import. O [PR #2](https://github.com/DanielSln/Wish/pull/2) está aberto com base em feature/product-management, dependente do PR #1. A restrição de escrita relatada abaixo é histórica e foi resolvida. A revisão atual, correções adicionais e revalidação estão em PHASE-2-3-REVIEW.md; nenhum merge foi realizado.

## Estado encontrado

- main em 56c49d8: estrutura Expo SDK 58, Router, TypeScript e tela inicial escura.
- feature/product-management em 2b7f495: Fase 2 implementada, PR #1 aberto. Foram lidos estrutura, telas, repositório SQLite, migrações, validação, testes, dependências e commits dessa branch antes das alterações.
- Fase 2 validada nesta retomada: 3 testes SQLite, TypeScript e lint passaram. Não havia importação por links, autenticação/backup ou comparação de preços. A primeira fase sem implementação nas branches examinadas era a Fase 3.
- A branch feature/link-import preserva os commits da Fase 2 e acrescenta somente a importação; após publicação, a base do PR foi definida como feature/product-management para evitar duplicação no diff.

## Implementação

- Serviço tipado e independente da UI: consulta HTTPS, timeout/cancelamento, tratamento de erros, JSON-LD e Open Graph, preço BRL explícito e rejeição de seleção ambígua.
- Tela de importação com prévia, revisão no formulário existente e opção manual preservando o link válido.
- Nenhuma gravação durante consulta/prévia; a confirmação utiliza o repositório SQLite existente. Sem migração, alteração de dependências, transmissão para Supabase ou serviços pagos.
- Arquivos novos: src/services/product-import.ts, src/app/products/import.tsx, tests/import.test.mjs e este relatório.
- Arquivos alterados: src/app/index.tsx, src/app/_layout.tsx, src/components/product-form.tsx, README.md e docs/SECURITY-AUDIT.md.

## Verificações executadas

- npm ci: passou usando cache em diretório gravável. A tentativa inicial no cache padrão do ambiente falhou com ENOENT; não foi necessário alterar o lockfile nem ignorar hashes.
- npm test: 8 testes passaram (3 existentes e 5 de importação). Casos de metadados simulados, ofertas/moedas ambíguas, preços ausentes/inválidos, imagens relativas/inseguras, links inválidos, ausência de metadados, limites de conteúdo, HTTP 403/404/429, falha de rede/CORS e cancelamento.
- npm run typecheck: passou.
- npm run lint: passou, sem erros ou avisos de lint.
- expo install --check: dependências compatíveis.
- expo-doctor: 20/20 passaram após habilitar o uso do proxy do ambiente para o fetch do Node (NODE_USE_ENV_PROXY=1). Na tentativa anterior, duas verificações externas falharam por conexão.
- expo export --platform web: passou, incluindo rota de importação e SQLite/WASM.
- expo export --platform android --output-dir dist-android: passou, bundle Hermes. Não gera um APK nem comprova execução em aparelho.
- Playwright/Chromium, viewport 412×915: prévia, dados importados no formulário, revisão/anotações, salvamento, persistência após recarregar, erro HTTP 403 e cadastro manual preservando URL passaram sem page errors. O teste interceptou respostas de uma loja fictícia; os preços usados são fixtures de teste e não dados reais ou pré-cadastrados no app.
- git diff --check: passou.
- npm audit: 10 ocorrências moderadas, nenhuma alta/crítica; mesmas cadeias da Fase 2. Nenhuma dependência adicionada.

Os comandos Expo foram executados com EXPO_NO_TELEMETRY=1 e diretório de estado/cache gravável no workspace, sem alterar HOME ou versionar configurações locais. O Node emite aviso de detecção de módulo nos testes TypeScript existentes; os testes passam.

## Histórico da tentativa de publicação anterior

Os commits foram criados localmente na branch feature/link-import. O push para DanielSln/Wish retornou HTTP 403 (Permission denied), e a tentativa de criar a branch pela integração GitHub retornou 403 Resource not accessible by integration. Portanto, a branch não foi publicada e nenhum PR novo foi criado. Nenhum merge foi realizado. Após habilitar escrita no repositório para este ambiente/integração, envie a branch e abra o PR para main, informando que inclui a base do PR #1.

## Android e limitações

1. Confira esta branch, execute npm ci e npm run android (ou npm start na mesma rede).
2. Use Expo Go compatível com SDK 58; se incompatível, use development build conforme a documentação Expo.
3. Importe um link de produto acessível com metadados. Confira a prévia, escolha categoria, corrija campos e salve.
4. Tente um link inválido e uma loja incompatível; confira a mensagem e o preenchimento manual.
5. Feche/reabra e confira persistência. Verifique produtos salvos e cadastro manual sem internet; imagens remotas/consulta de loja precisam de rede.

Nenhum aparelho Android/iOS físico foi usado nesta retomada. O suporte real depende de cada loja; não há certificação de e-commerces específicos. O transporte nativo pode seguir redirects automaticamente antes da validação da URL final; não é um filtro de rede/DNS. O serviço é cliente local, sem servidor de importação ou execução de scripts. SQLite web continua experimental, com requisitos COOP/COEP da Fase 2. Próxima fase funcional: backup/autenticação e sincronização offline-first com Supabase, após revisão das Fases 2/3 e teste Android.
