# Expo Go — validação em 15/11/2026

Base: main `025429d4b885641be757915c5aff392f4b5ceb94`. Fases 1–3, identidade visual e preparação Android integradas. A branch desta entrega, feature/expo-go-readiness, parte dessa base. PR #5/feature/supabase-backup preservado em `4fa742acfcf1d74adadcbe1d5bda320ce3f16cde`, sem alterações nem merge. Nenhuma alteração no esquema SQLite v2, dependências, SDK ou configuração de assinatura/build.

| Verificação | Resultado |
| --- | --- |
| `npm ci` com package-lock da main | aprovado (Node 24.22.1/npm 11.9) |
| Testes Node + SQLite | 19/19 aprovados |
| TypeScript | aprovado |
| ESLint | aprovado, sem erros ou avisos |
| Expo Doctor | 20/20 |
| `expo install --check` | dependências compatíveis |
| `expo start --go` | Metro iniciou, manifesto Android servido com HTTP 200, SDK 58 e extra.expoGo |
| Bundle Android de desenvolvimento solicitado pelo manifesto | HTTP 200, JavaScript gerado |
| `expo export --platform android` | bundle Hermes gerado; não é APK |
| Playwright: navigation.cjs | aprovado, nenhum page error |
| Playwright: import-flow.cjs | aprovado, nenhum page error |
| Expo Go Android físico | não realizado: sem dispositivo disponível |
| Windows real / túnel até celular | não realizados neste ambiente Linux; guia e argumentos CLI conferidos |

Os testes de parser/transporte cobrem JSON-LD/Open Graph, moeda/valor desconhecido, múltiplos produtos, URLs inválidas, hosts não habilitados, redirecionamentos, cancelamento, timeout e limite de bytes mesmo sem Content-Length. As duas novas regressões recusam preço com validade vencida/futura/inválida e verificam limites de validade sem declarar cotação ao vivo. Os testes SQLite preservam cadastro/edição, categorias, filtros, comprados, tombstones, migração e aparência.

A suíte de navegação cobre cinco abas, categorias, cadastro por nome, produtos comprados, integridade ao excluir categoria, importação com revisão, persistência após reload e aparência clara/escura/automática. A nova suíte de usabilidade cobre campo de link em Adicionar, prévia automática única, metadados/imagem de fixture, revisão antes de salvar, prioridade sem abrir detalhes, edição/pesquisa, HTTP 403 sem repetição/contorno, fallback manual com URL da loja preservada, salvamento/status offline em página já carregada, persistência e nenhuma requisição a host fora da lista. Fixtures de metadados/imagens não representam extração real de lojas.

Compatibilidade foi conferida na documentação SDK 58 e no manifesto local. A API pública oficial do Expo indicou Expo Go Android 58.0.5 para SDK 58 nesta data. Não houve atualização de SDK nem inclusão de biblioteca nativa. Não há login/Supabase, APK novo, exportação de backup local, serviço pago ou migração de dados nesta branch.

O ambiente apresentou fallback não bloqueante de React Native DevTools por diretório de cache não gravável, e o Metro refez um cache antigo. O servidor continuou e entregou manifesto/bundle. Esses avisos não são evidência de erro no Windows nem de execução física.

Antes de aprovar uso em aparelho: seguir [EXPO-GO-TESTING.md](EXPO-GO-TESTING.md), abrir QR no Expo Go 58, verificar teclado/voltar/rolagem, reinício do processo com catálogo preservado, temas Android, imagens e consultas reais às lojas (que podem bloquear), e operações locais em modo avião com o app previamente carregado. Expo Go não garante iniciar novamente sem Metro/bundle acessível; não equivale a um APK independente.
