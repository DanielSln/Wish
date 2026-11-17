# Descrições expansíveis — 15/11/2026

Entrega visual na branch feature/expo-go-readiness e PR #6. Main e PR #5 preservados, sem merge, novas dependências ou migração. Importador, preços, cupons, validações e esquema SQLite v2 não foram alterados.

## Comportamento

- Prévia da importação e detalhes mostram até quatro linhas da descrição, usando numberOfLines. Se houver mais conteúdo, aparece Ver mais...; expandido, o botão passa a Ver menos.
- O botão depende da diferença entre a altura natural e a altura recolhida do texto renderizado, não de uma estimativa por caracteres. A medição usa a mesma largura, fonte e estilo; fica fora da rolagem, dos toques e da árvore de acessibilidade. Alterações de largura/escala da fonte ou de conteúdo reiniciam a medição recolhida.
- Não há substring, trim, conversão de formatação ou alteração do valor pelo componente. Quebras de linha permanecem no texto. O texto completo está nos filhos de Text; numberOfLines altera apenas sua apresentação.
- No formulário compartilhado de cadastro/edição, dentro de Mais detalhes e categorias, a descrição existente aparece resumida. Editar descrição abre um TextInput com o valor completo e rolagem interna. Concluir edição da descrição retorna ao resumo, preservando as alterações em memória. Salvar desejo continua sendo a ação que grava o produto.
- Uma descrição vazia já abre o campo de texto. O limite de validação anterior de 10.000 caracteres permanece; não foi acrescentado um limite ou corte de dados.
- O modelo atual não possui ficha técnica estruturada separada. Quando especificações já vierem no texto da descrição, elas são acessadas pela mesma expansão. Não há extração/classificação nova nem transformação de marketing em especificação técnica.
- Botões discretos usam os tokens do tema, alvo de toque de 44 pontos, rótulos acessíveis e estado expandido. Nenhum modal ou tela extra foi criado.

## Arquivos

Componentes novos: src/components/expandable-text.tsx e src/components/description-field.tsx. Integração: src/app/products/import.tsx, src/components/product-form.tsx e src/app/products/[id].tsx. Suíte nova: tests/ui/expandable-description.cjs. A suíte import-flow foi adaptada para o acesso explícito ao editor e para aguardar a lista antes de recarregar o navegador.

## Validação

- 28 testes Node/SQLite aprovados, zero falhas/skips; TypeScript, ESLint e Expo Doctor 20/20 aprovados.
- Quatro suítes Playwright aprovadas: navigation, import-flow, promotions e expandable-description. Sem page errors.
- A nova suíte verifica descrição curta sem botão, texto longo com botão, largura móvel/desktop, expansão/recolhimento, quebras de linha, temas claro/escuro, edição integral, fechamento de Mais detalhes sem perder alterações, persistência após reload e reedição do mesmo texto. Também confere que o preço permanece inalterado.
- Export Android/Hermes aprovado, mantendo SDK 58. Não é APK nem execução em aparelho.
- Não houve teste físico adicional. O relato anterior do proprietário sobre Expo Go Android não substitui a conferência deste comportamento no dispositivo.

## Conferir no Expo Go

Reabrir o projeto correto e usar Reload enquanto o servidor de desenvolvimento estiver acessível. Um link experimental antigo pode ter expirado; nenhuma disponibilidade permanente é prometida nesta entrega.

Importar uma página com descrição curta e outra com descrição longa. Na prévia, expandir/recolher; abrir a revisão, Mais detalhes e categorias, Editar descrição e percorrer todo o campo. Alterar uma linha ao final, concluir, salvar e conferir nos detalhes. Fechar/reabrir com o projeto acessível e verificar o texto integral novamente. Repetir nos temas claro e escuro e, se possível, com fonte ampliada no Android. Não limpar dados ou reinstalar o Expo Go para atualizar o JavaScript.
