import { diffWords } from 'diff'
import { renderizarHtmlProposta } from './renderizarHtmlProposta'

/**
 * Recebe o Markdown original e o corrigido pela IA e devolve o HTML do
 * documento corrigido com cada troca de palavra destacada inline
 * (`<del>` pro texto removido, `<ins>` pro adicionado). Como o guardrail já
 * garante que a estrutura não mudou, dá pra casar os nós de texto das duas
 * árvores renderizadas por posição e diffar par a par.
 */
export function diffPropostaRenderizada(original: string, corrigido: string): string {
  const htmlCorrigido = renderizarHtmlProposta(corrigido)

  if (typeof DOMParser === 'undefined') return htmlCorrigido

  const docOriginal = new DOMParser().parseFromString(renderizarHtmlProposta(original), 'text/html')
  const docCorrigido = new DOMParser().parseFromString(htmlCorrigido, 'text/html')

  const textosOriginal = coletarNosDeTexto(docOriginal.body, [])
  const textosCorrigido = coletarNosDeTexto(docCorrigido.body, [])

  if (textosOriginal.length !== textosCorrigido.length) return htmlCorrigido

  textosCorrigido.forEach((noCorrigido, i) => {
    const textoOriginal = textosOriginal[i].textContent ?? ''
    const textoCorrigido = noCorrigido.textContent ?? ''
    if (textoOriginal === textoCorrigido) return

    const span = docCorrigido.createElement('span')
    for (const parte of diffWords(textoOriginal, textoCorrigido)) {
      if (parte.added) {
        const ins = docCorrigido.createElement('ins')
        ins.textContent = parte.value
        span.appendChild(ins)
      } else if (parte.removed) {
        const del = docCorrigido.createElement('del')
        del.textContent = parte.value
        span.appendChild(del)
      } else {
        span.appendChild(docCorrigido.createTextNode(parte.value))
      }
    }
    noCorrigido.replaceWith(span)
  })

  return docCorrigido.body.innerHTML
}

function coletarNosDeTexto(no: Node, acumulador: Text[]): Text[] {
  for (const filho of Array.from(no.childNodes)) {
    if (filho.nodeType === 3) {
      if ((filho.textContent ?? '').trim() !== '') acumulador.push(filho as Text)
    } else {
      coletarNosDeTexto(filho, acumulador)
    }
  }
  return acumulador
}
