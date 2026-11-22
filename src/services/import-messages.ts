// UI categories explain the failure without claiming a store is supported.
export function importFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/HTTP (403|429)|bloqueou|captcha/i.test(message)) return 'A loja bloqueou a consulta. Complete os dados manualmente.';
  if (/HTTP \d+/.test(message)) return 'Loja temporariamente indisponível. Tente novamente ou complete os dados.';
  if (/JavaScript/.test(message)) return 'Esta página depende de JavaScript. Complete os dados manualmente.';
  if (/redirecion|destino não autorizado|endereço da resposta|link curto/i.test(message)) return 'Redirecionamento não autorizado ou não verificável. O link foi preservado.';
  if (/não disponibilizou|informações do produto|vários produtos|variante/.test(message)) return 'Informações do produto não confirmadas. Complete os dados manualmente.';
  if (/tempo esgotado/i.test(message)) return 'A loja demorou mais de 12 segundos. Complete os dados ou tente novamente.';
  if (/conexão|acessar a loja/.test(message)) return 'Falha de conexão. Tente novamente ou complete os dados.';
  return message || 'Informações indisponíveis. Complete os dados manualmente.';
}
