# Proposta de ofertas — decisão antes de migrar

Estado: proposta autorizada explicitamente pelo proprietário. Implementação v5 e resultados em PHASE-6-1-REFINEMENTS.md; migração executada apenas em bancos de teste nesta sessão. Campo conditional foi adicionado para separar valores condicionados.

Auditoria v4: products.price_cents é um valor opcional em centavos, sem data própria/origem estruturada; desired_price_cents é meta pessoal e não oferta. store/original_url indicam uma única fonte. offer_details é texto livre preservado (pode conter PIX/cupom/condições), não coleção de ofertas. updated_at muda também ao editar notas/foto/status e não é data de verificação de preço. Importador distingue preço anterior, preço selecionado e condicionais na revisão; depois salva o preço escolhido e texto, sem histórico estruturado. Não há busca automática entre lojas ou vínculo entre desejos por variante.

## Opção recomendada: SQLite v5 aditivo

Nova tabela product_offers: id UUID; product_id FK products(id); store; price_cents inteiro positivo; url HTTPS pública; condition texto (variante/novo/usado/kit e condições); recorded_at ISO informado pelo app na gravação; created_at/updated_at; deleted_at opcional para remoção lógica. Índice product_id/preço, sem alterar campos existentes.

Somente registros manuais vinculados por ID exato do desejo. Usuário confirma mesmo modelo/variante; nenhuma associação por semelhança de nomes e nenhuma extração automática. Preços em BRL, identificados como registrados manualmente e não verificados na loja, sem promessa de atualidade/estoque. Preço condicional deve ser descrito e marcado como condicionado, separado da classificação de valores sem condição.

Migração v4→v5 apenas CREATE TABLE/INDEX e user_version; sem UPDATE nos produtos, sem apagar/recriar tabelas. Versões anteriores suportadas mantêm suas migrações. v3 da branch separada continua recusada. Bancos posteriores continuam recusados. Código v4 não deve abrir banco v5: usar só código atualizado após migrar. Isso não altera nem integra o PR #5.

Antes da primeira migração v4→v5: cópia consistente via API de backup SQLite do Expo no diretório privado da instalação, preservando banco original e fotos (sem upload). Migração transacional: falha reverte nova tabela/versão e mantém dados anteriores. Backup não deve ser sobrescrito em tentativas posteriores. Restaurar somente com app fechado/sem conexões ativas e API de backup para banco de recuperação separado; verificar integridade/contagem antes da troca. Restauração de snapshot perde alterações posteriores à cópia e deve exigir decisão explícita. Não copiar banco vivo com WAL por simples cópia de arquivo. Documentar procedimento operacional completo e testar restauração em banco de testes antes de disponibilizar a migração.

Ofertas antigas: não converter notas/offer_details em ofertas. Preço existente permanece intacto e visível como referência sem data de verificação conhecida, fora do ranking de ofertas cadastradas. Usuário poderá registrar manualmente uma oferta confirmando preço/link/modelo. Sem dados fictícios ou preenchimento por preço riscado/meta.

## Alternativa sem autorização

Manter SQLite v4 integralmente. Implementar layout/prioridades/teclado e seção informativa do único preço cadastrado (referência não verificada, data desconhecida); sem CRUD múltiplas lojas nem alegar comparação implementada. Não esconder ofertas serializadas em notas ou app_settings para contornar a necessidade de migração.

Nenhuma build EAS ou merge nesta fase sem autorização posterior específica.
