# VerAI — Listagem (design)

**Módulo**: 4 de 8 do roteiro de sub-projetos do VerAI (Listagem)
**Depende de**: módulo 2 — [Setup base](2026-08-18-setup-base-design.md), módulo 3 — [Ingestão + extração](2026-08-18-ingestao-extracao-design.md)
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Tirar a tela `/` do estado de esqueleto: listar os documentos já
processados, com upload direto pela tela, filtros, busca e ações de
download — fechando o ciclo "subo um documento → vejo ele na lista".

**Fora de escopo aqui**: conteúdo real de `/documentos/[id]` (split view
documento × análise — módulo 5), geração/download de relatório PDF
(módulo 7), filtro por "quem subiu" (exigiria módulo 8 — gestão de
usuários).

**Decisão de processo**: sem testes automatizados/TDD nesta leva, mesma
linha do módulo 3.

---

## 2. Regra de visibilidade

- `uploader`: só os documentos que ele mesmo subiu (`uploadedById`)
- `responsavel` e `admin`: todos os documentos, por enquanto — a regra
  real de "responsável vê o que bate na regra de notificação dele" só
  existe quando o módulo 6 for implementado. Até lá, `responsavel` é
  tratado como `admin` pra fins de visibilidade.

Aplicada tanto em `GET /api/documentos` quanto em
`GET /api/documentos/[id]/original`.

---

## 3. `GET /api/documentos`

Query params (todos opcionais):
- `tipo` — `xlsx` | `csv` | `pdf`
- `status` — `processando` | `concluido` | `erro`
- `busca` — substring no `nomeArquivo` (case-insensitive)
- `de` / `ate` — período por `createdAt` (ISO date)

Resposta: lista de `Documento`, ordenada por `createdAt desc`, incluindo
`uploadedBy.nome` e se já existe `Analise` associada. Sem paginação
(volume interno pequeno).

---

## 4. `GET /api/documentos/[id]/original`

- 404 se o documento não existir
- 403 se o usuário não tiver visibilidade sobre ele (regra da seção 2)
- Lê o arquivo de `caminhoOriginal` via `getUploadFullPath` e retorna como
  download (`Content-Disposition: attachment`, `Content-Type` conforme o
  `tipo`)

---

## 5. Página `/`

Substitui a página esqueleto do módulo 2.

**Upload**: `<input type="file">` + botão, `POST /api/documentos`
(multipart, campo `arquivo` — já existente do módulo 3). Ao concluir,
recarrega a lista.

**Tabela**: nome do arquivo, tipo, data, quem subiu, status (badge:
verde=concluído, cinza=processando, vermelho=erro), ações.

**Ações por linha**:
- **Ver análise** → link para `/documentos/[id]` (hoje esqueleto,
  navegável desde já)
- **Baixar original** → chama a rota da seção 4
- **Baixar relatório** → botão desabilitado, "em breve" (módulo 7)

**Filtros** (client-side, refaz o fetch com query params): tipo, status,
busca por nome, período (data de/até). Sem "quem subiu" (fora de escopo,
seção 1).

---

## 6. Fora de escopo (por ora)

- Conteúdo real de `/documentos/[id]` (módulo 5)
- Download/geração de relatório PDF (módulo 7)
- Filtro por "quem subiu" (módulo 8)
- Paginação
- Testes automatizados desta leva
