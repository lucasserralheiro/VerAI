import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const hook = {
  conversaId: null as string | null,
  mensagens: [] as { id: string; papel: 'usuario' | 'assistente'; conteudo: string }[],
  estado: 'pronto' as 'pronto' | 'respondendo' | 'erro',
  erro: null as string | null,
  ferramentaAtual: null as string | null,
  anexos: [] as { id: string; nome: string; etapa: 'fila' | 'enviando' | 'ocr' | 'lendo' | 'pronto' | 'erro'; progresso?: { pagina: number; total: number } }[],
  enviar: jest.fn(),
  anexar: jest.fn(),
  parar: jest.fn(),
  tentarDeNovo: jest.fn(),
  novaConversa: jest.fn(),
  abrirConversa: jest.fn(),
}
jest.mock('./use-conversa-assistente', () => ({ useConversaAssistente: () => hook }))
jest.mock('@/components/relatorios-clientes/sei-link', () => ({ SeiLink: ({ numero }: { numero: string }) => <span>{numero}</span> }))

import { PainelAssistente } from './painel-assistente'

/** Renderiza e espera o chip de contexto (o fetch do rótulo) — sem isso o setState dele cai fora do act. */
async function abrirPainel(rota = '/confere') {
  render(<PainelAssistente rota={rota} onFechar={() => {}} />)
  await screen.findByText('SMIT › Contrato 031/2023')
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(hook, { conversaId: null, mensagens: [], estado: 'pronto', erro: null, ferramentaAtual: null, anexos: [] })
  hook.anexar.mockResolvedValue(true)
  global.fetch = jest.fn(async (url: string) =>
    new Response(JSON.stringify(String(url).startsWith('/api/assistente/contexto') ? { rotulo: 'SMIT › Contrato 031/2023' } : { conversas: [] }))
  ) as jest.Mock
})

it('mostra o chip de contexto da tela e as sugestões; clicar numa sugestão envia com a rota', async () => {
  render(<PainelAssistente rota="/clientes/c1/contratos/k1" onFechar={() => {}} />)
  expect(await screen.findByText('SMIT › Contrato 031/2023')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Qual o saldo deste contrato?' }))
  expect(hook.enviar).toHaveBeenCalledWith('Qual o saldo deste contrato?', '/clientes/c1/contratos/k1')
})

it('remover o chip envia sem a rota', async () => {
  render(<PainelAssistente rota="/clientes/c1" onFechar={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Remover contexto' }))
  fireEvent.change(screen.getByPlaceholderText(/Pergunte/), { target: { value: 'oi' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/Pergunte/), { key: 'Enter' })
  expect(hook.enviar).toHaveBeenCalledWith('oi', '')
})

it('Shift+Enter não envia', async () => {
  await abrirPainel()
  fireEvent.change(screen.getByPlaceholderText(/Pergunte/), { target: { value: 'oi' } })
  fireEvent.keyDown(screen.getByPlaceholderText(/Pergunte/), { key: 'Enter', shiftKey: true })
  expect(hook.enviar).not.toHaveBeenCalled()
})

it('respondendo: mostra a ferramenta em uso e o botão Parar', async () => {
  Object.assign(hook, { estado: 'respondendo', ferramentaAtual: 'resumoDoCliente', mensagens: [{ id: 'p', papel: 'usuario', conteudo: 'oi' }] })
  await abrirPainel()
  expect(screen.getByText('Consultando o cliente…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Parar' }))
  expect(hook.parar).toHaveBeenCalled()
})

it('erro: mostra a mensagem e "Tentar de novo" (com a rota, quando há contexto)', async () => {
  Object.assign(hook, { estado: 'erro', erro: 'O assistente não respondeu. Tente de novo.' })
  render(<PainelAssistente rota="/clientes/c1" onFechar={() => {}} />)
  await screen.findByText('SMIT › Contrato 031/2023') // espera o chip carregar
  expect(screen.getByText('O assistente não respondeu. Tente de novo.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(hook.tentarDeNovo).toHaveBeenCalledWith('/clientes/c1')
})

it('lista conversas anteriores e abre uma', async () => {
  ;(global.fetch as jest.Mock).mockImplementation(async (url: string) =>
    new Response(JSON.stringify(String(url).startsWith('/api/assistente/contexto') ? { rotulo: null } : { conversas: [{ id: 'c9', titulo: 'Saldo do SMIT', atualizadaEm: '2026-09-22T10:00:00Z' }] }))
  )
  render(<PainelAssistente rota="/confere" onFechar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Conversas anteriores' }))
  fireEvent.click(await screen.findByRole('button', { name: /Saldo do SMIT/ }))
  await waitFor(() => expect(hook.abrirConversa).toHaveBeenCalledWith('c9'))
})

describe('anexos', () => {
  const arquivo = (nome: string) => new File(['x'], nome)

  it('"Anexar arquivo" abre o seletor (vários, só os formatos aceitos) e os escolhidos são anexados com a rota', async () => {
    await abrirPainel('/clientes/c1')
    const seletor = screen.getByTestId('seletor-de-anexos') as HTMLInputElement
    expect(seletor.type).toBe('file')
    expect(seletor.multiple).toBe(true)
    expect(seletor.accept).toBe('.pdf,.docx,.xlsx,.csv,.txt')
    const abrir = jest.spyOn(seletor, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Anexar arquivo' }))
    expect(abrir).toHaveBeenCalled()
    const a = arquivo('proposta.pdf')
    fireEvent.change(seletor, { target: { files: [a] } })
    expect(hook.anexar).toHaveBeenCalledWith([a], '/clientes/c1')
  })

  it('soltar arquivos no painel anexa todos', async () => {
    await abrirPainel()
    const painel = screen.getByRole('dialog', { name: 'Assistente VerAI' })
    const a = arquivo('a.pdf')
    const b = arquivo('b.xlsx')
    fireEvent.dragOver(painel, { dataTransfer: { files: [a, b], types: ['Files'] } })
    expect(screen.getByText('Solte os arquivos para anexar')).toBeInTheDocument()
    fireEvent.drop(painel, { dataTransfer: { files: [a, b], types: ['Files'] } })
    expect(hook.anexar).toHaveBeenCalledWith([a, b], '/confere')
    expect(screen.queryByText('Solte os arquivos para anexar')).not.toBeInTheDocument()
  })

  it('respondendo: clipe e arrastar desativados (a ficha não entra entre a pergunta e a resposta)', async () => {
    Object.assign(hook, { estado: 'respondendo', mensagens: [{ id: 'p', papel: 'usuario', conteudo: 'oi' }] })
    await abrirPainel()
    expect(screen.getByRole('button', { name: 'Anexar arquivo' })).toBeDisabled()
    expect((screen.getByTestId('seletor-de-anexos') as HTMLInputElement).disabled).toBe(true)
    const painel = screen.getByRole('dialog', { name: 'Assistente VerAI' })
    const a = arquivo('a.pdf')
    fireEvent.dragOver(painel, { dataTransfer: { files: [a], types: ['Files'] } })
    expect(screen.queryByText('Solte os arquivos para anexar')).not.toBeInTheDocument()
    // Soltar não abre o arquivo no navegador, mas também não anexa.
    expect(fireEvent.drop(painel, { dataTransfer: { files: [a], types: ['Files'] } })).toBe(false)
    expect(hook.anexar).not.toHaveBeenCalled()
  })

  it('mostra os cartões dos anexos com o andamento', async () => {
    hook.anexos = [{ id: 'l1', nome: 'termo.pdf', etapa: 'ocr', progresso: { pagina: 3, total: 12 } }]
    await abrirPainel()
    expect(screen.getByText('termo.pdf')).toBeInTheDocument()
    expect(screen.getByText('Lendo página 3 de 12 (OCR)…')).toBeInTheDocument()
    // leitor de tela anuncia o andamento
    expect(screen.getByRole('region', { name: 'Anexos da conversa' })).toHaveAttribute('aria-live', 'polite')
  })

  it('texto colado com mais de 2.000 caracteres vira anexo .txt e a pergunta enviada é a primeira linha', async () => {
    await abrirPainel()
    const campo = screen.getByPlaceholderText(/Pergunte/)
    expect(campo).not.toHaveAttribute('maxLength')
    const colado = 'Confira os valores deste e-mail\n' + 'x'.repeat(2500)
    fireEvent.change(campo, { target: { value: colado } })
    await act(async () => {
      fireEvent.keyDown(campo, { key: 'Enter' })
    })
    const [[arquivos]] = hook.anexar.mock.calls as [File[], string][]
    expect(arquivos).toHaveLength(1)
    expect(arquivos[0].name).toMatch(/^texto-colado-\d{4}-\d{2}-\d{2}-\d{4}\.txt$/)
    expect(arquivos[0].size).toBe(colado.length)
    await waitFor(() => expect(hook.enviar).toHaveBeenCalledWith('Confira os valores deste e-mail', '/confere'))
    expect(campo).toHaveValue('')
  })

  it('texto colado sem linha curta: a pergunta é "Analise o texto colado."; anexo com erro não envia pergunta', async () => {
    await abrirPainel()
    const campo = screen.getByPlaceholderText(/Pergunte/)
    fireEvent.change(campo, { target: { value: 'y'.repeat(2500) } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    })
    await waitFor(() => expect(hook.enviar).toHaveBeenCalledWith('Analise o texto colado.', '/confere'))

    hook.enviar.mockClear()
    hook.anexar.mockResolvedValue(false)
    fireEvent.change(campo, { target: { value: 'z'.repeat(2500) } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    })
    expect(hook.anexar).toHaveBeenCalledTimes(2)
    expect(hook.enviar).not.toHaveBeenCalled()
    // o texto colado não se perde: volta ao campo
    expect(campo).toHaveValue('z'.repeat(2500))
  })

  it('anexo do texto colado falhou mas o usuário já trocou de conversa (ou digitou outra coisa): o campo não é sobrescrito', async () => {
    await abrirPainel()
    const campo = screen.getByPlaceholderText(/Pergunte/)
    let concluir!: (ok: boolean) => void
    hook.anexar.mockImplementation(() => new Promise<boolean>((r) => (concluir = r)))
    fireEvent.change(campo, { target: { value: 'z'.repeat(2500) } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    await act(async () => concluir(false))
    expect(campo).toHaveValue('')

    fireEvent.change(campo, { target: { value: 'w'.repeat(2500) } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    fireEvent.change(campo, { target: { value: 'outra pergunta' } })
    await act(async () => concluir(false))
    expect(campo).toHaveValue('outra pergunta')
  })

  it('com o painel aberto, soltar arquivo fora dele não abre o arquivo no navegador (só arraste de arquivos)', async () => {
    const { unmount } = render(<PainelAssistente rota="/confere" onFechar={() => {}} />)
    await screen.findByText('SMIT › Contrato 031/2023')
    // fireEvent devolve false quando alguém chamou preventDefault
    expect(fireEvent.dragOver(window, { dataTransfer: { types: ['Files'] } })).toBe(false)
    expect(fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [] } })).toBe(false)
    expect(fireEvent.dragOver(window, { dataTransfer: { types: ['text/plain'] } })).toBe(true)
    expect(hook.anexar).not.toHaveBeenCalled()
    unmount()
    expect(fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [] } })).toBe(true)
  })

  it('até 2.000 caracteres continua indo como pergunta', async () => {
    await abrirPainel()
    const campo = screen.getByPlaceholderText(/Pergunte/)
    fireEvent.change(campo, { target: { value: 'a'.repeat(2000) } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(hook.anexar).not.toHaveBeenCalled()
    expect(hook.enviar).toHaveBeenCalledWith('a'.repeat(2000), '/confere')
  })
})
