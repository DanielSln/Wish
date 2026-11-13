# Auditoria de dependências — Fase 2

Data: 12/11/2026. Projeto mantido em Expo SDK 58.

## Oito alertas originais

O npm audit inicial reportou 8 ocorrências moderadas, derivadas de uma vulnerabilidade real em minimatch 10.2.6: amplificação de padrões glob e possível consumo excessivo de CPU/memória (GHSA-g3hv-75wg-m249). Não são oito falhas independentes.

Pacotes apontados: minimatch, @expo/fingerprint, expo, @typescript-eslint/typescript-estree, @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils e @typescript-eslint/eslint-plugin.

Cadeias: expo -> @expo/fingerprint -> minimatch; eslint-config-expo -> pacotes @typescript-eslint -> minimatch. A versão corrigida publicada no advisory é 11.0.1; os consumidores atuais usam a versão principal 10.

Foi executado npm audit fix --ignore-scripts, SEM --force: nenhuma correção dentro das faixas atuais resolveu os alertas. O npm sugere rebaixar Expo para 52.0.49 com --force. Isso seria incompatível com o projeto SDK 58 e foi recusado. Não foram impostos overrides de minimatch 11 sobre consumidores que esperam 10.

Risco: processamento de padrões glob maliciosos nas ferramentas de desenvolvimento. O repositório de produtos usa consultas parametrizadas e não fornece dados cadastrados a minimatch. Isso limita a exposição dos fluxos de produtos, mas não elimina a vulnerabilidade das ferramentas. Reavaliar quando Expo/fingerprint e TypeScript ESLint publicarem dependências compatíveis corrigidas.

## Dois alertas adicionais da prévia remota

Para atender ao teste no celular sem login Expo, foi adicionada a dependência DE DESENVOLVIMENTO @expo/ngrok 4.1.3. Ela depende de uuid 3.4.0, apontado por GHSA-w5hq-g745-h8pq (checagem de limites de buffer em APIs UUID v3/v5/v6). O npm marca uuid e seu consumidor @expo/ngrok, elevando o total final para 10 ocorrências moderadas. Não há correção automática compatível publicada para essa cadeia. Não foi forçada uma atualização principal de uuid que alteraria a API esperada do ngrok.

Essa ferramenta serve apenas ao túnel de desenvolvimento. Os IDs dos produtos usam expo-crypto.randomUUID, sem dependência de uuid 3.4.0. Para trabalhar somente por LAN, pode-se remover @expo/ngrok, retornando aos oito alertas originais, com perda do túnel ngrok.

## Validação e acompanhamento

npm audit, npm ls minimatch e verificações Expo foram executados. Expo install --check: dependências compatíveis. Expo Doctor: 20/20.

Fontes:
- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/advisories/GHSA-w5hq-g745-h8pq

Nenhuma credencial ou conteúdo de banco local é versionado.
