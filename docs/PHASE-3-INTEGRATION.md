# Fase 3 — revisão de segurança para integração

## Estado após integração autorizada da Fase 2

Em 15/11/2026, o PR #1 foi integrado com commit de merge 0c36cbaff599ba4f5c826877f011f4ab54321133, preservando ee10980. Antes do merge passaram 3/3 testes, TypeScript, lint, compatibilidade Expo, Expo Doctor 20/20 e diff --check; foram removidas apenas linhas em branco extras de dois arquivos no commit 5d6081c. Nenhum check de CI estava configurado no commit remoto.

feature/link-import recebeu a nova main no commit de sincronização 929ac04, sem conflitos e sem reescrever commits. O PR #2 foi atualizado para base main. A equivalência do patch de código/testes/configuração da Fase 3 foi verificada por git patch-id --stable antes/depois da sincronização; a Fase 2 não aparece novamente no diff. Após a sincronização passaram 13/13 testes, TypeScript, lint, compatibilidade Expo, Expo Doctor 20/20 e diff --check. As proteções de hosts, redirects e limite de resposta estão cobertas pela suíte. O PR #2 permanece aberto, tecnicamente pronto para integração mediante nova autorização, e NÃO foi integrado. Sem Supabase, novas funcionalidades, atualização de dependências ou force push.

O registro abaixo descreve a revisão anterior à integração da Fase 2; os riscos residuais e limites de teste em dispositivo continuam aplicáveis. Android/iOS físico não foi testado nesta tarefa.

## Registro da revisão anterior

15/11/2026. PR #2, base feature/product-management enquanto o PR #1 permanece aberto. Nenhum PR foi integrado. As correções da base foram incorporadas à branch dependente por sincronização local de branches, preservando os commits anteriores; main não foi alterada.

## Problemas corrigidos

1. O fetch anterior seguia redirects antes da validação final. Agora a tela injeta **expo/fetch**, já incluído no Expo SDK 58, com redirect: error e credentials: omit. O serviço exige transporte explícito, sem fallback silencioso para fetch incompatível. Redirects HTTP, indicador redirected e URL final diferente são recusados. O endereço final deve ser colado pelo usuário ou preenchido manualmente; não existe redirecionamento automático, nem para outra loja permitida.
2. response.text recebia todo o corpo antes de validar o tamanho. Agora o serviço lê o stream em blocos, com buffer fixo e limite de **2.000.000 bytes recebidos pelo leitor**, independentemente de Content-Length ausente, menor ou comprimido. Ao exceder, cancela leitor e requisição. Não há fallback para leitura integral se o stream não estiver disponível. Timeout de 12 segundos e cancelamento cobrem também o corpo; o transporte é abortado ao terminar ou rejeitar headers.
3. A validação apenas lexical de URLs aceitava domínios arbitrários que poderiam resolver para rede privada. Consultas automáticas agora exigem um host EXATO de import-policy.ts: domínios raiz/www de Amazon Brasil, Mercado Livre, Magalu, KaBuM! e Casas Bahia. Sem wildcard de subdomínio e sem resolver domínios fornecidos livremente pelo usuário. Nome semelhante, sufixo malicioso, IP literal, localhost, porta não padrão e credencial não são aceitos. A presença na lista não garante suporte à extração em cada loja.
4. A imagem de metadados também pode causar uma requisição automática. Por isso só são aceitos os hosts exatos de CDNs de imagem listados na política, não páginas genéricas de lojas com possíveis endpoints de redirect. Imagem ausente/recusada usa placeholder e pode ser preenchida manualmente pelo usuário. A lista não se aplica retroativamente a imagens que o usuário cadastrou manualmente.

O cadastro manual preserva links HTTPS válidos de outras lojas, sem consultá-los. A limitação de lojas é uma redução deliberada da superfície de requisições automáticas; novos hosts/CDNs exigem revisão de código. Não há proxy, serviço pago, novo pacote, migração SQLite ou Supabase.

## Integridade funcional

Continuam presentes JSON-LD Product/Offer, Open Graph, prévia, revisão antes de salvar e persistência pelo repositório SQLite. Preços ausentes, estrangeiros, múltiplos, inválidos ou agregados permanecem NULL; não há preço inventado. URI/array de AggregateOffer também é reconhecido. URLs de imagem relativas só são mantidas se a resolução produzir um CDN permitido. Toda consulta é opcional; CRUD local permanece offline.

## Verificações

- Fase 2 na própria branch após correção: 3/3 testes SQLite/validação, TypeScript e lint passaram; Expo install --check compatível e Expo Doctor 20/20.
- Branch da Fase 3 após sincronizar a base e corrigir o transporte: 13/13 testes, TypeScript, lint e diff --check passaram. Casos novos cobrem hosts rejeitados antes da rede, imagens, redirects, URL final inesperada, tamanho real maior que o declarado, stream ausente, UTF-8 dividido entre blocos, cancelamento de corpo lento e liberação do transporte.
- Expo install --check compatível; Expo Doctor 20/20.
- Exportações web e Android/Hermes passaram na versão final. Isso não equivale a um APK instalado.
- Playwright/Chromium em viewport 412×915: prévia, revisão, anotações, salvamento, persistência após recarregar e fallback HTTP 403 passaram com respostas simuladas e sem page errors.
- Teste de segurança no navegador: host fora da lista não gerou requisição, redirect não alcançou o destino e a alternativa manual preservou o link. Testes com fixtures, sem confirmar preços ou compatibilidade com lojas reais.
- Nenhum dispositivo Android/iOS físico foi testado. Não foram testados modo avião ou o transporte em aparelho real nesta revisão.

Documentação do SDK e implementação instalada consultadas: https://docs.expo.dev/versions/v58.0.0/sdk/expo/ ; expo/fetch tem streaming e redirect error no Android/iOS. As exportações verificam integração de código, não substituem o teste nativo desses controles.

## Riscos residuais e decisão

A lista limita destinos, mas não implementa pinning de IP/DNS: depende da integridade dos hosts explicitamente confiados, DNS e TLS. CDNs de imagem usam o transporte nativo de imagem, cujo comportamento em aparelho não foi inspecionado em execução. O limite controla bytes retidos/lidos pelo aplicativo, não promete limitar todos os buffers internos do sistema operacional. Não expor o importador como endpoint servidor sem proteção própria de DNS/IP e egress. Essas fronteiras não devem ser descritas como proteção SSRF universal.

Permanecem dez ocorrências moderadas nas dependências, conforme a auditoria já publicada; nenhuma dependência foi modificada para ocultar alertas. Sem correção compatível demonstrada e sem atualizações forçadas. Busca Unicode completa permanece uma limitação da Fase 2.

**Pronto tecnicamente para revisão/integração após o PR #1**, considerando o uso pessoal como cliente e as fronteiras documentadas. Para distribuição/uso nativo, recomenda-se testar em Android real o bloqueio de redirect, stream acima do limite, CRUD offline e persistência. Sem autorização, não integrar PRs. Somente após o #1 estar integrado, atualizar o remoto, conferir ancestralidade/diff e mudar a base do #2 para main, preservando commits e corrigindo duplicações caso haja squash. Não implementar Supabase nesta tarefa.
