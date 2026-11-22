# Search gateway experimental — somente local e simulado

Node **24.22.1** usado na validação. TypeScript e tipos Node já instalados no projeto; nenhuma dependência nova. Não importa o app, não abre seu banco e **não lê a chave SerpApi ou variáveis de ambiente**. O descritor de endpoint SerpApi é apenas uma função de planejamento (`enabled:false`), sem transporte real.

## Executar

Na raiz `D:\Projetos\Wish`:

```powershell
node --require ./experiments/search-gateway/offline-loopback.cjs --experimental-strip-types experiments/search-gateway/cli.ts
```

A opção final numérica escolhe porta, por exemplo `.../cli.ts 0` para uma porta temporária. O processo imprime somente URL loopback, identificação de simulação e caminho do arquivo de sessão. **Não escuta na rede local nem no celular.** Não criar túnel ou alterar firewall. Encerrar com Ctrl+C.

O arquivo `.expo/search-gateway/owner-session.json` contém um bearer **experimental**, gerado localmente, com validade de até uma hora. Nunca publicar seu conteúdo. O serviço guarda somente hash do token, permite revogação pelo operador e rejeita solicitações sem autorização. O arquivo/DB seguem permissões locais; `mode600` não é garantia de ACL restrita no Windows. Não é armazenamento de credencial para produção/mobile.

Exemplo local, em outro PowerShell na raiz, com a porta impressa pelo processo:

```powershell
$wishSession = Get-Content -LiteralPath '.expo/search-gateway/owner-session.json' -Raw | ConvertFrom-Json
$wishHeaders = @{ Authorization = "Bearer $($wishSession.token)" }
$wishBody = @{
  version = 1
  requestId = 'example-identify-1'
  product = @{
    name = 'HyperX Cloud Earbuds III vermelho'
    identifiers = @(@{ scheme = 'asin'; namespace = 'amazon.com.br'; value = 'B0GRWJ9QBR' })
  }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri 'http://127.0.0.1:4318/v1/identify' -Method Post -Headers $wishHeaders -ContentType 'application/json' -Body $wishBody
```

Substituir apenas a porta se necessário. Não imprimir o token, usar a chave real ou executar a CLI SerpApi anterior. As consultas acima vão **exclusivamente ao simulador local**. `/v1/compare` exige `confirmedByOwner:true` e identificador GTIN/MPN/ASIN válido, além do produto; confirmação é declaração experimental do proprietário, não certificação independente. `/v1/cancel` recebe somente `version` e `requestId`.

## Estado privado e orçamento

Tudo em `.expo/search-gateway/`, já ignorada no Git, separado de SQLite Wish e da POC. O DB termina em `.gateway.sqlite`, tem application ID e versão de esquema próprios. Recusa paths fora dessa raiz ou arquivos com tabelas/esquema alheios. O lock de processo é exclusivo; lock órfão exige verificar manualmente o processo, não é removido automaticamente.

O perfil inicial é **fictício**: ciclo `mock-free-initial`, 21/11–21/12/2026, usado 14/restante236 apenas para reproduzir o último cenário conhecido, não consultar a conta. Não renova pelo calendário. Snapshot com mais de uma hora, período expirado ou saldo inconsistente bloqueia novas simulações até reconciliação explícita pelo operador. Reiniciar não apaga reservas ou atualiza saldo. A CLI não implementa um painel de reconciliação e pode deixar de aceitar novas pesquisas quando o snapshot envelhece; não apagar o estado como atalho.

Teto de 200 reservas por ciclo, 40/hora, preservando 50 unidades do saldo atestado; com saldo fictício236, capacidade inicial efetiva é186. Identificar: até uma chamada simulada; comparar: até duas. Não há retries/paginação automática. Erro, timeout ou cancelamento mantém a reserva, inclusive após restart. Sessões anteriores continuam até expiração/revogação; não há auto-renovação de sessão ou token mobile.

Cache normalizado privado: identidade24h, dados comerciais15min, vazio60s; máximo128 registros, 2MB de texto e 200KB por entrada. Origem/data por campo permanecem; `cache=hit` transforma a procedência em cache com `cachedFrom`, sem declarar preço atual. `commercialFresh` descreve somente TTL local, **não confirmação de loja**. Invalidação é método interno autorizado, não parâmetro arbitrário do cliente.

## Testes offline

```powershell
node --require ./experiments/search-gateway/offline-loopback.cjs --experimental-strip-types --test experiments/search-gateway/gateway.test.mjs experiments/product-confidence/engine.test.mjs experiments/serpapi-poc/guards.test.cjs tests/*.test.mjs
npm run typecheck
npm run lint
```

O preloader permite somente loopback literal; bloqueia DNS externo, UDP, TLS, HTTP/HTTPS externo, fetch externo, HTTP/2 e bind público. Resolução de `127.0.0.1`/`::1` é feita em memória, sem consulta DNS. É proteção dos clientes Node usados pelos testes, não sandbox do sistema operacional contra código arbitrário/subprocessos maliciosos. Não desativa firewall nem modifica o SO.

Os testes criam DBs sintéticos próprios em `.expo/search-gateway/tests`. Não usar banco, caches ou credenciais do Wish como fixture. A ferramenta anterior da POC só é importada por seus testes de funções, nunca por `run.cjs account/search`.

## Limites

Um processo compartilha promessas equivalentes e isola usuários antes do cache; SQLite garante reserva transacional entre conexões. Reinício conserva cache/reservas, mas não a promessa em memória. Não há promessa de execução exatamente uma vez após crash, deduplicação distribuída ou autenticação pronta para produção.

Fixtures de formato são reconstruções sanitizadas/sintéticas, não respostas brutas nem amostras novas. O token de produto da fixture é deliberadamente falso e não sai do servidor. Valores documentais mantêm 21/11/2026 com precisão de dia; o instante de simulação/cache não é nova consulta à loja. Todos os dados do simulador continuam de índice de busca, jamais `store_page`.

Relatório, diagrama, pesquisa oficial de hospedagem e próximos requisitos: [PHASE-7-2-SEARCH-GATEWAY.md](../../docs/PHASE-7-2-SEARCH-GATEWAY.md). Não implantar em nuvem, habilitar provedor real ou integrar ao Wish sem nova autorização.
