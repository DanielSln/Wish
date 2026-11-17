# PR #6 — encerramento dos testes e preparação de merge

Data: 16/11/2026. Repositório DanielSln/Wish; branch feature/expo-go-readiness; destino main. Este relatório substitui a recomendação condicional da revisão anterior. O merge NÃO foi executado nem autorizado por esta preparação.

## Aprovação física informada pelo proprietário

O proprietário confirmou no Android/Expo Go: inicialização, cadastro, categorias e sugestões, importação Youcom, detalhes e notas pessoais, comprados, persistência SQLite e preservação dos produtos existentes após atualizações.

A correção da foto da camiseta Youcom foi aprovada fisicamente pelo proprietário: a nova importação selecionou z2 (1022×1400) e ficou maior e mais nítida. O produto anterior manteve a miniatura de 77×105, como esperado. Não foram alterados o seletor de imagens, o componente de exibição nem os registros existentes nesta etapa de encerramento. Nenhum novo teste físico foi executado pelo agente.

## Preço Youcom: causa reproduzida, limitação aceita

Foi feita uma consulta HTTP 200, sem seguir redirecionamentos, à mesma página pública da camiseta comfort great stories p1190860 e variante pp=/44.3250/ fornecida pelo proprietário. A consulta não acessou APIs privadas, outras lojas nem contornou bloqueios.

JSON-LD Product/Offer observado:

```json
{
  "@type": "Offer",
  "priceCurrency": "BRL",
  "price": "119.90",
  "availability": "https://schema.org/InStock",
  "priceSpecification": {
    "@type": "UnitPriceSpecification",
    "priceType": "https://schema.org/StrikethroughPrice",
    "price": "119.90",
    "priceCurrency": "BRL"
  }
}
```

O mesmo valor foi declarado em Offer.price e como StrikethroughPrice (preço riscado/de referência). Não há SalePrice separado, data de validade, cupom ou condição de pagamento nesse Offer; não foram encontrados metadados meta de preço/moeda que resolvessem a ambiguidade. BRL foi reconhecido: o problema não é moeda nem falha de salvamento.

A regra existente onlyReference em src/services/import-prices.ts recusa promover um preço de referência idêntico ao preço base para preço vigente. Reproduziu-se current_cents=null e original_cents=11990, sem cupom/preço condicionado. A prévia avisa para preencher manualmente. O valor anterior de R$ 119,90 não foi copiado de outro produto, da memória ou de outra loja.

Decisão: manter o campo vazio quando não há confirmação segura e manter o preenchimento manual disponível. Nenhuma regra de preço foi afrouxada nesta revisão. Os testes já cobrem referência riscada, promoção explícita, validade/moeda/condições e valores manuais/nulos no SQLite. Essa limitação não bloqueia o merge.

## Mercado Livre e carregamento do Expo Go

Mercado Livre/meli.la: falha automática no teste físico, com alternativa manual. Testes confirmam que o link exato e seus parâmetros chegam ao cadastro, são salvos e reabertos. HTTP 403/antibot, páginas sem metadados e conteúdo que exige JavaScript permanecem limitações conhecidas. Sem bypass ou implementação adicional nesta etapa.

Logo: o arquivo atualmente selecionado, adaptive-foreground.png, contém somente o W com transparência; a versão escura monochrome.png também é isolada. app.json e o código de splash não configuram o quadrado cinza, sombra e moldura branca descritos pelo proprietário. O W não foi redesenhado, e não foram adicionadas bordas ou efeitos.

A documentação oficial confirma que Expo Go mostra o ícone do app e não reproduz integralmente a splash nativa; orienta usar build preview/release para avaliar a aparência final. Portanto, a moldura descrita é consistente com a apresentação do cliente hospedeiro, e sua remoção não pode ser garantida pelo JavaScript ou pelos PNGs do Wish. A captura mencionada não foi anexada a esta solicitação (foi recebido um texto com sua descrição); não se afirma nova inspeção pixel a pixel nem auditoria do binário Expo Go instalado. A verificação definitiva depende de uma build independente, futura e separada. Não é bloqueador do merge.

Referências oficiais:
- https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/
- https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/

## SQLite v4 e proteção de desenvolvimento

Mantidos banco wish.db, UUIDs, categorias, produtos, notas, preços, tombstones e preferências. Migrações incrementais 0→1→2→4 preservadas, com ALTER aditivo e rollback transacional; notes antigo não é reinterpretado. V4 reabre sem nova alteração de esquema. Versões futuras e v3 do PR #5 são recusadas sem apagar registros. Não há downgrade nem migração destrutiva neste PR.

O incidente anterior veio de servir código v1 e depois main v2 para o aparelho já em v4. O wrapper de npm start/android/ios/web verifica branch/esquema e imprime pasta/commit; scripts/start-expo.mjs --check foi executado com sucesso. Há testes de branch errada, main antiga e código compatível. O wrapper não pode interceptar uma cópia antiga que não o contém nem chamadas diretas a npx expo start: usar os comandos documentados e conferir a branch continua necessário.

## Verificações de encerramento

- 48 testes Node/SQLite: aprovados, 0 falhas, 0 skipped.
- TypeScript: aprovado. ESLint (src e scripts): aprovado.
- Expo install --check: dependências compatíveis com SDK 58, sem instalação de atualizações. npm audit: 10 ocorrências moderadas, 0 altas e 0 críticas (oito originais e duas da ferramenta de túnel), já documentadas em SECURITY-AUDIT.md; nenhum --force aplicado.
- Expo Doctor: 20/20.
- Export Android/Hermes: aprovado. É bundle, não APK nem teste físico.
- Fonte de imagens aprovada, migrações e lógica de preços: sem alterações nesta etapa; apenas documentação de encerramento.
- GitHub: main 025429d é ancestral da branch; sem commits exclusivos da main. PR #6 aberto, mergeable=true antes da publicação documental. Commits de código 45e7919 e 61102bb já publicados.
- PR #5 preservado, aberto e sem merge, head 4fa742a. Nenhum login, sincronização ou serviço pago adicionado.

## Riscos aceitos e recomendação

A main passará a suportar banco v4 ao integrar este PR. Depois disso, não servir versões antigas ao mesmo catálogo. O PR #5 usa v3 independente e exigirá reconciliação explícita de migrações/campos antes de qualquer integração futura. Esta etapa não o resolve nem o altera.

Importação de lojas continua melhor esforço; preço não confirmado fica vazio e imagens/links externos dependem da internet. A moldura do cliente Expo Go não representa a splash final. Links de desenvolvimento exigem computador e servidor ativos. Os alertas de dependências são acompanhados separadamente e não foram ocultados nem tratados com audit fix --force.

Recomendo **Create a merge commit**, permitido pelo repositório: preserva a história já compartilhada dos commits de migração, correção de imagem e proteção de inicialização. Evita reescrever commits publicados e mantém rastreabilidade. Sem squash, rebase, force push ou exclusão de branch nesta preparação. As limitações conhecidas acima não bloqueiam a recomendação.

Resumo para aprovação: integrar somente o PR #6 à main, levando SQLite v4, melhorias de cadastro/detalhes/notas, importação assistida com fallback manual, imagem Youcom aprovada e inicialização protegida. Preservar PR #5 e os dados existentes. Aguardar autorização explícita do proprietário antes de acionar o merge.

Após autorização e merge: parar o Metro antigo; git switch main; git pull --ff-only; conferir node scripts/start-expo.mjs --check (v4 e novo commit); iniciar npm start -- --go --tunnel ngrok --port 8082. Confirmar abertura com os registros existentes e fazer smoke test de cadastro/edição/categoria/comprado e persistência, sem limpar dados. Manter a branch de revisão até essa confirmação. A preparação de APK/splash independente e melhorias de extração ficam para tarefas futuras.
