// Leituras públicas do Supabase (papel anon, statement_timeout de 3 s) disputam o banco gratuito com as coletas.
// Um pico isolado cancelava a consulta (57014) e a página respondia 503, embora a segunda tentativa funcionasse.
// Repetir só erros transitórios (timeout, conexão, PostgREST sem banco), com espera curta; erro de SQL/permissão
// volta na hora. Nunca usado para gravar.
type Result = {error: {code?: string; message?: string} | null};
const TRANSIENT = new Set(['57014', '40001', '40P01', '53300', '57P01', '08000', '08001', '08003', '08006', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);
export function transientError(e: Result['error']): boolean {
  if (!e) return false;
  if (e.code && TRANSIENT.has(e.code)) return true;
  // Falha de rede/gateway (fetch failed, 502/503/504 HTML) chega sem código SQL.
  return !e.code || /fetch failed|timeout|ECONNRESET|socket|502|503|504|520|522|524/i.test(e.message ?? '');
}
export async function withRetry<T extends Result>(run: () => PromiseLike<T>, delays: number[] = [250, 900]): Promise<T> {
  let r = await run();
  for (const ms of delays) {
    if (!transientError(r.error)) return r;
    await new Promise(res => setTimeout(res, ms));
    r = await run();
  }
  return r;
}
