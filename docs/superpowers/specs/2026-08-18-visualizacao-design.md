# VerAI — Visualização/comparação (design)

**Módulo**: 5 de 8 do roteiro de sub-projetos do VerAI (Visualização/comparação)
**Depende de**: módulos 2, 3, 4
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Tela `/documentos/[id]` de verdade: split view com o documento original de
um lado e a análise da IA do outro, com ação de reprocessar. Sem testes
automatizados, mesma linha dos módulos 3 e 4.

---

## 2. Backend

**`GET /api/documentos/[id]`** (substitui stub) — retorna `Documento` +
`Analise` (se existir) + `uploadedBy.nome`. Aplica a mesma regra de
visibilidade dos módulos anteriores (`podeVerTodosDocumentos` ou dono).
Grava `AcessoDocumento` (`acao: "visualizou"`) a cada chamada.

**`GET /api/documentos/[id]/original`** (ajuste) — aceita `?modo=preview`:
nesse modo usa `Content-Disposition: inline` (pra abrir dentro de um
`<iframe>`, no caso de PDF) em vez de forçar download; sem o parâmetro,
comportamento atual mantido (`attachment`) e grava `AcessoDocumento`
(`acao: "baixou_original"`) — só no modo download, não no preview, pra não
logar toda vez que o iframe carrega.

**`GET /api/documentos/[id]/preview`** (nova) — só para `xlsx`/`csv`:
reaproveita o parser do módulo 3 mas devolve dados estruturados (`{
cabecalho, linhas, truncado }`, até 30 linhas) em vez do texto pra IA, pra
renderizar como tabela HTML. PDF não usa essa rota (usa o `/original` em
modo preview direto, o navegador já renderiza PDF nativamente).

---

## 3. Frontend — `/documentos/[id]`

- Busca o documento em `GET /api/documentos/[id]` ao carregar
- **Split view** (empilha em telas estreitas):
  - **Esquerda — documento original**: PDF → `<iframe>` apontando pro
    `/original?modo=preview`; Excel/CSV → tabela HTML a partir de
    `/preview`, com aviso se `truncado`
  - **Direita — análise da IA**: resumo, pontos críticos (badge por
    severidade: alto=vermelho, medio=laranja, baixo=cinza), pontos
    positivos (badge verde), métricas-chave (tabela simples). Se
    `status !== "concluido"`, mostra o estado (`processando` ou o
    `mensagemErro` de `erro`) no lugar da análise
- **Ações**: "Baixar original" (link pro `/original`, sem `?modo=preview`)
  e "Reprocessar" (chama `POST /api/documentos/[id]/reprocessar`, já
  existente do módulo 3, recarrega a página depois)

---

## 4. Fora de escopo (por ora)

- Preview de Word (não suportado desde o módulo 3)
- Testes automatizados desta leva
