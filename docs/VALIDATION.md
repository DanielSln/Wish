# Validação da Fase 2

Verificações executadas em 12/11/2026:

- npm test: 3 testes passaram, cobrindo o repositório com SQLite real do Node, reabertura do arquivo, filtros combinados, categorias, ordenação, atualizações, status, tombstone, validação, rollback e proteção contra downgrade do esquema.
- npm run typecheck: passou.
- npm run lint: passou, sem erros nem avisos.
- expo install --check: dependências compatíveis com SDK 58.
- expo-doctor: 20/20 verificações passaram.
- expo export --platform web: passou, incluindo worker e WASM do SQLite.
- expo export --platform android --output-dir dist-android: passou (bundle Hermes; não é geração de APK).
- Interface no navegador com expo-sqlite: nome obrigatório, cadastro, detalhes, moeda, edição de anotações, comprado, pesquisa, filtros de status, persistência após recarregar e cancelamento da exclusão verificados.
- Exclusão efetiva e reversão para pendente verificadas nos testes do repositório; a confirmação de exclusão foi exibida e cancelada na interface.
- Prévia móvel: túnel ngrok e manifesto Android SDK 58 verificados na implementação; o endereço é temporário e muda ao reiniciar.

Limites: nenhum aparelho Android/iOS físico foi controlado; o teste no Android do usuário está pendente. Não foi simulado modo avião num dispositivo. Imagens externas e loja dependem de rede. A primeira carga no Expo Go precisa do servidor. Uso autônomo offline requer um binário instalado. SQLite web é experimental e os dados dependem do perfil/origem do navegador.

Segurança: oito ocorrências moderadas originais e duas adicionais na ferramenta de túnel. Veja SECURITY-AUDIT.md. Não foi executado audit fix --force.

Na retomada foram aplicados expo 58.0.25 e expo-sqlite 58.0.17, ambos patches do SDK 58; testes, TypeScript, lint, install --check e Expo Doctor passaram novamente. As exportações web e Android foram repetidas após esses patches.
