# TASKS 002 — Backlog do Grid de Divergências

| | |
|---|---|
| **Especificação** | [ESPEC 002](../specs/002-painel-de-divergencias.md) |
| **Plano** | Não há documento próprio — o incremento é de 1 a 2 dias e a §11 da ESPEC 002 cumpre o papel. Um PLANO 002 seria cerimônia sem beneficiário |
| **Versão** | 1.0 — 2026-08-05 |
| **Status** | **11 concluídas** |

> **Escrito depois da implementação.** As tarefas abaixo registram o que foi feito, não o que se
> planejou fazer. É um desvio do processo: a ESPEC 002 foi implementada sem backlog prévio, ao
> contrário da ESPEC 001. Fica anotado em vez de disfarçado — e as duas correções de rumo que a
> implementação exigiu (T-104 e T-107) mostram por que o registro importa.

---

## 1. Quadro geral

| # | Tarefa | Camada | Status |
|---|---|---|---|
| T-101 | `ReportLine.tem_divergencia` e `Report.apenas_divergencias()` | domínio | ✅ |
| T-102 | `ReportLine.perfil_ou_pacote`, marcado na reconciliação | domínio · aplicação | ✅ |
| T-103 | `Report.sem_previsao_contratual` no agregado | domínio | ✅ |
| T-104 | Coleta dos itens medidos sem contrapartida no relatório | aplicação | ✅ **corrigida durante a implementação** |
| T-105 | *Schemas* da resposta: `LinhaDoGrid`, `SecaoDoGrid`, `RespostaRelatorio` | api | ✅ |
| T-106 | `POST /reports` devolve JSON com o PDF em base64 | api | ✅ |
| T-107 | Grid na tela, agrupado por seção | frontend | ✅ |
| T-108 | Decodificação do PDF em base64 para o download | frontend | ✅ |
| T-109 | Testes: 17 unitários e de integração, mais 3 de API e 1 de navegador | testes | ✅ |
| T-110 | Coluna **Saldo** — `ReportLine.saldo`, campo na API e sexta coluna na tela | domínio · api · frontend | ✅ |
| T-111 | Título **"Divergências"** com a contagem | frontend | ✅ |

---

## 2. As duas correções de rumo

### T-104 — a regra estava errada, e o dado mostrou

`R-DIV-05` foi escrita prevendo itens **com quantidade contratada zero**, omitidos do PDF por
`R-REC-01`. Implementada assim, a coleta devolveu **zero itens** no caso-piloto — quando a ESPEC
001 §9.2 afirmava que `14.049.00054.00` existia.

A investigação mostrou o motivo: o item **não está no contrato**. Não tem quantidade zero — não tem
quantidade nenhuma, e por isso nem entrada de catálogo possui. Foi medido 2 sem qualquer cobertura
contratual.

A regra passou a cobrir as duas situações, e o achado ficou mais forte do que a spec supunha.

**Lição:** o teste que "passa devolvendo vazio" é o mais perigoso — parece verde e não prova nada.
Foi a asserção `len(fora) == 1`, e não a implementação, que revelou o erro.

### T-107 — o rótulo dizia a coisa errada

O bloco de itens sem previsão contratual saiu com *"não constam do PDF"*. Verdadeiro, mas irrelevante
para quem confere: o que importa é que **não constam no Contrato**. Corrigido a pedido do
solicitante, com a ressalva registrada na ESPEC 002 §5 — o texto é exato para o caso que ocorre
hoje, e ficará impreciso se aparecer um item da outra situação.

---

## 3. Verificação

| O que | Resultado |
|---|---|
| Divergências no piloto | **36 de 55**, em 16 das 22 seções |
| Saldo | Herda a formatação do item: SAN sai `2.737,45`, e o item sem previsão sai `-2` |
| Itens sem previsão contratual | **1** — `14.049.00054.00`, medido 2 e ausente do contrato |
| **Teste-âncora** | ✅ **continua em 54 de 55 linhas idênticas** — o PDF não mudou |
| Suíte de backend | 197 testes |
| Navegador | 2 casos, com asserções sobre o grid |
| Qualidade | `ruff`, `mypy --strict`, `bandit`, `eslint` sem apontamentos |
| Fluxo real | Executado com os **arquivos originais**, não só com as fixtures |

O teste-âncora é o que dá confiança neste incremento: ele prova que uma leitura nova sobre os
mesmos dados não tocou o entregável formal.

---

## 4. O que ficou fora

| Item | Onde está registrado |
|---|---|
| Coluna de percentual | ESPEC 002 §3.2 — o saldo entrou na v2.1; a proporção segue fora |
| Classificação por categoria | ESPEC 002 §3.2 |
| Exportação em Excel ou CSV | ESPEC 002 §3.2 |
| Comparação de perfil contratado × medido | ESPEC 001 §9.3 — exige mudar o layout de duas colunas |
| Resumo executivo e itens críticos | ESPEC 001 §13, item 1 — o `Relatorio_Analise_Medição.xlsx` completo |
