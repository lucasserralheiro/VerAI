import { useState } from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PainelChecagemConversao } from './painel-checagem-conversao'
import { limparChecagemIa } from '@/lib/checagemIaEmAndamento'
import { limparOcr } from '@/lib/ocrEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('PainelChecagemConversao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
    limparOcr('p1')
  })

  it('com marcador de OCR pendente mostra o OcrRunner e NÃO inicia a checagem por IA', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(
      <PainelChecagemConversao
        propostaId="p1"
        conteudoMarkdown={
          '<p>texto</p><div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>'
        }
        onConteudoAtualizado={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sem marcador pendente, inicia a checagem sozinha e mostra "Verificando com IA..."', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(screen.getByText(/Verificando com IA/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })

  it('mostra o score (nunca 100%) e o motivo do trecho suspeito ao conferir', async () => {
    mockFetch({
      ok: true,
      body: { scoreExibido: 87, trechosSuspeitos: [{ pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número suspeito' }] },
    })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/87%/)).toBeInTheDocument()
    expect(screen.getByText(/estimativa da IA/i)).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /^Conferir$/ }))
    expect(await screen.findByText(/número suspeito/)).toBeInTheDocument()
  })

  it('score null mostra a mensagem de "sem páginas de texto nativo"', async () => {
    mockFetch({ ok: true, body: { scoreExibido: null, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/Sem páginas de texto nativo/)).toBeInTheDocument()
  })

  it('erro na checagem mostra mensagem', async () => {
    mockFetch({ ok: false, body: { error: 'modelo indisponível' } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    await waitFor(() => expect(screen.getByText(/modelo indisponível/)).toBeInTheDocument())
  })

  it('mostra aviso de página com imagem embutida quando paginasComImagem não é vazio', async () => {
    mockFetch({
      ok: true,
      body: { scoreExibido: 90, trechosSuspeitos: [], paginasComImagem: [3, 8] },
    })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/3, 8/)).toBeInTheDocument()
    expect(screen.getByText(/imagem embutida/i)).toBeInTheDocument()
  })

  it('sem paginasComImagem, não mostra o aviso', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [], paginasComImagem: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    await screen.findByText(/90%/)
    expect(screen.queryByText(/imagem embutida/i)).not.toBeInTheDocument()
  })

  describe('correção automática dos trechos suspeitos', () => {
    const CORRIGIVEL = { pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número suspeito', correcaoSugerida: 'Valor: R$ 1.000' }
    const TEXTO = 'texto ... Valor: R$ 100 ... resto'
    const CORRIGIDO = 'texto ... Valor: R$ 1.000 ... resto'

    /** Monta o painel com o texto em estado, igual ao editor: o que o painel
     *  manda salvar volta como `conteudoMarkdown` na próxima renderização. */
    function Editor({ inicial, onSalvar }: { inicial: string; onSalvar: (markdown: string) => Promise<void> }) {
      const [texto, setTexto] = useState(inicial)
      return (
        <>
          <PainelChecagemConversao
            propostaId="p1"
            conteudoMarkdown={texto}
            onConteudoAtualizado={async (novo) => {
              setTexto(novo)
              await onSalvar(novo)
            }}
          />
          <output data-testid="texto">{texto}</output>
        </>
      )
    }

    it('trecho com correcaoSugerida ancorada mostra o botão de corrigir', async () => {
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown={TEXTO} onConteudoAtualizado={jest.fn()} />)

      expect(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ })).toBeInTheDocument()
      expect(screen.getByText(/1 com correção automática/)).toBeInTheDocument()
    })

    it('trecho sem correcaoSugerida (null) não mostra botão de corrigir, só entra na lista pra conferir à mão', async () => {
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [{ ...CORRIGIVEL, correcaoSugerida: null }] } })

      render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown={TEXTO} onConteudoAtualizado={jest.fn()} />)

      // Resumo único no topo (substitui a antiga frase separada por
      // categoria) — "1 diferença entre o PDF e o documento".
      expect(await screen.findByText(/1 diferença entre o PDF e o documento/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /automaticamente/ })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /^Conferir$/ }))
      expect(await screen.findByText(/número suspeito/)).toBeInTheDocument()
    })

    it('trecho que só diverge no marcador de lista (• no relato da IA vs "-" no Markdown) consegue aplicar — antes ficava travado', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      const DOC = '- Item ainda errado no documento\n- outro item qualquer'
      const SUSPEITO = {
        pagina: 1,
        trecho: '• Item ainda errado no documento',
        motivo: 'texto não bate com o PDF',
        correcaoSugerida: null,
        trechoOriginal: 'Item já corrigido no PDF',
        trechoOriginalEspecifico: true,
      }
      mockFetch({ ok: true, body: { scoreExibido: 70, trechosSuspeitos: [SUSPEITO] } })

      render(<Editor inicial={DOC} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /^Conferir$/ }))
      // Muda o rascunho pro texto do PDF — só aí "Como vai ficar" difere do
      // documento (editado=true) e o botão passa a depender só de achar o
      // trecho no Markdown, que é o que este teste cobre.
      fireEvent.click(await screen.findByRole('button', { name: 'PDF' }))

      const aplicar = await screen.findByRole('button', { name: /Aplicar no documento/ })
      await waitFor(() => expect(aplicar).not.toBeDisabled())
      fireEvent.click(aplicar)

      // O marcador de lista original ("- ") sobrevive — só o conteúdo troca.
      await waitFor(() =>
        expect(onSalvar).toHaveBeenCalledWith('- Item já corrigido no PDF\n- outro item qualquer')
      )
    })

    it('clicar em "Corrigir automaticamente" aplica e salva na hora, mostrando vermelho (antes) e verde (depois)', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))

      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))
      expect(screen.getByTestId('texto')).toHaveTextContent(CORRIGIDO)
      expect(await screen.findByText(/1 correção aplicada/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Conferir o que mudou/ }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(document.querySelector('del')).toHaveTextContent('100')
      expect(document.querySelector('ins')).toHaveTextContent('1.000')
    })

    it('"Desfazer" num item volta aquele trecho pro Markdown de antes e salva de novo', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))

      fireEvent.click(screen.getByRole('button', { name: /Conferir o que mudou/ }))
      const desfazer = await screen.findByRole('button', { name: /^Desfazer$/ })
      await waitFor(() => expect(desfazer).not.toBeDisabled())
      fireEvent.click(desfazer)

      await waitFor(() => expect(onSalvar).toHaveBeenLastCalledWith(TEXTO))
      expect(screen.getByTestId('texto')).toHaveTextContent(TEXTO)
      expect(await screen.findByText(/Desfeita/)).toBeInTheDocument()

      const aplicarDeNovo = screen.getByRole('button', { name: /Aplicar de novo/ })
      await waitFor(() => expect(aplicarDeNovo).not.toBeDisabled())
      fireEvent.click(aplicarDeNovo)
      await waitFor(() => expect(onSalvar).toHaveBeenLastCalledWith(CORRIGIDO))
    })

    it('"Desfazer todas" volta o texto original e o botão de corrigir reaparece', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))

      // O botão fica desabilitado enquanto "salvando" continua true — espera
      // o save da correção terminar de vez antes de clicar, senão o clique
      // num botão disabled não dispara o handler (comportamento nativo do
      // <button disabled>, não um bug da revisão).
      const desfazerTodas = screen.getByRole('button', { name: /Desfazer todas/ })
      await waitFor(() => expect(desfazerTodas).not.toBeDisabled())
      fireEvent.click(desfazerTodas)

      await waitFor(() => expect(onSalvar).toHaveBeenLastCalledWith(TEXTO))
      expect(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ })).toBeInTheDocument()
    })

    it('"Concluir" fecha a lista e o trecho corrigido não volta como pendente', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))

      const concluir = screen.getByRole('button', { name: /Concluir/ })
      await waitFor(() => expect(concluir).not.toBeDisabled())
      fireEvent.click(concluir)

      expect(await screen.findByText(/Nenhum trecho suspeito encontrado/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /automaticamente/ })).not.toBeInTheDocument()
    })

    it('depois de corrigir automaticamente e "Auditar PDF depois das mudanças", o mesmo ponto não reaparece nem pra conferir à mão', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      // 1ª chamada: acha o trecho, corrige automaticamente. 2ª chamada
      // ("Auditar PDF depois das mudanças"): a IA relata de novo o MESMO
      // ponto — agora com o texto já corrigido — mas sem correção segura
      // (ex.: um dos guardas de `correcaoEhSegura` descartou). Sem a
      // blindagem de sessão, isso reaparece como "sem correção automática",
      // pedindo conferência de algo que já está certo.
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] }) })
        // "Concluir" marca (via `marcarCorrecaoAutomaticaAplicada`) que o
        // botão em lote já foi usado nesta proposta — não lê o corpo, só
        // confere `ok`.
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              scoreExibido: 90,
              trechosSuspeitos: [{ pagina: 2, trecho: 'Valor: R$ 1.000', motivo: 'ainda suspeito', correcaoSugerida: null }],
            }),
        })
      global.fetch = fetchMock as unknown as typeof fetch

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))

      const concluir = screen.getByRole('button', { name: /Concluir/ })
      await waitFor(() => expect(concluir).not.toBeDisabled())
      fireEvent.click(concluir)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

      fireEvent.click(await screen.findByRole('button', { name: /Auditar PDF depois das mudanças/ }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

      expect(await screen.findByText(/Nenhum trecho suspeito encontrado/)).toBeInTheDocument()
      expect(screen.queryByText(/sem correção automática/)).not.toBeInTheDocument()
    })

    it('se o texto não for o que as correções produziram (editado depois), desliga o desfazer', async () => {
      const onConteudoAtualizado = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      // sem estado: o texto recebido continua o antigo, como se a pessoa
      // tivesse mexido no documento depois da correção
      render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown={TEXTO} onConteudoAtualizado={onConteudoAtualizado} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))

      expect(await screen.findByText(/o desfazer foi desligado/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Desfazer$/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Desfazer todas/ })).toBeDisabled()
    })

    it('"Desfazer todas" ANTES de concluir não marca nada — o botão em lote continua disponível depois', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      mockFetch({ ok: true, body: { scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] } })

      render(<Editor inicial={TEXTO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO))

      const desfazerTodas = await screen.findByRole('button', { name: /Desfazer todas/ })
      await waitFor(() => expect(desfazerTodas).not.toBeDisabled())
      fireEvent.click(desfazerTodas)

      expect(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ })).toBeInTheDocument()
    })

    it('depois de "Concluir" a primeira leva, o botão em lote não volta — um achado novo (auditoria seguinte) vira conferência manual, já preenchido', async () => {
      const onSalvar = jest.fn().mockResolvedValue(undefined)
      // "Prazo: 30 dias" precisa existir DE VERDADE no texto pra ficar
      // "localizável" (`mudancasDaChecagem` exige achar `trecho` literal no
      // Markdown atual — ver `mudancasTexto.ts`); sem isso o achado cai
      // pra "não localizado" em vez de "correção pronta, só falta aplicar".
      const TEXTO_COM_PRAZO = `${TEXTO} Prazo: 30 dias`
      const CORRIGIDO_COM_PRAZO = `${CORRIGIDO} Prazo: 30 dias`
      const ACHADO_NOVO = {
        pagina: 3,
        trecho: 'Prazo: 30 dias',
        motivo: 'prazo divergente do PDF',
        correcaoSugerida: 'Prazo: 60 dias',
      }
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ scoreExibido: 80, trechosSuspeitos: [CORRIGIVEL] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // marcar (Concluir)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ scoreExibido: 92, trechosSuspeitos: [ACHADO_NOVO], correcaoAutomaticaAplicada: true }),
        })
      global.fetch = fetchMock as unknown as typeof fetch

      render(<Editor inicial={TEXTO_COM_PRAZO} onSalvar={onSalvar} />)
      fireEvent.click(await screen.findByRole('button', { name: /Corrigir 1 automaticamente/ }))
      await waitFor(() => expect(onSalvar).toHaveBeenCalledWith(CORRIGIDO_COM_PRAZO))

      const concluir = screen.getByRole('button', { name: /Concluir/ })
      await waitFor(() => expect(concluir).not.toBeDisabled())
      fireEvent.click(concluir)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

      fireEvent.click(await screen.findByRole('button', { name: /Auditar PDF depois das mudanças/ }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

      // Some o botão em lote, mesmo achando algo novo e localizável.
      expect(screen.queryByRole('button', { name: /automaticamente/ })).not.toBeInTheDocument()
      // ...mas o achado não desaparece: vira conferência manual.
      expect(await screen.findByText(/sem correção automática/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /^Conferir$/ }))
      expect(await screen.findByText(/prazo divergente do PDF/)).toBeInTheDocument()
      // O rótulo "Correção pronta, só falta aplicar" aparece 2x na tela (na
      // lista-resumo por motivo E dentro do painel de detalhe aberto) —
      // checa a explicação, que só existe no painel de detalhe, pra
      // confirmar que É esse o motivo mostrado pro item aberto.
      expect(
        screen.getByText(/o botão "Corrigir automaticamente" some depois da primeira vez usado/)
      ).toBeInTheDocument()
      const aplicar = screen.getByRole('button', { name: /Aplicar no documento/ })
      expect(aplicar).not.toBeDisabled()
    })
  })
})
