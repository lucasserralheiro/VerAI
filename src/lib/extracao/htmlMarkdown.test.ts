import { converterHtmlParaMarkdown } from './htmlMarkdown'

describe('converterHtmlParaMarkdown', () => {
  it('converte parágrafo e títulos simples', () => {
    const html = '<h2>Seção 1</h2><p>Um parágrafo <strong>importante</strong>.</p>'
    expect(converterHtmlParaMarkdown(html)).toBe('## Seção 1\n\n' + 'Um parágrafo **importante**.')
  })

  it('converte lista simples fora de tabela (sem mudança de comportamento)', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
    expect(converterHtmlParaMarkdown(html)).toBe('- Item 1\n- Item 2')
  })

  it('converte tabela simples com célula de texto puro (comportamento anterior preservado)', () => {
    const html = '<table><tr><td>Item</td><td>Valor</td></tr><tr><td>Storage</td><td>R$ 100</td></tr></table>'
    const md = converterHtmlParaMarkdown(html)
    expect(md).toContain('| Item | Valor |')
    expect(md).toContain('| Storage | R$ 100 |')
  })

  it('preserva múltiplos parágrafos dentro de UMA célula como linhas separadas (<br>), em vez de colar tudo junto', () => {
    const html = '<table><tr><td>' + '<p>B - Serviços De Redes E Conectividades</p>' + '<p>11.027.00001.00 - DISPONIBILIZAÇÃO DE CERTIFICADO DIGITAL</p>' + '</td></tr></table>'
    const md = converterHtmlParaMarkdown(html)

    expect(md).toContain('B - Serviços De Redes E Conectividades<br>11.027.00001.00 - DISPONIBILIZAÇÃO DE CERTIFICADO DIGITAL')
  })

  it('preserva lista dentro de célula como linhas com marcador "•", não como texto corrido', () => {
    const html = '<table><tr><td>' + '<ul><li>Permite trocar informações com segurança.</li>' + '<li>Garante a legitimidade do subdomínio.</li></ul>' + '</td></tr></table>'
    const md = converterHtmlParaMarkdown(html)

    expect(md).toContain('• Permite trocar informações com segurança.<br>• Garante a legitimidade do subdomínio.')
    // sem isso, a célula viraria "Permite trocar informações com segurança.Garante a legitimidade do subdomínio."
    // (texto corrido, sem marcador nem separação) — exatamente o bug relatado.
  })

  it('preserva lista aninhada dentro de célula, com recuo pro segundo nível', () => {
    const html =
      '<table><tr><td>' +
      '<ul><li>O fornecimento deste serviço inclui:' +
      '<ul><li>A geração da CSR;</li><li>Suporte técnico.</li></ul>' +
      '</li></ul>' +
      '</td></tr></table>'
    const md = converterHtmlParaMarkdown(html)

    expect(md).toContain('• O fornecimento deste serviço inclui:<br>&nbsp;&nbsp;&nbsp;&nbsp;• A geração da CSR;<br>&nbsp;&nbsp;&nbsp;&nbsp;• Suporte técnico.')
  })

  it('preserva parágrafo(s) de "cabeçalho" seguidos de lista na mesma célula, igual ao documento original', () => {
    const html =
      '<table><tr><td>' +
      '<p>11.027.00001.00 - DISPONIBILIZAÇÃO DE CERTIFICADO DIGITAL - SERVIDOR SSL</p>' +
      '<ul><li>Permite que aplicativos Web troquem informações em segurança.</li>' +
      '<li>O fornecimento deste serviço inclui:' +
      '<ul><li>A geração da CSR;</li></ul>' +
      '</li></ul>' +
      '</td></tr></table>'
    const md = converterHtmlParaMarkdown(html)

    expect(md).toContain(
      '11.027.00001.00 - DISPONIBILIZAÇÃO DE CERTIFICADO DIGITAL - SERVIDOR SSL<br>' +
        '• Permite que aplicativos Web troquem informações em segurança.<br>' +
        '• O fornecimento deste serviço inclui:<br>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;• A geração da CSR;'
    )
  })

  it('escapa "|" dentro do conteúdo da célula mesmo com <br> misturado', () => {
    const html = '<table><tr><td><p>Custo: R$ 10 | mês</p><ul><li>Item</li></ul></td></tr></table>'
    const md = converterHtmlParaMarkdown(html)

    expect(md).toContain('Custo: R$ 10 \\| mês<br>• Item')
  })
})
