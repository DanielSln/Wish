# Auditoria atual — 15/11/2026

Atualização da preparação para integração: as limitações do importador descritas neste registro foram mitigadas por lista de hosts/CDNs exatos, transporte expo/fetch sem redirects e leitura em streaming limitada. O estado atual e os riscos residuais estão em [PHASE-3-INTEGRATION.md](PHASE-3-INTEGRATION.md). A auditoria de dependências abaixo continua sendo o último resultado registrado; nenhuma dependência foi alterada nesta preparação.

Executado npm audit --json sobre o lockfile existente, seguido de npm ls e consulta às versões/dependências publicadas no registry. Resultado: **10 ocorrências moderadas, zero altas/críticas**, provenientes de **duas vulnerabilidades de origem**. Nenhuma dependência/lockfile foi alterado, nenhum override foi imposto e npm audit fix --force não foi utilizado.

## Dependências apontadas individualmente

| Pacote afetado (versão instalada) | Origem no Wish | Severidade npm | Exposição no aplicativo | Correção e compatibilidade |
| --- | --- | --- | --- | --- |
| minimatch 10.2.6 | expo → @expo/fingerprint; eslint-config-expo → @typescript-eslint/typescript-estree | Moderada | Amplificação de padrões glob pode consumir CPU/memória nas ferramentas; os links/produtos não são passados a essa biblioteca pelo código do app | Advisory corrige em 11.0.1. Última versão 10 publicada consultada: 10.2.6; consumidores exigem 10. Atualização principal forçada não validada com SDK 58 |
| @expo/fingerprint 0.21.10 | expo 58.0.25 | Moderada, transitiva via minimatch | Fingerprinting/configuração de build; não é o parser de metadados ou o repositório de produtos | Versão latest consultada 0.21.10 ainda exige ^10.2.6. Aguardar correção oficial compatível; não substituir minimatch por 11 fora do contrato |
| expo 58.0.25 | Dependência direta | Moderada, transitiva via fingerprint | A ocorrência pertence à cadeia de ferramentas, não demonstra exploração via CRUD; builds processam arquivos e padrões, então a exposição não é nula | npm sugere Expo 52.0.49 como troca principal: incompatível com este SDK 58. expo install --check confirma o conjunto atual compatível; não aplicar downgrade |
| @typescript-eslint/typescript-estree 8.72.2 | eslint-config-expo 58.0.4 → parser/plugin | Moderada, transitiva via minimatch | Parsing/lint no desenvolvimento/CI; sem caminho identificado a partir dos campos cadastrados no app | latest consultada 8.72.2 ainda exige ^10.2.2. npm marca fixAvailable=true, mas não há versão corrigida demonstrada nessa faixa; não tratar o indicador isolado como correção comprovada |
| @typescript-eslint/parser 8.72.2 | eslint-config-expo | Moderada, transitiva via typescript-estree | Ferramenta de lint; não executada pela importação de produtos | Depende da correção de typescript-estree e do alinhamento oficial do eslint-config-expo/TypeScript 6; sem alteração compatível demonstrada |
| @typescript-eslint/type-utils 8.72.2 | eslint-config-expo → eslint-plugin | Moderada, transitiva via typescript-estree/utils | Análise estática durante lint; sem entrada direta dos produtos | Mesma cadeia; acompanhar atualização coordenada 8.x/Expo, sem override de minimatch 11 |
| @typescript-eslint/utils 8.72.2 | eslint-config-expo → eslint-plugin/type-utils | Moderada, transitiva via typescript-estree | Utilitários de lint; sem caminho de execução identificado no catálogo | Mesma cadeia; fixAvailable=true no audit não comprova que o consumidor atual aceite a versão corrigida |
| @typescript-eslint/eslint-plugin 8.72.2 | eslint-config-expo | Moderada, transitiva via type-utils/utils | Lint no desenvolvimento/CI | Atualizar somente quando parser, utils, estree e configuração Expo tiverem solução conjunta compatível |
| uuid 3.4.0 | @expo/ngrok 4.1.3 (devDependency) | Moderada | Advisory: validação de limites de buffer em APIs v3/v5/v6. Não há uso dessas APIs pelo catálogo; IDs locais usam expo-crypto.randomUUID | Corrigido em >=11.1.1; ngrok exige ^3.3.2. Troca principal pode quebrar API; sem correção automática compatível. O advisory traz CVSS 7.5, embora o audit classifique esta ocorrência como moderada |
| @expo/ngrok 4.1.3 | Dependência direta de desenvolvimento para túnel | Moderada, transitiva via uuid | Túnel de desenvolvimento; não faz parte do serviço de importação nem da geração de IDs dos produtos | latest consultada ainda 4.1.3 com uuid ^3.3.2; fixAvailable=false. Remover perderia o túnel existente e exige decisão consciente, por isso foi preservado |

O fato de algumas dependências estarem na seção dependencies não significa que todas suas ferramentas entrem no bundle móvel. Esta análise verificou os caminhos de uso do código do Wish e a árvore npm, não pretende comprovar ausência de qualquer caminho transitivo em toda a plataforma. Evitar arquivos/padrões de origem não confiável nas ferramentas de build/CI. Os oito primeiros alertas compartilham a raiz minimatch; os dois últimos compartilham uuid.

Fontes de vulnerabilidade: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) e [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Segurança específica da importação

O serviço aceita HTTPS, rejeita credenciais na URL, IPs literais, localhost, sufixos .local/.localhost e portas não padrão. Nesta revisão foi corrigida a evasão de sufixo por ponto DNS final, com teste de regressão. Scripts recebidos não são executados; os campos são apresentados como texto, validados no formulário e gravados por consultas SQLite parametrizadas. fetch usa credentials: omit e não recebe tokens Supabase. Respostas 403/429 não provocam tentativas de contornar bloqueios.

Não é proteção completa de rede: DNS pode resolver um domínio para rede privada; o transporte nativo pode seguir redirects antes de a URL final ser validada. Há verificação de tamanho por Content-Length e após leitura; sem tamanho confiável, o corpo já terá sido recebido. Esses limites impedem afirmar proteção completa contra SSRF/consumo de memória. Hoje é um cliente pessoal, não um endpoint servidor. Antes de reutilizar em backend, exigir validação de DNS e de cada salto, bloqueio de redes privadas/reservadas, limite de streaming e timeouts reais; não mover o fetch para uma função Supabase sem esse desenho.

Os preços de AggregateOffer com @type em array ou URI schema.org agora permanecem desconhecidos, como já ocorria com o tipo abreviado. Esse defeito de integridade foi reproduzido e corrigido; não se deve converter um preço agregado em preço confirmado de uma oferta individual.

## Pendências e revalidação

Manter os 10 alertas registrados até existir correção compatível. Reexecutar audit/árvore e verificações Expo antes de qualquer atualização futura. Nenhum serviço pago ou credencial foi adicionado. Testes de dispositivos, redirects nativos, autenticação/RLS e isolamento entre contas serão necessários antes da Fase 4; as duas últimas funcionalidades ainda não existem.
