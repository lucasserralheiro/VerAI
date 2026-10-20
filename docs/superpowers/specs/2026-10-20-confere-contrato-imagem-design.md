# ConfereAI — contrato que é imagem (leitura do texto da imagem)

Data: 20/10/2026. Decisões tomadas com o usuário na conversa de 20/10/2026.

## 1. Problema

Desde 20/10/2026 o Confere recusa na hora o PDF sem nenhuma fonte (`pdf_sem_texto`,
`services/confere/backend/src/infrastructure/shared/arquivos.py`): a página mostra o texto, mas
não há caractere para extrair. Não é um caso isolado. Medido em 20/10/2026 na biblioteca
ContratosReceita (pasta sincronizada no PC do Lucas), só arquivos `PC-`/`PA-`:

| | Arquivos |
|---|---|
| PC/PA no total | 469 |
| **Sem texto** | **95 (20%)** |
| — "Microsoft: Print To PDF" | 64 |
| — Nitro PDF PrimoPDF | 14 |
| — escâner Lexmark (X656de, MX622adhe) | 15 |
| — PFU PDF Library / ilovepdf | 2 |

Espalhados por cliente (SF 10, SMS 8, SMPED 6, SMUL 6, TCM 6, ...). São dois tipos:

- **Impresso com letras em contorno** (Print To PDF, PrimoPDF — 78): as linhas da tabela
  continuam vetoriais; cada letra virou desenho (o PC do HSPM TC 094/2023 tem ~40 mil traços, que
  o pdfplumber leva 62 s e 275 MB para analisar aqui e ~10 min no Render free).
- **Escaneado** (Lexmark, PFU, ilovepdf — 17): só a imagem da folha; nem as linhas da tabela
  existem como vetor.

O Confere acha as colunas da tabela de itens pelas **divisórias verticais** do PDF
(`analisar_geometria`, `pode_ter_grade` em `grid.py`). Por isso "pôr texto invisível sobre o
original" não serve: no escaneado não há divisórias, e no impresso os 40 mil traços continuariam lá.

## 2. Decisões

1. **Gera direto, com aviso** (não há passo de revisão): o Confere segue "só conferência" (08/10).
   A proteção contra número lido errado é a conta que o Confere já faz — itens × total declarado
   (`V-CTR-03` e a convergência prosa × cronograma): um dígito errado não fecha e bloqueia.
2. **A palavra "OCR" não aparece na tela.** O texto é para quem usa: "Este contrato é uma imagem
   (foi impresso ou escaneado). O sistema leu o texto da imagem — confira os valores."
3. **Leitura antes, em lote**, pelo agendador do SharePoint (PC do Lucas, a cada 30 min). Na hora,
   no navegador, só para arquivo **enviado do computador** no ConfereAI.
4. **Banco quase intocado**: uma tabela nova com uma linha por arquivo lido; o PDF lido no R2; o
   texto lido não vai para o banco.
5. **Nada de marca no DOCX/XLSX** (regra "só conferência" de 08/10): o aviso fica na tela do
   ConfereAI e no histórico.

## 3. Como funciona

### 3.1 A peça: `lerPdfDeImagem` (`src/lib/leitura-imagem/`)

Uma só, usada pelo agendador (Node) e pelo navegador. Entra o PDF original; sai um **PDF novo,
limpo**, com o mesmo número de páginas e o mesmo tamanho de página:

1. **Desenhar** cada página como imagem — `unpdf` (já usado pelo OCR da Proposta Comercial),
   escala 4 (~300 DPI, `ESCALA_RENDER_OCR`). No navegador, canvas do DOM; no Node,
   `@napi-rs/canvas` (dependência nova, a que o `unpdf` usa no servidor).
2. **Ler as palavras com posição** — `tesseract.js` (já no projeto), idioma `por`, com o
   pré-processamento existente (`preprocessarImagem.ts`).
3. **Achar as linhas da tabela na imagem** — segmentos escuros, retos e longos na horizontal e na
   vertical (varredura de corridas de pixel escuro na imagem binarizada; comprimento mínimo
   relativo à página). Função pura sobre o bitmap, testável com imagem sintética.
4. **Montar o PDF** — `pdf-lib` (dependência nova, JS puro): página do tamanho original em pontos;
   cada linha achada vira linha vetorial; cada palavra vira texto em fonte padrão (Helvetica) na
   posição da caixa do OCR, com tamanho pela altura da caixa e escala horizontal ajustada à largura
   (o Confere lê célula por posição). Os traços das letras originais **não vão**. Metadado
   `Producer` = `VerAI — leitura de imagem` (só informativo; nenhuma regra depende dele).

Separação das partes: `desenhar` e `reconhecer` entram por injeção (como `DepsRodarOcr` em
`src/lib/ocr/rodarOcr.ts`), para os testes não precisarem de canvas nem de tesseract;
`acharLinhas` e `montarPdf` são puras.

**Números:** o texto lido nunca é "corrigido" (mesma invariante do reparo da camada de texto —
`repararTextoPdf.ts`): token com dígito passa como o OCR leu. Erro de leitura vira bloqueio pela
conta do Confere, nunca valor ajustado.

### 3.2 Onde fica guardado

- **Tabela nova** `LeituraImagemPdf` (só tabela nova — o agendador roda o cliente Prisma desta
  pasta contra produção; coluna nova em model que ele usa quebraria a sincronização):
  `sha256` (chave — mesmo conteúdo, mesma leitura, em qualquer cliente), `situacao`
  (`lido` | `falhou`), `caminhoLido` (`r2:leitura-imagem/<sha256>.pdf`), `paginas`, `motivo`
  (quando falhou), `lidoEm`, `tentarDepoisDe`. Sem FK: liga pelo `sha256` que `ArquivoCliente` e
  `ArquivoSharepoint` já têm.
- **R2**: o PDF lido, ~50–150 KB por arquivo (estimativa; a régua mede) — ~10 MB para os 95.
- O **original nunca é trocado**: "Ver no PDF", a aba Documentos e o histórico continuam no original.

### 3.3 Agendador: `etapaDaLeituraDeImagem`

No fim de `scripts/sincronizar-sharepoint.ts`, como as outras etapas: só com `--aplicar`, guarda
pela própria migração (`MIGRACAO_DA_LEITURA_IMAGEM`), nunca muda o código de saída, pula com
`--sem-leitura-imagem` e com `--clientes=` (passada parcial).

- Candidatos: PDFs `PC`/`PA` (proposta e aditivo — o que o ConfereAI usa) do `ArquivoSharepoint` ativo, sem linha em `LeituraImagemPdf` para o `sha256`, e que respondem *sem
  texto* — a mesma regra do Confere, portada para TS (nenhuma fonte declarada em página nem em
  Form XObject).
- No máximo `LEITURAS_POR_PASSADA` arquivos por passada (a régua fixa o número para caber nos 30 min).
- Falhou: `situacao = falhou`, `motivo`, `tentarDepoisDe` = +24 h (como a indexação do assistente).

### 3.4 ConfereAI

- **Contrato/aditivo do cadastro** (`contrato_arquivo_id`, `aditivos=cadastro:<id>`): o proxy
  (`src/app/api/confere/reports/route.ts`) já baixa o original do R2; se houver `LeituraImagemPdf`
  `lido` para o `sha256`, baixa e envia **a versão lida** no lugar. O Confere não muda a leitura.
- **Enviado do computador**: antes de enviar, o navegador testa *sem texto*; se for, roda
  `lerPdfDeImagem` ali mesmo, com "Lendo o contrato, que é uma imagem… página 3 de 12", e envia o
  PDF lido. Fechar a aba cancela; nada fica pela metade. (Não grava em `LeituraImagemPdf` — o
  arquivo não é do cadastro.)
- **Aviso**: a linha do documento na tela de conferência e o cartão "Relatório gerado" mostram
  "Este contrato é uma imagem (foi impresso ou escaneado). O sistema leu o texto da imagem —
  confira os valores." O histórico (`ConfereExecucao.arquivosEntrada`, já JSON) ganha
  `lidoDeImagem: true` na entrada — sem migração.
- **Mensagens de erro em língua de gente**:
  - imagem que não deu para ler: "Este contrato é uma imagem e o sistema não conseguiu ler o texto.
    Peça o arquivo do Word ou um PDF salvo pelo Word." (substitui a mensagem atual do `pdf_sem_texto`
    quando ele chegar ao usuário);
  - lido, mas a conta não fechou: o bloqueio do Confere chega como hoje, e a tela acrescenta
    "Este contrato é uma imagem — a leitura pode ter errado um valor."

## 4. Fora da primeira versão

- **PDF misto** (algumas páginas com texto, outras imagem): hoje não é recusado e segue o caminho
  de sempre. Entra se a régua mostrar que é comum.
- Usar a versão lida em outras áreas (índice do assistente, conversão da Proposta Comercial).
- **Escaneados**, se a régua mostrar que não fecham: ficam com a mensagem de "não deu para ler" em
  vez de gerar relatório bloqueado.

## 5. Prova: régua da leitura de imagem

`scripts/regua-leitura-imagem.ts` — na pasta sincronizada, acha os PC/PA sem texto, lê cada um com
`lerPdfDeImagem`, envia o PDF lido ao Confere **local** (só a extração do contrato, sem planilha) e
conta, por tipo (impresso × escaneado): itens extraídos, total declarado achado, **soma dos itens =
total declarado**, tempo e pico de memória da extração, tamanho do PDF lido. `--salvar` guarda a
base em `logs/regua-leitura-imagem.json`; sem `--salvar`, compara arquivo por arquivo (o que
piorou/melhorou), como as outras réguas.

**Critério de aceite**: definido com o usuário depois da primeira rodada (número de arquivos que
fecham a conta, por tipo). Os escaneados só entram se fecharem; o tempo/memória da extração do PDF
lido precisa ficar abaixo do teto por fase (240 s) com folga no Render free.

## 6. Testes

- `acharLinhas`: imagens sintéticas — grade de tabela, grade com ruído/serrilhado, página sem
  tabela, texto sublinhado (não pode virar divisória).
- `montarPdf`: palavras e linhas → PDF → relido com `unpdf`: mesmo texto, mesma posição (tolerância
  em pontos), linhas presentes; página do tamanho original.
- `lerPdfDeImagem` com `desenhar`/`reconhecer` falsos: ordem das páginas, progresso, falha de uma
  página vira falha do arquivo com motivo.
- Regra *sem texto* em TS: mesmos casos de `tests/test_pdf_sem_texto.py`.
- Etapa do agendador: só com `--aplicar`, guarda da migração, limite por passada, `tentarDepoisDe`.
- Proxy: com `LeituraImagemPdf` lido envia a versão lida; sem, o original; o histórico marca
  `lidoDeImagem`.
- No Confere (Python): um teste com um PDF montado pelo `montarPdf` (fixture gerada) garantindo
  que a extração acha a grade e os itens.

## 7. Deploy

Migração da tabela nova **antes** do deploy e antes de o agendador rodar o código novo (o
agendador usa o cliente Prisma da pasta contra produção). Dependências novas: `pdf-lib`,
`@napi-rs/canvas` (só o agendador/scripts usa; conferir que não entra no bundle da Vercel).
