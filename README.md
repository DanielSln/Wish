# Wish

Aplicativo pessoal de lista de desejos desenvolvido com React Native, Expo e TypeScript.

## Iniciar

Requisitos: Node.js compatível com Expo SDK 58 e npm.

```sh
npm install
npm start
```

Para abrir no navegador: `npm run web`. Para Android: `npm run android`.
O SDK 58 pode exigir uma development build em dispositivos físicos conforme a versão disponível do Expo Go. Builds iOS locais precisam de macOS.

## Estado inicial

Expo Router configurado, tema escuro e tela inicial em português. Cadastro de desejos e persistência serão implementados nas próximas etapas.

## Verificação

```sh
npx tsc --noEmit
npm run lint
```

Nunca versione arquivos .env, tokens ou credenciais. As regras de exclusão estão no .gitignore.
