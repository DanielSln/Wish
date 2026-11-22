# Fase 7.5 — segurança e prontidão para operação remota

Revisão concluída em **22/11/2026, America/Sao_Paulo**. Base: `536da69087f40545e0753384e8c2109308ebec5a`, branch `feature/android-preview-splash`, inicialmente limpa e sincronizada. Referências examinadas: [Fase 7.2](PHASE-7-2-SEARCH-GATEWAY.md), [7.3](PHASE-7-3-CLOUDFLARE-READINESS.md), [7.4](PHASE-7-4-GATEWAY-AUTH-RECOVERY.md) e os módulos em `experiments/cloudflare-gateway/` e `experiments/search-gateway/`.

## Decisão

**NO-GO: não implantar o gateway atual, nem habilitar pesquisas reais.** Houve correções justificadas e testes locais adicionais, mas ainda não está demonstrada uma solução remota simultaneamente segura e com custo obrigatório de R$ 0,00. Manter pesquisa externa desabilitada e funcionamento manual/offline do Wish. Isso não afirma que Cloudflare Free seja inviável; afirma que os requisitos deste gateway ainda não foram satisfeitos.

Não houve conta/recurso Cloudflare, deployment, integração de identidade, SDK/dependência nova, consulta/chave SerpApi real, APK ou EAS. Aplicativo, SQLite v5, migrações, importador, preços, estética, versionCode 5, main, PR #5 e Supabase preservados. Nenhuma revisão independente foi realizada: esta é revisão interna do experimento, não certificação do protocolo próprio.

## 1. Mudanças reais e respectivas justificativas

| Mudança | Problema encontrado | Comportamento final demonstrado |
| --- | --- | --- |
| `ControlQueue` com fila prioritária | A fila única deixava cancelamento/revogação aguardarem toda a pesquisa. | Um escritor persistente continua exclusivo; controles autenticados têm prioridade entre transações. Admissão separada: até 16 requisições normais, 4 cancelamentos e 2 requisições administrativas em processamento/espera. |
| Interrupção restritiva em memória | Era impossível parar trabalho ativo antes da transação de revogação. | Operador validado pode negar o dispositivo em memória e abortar seu job. Cancelamento exige prova válida e corresponde ao aparelho/ID ativos. Não emite sessão, não libera créditos e não substitui confirmação persistente. |
| Guarda na fronteira do provedor | Uma operação admitida antes da revogação podia avançar para outra chamada. | Após flush da reserva e antes de cada chamada mock, revalida sessão/negação/cancelamento. Reserva impedida antes do envio ainda pode permanecer debitada conservadoramente. |
| Limpeza do job antes de encerrar fence | O consumidor cancelado podia terminar antes da atualização assíncrona da reserva. | `SearchGateway.drain()` aguarda os jobs e sua limpeza. Só então o coordenador fecha seu fence; nenhum estorno presumido. Comportamento original do gateway Node não foi substituído. |
| Verificação final de entrega | Uma revogação podia chegar enquanto se aguardava confirmação final da testemunha. | Revalida dispositivo/sessão/cancelamento após o último await, antes de retornar dados; não há novo await nessa saída. Tokens recém-emitidos também são recusados se o aparelho foi negado nesse intervalo. |
| Separação da inspeção da prova | A via urgente não pode consumir nonce/gravar SQL fora do fence. | Inspeção antecipada é somente leitura/criptografia. Uma marca temporária impede usar o mesmo nonce como múltiplas interrupções. Consumo definitivo e rate persistente continuam no escritor serializado. |
| Fixtures explicitamente opt-in | Estar em modo local implicava disponibilizar controles perigosos de teste. | `TEST_CONTROLS=yes` é necessário. Ausente ou diferente de yes recusa controles pessoais/legados. Mutações de fixtures ficam em módulo marcado LAB ONLY. |
| Testemunha com prazo e corpo limitado | Binding indisponível ou resposta arbitrária podia deixar espera/análise sem limite específico. | Até 2 s e 1.024 bytes; valida resposta e sequência. Timeout, resposta excessiva ou confirmação perdida bloqueiam; não se adivinha novo contador. |
| Inventário executável de exposição | Não havia lista de evidências que impedisse confundir um bundle testado com entrada publicável. | `remote-blockers.json` + `exposure-audit.mjs` verificam 11 categorias e retornam NO_GO, com status de saída 1. Evidência ausente é inventário obsoleto, saída 2, nunca aprovação automática. |

Essas alterações ficam em experimentos. Não há adaptação de código do aplicativo ou de seu banco. Ferramentas já instaladas na 7.3 foram reutilizadas: Miniflare 4.20260730.0, workerd 1.20260730.1, esbuild 0.28.2; Node 24.22.1. Bundles locais finais: pessoal **67.455 bytes**, legado **49.522 bytes**. Esses tamanhos não certificam quotas reais.

## 2. Fronteiras de confiança revisadas

| Fronteira | Invariante local | Risco para exposição remota |
| --- | --- | --- |
| Dispositivo → entrada | Chave P-256 por dispositivo, aprovação explícita de fingerprint, desafio e prova individual. URL/rota/corpo limitados. | Protocolo particular ainda sem avaliação independente; não se anuncia DPoP/OAuth/OIDC. UI humana de aprovação e armazenamento Android não foram validados. |
| Sessão → consulta | Token opaco curto + prova contextual, nonce único, sessão/aparelho persistentes; reautenticação prova chave, não refresh bearer fixo. | TLS, audience explícita de serviço, ameaça de dispositivo comprometido e proteção de borda permanecem pendentes. |
| Cliente → administração | Worker rejeita caminhos administrativos e remove header administrativo. Stub privado exige capacidade diferente; não aceita owner/namespace do corpo. | Capacidade do operador e dono do computador são autoridades do laboratório; não são autenticação administrativa produtiva/MFA. |
| Controle urgente → persistência | Antes da fila só há validação e restrição em memória; escritor único consome nonce e grava revogação com fences. | Até confirmação 200, a revogação não deve ser tratada como persistente. 429/503 exigem investigação/retry autorizado; negação volátil não é uma garantia após restart. |
| Gateway → provedor | Provedor somente mock; orçamento global, reserva/flush antes de chamada, sem retries/reembolsos automáticos. | Transporte real e prova de consumo ainda inexistentes. Não basta inserir uma chave no ambiente. |
| DO → testemunha | Binding fixa, sequência/linhagem, transações e sync; falha fechada em divergência. | O arquivo local compartilha o domínio de confiança do host e não é âncora independente de produção. |
| Backup → recuperação | Restauração declarada bloqueia; backup antigo só do DO diverge da testemunha mais nova. | Rollback conjunto não declarado, edição maliciosa dos dois estados ou comprometimento administrativo continuam fora da garantia. |

Assinaturas inválidas de operações ordinárias continuam consumindo rate persistente dentro do fence, antes da verificação criptográfica custosa. A inspeção urgente é limitada por admissões em memória, mas não implementa um rate global durável de todas as tentativas inválidas antes da fila. Ataques de CPU/negação de serviço na borda são bloqueio produtivo, mesmo sem consumo SerpApi.

Dados escritos no cache/journal por uma consulta já terminada podem continuar disponíveis ao proprietário legitimamente autenticado, embora uma sessão revogada/cancelada não receba sua resposta. Cancelar entrega não desfaz execução, apaga evidências ou prova ausência de cobrança.

## 3. Cancelamento e revogação: alcance e limites

A via urgente só restringe. Requisições sem capacidade administrativa ou assinatura válida não interrompem um job; um dispositivo não interrompe outro apenas por compartilhar o owner pessoal. Controles repetidos não ganham novo privilégio pelo reaproveitamento do nonce. O fechamento persistente continua ordenado: abortar/terminar job, registrar estado da reserva, fechar fence, aplicar controle prioritário, confirmar.

No cancelamento, o cliente precisa de nonce contextual **pré-emitido** para `/v1/cancel`, ainda dentro dos 60 s de validade. A emissão de um novo desafio permanece serializada; sem nonce disponível, pode continuar aguardando a operação ativa. Não foi criada emissão concorrente de desafios que contorne os fences. Isso melhora o caso demonstrado, mas não resolve toda a UX futura de cancelamento no Android.

A revogação local por operador não depende desse nonce do dispositivo. Bloqueia novas chamadas e suprime a resposta se chegar antes de sua entrega. A operação externa que já recebeu a consulta não pode ser cancelada retroativamente: seu custo continua settled/uncertain conforme as evidências. Não há promessa de latência instantânea durante trabalho síncrono ou garantia de comportamento de um transporte real não implementado.

Recuperação global continua uma transição serializada com sua autorização específica. Diagnóstico e release de gates usados nos testes são exceções **LAB ONLY**, privadas, com capacidade administrativa e flag de teste; não substituem cancelamento/autorização reais e precisam desaparecer de uma entrada pública.

## 4. Alternativa gerenciada gratuita: Auth0 com OIDC/OAuth + PKCE

Fonte comercial oficial consultada em 22/11/2026: [Auth0 Pricing](https://auth0.com/pricing). Free anuncia **US$ 0/mês, até 25.000 usuários ativos mensais e cadastro sem cartão**. A verificação por cartão para custom domains é explicitamente ressalvada; não escolher esse recurso sob esta proposta. Acima do limite, o FAQ orienta selecionar plano pago: não autorizar upgrade/cobrança como fallback. Não foi criada conta, contratado plano ou verificado o enquadramento de um tenant real.

[Auth0 PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) documenta Authorization Code + PKCE para clientes nativos/públicos, sem segredo compartilhado confiado ao aplicativo. Uma futura integração deve usar navegador externo, PKCE S256, state/nonce, redirects revisados, issuer e endpoints fixos, audience da API e allowlist do proprietário por identidade estável do servidor. É planejamento; nenhum SDK, token ou IdP simulado foi usado para declarar essa integração aprovada.

| Critério | Pareamento próprio atual | Auth0 Free + PKCE, candidato não integrado |
| --- | --- | --- |
| Custo monetário conhecido agora | Laboratório local sem serviço contratado; custo remoto completo não demonstrado. | Preço público Free acima; rates, funcionalidades e condições reais precisam ser confirmados antes de qualquer adesão. Não presumir refresh/API ilimitados. |
| Segurança/identidade | Bootstrap, protocolo, recuperação, chaves e revisão são responsabilidade integral do Wish. | Reduz a implementação própria de autenticação/recuperação de identidade; configuração e validação do gateway continuam críticas. Não resolve orçamento ou anti-rollback. |
| Complexidade operacional | Operador/capacidades offline, testemunha, fingerprint, revogação e restauração próprios. | Tenant, app público/API, callbacks, JWKS/rotação, recuperação do administrador e vínculo com aparelhos. Login gerenciado não equivale a autorização universal. |
| Revogação | Registro próprio consultado em cada admissão/chamada/entrega; controles locais testados. | Revogação de refresh/grant e expiração do access token devem ser consideradas separadamente; planejar revogação de acesso no gateway/aparelho, não confiar apenas em logout. |
| Validação disponível | Assinaturas e cenários locais em workerd; sem revisão independente ou validação móvel. | Apenas pesquisa documental; não há evidência de login, TLS, callback, claim, revogação ou recuperação reais. |
| Núcleo offline | Não alterado. | Deve continuar sem login obrigatório; autenticação só habilitaria a pesquisa online opcional. |

A [validação de access tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens) exige checagem criptográfica, audiência, claims e permissões; rejeitar falhas. Não usar ID token como autorização genérica da API, nem endpoint JWKS escolhido por header não confiável. A [revogação de refresh tokens](https://auth0.com/docs/secure/tokens/refresh-tokens/revoke-refresh-tokens) possui semântica de grant/configuração própria; não deduzir invalidade imediata de todo access token a partir de uma ação de logout.

**Recomendação para estudo posterior:** preferir avaliar a opção gerenciada antes de expor o protocolo próprio. Manter esta implementação como laboratório; escolher Auth0 não fecha automaticamente nenhum bloqueio de implantação. A [BCP OAuth RFC 9700](https://www.rfc-editor.org/rfc/rfc9700) e [RFC 8252 para apps nativos](https://www.rfc-editor.org/rfc/rfc8252) continuam referências, não evidência de conformidade deste experimento.

## 5. Âncora de recuperação independente: projeto e bloqueio

Uma âncora deve ficar **fora do conjunto de estado restaurável e da mesma autoridade que pode restaurá-lo**. Copiar o contador para outro arquivo/DO/namespace/conta sob o mesmo procedimento de backup ou mesma autoridade não prova independência. Assinar um backup ou guardar um hash junto dele também não demonstra frescor após rollback conjunto.

Proposta de contrato para uma fase futura, sem serviço escolhido/criado:

1. Identidade imutável da conta do provedor e do coordenador; epochs de recuperação aprovados, sem namespace novo para zerar limite.
2. Autoridade independente mantém sequência monotônica, limite superior de consumo e compromisso do estado/checkpoint. Antes do envio, confirma intenção/reserva vinculada a conta, ciclo, executionId, digest e sequência.
3. Restauração começa bloqueada. Valida checkpoint, high-water mark independente e evidência autenticada do provedor. Não basta copiar a sequência nova para um SQLite antigo.
4. Confirmações perdidas mantêm incerteza; nova emissão depende de reconciliação verificada. Replay de receipt/epoch anterior deve falhar.
5. Comprometimento, perda ou restauração da própria âncora precisa de protocolo distinto e autoridade independente; indisponibilidade resulta em pesquisa desabilitada, não em fallback para contador local.

Não foram demonstrados recursos gratuitos disponíveis que atendam a todo esse contrato, sua durabilidade e separação administrativa. Não se afirma que a SerpApi ofereça comprovante individual suficiente para liquidação; um saldo agregado não identifica necessariamente cada execução. Não se presume contador monotônico de hardware em Android/TPM sem testes/evidência específicos. Identidade gerenciada também não certifica consumo do provedor.

**Bloqueio obrigatório ANCHOR:** garantia produtiva permanece ausente. O witness local foi mantido como laboratório, agora com limite de prazo/corpo; não foi substituído por falsa proteção. Sem solução independente verificável e custo aceito explicitamente, não implantar o piloto com pesquisa real.

## 6. Reservas, rollover, tombstones e falhas

- Conservam-se as reservas e limites fictícios 7.3: 200/ciclo, 40/h e margem de 50. Saldo 236 é fixture histórica/fictícia, nunca leitura da conta nesta etapa.
- Reserva é persistida antes da chamada mock. Cancelamento, timeout, perda de confirmação ou erro de armazenamento não liberam crédito. A limpeza do job é aguardada antes de fechar o fence.
- `/operator/reconcile` continua apenas revisão: `retained-no-retry`, `release:false`, `externalEvidenceRequired:true`. Nenhum corpo com receipt alegado autoriza liquidação/desbloqueio.
- Não foi implementado rollover produtivo. O relógio local não cria ciclo nem cota. Tentativa de novo ciclo fictício inconsistente bloqueia e mantém contadores. O endpoint genérico de injeção de snapshots pertence somente às fixtures legadas e não pode ser levado à produção.
- Para rollover futuro, exigir identidade de ciclo/período confirmada, consumo/limites autenticados, decisão explícita sobre reservas antigas e preservação do journal. Não apagar pendências nem permitir retry da mesma execução só porque virou o mês.
- RequestId continua vinculado ao fingerprint do proprietário. Respostas completas limitadas a 16/15 min lógicos, tombstones permanentes no estado experimental, teto de 4.096 IDs. Não houve redução do horizonte de replay ou expurgo para facilitar testes.
- Falhas e tombstones não são reabertos por idade. Compactação física ocorre no próximo acesso autorizado; não é limpeza imediata em background. Política contínua de retenção/checkpoints ainda precisa ser aprovada.
- `inflight`, schema incompleto, divergência da testemunha e restauração declarada continuam bloqueando. Não foi criado reset de credencial, contador ou fence para obter sucesso.

## 7. Inventário verificável antes de exposição

O arquivo [remote-blockers.json](../experiments/cloudflare-gateway/remote-blockers.json) registra 11 categorias, arquivos e marcadores, acompanhado de [exposure-audit.mjs](../experiments/cloudflare-gateway/exposure-audit.mjs). É inventário da revisão, não scanner completo ou certificador. A remoção de um marcador não concede aprovação: passa a exigir revisão do inventário.

| Categoria | Remover/substituir/verificar obrigatoriamente |
| --- | --- |
| Autenticação própria | Contexto `wish-personal-v1`, provas particulares, representação JSON, bootstrap/fingerprint e recuperação; revisão independente ou substituição gerenciada validada. |
| Operador simulado | `personal-harness.mjs`, capacidades geradas em memória, `OPERATOR_HASH`, `RECOVERY_HASH`, contexto retornado pelos testes; nunca embarcar em app ou expor em logs. |
| Endpoints privados | `/operator/approve`, `/operator/revoke`, `/operator/recover`, `/operator/reconcile`, `/operator/status`: redesenhar autenticação/autorização/auditoria administrativa, sem capacidade de teste enviada por cliente. |
| Fixtures mutantes | `/operator/test` e `operator-fixtures.ts`: expiry, cap de requests, aging, fault; diagnósticos peek e release fora dos fences só para laboratório. Remover da entrada publicável. |
| Perfil legado | Não publicar `AccountCoordinator`/bearers sintéticos, `/__test`, `/__egress-probe`, controles de snapshot, seed, corrupção e revogação de fixture. |
| Bindings sintéticas | `LOCAL_TEST_ONLY`, `TEST_CONTROLS`, `SESSIONS`, `SNAPSHOT`, `INTERNAL_TOKEN`, `LINEAGE`, `MOCK_*`, `AUTH_SESSION_MS`, `WITNESS_TIMEOUT_MS`, `RESTORE_DECLARED`: revisar finalidade/segredos/limites em configuração produtiva separada, sem parâmetros de cliente. |
| Transporte e ownership | MockProvider/fixtures, bridge de sessão legada, `personal-owner` e coordenador fictício: preservar conta única por provedor/owner autenticado e autorização por dispositivo. Sem proxy arbitrário. |
| Testemunha | JSON/lock/fsync/rename e fault gates do harness são Node local; não são binding remoto existente nem raiz anti-rollback independente. |
| Dados e ferramentas | `.local/`, `.tools/`, `.wrangler/`, `.dev.vars*`, caches/SQLite/backups/witnesses/perfis/logs e credenciais não entram em Git, bundle ou upload. |
| Entrada HTTP | Guardas de loopback não devem ser apenas removidas; futura entrada exige TLS, regras de Host/Origin, validação de audience e proteção de borda. |
| Evidência operacional | Free real, faturamento, CPU/memória/startup, storage/SQL, logs redigidos, parada segura, recuperação e revogação reais precisam de validação autorizada. |

Comando exclusivamente local:

```powershell
node experiments/cloudflare-gateway/exposure-audit.mjs
```

Resultado esperado hoje: **NO_GO, deploymentAllowed=false, 11 categorias verificadas/pendentes**. Saída **1 é bloqueio esperado**, não aprovação ou falha escondida da suíte. Saída 2 indica evidência obsoleta/ausente. Não existe comando de deploy nesse verificador, nem decisão automática que habilite publicação.

## 8. Cloudflare Free: limites reconferidos e medições pendentes

Fontes oficiais consultadas em 22/11/2026:

| Componente | Limites publicados relevantes | Fonte |
| --- | --- | --- |
| Worker Free | 100.000 requests/dia, CPU 10 ms/request, 128 MB/isolate, 50 subrequests/request, startup global 1 s, bundle 64 MiB descompactado; variáveis até 5 KB. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| DO SQLite Free | 100.000 requests/dia, 13.000 GB-s/dia, 5 milhões de linhas lidas/dia, 100.000 escritas/dia, 5 GB totais; limites diários reiniciam 00:00 UTC; exceder no Free faz a operação falhar. | [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| DO por objeto/CPU | FAQ especifica 1 GB por objeto no Free, apesar de tabela genérica mencionar 10 GB. Documenta 30 s de CPU padrão de DO; confirmar o enquadramento do perfil na conta autorizada, separadamente da CPU do Worker de entrada. | [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/) |

Não se deve comparar duração do teste Node/IPC com CPU metered. Heap de CDP e RSS local não certificam 128 MB; bundle pequeno não prova startup global. Durabilidade física, recuperação/PITR, distribuição/reinício e latência são propriedades diferentes de executar workerd local. A [API SQLite/transactionSync/sync](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) fundamenta o uso das transações, mas não cria transação distribuída com provedor ou testemunha.

Somente em futuro ambiente remoto **autorizado** poderão ser aferidos/enquadrados: CPU por Worker e DO, startup reportado pela plataforma, memória e falhas de recursos, linhas SQL/duração efetivamente contabilizadas, tráfego negado/auth/cache, picos de concorrência, egress/latência, recuperação, exposição real, billing e limites compartilhados com outros serviços da conta. Confirmar também a disponibilidade das métricas no plano, sem contratar observabilidade paga.

O fluxo de autenticação e os fences consomem requests/SQL/duração mesmo sem pesquisa. Requisições abusivas podem esgotar Cloudflare antes da cota SerpApi. Nenhum plano/conta atual foi consultado, porque criar/operar recursos não foi autorizado. Um limite de gasto/alerta de conta paga não equivale a garantia de custo zero; selecionar e verificar Free e não aceitar upgrade/cobranças é requisito próprio.

## 9. Matriz de riscos e critérios de aceite

| ID / gravidade remota | Estado | Evidência/critério exigido antes do piloto |
| --- | --- | --- |
| ANCHOR / crítica | **Aberto, bloqueante** | Provar independência do conjunto restaurável e da autoridade de restauração; validar rollback/epoch/recovery com evidência externa. Não disponível nesta fase. |
| AUTH-REVIEW / alta | **Aberto, bloqueante** | Revisão independente do protocolo ou integração gerenciada explicitamente aprovada, testada contra issuer/audience/redirect/revogação/recuperação reais. |
| BUDGET-EVIDENCE / alta | **Aberto, bloqueante** | Fonte de consumo/ciclo confiável, tratamento conservador de incerteza, rollover e replay sem liberação por suposição. |
| LAB-EXPOSURE / alta | **Aberto, bloqueante** | Entrada produtiva sem fixtures, operador simulado, perfil legado ou segredos/contextos de testes; inventário revisto e teste negativo de superfície pública. |
| FREE-COST / alta | **Aberto, bloqueante** | Plano e métricas reais dentro do Free, inclusive identidade/âncora/observabilidade; custo obrigatório zero verificado, sem contratação automática. |
| CONTROLS / alta | **Melhorado localmente, aceite remoto pendente** | Casos de prioridade/interrupção e entrega tardia passam; completar UX de nonce pré-emitido, limites de borda, administração e transporte reais. |
| REPLAY / alta | **Conservador local; operação contínua pendente** | Tombstones, capacidade e falhas sem reabertura passam. Aprovar retenção/rollover/checkpoints que não percam proteção. |
| DOS / alta | **Aberto, bloqueante** | Limites de fila locais não substituem proteção de borda; avaliar custo de provas inválidas, desafio e tráfego negado sob quotas reais. |
| MOBILE / média | **Não executado** | Chaves/Keystore, navegador, callbacks, sessão, revogação e acessibilidade em Android; núcleo offline preservado. |

Nenhum risco crítico aberto pode ser “aceito” automaticamente pelo verificador ou por testes positivos. Se não houver solução segura e gratuita para os bloqueios, continuar local/manual e sem pesquisa externa.

## 10. Plano mínimo de futuro piloto privado — não autorizado a executar

1. **Gate documental:** resolver os bloqueios acima, escolher identidade e âncora, revisar dependências/termos/privacidade/custo; obter nova autorização explícita para contas, recursos e escopo. Não criar recursos como parte desta entrega.
2. **Entrada separada de produção:** remover laboratório, administrar por canal autenticado/auditável independente, um owner autorizado e um coordenador por conta, segredos só no servidor, TLS e limites estritos. Nenhuma autorização inferida de headers/IDs do cliente.
3. **Piloto inicialmente mock-only:** depois de autorização e gates aprovados, testar um proprietário e poucos aparelhos, sem chave SerpApi e sem integração ao Wish. Medir allowlist, falhas de autenticação, revogação, custos e limites de recursos com tráfego baixo declarado.
4. **Exercícios de recuperação:** testar a âncora independente e falha fechada, acknowledgements perdidos, reinícios/restauração, capacidade/tombstones e indisponibilidade. Não zerar banco/contadores para recuperar disponibilidade.
5. **Critério de parada:** qualquer incerteza de consumo, divergência de estado, risco de cobrança ou perda de revogação desabilita pesquisa. Não iniciar retries de busca, nova implantação ou plano pago automaticamente.
6. **Novo aceite específico:** só considerar provedor real/chave/consumo e integração ao app em outra autorização, com orçamento explícito e evidências. Nenhuma APK/build faz parte deste plano executado.

## 11. Testes e alterações

| Verificação final | Resultado |
| --- | --- |
| Novos testes adversariais 7.5 | **22/22 aprovados**, 0 falhas, 0 ignorados/cancelados; 21 cenários executam workerd e um verifica o inventário local. |
| Autenticação/recuperação 7.4 | **37/37 aprovados**, regressão completa na versão final. |
| Runtime Cloudflare 7.3 | **46/46 aprovados**, incluindo sua verificação de resumo de medições. |
| Node/SQLite anteriores | **310/310 aprovados**: gateway 75, confiança 103, guardas POC 5 e app/SQLite 127. |
| Total distinto | **415 aprovados, zero falhas finais**. Reexecuções dirigidas não são contadas novamente. |
| TypeScript | `npm run typecheck` aprovado. |
| ESLint | `npm run lint`, Expo offline e sem telemetria, aprovado. |
| Inventário de exposição | 11 categorias verificadas, nenhuma evidência ausente; **NO_GO / exit 1 esperado**. Não é autorização de deployment. |
| Remoto / físico | Não executados. Nenhuma conclusão de segurança Android, OAuth real, quota metered ou durabilidade de nuvem. |

Logs finais ignorados: `.local/readiness-tests.log`, `.local/phase75-auth-regressions.log`, `.local/phase75-runtime-regressions.log`, `.local/phase75-node-regressions.log`. Provas e capacidades não são impressas nos novos testes; falhas de asserção omitem payloads confidenciais. A auditoria local do bundle exclui app/SQLite/filesystem Node do caminho Worker; witness/harness continuam Node somente de desenvolvimento.

Novos cenários adversariais: cancelamento assinado pré-emitido e replay, revogação ativa antes de segunda consulta, prioridade sobre buscas já na fila, capacidade normal esgotada, operador falso, assinatura falsa, outro aparelho tentando interromper, cancelamentos concorrentes com mesmo nonce, fixtures ausentes/desativadas, rotas administrativas/probes pela entrada pública, confirmação tardia/excessiva da testemunha, expiração de sessão em voo, revogação após reinício, restauração sem prova, resposta concluída com revogação durante ack final, falha de witness durante revogação, rollover inventado, inventário NO_GO e rate persistente de assinaturas inválidas.

O primeiro teste da janela final usava relógio/polling para encontrar uma confirmação em voo. Foi substituído por retenção explícita de uma resposta da testemunha **depois do CAS real local**, permitindo injetar a revogação na fase exata e manter a asserção de que nenhum dado é entregue. A espera não apaga contadores nem desabilita assinatura, transação ou fence. Foi corrigida a verificação pós-ack e removido o await de limpeza na saída de sucesso após essa última verificação. Falhas intermediárias não foram ocultadas; os totais finais abaixo só são aprovados após execução da versão final.

Arquivos: `control-queue.ts`, `operator-fixtures.ts`, `remote-blockers.json`, `exposure-audit.mjs`, `readiness.test.mjs`; alterações em `personal-worker.ts`, `personal-auth.ts`, `personal-harness.mjs`, `harness.mjs`, `runtime.ts`, `worker.ts` e `experiments/search-gateway/gateway.ts` (drain). README do laboratório e este relatório atualizados. Nenhum arquivo de produção/dependência/configuração Android alterado. Logs/estados/backups/bundles ficam ignorados em `.local/`.

## 12. Reproduzir somente localmente

```powershell
node experiments/cloudflare-gateway/build.mjs personal
node experiments/cloudflare-gateway/build.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs --test experiments/cloudflare-gateway/readiness.test.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs --test experiments/cloudflare-gateway/personal.test.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs --test experiments/cloudflare-gateway/runtime.test.mjs
node --require ./experiments/search-gateway/offline-loopback.cjs --experimental-strip-types --test experiments/search-gateway/gateway.test.mjs experiments/product-confidence/engine.test.mjs experiments/serpapi-poc/guards.test.cjs tests/*.test.mjs
npm run typecheck
$env:EXPO_OFFLINE='1'; $env:EXPO_NO_TELEMETRY='1'; npm run lint
node experiments/cloudflare-gateway/exposure-audit.mjs
```

O último comando deve retornar 1 e NO_GO. Não é comando de implantação. Testes usam somente workerd local, fixtures e provider mock, `cf:false`, egress negado e loopback; não leem credenciais reais. Não há conta ou servidor remoto criado para validar o parecer. PR #8 deve permanecer em rascunho e sem merge; aguardar autorização explícita para qualquer operação remota.
