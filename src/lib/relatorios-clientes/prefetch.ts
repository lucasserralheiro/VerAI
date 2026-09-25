/**
 * Pré-carregamento das abas da ficha do cliente.
 *
 * Cada aba busca os próprios dados quando monta — então a primeira abertura de cada aba pagava
 * o tempo todo da rota (auth + banco, e no dev ainda a compilação da rota) com spinner. Aqui a
 * ficha aquece as outras abas em segundo plano, uma por vez (não disputa conexão com a aba
 * aberta), e a aba, ao montar, consome a resposta pronta em vez de pedir de novo.
 *
 * Regras que evitam dado velho:
 *  - uso único: a resposta pré-carregada é entregue a UM consumidor e sai do mapa; recarga depois
 *    de salvar/excluir sempre vai ao servidor;
 *  - validade curta (TTL): se ninguém usou em 30s, descarta;
 *  - só GET sem opções especiais além de `cache`.
 */
const TTL_MS = 30_000

interface Entrada {
  promessa: Promise<Response | null>
  criadaEm: number
}

const pendentes = new Map<string, Entrada>()

function chave(url: string, init?: RequestInit) {
  return `${init?.cache ?? 'default'}|${url}`
}

/** Repassa ao `fetch` só o que veio — drop-in fiel (sem `init`, a chamada é `fetch(url)`). */
function buscar(url: string, init?: RequestInit) {
  return init === undefined ? fetch(url) : fetch(url, init)
}

/** Dispara a busca e guarda a promessa. Não faz nada se já houver uma válida pra mesma URL. */
export function preCarregar(url: string, init?: RequestInit): Promise<void> {
  const k = chave(url, init)
  const existente = pendentes.get(k)
  if (existente && Date.now() - existente.criadaEm < TTL_MS) return existente.promessa.then(() => undefined)
  const promessa = buscar(url, init).catch(() => null)
  pendentes.set(k, { promessa, criadaEm: Date.now() })
  return promessa.then(() => undefined)
}

/**
 * Drop-in de `fetch` pra carga inicial de uma aba: entrega a resposta pré-carregada (uma vez) se
 * houver e estiver dentro do TTL; senão, `fetch` normal.
 */
export async function fetchComPreCarga(url: string, init?: RequestInit): Promise<Response> {
  const k = chave(url, init)
  const entrada = pendentes.get(k)
  if (entrada) {
    pendentes.delete(k)
    if (Date.now() - entrada.criadaEm < TTL_MS) {
      const resposta = await entrada.promessa
      if (resposta) return resposta
    }
  }
  return buscar(url, init)
}
