# VerAI — Relatório PDF (design)

**Módulo**: 7 de 8 do roteiro de sub-projetos do VerAI (Relatório PDF)
**Depende de**: módulos 2, 3, 5
**Status**: Aprovado para implementação
**Data**: 18/08/2026

---

## 1. Objetivo

Gerar e baixar um relatório em PDF da análise, com a identidade visual
Prodam (a independência é de código/banco/auth em relação ao SPDF — a
identidade visual de um órgão Prodam continua fazendo sentido no
relatório em si).

**Ajuste em relação ao mapeamento original**: em vez de
Puppeteer/Playwright (precisa baixar um Chromium inteiro, pesado pro
volume interno), uso `@react-pdf/renderer` — gera PDF direto por
componentes React, sem navegador headless. Mesmo resultado visual, muito
mais leve/rápido de instalar e rodar. Sem testes automatizados, mesma
linha dos módulos anteriores.

---

## 2. Geração — `src/lib/pdf/`

```
src/lib/pdf/
├── RelatorioDocument.tsx   → componente @react-pdf/renderer (layout A4)
└── gerarRelatorio.ts        → gerarRelatorioPdf(documento, analise): Promise<Buffer>
```

**Tokens visuais** (do mapeamento original):
| Elemento | Valor |
|---|---|
| Azul marinho | `#002A4A` |
| Laranja | `#F5691E` |
| Formato | A4 |
| Badges | Verde (positivo), laranja/vermelho (crítico por severidade), cinza (baixo) |

**Estrutura**: capa (nome do documento, quem subiu, data) → resumo
executivo → pontos críticos (badge por severidade) → pontos positivos
(badge verde) → métricas-chave (tabela) → rodapé "Gerado automaticamente
pelo VerAI".

---

## 3. `GET /api/documentos/[id]/relatorio` (substitui stub)

1. Checa visibilidade (mesma regra dos módulos anteriores)
2. 400 se `documento.status !== "concluido"` ou não existir `Analise`
3. **Cache**: se `Analise.caminhoRelatorioPdf` existe e o arquivo está no
   disco, serve ele direto (sem regerar)
4. Senão, gera via `gerarRelatorioPdf`, salva em
   `uploads/{ano}/{mes}/{documentoId}/relatorio.pdf`, atualiza
   `Analise.caminhoRelatorioPdf` e `relatorioGeradoEm`
5. Retorna o PDF (`Content-Type: application/pdf`,
   `Content-Disposition: attachment`), grava `AcessoDocumento`
   (`acao: "baixou_relatorio"`)

---

## 4. Frontend

Botão "Baixar relatório" (hoje desabilitado, "em breve") vira link real
pra rota acima, tanto na listagem (`/`) quanto no detalhe
(`/documentos/[id]`) — só habilitado quando `status === "concluido"`.

---

## 5. Fora de escopo (por ora)

- Reprocessar limpa o cache do PDF (já acontece — `reprocessar` zera
  `caminhoRelatorioPdf`/`relatorioGeradoEm` no upsert da `Analise`, então
  o próximo download regenera)
- Testes automatizados desta leva
