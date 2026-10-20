# Confere — geração assíncrona no plano free (20/10/2026)

Design: `docs/superpowers/specs/2026-09-21-integracao-confere-design.md`, adendos "Ran out of memory
no Render (19/10/2026)" e "geração assíncrona (20/10/2026)".

**Problema**: depois da correção de memória, envios maiores terminavam em 504 ("O Confere não
terminou dentro do tempo máximo…"). A geração no Render free leva minutos e a função da Vercel morre
aos 300 s. Decisão do usuário: continuar no free.

## Tarefas

- [x] **1. Pré-aquecimento** — já existia (`aquecerServico` ao escolher o primeiro arquivo,
  `/api/confere/health`). Nada a fazer.
- [x] **2. Confere: `POST /jobs`, `GET /jobs/{id}`, `GET /jobs/{id}/resultado`** — jobs em memória,
  fase pelo arquivo da pasta do job, fila, retenção de 20 min, teto de 20 jobs. `tests/test_jobs.py`.
- [x] **3. Confere: ler cada página do PDF uma vez** — `candidatas_por_pagina` +
  `pode_ter_grade`; teto de caracteres retidos. `test_memoria.py::test_cada_pagina_e_analisada_uma_vez_so`.
- [x] **4. VerAI: cliente** — `iniciarNoConfere`, `consultarNoConfere`, `resultadoDoConfere`
  (`src/lib/confere/cliente.ts`), com testes.
- [x] **5. VerAI: proxy** — `assincrono=1` no `POST /api/confere/reports` (202 + bilhete, entradas
  guardadas no envio, recuo para o síncrono); `GET /api/confere/reports/[execucao]` (andamento,
  resultado, histórico, 410). Bilhete assinado em `execucao-assincrona.ts`. Testes nas duas rotas.
- [x] **6. VerAI: tela** — `acompanharGeracao` em `lib/api.ts`; `ProgressoDaGeracao` com
  `doServidor` (fase real e posição na fila). Testes em `lib/api.test.ts`.
- [x] **7. Docs** — design doc, CLAUDE.md, este plano.
- [x] **9. Teto por fase** (20/10/2026, depois do envio do HSPM TC 094/2023 que ficou 9 min em
  "Extraindo a tabela de itens do contrato" — a planilha lia em 0,15 s, o gargalo era o PDF do
  contrato). O pai vigia a data do `fase.txt`; fase parada além de `TETO_DA_FASE_S` (240 s,
  `CONFERE_TETO_DA_FASE_S`) mata o filho (`_matar_executor`) e o job responde **504** com a etapa e
  o nome do arquivo (`GeracaoDemorada`). Teto por fase e não da geração: contrato com muitos
  aditivos tem mais fases, e quem troca de fase está andando. O `/reports` síncrono não é vigiado
  (não tem `fase.txt`). Testes em `test_memoria.py` (fase parada, fase que anda, 504 no job).
- [x] **10. Causa do HSPM: PDF sem texto** — o `PC-HSPM-230207-13 v3.0` (TC 094/2023) foi impresso
  pelo "Microsoft: Print To PDF" com as letras em contorno: 12 páginas, 0 caracteres, ~40 mil traços.
  A extração levava 62 s / 275 MB local (~10 min no Render) e terminava sem itens. `pdf_sem_texto`
  (`infrastructure/shared/arquivos.py`, só lê o dicionário de recursos — 6 ms) recusa a peça em
  `gerar` e no portão (`_exigir_texto_nos_pdfs`, `container.py`) com 422 dizendo qual arquivo trocar.
  `tests/test_pdf_sem_texto.py`. Para gerar o HSPM falta a proposta com texto (SEI ou Word); os termos
  (TC 094/2023, TAs) têm texto e a tabela de itens, mas em layout de termo do SEI, que o extrator não lê.
- [ ] **8. Deploy e medição** — push (Render + Vercel); conferir no log do Render
  `geração concluída em N s: pico M MB` num envio real com aditivos.
