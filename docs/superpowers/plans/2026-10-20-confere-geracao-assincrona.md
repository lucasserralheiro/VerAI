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
- [ ] **8. Deploy e medição** — push (Render + Vercel); conferir no log do Render
  `geração concluída em N s: pico M MB` num envio real com aditivos.
