# Cloudflare gateway — laboratório local, sem deployment

Executa **Worker + Durable Object SQLite em workerd**, por meio do Miniflare. Não integra o Wish, não abre seu SQLite e não lê `SERPAPI_API_KEY`, arquivos de ambiente ou credenciais Cloudflare. O único provedor é simulado. Não há manifest Wrangler, conta, login, recurso remoto ou comando de deployment.

## Ferramentas isoladas

Instaladas com autorização do proprietário em `.tools/`, nunca globalmente:

| Ferramenta | Versão fixada | Origem |
| --- | --- | --- |
| Miniflare | 4.20260730.0 | pacote oficial Cloudflare, registry.npmjs.org |
| workerd | 1.20260730.1 | dependência exata do Miniflare e binário oficial para Windows |
| esbuild | 0.28.2 | pacote oficial esbuild, registry.npmjs.org |
| Node usado | 24.22.1 | runtime já instalado |

Wrangler não foi necessário. O lockfile isolado registra também versões, integridades e URLs das dependências transitivas distribuídas pelos fornecedores. Não foram impostas versões alternativas a essas dependências. As dependências do aplicativo não mudam.

`tools.package.json` e `tools.package-lock.json` são os manifests reproduzíveis **exclusivos deste laboratório**, com nomes deliberadamente diferentes dos manifests do app. `.tools/` contém as cópias usadas pelo npm. Para restaurar apenas estas ferramentas, a partir da raiz do Wish:

```powershell
New-Item -ItemType Directory -Force experiments/cloudflare-gateway/.tools | Out-Null
Copy-Item experiments/cloudflare-gateway/tools.package.json experiments/cloudflare-gateway/.tools/package.json
Copy-Item experiments/cloudflare-gateway/tools.package-lock.json experiments/cloudflare-gateway/.tools/package-lock.json
npm ci --prefix experiments/cloudflare-gateway/.tools --registry=https://registry.npmjs.org --no-audit --no-fund
```

Esse comando exige acesso ao registro npm; **os testes abaixo não exigem internet**. Não executar `npm install` na raiz do app para este laboratório.

## Validar localmente

Na raiz `D:\Projetos\Wish`:

```powershell
node experiments/cloudflare-gateway/build.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs --test experiments/cloudflare-gateway/runtime.test.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs experiments/cloudflare-gateway/measure.mjs
```

Os scripts encerram suas instâncias com `dispose()`. Host e inspetor são **127.0.0.1**, porta temporária, sem túnel. `cf:false` impede a busca automática de metadados Cloudflare; `outboundService` responde 403 a qualquer saída do Worker. O preloader bloqueia rede externa no processo Node. Um teste negativo faz `fetch` para um domínio `.invalid`, interceptado antes de qualquer transporte externo. Não é uma consulta à internet.

Estados SQLite, logs, bundles, perfis e métricas ficam em `.local/`. Ferramentas instaladas ficam em `.tools/`. Ambos são ignorados, assim como `.wrangler/` e `.dev.vars*`. Tokens experimentais de 256 bits são gerados em memória a cada execução, passam somente em bindings/headers locais e não são impressos. Não copiar estados locais para GitHub ou dispositivos.

## Arquivos

- `runtime.ts`: portas estruturais mínimas verificadas em workerd.
- `store.ts`: armazenamento e orçamento transacionais do DO, independentes do app.
- `worker.ts`: entrada HTTP, autorização sintética, coordenador global e controles privados de falha.
- `harness.mjs`: Miniflare, bindings fictícios, persistência e saída negada.
- `runtime.test.mjs`: cenários funcionais e de segurança no runtime real local.
- `build.mjs`: bundle e verificação do grafo; só `node:crypto` permanece externo.
- `measure.mjs`: latência, bytes, SQL, heap e amostragem do inspetor local, sem garantia de limites remotos.

O gateway 7.2 recebe apenas uma porta de armazenamento tipada (`Pick`), sem mudar seus critérios. Motor de confiança, adaptadores, fixtures e algoritmo de consultas são reutilizados diretamente.

**Não é serviço publicável.** Controles de teste deliberados só são alcançáveis pelo stub local com capacidade interna, nunca pelas rotas do Worker. Não transformar este laboratório em deployment removendo apenas a checagem de loopback. Autenticação mobile, reconciliação real, recuperação operacional e medições de produção exigem projeto e autorização específicos.

Relatório completo: [PHASE-7-3-CLOUDFLARE-READINESS.md](../../docs/PHASE-7-3-CLOUDFLARE-READINESS.md).

## Fase 7.4 — laboratório de autenticação pessoal

Há uma entrada **adicional e explicitamente local** em `personal-worker.ts`, com pareamento individual, prova ECDSA por requisição, reautenticação por chave, revogação, recuperação e witness independente do backup do DO. A entrada 7.3 permanece para regressões; seus bearers estáticos não são aceitos pela entrada pessoal.

```powershell
node experiments/cloudflare-gateway/build.mjs personal
node --require ./experiments/search-gateway/offline-loopback.cjs --test experiments/cloudflare-gateway/personal.test.mjs
```

`personal-harness.mjs` representa os papéis de dispositivo e operador apenas no laboratório; não é código para embarcar no app. Capacidades são geradas em memória e não devem ser impressas ou serializadas. Witnesses e checkpoints ficam sob `.local/` em árvores separadas. Retomada requer o contexto original e witness íntegra; não há reset automático de credenciais/orçamento. Restauração declarada fica bloqueada.

[Modelo de ameaças, procedimentos e limitações da Fase 7.4](../../docs/PHASE-7-4-GATEWAY-AUTH-RECOVERY.md). **Sem autorização de deployment, API real ou integração ao Wish.**
