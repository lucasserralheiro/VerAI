# Tabela de preços no VerAI — design

**Status:** rascunho para revisão do usuário (29/09/2026). Depende da base
`2026-09-29-biblioteca-documentos-prodam-design.md` (sincronização, `ArquivoBiblioteca`, menu).

## 1. Pedido

Tela **Tabela de preços** dentro de "Relatórios dos clientes", estruturada, alimentada pela pasta TABELA
DE PREÇOS PRODAM-SP do SharePoint e atualizada pelo agendador.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Achar um preço | abrir o PDF de 19 páginas e procurar | digitar código ou parte da descrição; resposta na hora |
| Qual versão vale | ler o nome do arquivo | "2026 v3.0 · publicada no DOC em 21/09/2026", no topo |
| Mudanças depois da publicação | informativo em PDF separado | aviso no topo, com o informativo a um clique |
| Nova versão | ninguém sabe o que mudou | aba "O que mudou": serviços novos, retirados e preços que subiram ou caíram |
| Assistente de IA | não sabe preço | responde "quanto custa a hora de analista complexidade 3?" com a fonte |

## 3. Fonte

Pasta `TABELA DE PREÇOS PRODAM-SP` (29/09/2026):

- `Memória de Cálculo 2026 v3.0.xlsx` — aba "Tabela de Preços 2026 v3": `GRUPO | CÓDIGO | DESCRIÇÃO |
  UNIDADE | PREÇO UNITÁRIO (R$) | QTDE | PERÍODO (MÊS) | TOTAL (R$)`. **315 serviços** (A 7, B 4, C 51,
  E 158, H 95), 8 com preço "SOB DEMANDA". Linhas de seção em hierarquia ("C - SOLUÇÕES DE SERVIÇOS DE
  COMUNICAÇÃO" → "C7. SD-WAN" → "C7.1. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (INSTALAÇÃO)"). É a fonte
  **estruturada**.
- `Tabela de Preços PRODAM-SP 2026 v3.0.pdf` — a tabela **oficial** (19 págs), linhas "código descrição
  unidade preço". É a fonte da **conferência**.
- `Publicação DOC 21.09.2026.pdf` e `Publicação + Tabela (DOC 21.09.2026).pdf` — a data de publicação sai
  do nome.
- `INFORMATIVO Alterações Tabela de Preços v3.0.pdf` — "Informativo Interno" com o que mudou **depois**
  da publicação (29/09: alteração de preço do TID, novo produto SPdf, retorno do item 15.062.00008.00
  ELEIÇÃO). Vale junto com a tabela publicada até a próxima publicação.

## 4. Regras de leitura

1. **Versão** = "2026 v3.0", do nome dos arquivos (`Memória de Cálculo <ano> v<n>`, `Tabela de Preços
   … <ano> v<n>`). Todos os arquivos da mesma versão formam um conjunto.
2. **Itens** saem da planilha: a aba é achada pelo **cabeçalho** (`GRUPO` + `CÓDIGO` + `PREÇO UNITÁRIO`),
   não pelo nome, que muda a cada versão. Item = linha com código no formato `NN.NNN.NNNNN.NN`. Seção =
   linha com texto na primeira coluna e sem código; o caminho de seções fica no item.
3. Preço numérico → `preco` (decimal, sem passar por float: `normalizarDecimal` ou string da célula).
   "SOB DEMANDA" → `preco = null`, `sobDemanda = true`. Qualquer outro texto → item marcado
   "preço não lido" (aparece, com o texto original).
4. **Conferência com o PDF oficial**, item a item: o código aparece no texto do PDF e, na mesma linha, o
   mesmo preço. Resultado por item: `confere`, `diverge` (preço diferente no PDF) ou `fora-do-pdf`.
   - Item que diverge **e** está citado no informativo → `alterado-pelo-informativo`: a planilha já traz
     a mudança que o PDF publicado ainda não tem. Não é erro.
   - Divergência que não está no informativo → aviso na versão "N preços da planilha diferem do PDF
     publicado", com a lista. A tela mostra **os dois valores** nesses itens, nunca escolhe um em
     silêncio.
5. Só a **versão mais nova** é "vigente". As anteriores ficam guardadas para o histórico e o "O que mudou".

## 5. Banco

- `TabelaPrecos`: `versao` (único), `ano`, `numero`, `publicadaEm`, `arquivoPlanilhaId`,
  `arquivoPdfId`, `arquivoPublicacaoId`, `arquivoInformativoId` (todos `ArquivoBiblioteca`, opcionais),
  `totalItens`, `divergencias`, `lidaEm`.
- `ItemTabelaPrecos`: `tabelaId`, `grupo` ("A"), `secoes` (texto, "C > C7 > C7.1"), `codigo`,
  `descricao`, `unidade`, `preco Decimal?`, `sobDemanda`, `conferencia`, `precoNoPdf Decimal?`.
  Único por (`tabelaId`, `codigo`).

## 6. Tela `/tabela-de-precos`

**Topo:** "Tabela de preços" · "Preços dos serviços da PRODAM, pela tabela publicada no Diário Oficial" ·
"Atualizado em …".

**Cartão da versão:** "2026 v3.0 · publicada no DOC em 21/09/2026 · 315 serviços · conferida com o PDF
publicado" e botões **Tabela oficial (PDF)**, **Publicação no DOC**, **Memória de cálculo (planilha)**.
Com informativo: faixa laranja "Há alterações depois da publicação (informativo interno) — confira antes
de usar o preço", abrindo o PDF do informativo.

**Busca:** um campo só (código ou descrição, sem acento e sem caixa, com destaque do trecho achado);
atalho `/`. Filtro por grupo em pílulas com contagem ("Data Center 158"). A seção aparece como
cabeçalho de grupo na lista, igual ao PDF, para quem está acostumado com ele.

**Lista:** código (fonte mono, clique copia — "copiado"), descrição, unidade, preço à direita
(`formatarMoeda`; "Sob demanda" como etiqueta). Item com divergência: ícone de aviso e, ao passar o mouse,
"planilha R$ X · PDF publicado R$ Y". Em tela estreita, cada item vira um cartão.

**Versões:** seletor "Versão" quando houver mais de uma; a vigente vem marcada. Aba **"O que mudou"**
(a partir da segunda versão): novos, retirados, preço que mudou (antes → depois, % em verde/vermelho),
ordenável.

**Estados:** esqueleto ao carregar; sem tabela lida ainda → "A tabela ainda não foi lida da pasta do
SharePoint" com a data da última passada.

## 7. API

- `GET /api/tabela-precos` → versão vigente + itens (≈ 315 linhas; filtro e busca no navegador — a lista é
  pequena e a busca fica instantânea).
- `GET /api/tabela-precos?versao=2026 v3.0` e `GET /api/tabela-precos/versoes`.
- `GET /api/tabela-precos/diferencas?de=…&para=…`.
- Qualquer usuário logado: a tabela é pública (publicada no DOC).

## 8. Assistente de IA

Ferramenta somente-leitura `consultarTabelaDePrecos` (busca por código ou descrição; devolve código,
descrição, unidade, preço, versão e se está no informativo), no padrão de `src/lib/assistente/ferramentas/`:
`definirFerramenta` + registro em `ferramentas/index.ts` + rótulo em `rotulos.ts` + teste de permissão.
Régua do assistente antes e depois.

## 9. Testes

- Leitor: planilha mínima de fixture com seções, item "SOB DEMANDA", preço com texto estranho; aba com
  outro nome; conferência com PDF de fixture (confere, diverge, fora do PDF, alterado pelo informativo).
- Diferenças entre duas versões (novo, retirado, preço mudou, igual).
- Tela: busca sem acento, filtro por grupo, copiar código, item com divergência mostra os dois valores,
  estado vazio.

## 10. Fora do escopo

- **Conferir o preço da proposta comercial contra a tabela** (Proposta Comercial e ConfereAI) — o próximo
  passo natural, com design próprio: esta tela cria a base de preços que ele vai usar.
- Montar proposta pela tela (a memória de cálculo tem QTDE/PERÍODO/TOTAL e cronograma — é uma calculadora
  de proposta; fica para depois).
- Ler o conteúdo do informativo em dados (hoje é texto livre; fica como PDF e como marca nos itens que
  divergem).

## 11. Riscos

- **O formato da planilha muda numa versão nova** → o leitor acha a aba pelo cabeçalho; se não achar,
  a versão fica "não lida" com o PDF disponível, e a anterior continua como vigente com o aviso "existe
  versão mais nova ainda não lida".
- **Planilha e PDF divergem** → nunca escolhe sozinho: mostra os dois (§4.4).
