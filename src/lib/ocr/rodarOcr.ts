import { listarBlocosOcrPendente, substituirCorpo } from './marcadorOcrPendente'

export interface ProgressoOcr {
  pagina: number
  total: number
}

export interface DepsRodarOcr {
  renderizarPagina: (arquivoId: string, pagina: number) => Promise<string>
  reconhecer: (imagemDataUrl: string) => Promise<string>
  onProgresso?: (p: ProgressoOcr) => void
}

/**
 * Roda o OCR de TODOS os blocos `:::ocr-pendente` do markdown, um a um,
 * preenchendo o corpo de cada um com o texto reconhecido (o wrapper continua
 * lá — a conferência humana é um passo separado, ver `marcadorOcrPendente.ts`
 * `removerWrapper`). Erro numa página vira um aviso só naquela página; as
 * outras seguem normalmente.
 */
export async function rodarOcrEmBlocos(markdown: string, deps: DepsRodarOcr): Promise<string> {
  const blocos = listarBlocosOcrPendente(markdown)
  let atual = markdown

  for (const [indice, bloco] of blocos.entries()) {
    deps.onProgresso?.({ pagina: indice + 1, total: blocos.length })
    try {
      if (!bloco.arquivoId) throw new Error('bloco de OCR sem arquivoId')
      const imagem = await deps.renderizarPagina(bloco.arquivoId, bloco.pagina)
      const texto = await deps.reconhecer(imagem)
      atual = substituirCorpo(atual, bloco, texto)
    } catch {
      atual = substituirCorpo(atual, bloco, '_(OCR falhou nesta página — transcreva manualmente a partir do original)_')
    }
  }

  return atual
}
