# Aviso de Imagem Embutida na Checagem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A checagem por IA passa a avisar quando uma página do PDF tem imagem de conteúdo embutida (possível tabela/gráfico não extraído como texto), fechando o buraco que nem a detecção de OCR nem a checagem de texto cobrem hoje.

**Architecture:** Dado 100% determinístico, já calculado em `converterPdfParaMarkdown` (a lista `imagensFiltradas`) — só passa a ser exposto no retorno, propagado pela rota `checagem-ia` e pelo cache de sessão até o painel. Sem IA nova, sem chamada extra.

**Tech Stack:** TypeScript, Jest + Testing Library — mesmo stack dos planos anteriores desta feature.

## Global Constraints

- Sem IA olhando a imagem — só aponta a página, a pessoa confere (decisão já tomada: vision da DeepSeek é
  experimental/limitado demais pra esse fim).
- Página já marcada em `paginasImagem` (fluxo de OCR) não duplica aviso aqui — só uma vez, no lugar certo.
- Score, trechos suspeitos e este aviso convivem na mesma tela — nenhum substitui o outro.

---

### Task 1: `paginasComImagem` em `converterPdfParaMarkdown`

**Files:**
- Modify: `src/lib/extracao/pdfMarkdown.ts`
- Test: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Produces: `ResultadoConversaoPdf` ganha `paginasComImagem: number[]` (1-indexado, ordenado, sem repetição).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `src/lib/extracao/pdfMarkdown.test.ts` (novo `describe`, no fim do arquivo). Usa o mock de
`extrairImagensDeConteudo` já existente no topo do arquivo (`jest.mock('./pdfImagens', ...)`):

```ts
describe('paginasComImagem (aviso de imagem embutida)', () => {
  it('página com imagem de conteúdo entra em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal da página, com bastante conteúdo textual.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      { pagina: 0, x: 0, y: 0, largura: 200, altura: 150, topo: 150, larguraPx: 400, alturaPx: 300, nomeArquivo: 'pagina-1-imagem-1.png', png: Buffer.from('') },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''), { salvarImagem: async () => 'https://storage.exemplo/img.png' })

    expect(resultado.paginasComImagem).toEqual([1])
  })

  it('página sem imagem não entra em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal, sem imagem nenhuma nessa página.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.paginasComImagem).toEqual([])
  })

  it('imagem numa página marcada pra OCR não duplica em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] }) // página escaneada
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.9 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      { pagina: 0, x: 0, y: 0, largura: 500, altura: 700, topo: 700, larguraPx: 1000, alturaPx: 1400, nomeArquivo: 'pagina-1-imagem-1.png', png: Buffer.from('') },
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''), { salvarImagem: async () => 'https://storage.exemplo/img.png' })

    expect(resultado.paginasImagem).toEqual([1]) // vai pro fluxo de OCR
    expect(resultado.paginasComImagem).toEqual([]) // não duplica aviso aqui
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: FAIL — `resultado.paginasComImagem` é `undefined`.

- [ ] **Step 3: Implementar**

Em `src/lib/extracao/pdfMarkdown.ts`, adicionar o campo na interface:

```ts
export interface ResultadoConversaoPdf {
  markdown: string
  paginasImagem: number[]
  paginasConvertidas: PaginaConvertida[]
  /** Páginas (1-indexadas) com pelo menos uma imagem de CONTEÚDO embutida
   *  (![Imagem da página N]) — pode ser tabela, gráfico ou diagrama que o
   *  PDF trouxe como figura em vez de texto. Exclui página que já está em
   *  `paginasImagem` (essa já tem fluxo próprio de OCR). */
  paginasComImagem: number[]
}
```

Calcular logo depois de `imagensFiltradas` já existir (mesmo bloco onde `paginasImagem0`/`imagensFiltradas` são
montados):

```ts
  const paginasComImagem = [...new Set(imagensFiltradas.map((imagem) => imagem.pagina + 1))].sort((a, b) => a - b)
```

E incluir nos DOIS `return` da função (o branch de `todasAsLinhas.length === 0` e o branch normal):

```ts
    return { markdown: [...blocosOcr, ...restante].join('\n\n'), paginasImagem, paginasConvertidas: [], paginasComImagem }
```

```ts
  return { markdown, paginasImagem, paginasConvertidas, paginasComImagem }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- pdfMarkdown.test.ts`
Expected: PASS — todos os casos, incluindo os 3 novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: expoe paginasComImagem na conversao de PDF"
```

---

### Task 2: Rota `checagem-ia` agrega e devolve `paginasComImagem`

**Files:**
- Modify: `src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts`
- Modify: `src/app/api/propostas-comerciais/[id]/checagem-ia/route.test.ts`

**Interfaces:**
- Consumes: `ResultadoConversaoPdf.paginasComImagem` (Task 1).
- Produces: resposta do `POST` ganha `paginasComImagem: number[]`.

- [ ] **Step 1: Escrever o teste que falha**

Ajustar o teste existente `'junta paginasConvertidas de todos os arquivos PDF e devolve o resultado da
checagem'` em `route.test.ts` — o mock de `converterPdfParaMarkdown` passa a incluir `paginasComImagem`, e a
asserção final também:

```ts
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({
      markdown: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }],
      paginasComImagem: [3],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 87, trechosSuspeitos: [] })

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1)
    expect(getUpload).toHaveBeenCalledWith('https://blob/a1.pdf')
    expect(checarConversao).toHaveBeenCalledWith([{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }])
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [3] })
```

Também ajustar o teste `'sem nenhum arquivo pdf devolve score null sem chamar checarConversao'` — a asserção
final passa a incluir o campo vazio:

```ts
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: null, trechosSuspeitos: [], paginasComImagem: [] })
```

E o mock de `converterPdfParaMarkdown` no teste `'retorna 502 quando a checagem falha'` também ganha
`paginasComImagem: []`.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- "checagem-ia/route.test.ts"`
Expected: FAIL — resposta hoje não tem `paginasComImagem`.

- [ ] **Step 3: Implementar**

Em `src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts`:

```ts
  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf')

  const paginasConvertidas: PaginaConvertida[] = []
  const paginasComImagem: number[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaMarkdown(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
    paginasComImagem.push(...resultado.paginasComImagem)
  }

  if (paginasConvertidas.length === 0) {
    return NextResponse.json({ scoreExibido: null, trechosSuspeitos: [], paginasComImagem })
  }

  try {
    const resultado = await checarConversao(paginasConvertidas)
    return NextResponse.json({ ...resultado, paginasComImagem })
  } catch (erro) {
    console.error('checagem por IA falhou:', erro)
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return NextResponse.json({ error: `não foi possível checar a conversão agora (${detalhe})` }, { status: 502 })
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- "checagem-ia/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/propostas-comerciais/[id]/checagem-ia/route.ts" "src/app/api/propostas-comerciais/[id]/checagem-ia/route.test.ts"
git commit -m "feat: rota de checagem por IA agrega paginasComImagem"
```

---

### Task 3: Cache de sessão normaliza `paginasComImagem`

**Files:**
- Modify: `src/lib/checagemIaEmAndamento.ts`
- Modify: `src/lib/checagemIaEmAndamento.test.ts`

**Interfaces:**
- Produces: `ResultadoChecagemIa` ganha `paginasComImagem: number[]`.

- [ ] **Step 1: Escrever o teste que falha**

Ajustar os testes de `checagemIaEmAndamento.test.ts` que fazem `mockFetch({ ok: true, body: { scoreExibido: 87,
trechosSuspeitos: [] } })` pra incluir `paginasComImagem: [2]` no corpo, e as asserções de `checagemIaAtual`
esperarem o campo de volta:

```ts
  it('iniciarChecagemIa chama a rota e vira status ok com o resultado', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [2] } })

    const promise = iniciarChecagemIa('p1')
    expect(checagemIaAtual('p1')).toEqual({ status: 'rodando', promise })

    await promise

    expect(checagemIaAtual('p1')).toEqual({
      status: 'ok',
      resultado: { scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [2] },
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })
```

Novo caso, cobrindo a normalização defensiva:

```ts
  it('resposta sem paginasComImagem (formato antigo) vira lista vazia, não quebra', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 87, trechosSuspeitos: [] } })

    const resultado = await iniciarChecagemIa('p1')

    expect(resultado.paginasComImagem).toEqual([])
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- checagemIaEmAndamento.test.ts`
Expected: FAIL — `resultado.paginasComImagem` não existe ainda.

- [ ] **Step 3: Implementar**

Em `src/lib/checagemIaEmAndamento.ts`:

```ts
export interface ResultadoChecagemIa {
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeitoIa[]
  paginasComImagem: number[]
}
```

```ts
    const scoreExibido = typeof corpo?.scoreExibido === 'number' ? corpo.scoreExibido : null
    const trechosSuspeitos = Array.isArray(corpo?.trechosSuspeitos) ? corpo.trechosSuspeitos : []
    const paginasComImagem = Array.isArray(corpo?.paginasComImagem) ? corpo.paginasComImagem : []
    return { scoreExibido, trechosSuspeitos, paginasComImagem }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- checagemIaEmAndamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checagemIaEmAndamento.ts src/lib/checagemIaEmAndamento.test.ts
git commit -m "feat: normaliza paginasComImagem no cache de checagem por IA"
```

---

### Task 4: Aviso no painel

**Files:**
- Modify: `src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx`
- Modify: `src/app/propostas-comerciais/[id]/painel-checagem-conversao.test.tsx`

**Interfaces:**
- Consumes: `ResultadoChecagemIa.paginasComImagem` (Task 3).

- [ ] **Step 1: Escrever os testes que falham**

Ajustar os `mockFetch` existentes em `painel-checagem-conversao.test.tsx` pra incluir `paginasComImagem: []` nos
corpos que já têm `scoreExibido`/`trechosSuspeitos` (evita quebrar os testes já escritos, já que o componente vai
passar a ler esse campo). Adicionar um caso novo:

```ts
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- painel-checagem-conversao.test.tsx`
Expected: FAIL — o aviso ainda não existe.

- [ ] **Step 3: Implementar**

Em `src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx`, dentro do bloco que já monta score +
lista (fase `'pronta'`), adicionar o aviso — convive com score e lista, nenhum substitui o outro:

```tsx
  const { scoreExibido, trechosSuspeitos, paginasComImagem } = estado.resultado

  return (
    <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
      {scoreExibido !== null && (
        <p className="flex items-center gap-2 text-sm font-medium text-navy">
          <ShieldCheck className="size-4 shrink-0" strokeWidth={2.25} />
          {scoreExibido}% de confiabilidade (estimativa da IA) — confira os trechos abaixo antes de finalizar.
        </p>
      )}
      {scoreExibido === null && (
        <p className="text-sm text-mid-grey">
          Sem páginas de texto nativo pra checar automaticamente — revise o conteúdo de OCR manualmente.
        </p>
      )}
      {paginasComImagem.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-orange/30 bg-orange-light/40 p-2.5 text-sm text-navy">
          <AlertCircle className="size-4 shrink-0 text-orange" strokeWidth={2.25} />
          Página {paginasComImagem.join(', ')} {paginasComImagem.length > 1 ? 'têm' : 'tem'} imagem embutida — pode
          ser uma tabela ou gráfico que não virou texto. Confira o PDF original nesses pontos.
        </p>
      )}
      {scoreExibido !== null && trechosSuspeitos.length === 0 && (
        <p className="text-sm text-mid-grey">Nenhum trecho suspeito encontrado.</p>
      )}
      {scoreExibido !== null && trechosSuspeitos.length > 0 && (
        <ul className="space-y-2">
          {trechosSuspeitos.map((trecho, indice) => (
            <li key={indice} className="rounded-lg border border-orange/30 bg-orange-light/40 p-2.5 text-sm text-navy">
              <p className="font-medium">Página {trecho.pagina}</p>
              <p className="text-mid-grey">&quot;{trecho.trecho}&quot;</p>
              <p>{trecho.motivo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
```

(substitui o bloco de retorno atual da fase `'pronta'`, que hoje trata `scoreExibido === null` como um `return`
antecipado separado — aqui os dois casos, com e sem score, passam a cair no MESMO container, pra o aviso de
imagem poder aparecer nos dois.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- painel-checagem-conversao.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o `tsc`**

Run: `npm test && npx tsc --noEmit`
Expected: mesma baseline de falhas pré-existentes (não relacionadas), nenhuma nova; `tsc` limpo.

- [ ] **Step 6: Commit**

```bash
git add "src/app/propostas-comerciais/[id]/painel-checagem-conversao.tsx" "src/app/propostas-comerciais/[id]/painel-checagem-conversao.test.tsx"
git commit -m "feat: avisa pagina com imagem embutida no painel de checagem"
```
