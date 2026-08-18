# VerAI — Ingestão + extração (design)

**Módulo**: 3 de 8 do roteiro de sub-projetos do VerAI (Ingestão + extração)
**Depende de**: módulo 1 — [Camada de IA](2026-08-18-camada-ia-design.md), módulo 2 — [Setup base](2026-08-18-setup-base-design.md)
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Fazer `POST /api/documentos` funcionar de verdade: receber um arquivo,
salvar, extrair o conteúdo de forma resumida (sem mandar o arquivo cru pra
IA) e gerar a análise, tudo síncrono no mesmo request — sem fila.

**Fora de escopo aqui**: qualquer UI de upload (tela `/` com tabela,
filtros, formulário de upload) — isso é módulo 4. Aqui só a rota de API,
testável via curl/Postman.

**Decisão de processo**: sem testes automatizados/TDD nesta leva —
implementação direta, verificada com `npm run build` + chamadas manuais.

---

## 2. Tipos de arquivo (v1)

Excel/CSV (`.xlsx`, `.xls`, `.csv`) e PDF (`.pdf`). Word fica para uma
extensão futura do módulo. Extensão fora dessa lista → `400`.

Sem limite de tamanho de arquivo por ora.

---

## 3. Fluxo de `POST /api/documentos`

1. Lê `multipart/form-data`, valida extensão do arquivo
2. Identifica o usuário autenticado (`getAuthUser`) → `uploadedById`
3. Cria `Documento` (`status: "processando"`)
4. Salva o arquivo em disco (`buildUploadPath` + `getUploadFullPath`,
   módulo 2)
5. Extrai o conteúdo do buffer (por tipo, ver seção 4) → texto resumido
6. Chama `analisarDocumento(conteudoExtraido, PROMPT_VERSION_ATUAL)`
   (módulo 1)
7. Persiste `Analise` e atualiza `Documento.status = "concluido"`
8. Falha em qualquer parte de 4–7 → `Documento.status = "erro"` +
   `mensagemErro`; o registro já criado no passo 3 continua existindo
9. Resposta: `201` com o `Documento` (incluindo `status`) — mesmo em caso
   de erro na extração/IA, já que o registro existe e fica visível depois

`POST /api/documentos/[id]/reprocessar` entra no mesmo módulo (reusa a
mesma extração + IA em cima do arquivo já salvo, sem UI nova):
1. Busca `Documento` por id (404 se não existir)
2. Lê o arquivo salvo em disco
3. Repete os passos 5–8 acima, fazendo `upsert` da `Analise` (chave
   `documentoId`, único)

---

## 4. Extração — `src/lib/extracao/`

```
src/lib/extracao/
├── excel.ts   → exceljs: primeira planilha do arquivo
├── pdf.ts      → unpdf: texto do PDF
└── index.ts     → extrairConteudo(buffer, tipo) → dispatcher
```

**`excel.ts`** — usa `exceljs` para ler a primeira planilha do buffer e
monta um texto com:
- Nome/índice da planilha, número de linhas e colunas
- Colunas com tipo inferido (texto/número/data) a partir da primeira linha
  de dados
- Amostra das primeiras 20–30 linhas, formatada como texto tabular
- Estatísticas básicas por coluna numérica: mínimo, máximo, média, soma

Limitação assumida: só a primeira planilha é processada. Documentado aqui
— revisitar se virar necessidade real.

**`pdf.ts`** — usa `unpdf` para extrair o texto do PDF a partir do buffer.
Texto truncado em ~15.000 caracteres (controle de custo de tokens na IA);
se truncar, adiciona um marcador `[... texto truncado ...]` ao final.

**`index.ts`** — `extrairConteudo(buffer: Buffer, tipo: string): Promise<string>`,
despacha para `excel.ts` (`tipo` = `xlsx`/`xls`/`csv`) ou `pdf.ts`
(`tipo` = `pdf`); lança erro para tipo não suportado.

---

## 5. Stack nova

| Pacote | Papel |
|---|---|
| `exceljs` | Parsing de planilhas Excel/CSV |
| `unpdf` | Extração de texto de PDF |

---

## 6. Prompt version

`PROMPT_VERSION_ATUAL` é uma constante exportada de `lib/ia/analisar.ts`
(`v1` por enquanto) — usada tanto no upload quanto no reprocessamento.
Trocar o prompt no futuro = mudar essa constante; documentos antigos
guardam a versão que geraram sua análise (`Analise.promptVersion`), sem
precisar reprocessar todo mundo.

---

## 7. Fora de escopo (por ora)

- UI de upload (módulo 4)
- Suporte a Word (`.docx`)
- Processar múltiplas planilhas de um mesmo Excel
- Limite de tamanho de arquivo
- Testes automatizados desta leva
