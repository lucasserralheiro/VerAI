'use client'

/**
 * Preferência de fonte/tamanho da Proposta Comercial — controla tanto o
 * preview renderizado (`.markdown-preview` em globals.css, via variáveis CSS
 * aplicadas em `ConteudoEditavelProposta`) quanto o HTML que "Copiar
 * formatado" manda pra área de transferência (`copiarMarkdownFormatado`).
 *
 * Guardada no localStorage do navegador — é uma preferência de quem está
 * editando, não um dado da proposta em si, então não precisa de coluna no
 * banco: cada pessoa vê/copia com a fonte que preferir, e ela persiste entre
 * sessões no mesmo navegador.
 */

export interface OpcaoFonte {
  /** Valor salvo/usado no <select> — estável mesmo se o rótulo mudar. */
  valor: string
  rotulo: string
  /** Pilha de font-family CSS completa, com fallbacks. */
  pilha: string
}

export const OPCOES_FONTE: OpcaoFonte[] = [
  { valor: 'aptos', rotulo: 'Aptos (Corpo)', pilha: "'Aptos', 'Aptos Text', Calibri, 'Segoe UI', sans-serif" },
  { valor: 'calibri', rotulo: 'Calibri', pilha: "Calibri, 'Segoe UI', sans-serif" },
  { valor: 'arial', rotulo: 'Arial', pilha: 'Arial, Helvetica, sans-serif' },
  { valor: 'times-new-roman', rotulo: 'Times New Roman', pilha: "'Times New Roman', Times, serif" },
  { valor: 'segoe-ui', rotulo: 'Segoe UI', pilha: "'Segoe UI', Tahoma, sans-serif" },
  { valor: 'verdana', rotulo: 'Verdana', pilha: 'Verdana, Geneva, sans-serif' },
]

/** Tamanhos de corpo de texto disponíveis, em pt — o título usa sempre
 *  corpo + 2pt, pra manter a mesma proporção em qualquer tamanho escolhido. */
export const TAMANHOS_CORPO = [10, 11, 12, 13, 14, 16] as const
export type TamanhoCorpo = (typeof TAMANHOS_CORPO)[number]

export interface PreferenciaFonte {
  fonte: string
  tamanhoCorpo: TamanhoCorpo
}

export const PREFERENCIA_PADRAO: PreferenciaFonte = { fonte: 'aptos', tamanhoCorpo: 12 }

const CHAVE_LOCALSTORAGE = 'verai:proposta:preferenciaFonte'

function ehTamanhoValido(valor: unknown): valor is TamanhoCorpo {
  return typeof valor === 'number' && (TAMANHOS_CORPO as readonly number[]).includes(valor)
}

/** Lê a preferência salva no localStorage; devolve o padrão (Aptos 12pt) se
 *  não houver nada salvo, se o valor salvo for inválido/de uma fonte que não
 *  existe mais, ou se o localStorage estiver indisponível (SSR, modo
 *  privado, quota). Nunca lança — sempre devolve uma preferência utilizável. */
export function carregarPreferenciaFonte(): PreferenciaFonte {
  if (typeof window === 'undefined') return PREFERENCIA_PADRAO
  try {
    const bruto = window.localStorage.getItem(CHAVE_LOCALSTORAGE)
    if (!bruto) return PREFERENCIA_PADRAO
    const dados = JSON.parse(bruto) as Partial<PreferenciaFonte>
    const fonteValida = OPCOES_FONTE.some((o) => o.valor === dados.fonte) ? (dados.fonte as string) : PREFERENCIA_PADRAO.fonte
    const tamanhoValido = ehTamanhoValido(dados.tamanhoCorpo) ? dados.tamanhoCorpo : PREFERENCIA_PADRAO.tamanhoCorpo
    return { fonte: fonteValida, tamanhoCorpo: tamanhoValido }
  } catch {
    return PREFERENCIA_PADRAO
  }
}

/** Salva a preferência no localStorage. Falha silenciosamente (modo
 *  privado, quota estourada) — a preferência simplesmente não persiste entre
 *  sessões nesse caso, mas continua funcionando em memória na sessão atual. */
export function salvarPreferenciaFonte(preferencia: PreferenciaFonte): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAVE_LOCALSTORAGE, JSON.stringify(preferencia))
  } catch {
    // localStorage indisponível — preferência não persiste, mas o app segue funcionando.
  }
}

/** Pilha de font-family CSS pro valor salvo — cai pro padrão (Aptos) se o
 *  valor não corresponder a nenhuma opção conhecida. */
export function pilhaDaFonte(valor: string): string {
  return OPCOES_FONTE.find((o) => o.valor === valor)?.pilha ?? OPCOES_FONTE[0].pilha
}
