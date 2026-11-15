# Fase 2 — revisão para integração

15/11/2026. PR #1, base main, branch feature/product-management.

Revisados cadastro, edição, exclusão com confirmação/tombstone, detalhes, categorias, prioridades, busca/filtros, migração SQLite, consultas parametrizadas e persistência. Corrigidas as whitelists de prioridade e ordenação: nomes herdados de Object.prototype não são opções válidas. Ordenações desconhecidas usam a ordem padrão, sem interpolar propriedades herdadas em SQL. Os casos de regressão incluem constructor, __proto__, toString e texto semelhante a SQL.

Verificações após a correção: npm test 3/3, TypeScript, lint, git diff --check, expo install --check e Expo Doctor 20/20 passaram. O teste SQLite cobre CRUD, filtros combinados, categorias, ordem, status, exclusão lógica, reabertura, rollback e proteção contra banco futuro. O esquema v1 e os dados não foram alterados.

O PR #1 pode ser integrado após autorização do proprietário. Nenhum merge de PR foi realizado. Teste em aparelho Android/iOS e modo avião não foi executado; busca Unicode completa e os dez alertas moderados de dependências continuam documentados. A revisão técnica não substitui validação em aparelho.

O PR #2 permanece baseado nesta branch até o #1 ser integrado. Após a integração, atualizar o remoto e conferir como os commits entraram em main antes de mudar a base do #2. Integração com merge preserva ancestralidade; squash pode exigir sincronização adicional para evitar repetição no diff. Não executar force push nem descartar commits existentes.
