# Fase 4 — validação em 2026-11-15

## Base preservada

PR #4 revisado e integrado na main em `025429d4b885641be757915c5aff392f4b5ceb94`, após 17 testes, TypeScript, lint e Expo Doctor 20/20. A branch `feature/supabase-backup` contém essa integração por merge normal; sem force push. Fases anteriores e proteção da importação por URL permanecem na base.

## Resultados da implementação

| Verificação | Resultado |
| --- | --- |
| Testes Node, SQLite real local, Auth/HTTP/servidor simulados e PostgreSQL WASM | **43 aprovados, 0 falhas, 0 skipped**, incluindo o caso SQL ativado por WISH_PGLITE_MODULE |
| TypeScript `tsc --noEmit` | aprovado |
| ESLint `expo lint` | aprovado, sem erros/avisos |
| Expo Doctor | 20/20 |
| `expo install --check` | dependências compatíveis com SDK 58 |
| `expo export --platform all` | web + bundles Hermes Android e iOS gerados |
| Interface Playwright/Chromium, app sem configuração | aprovado; cinco abas, categorias, comprado, importação simulada, persistência SQLite/tema e tema automático, aviso de backup não configurado |
| Interface Playwright/Chromium, backend simulado | aprovado; OTP, consentimento antes do envio, confirmação do backup, sessão após reload, logout, conta B isolada e retorno ao catálogo A |
| Supabase real / entrega de e-mail | não realizado: projeto ainda não criado |
| SecureStore em Android/iOS real | não realizado |
| APK / Android físico / simulador iOS | não gerado/não realizado nesta fase |

A suíte SQL é opcional nas instalações comuns (`npm test` a marca skipped se WISH_PGLITE_MODULE não existir). Nesta validação, PGlite foi instalado fora do app e o caso foi executado. Ele testa a migração integral, RPC, recibos, conflito de versão, paginação com limite superior fixo, rollback, FK por proprietário, RLS e privilégios de papéis anon/authenticated. auth.uid é simulado localmente; não representa uma instância Supabase operacional.

A migração SQLite v2→v3 preserva UUID, tombstone, referência de categoria e preferência de aparência; uma falha de criação da fila reverte o esquema/versão. Mutações e outbox também são testadas com falha forçada para garantir rollback. As suítes exercitam confirmação perdida, duplicações, reinício durante recuperação paginada, edição concorrente, conflitos explícitos, exclusão, conta errada, cancelamento no logout e retentativas persistidas.

O teste de interface encontrou e permitiu corrigir uma chamada de fetch com receiver inválido no navegador. Foi acrescentado teste de regressão. O inicializador SQLite estável e as conexões distintas evitam reaberturas causadas por rerenders de autenticação. A confirmação de associação mantém a tela aberta e não reinicia desnecessariamente o catálogo.

Logs e bundles são artefatos temporários do ambiente, não commits. O export valida empacotamento, **não é APK** e não prova execução física. Não foram aplicadas atualizações incompatíveis ou serviços pagos.

## Antes de aprovar uso remoto

Seguir [SUPABASE-SETUP.md](SUPABASE-SETUP.md): criar projeto gratuito, executar SQL, configurar template OTP, preencher somente URL/key públicas e gerar novo build. Validar dois usuários e dois dispositivos/perfis contra o projeto real, inclusive revogação, reconexão, conflitos e isolamento. Depois testar SecureStore, reinício do processo e modo avião em Android. A Fase 4 permanece em PR para revisão, sem merge automático.
