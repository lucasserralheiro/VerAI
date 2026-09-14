import { listarBlocosOcrPendente, substituirCorpo } from './marcadorOcrPendente'
import { reconstruirTabelaOcr } from './tabelaPorPosicaoOcr'
import { escaparHtml } from '../extracao/escaparHtml'

export interface ProgressoOcr {
  pagina: number
  total: number
}

export interface PalavraReconhecidaOcr {
  texto: string
  x: number
  largura: number
  y: number
}

export interface ResultadoReconhecimento {
  texto: string
  palavras: PalavraReconhecidaOcr[]
}

export interface DepsRodarOcr {
  renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>
  reconhecer: (imagemDataUrl: string) => Promise<ResultadoReconhecimento>
  onProgresso?: (p: ProgressoOcr) => void
}

/** Monta o corpo HTML do bloco a partir do resultado do reconhecimento:
 *  tenta reconstruir tabela pela posição das palavras primeiro (mais fiel
 *  quando o padrão de coluna é reconhecível); sem padrão, cai pra um
 *  parágrafo por linha de texto reconhecida — texto bruto do OCR é
 *  escapado (nunca confiar em `&`/`</>` vindos de reconhecimento de
 *  caractere). */
function montarCorpoDoOcr(resultado: ResultadoReconhecimento): string {
  const tabela = reconstruirTabelaOcr(resultado.palavras)
  if (tabela) return tabela

  return resultado.texto
    .split('\n')
    .filter((linha) => linha.trim().length > 0)
    .map((linha) => `<p>${escaparHtml(linha.trim())}</p>`)
    .join('')
}

/**
 * Roda o OCR de TODOS os blocos `.ocr-pendente` do HTML, um a um,
 * preenchendo o corpo de cada um com o texto (ou tabela) reconhecido — o
 * wrapper continua lá, a conferência humana é um passo separado (ver
 * `marcadorOcrPendente.ts`, `removerWrapper`). Erro numa página vira um
 * aviso só naquela página; as outras seguem normalmente.
 */
export async function rodarOcrEmBlocos(html: string, deps: DepsRodarOcr): Promise<string> {
  const blocos = listarBlocosOcrPendente(html)
  let atual = html

  for (const [indice, bloco] of blocos.entries()) {
    deps.onProgresso?.({ pagina: indice + 1, total: blocos.length })
    try {
      if (!bloco.arquivoId) throw new Error('bloco de OCR sem arquivoId')
      const imagem = await deps.renderizarPagina(bloco.arquivoId, bloco.pagina)
      const resultado = await deps.reconhecer(imagem)
      atual = substituirCorpo(atual, bloco, montarCorpoDoOcr(resultado))
    } catch {
      atual = substituirCorpo(
        atual,
        bloco,
        '<p><em>(OCR falhou nesta página — transcreva manualmente a partir do original)</em></p>'
      )
    }
  }

  return atual
}
