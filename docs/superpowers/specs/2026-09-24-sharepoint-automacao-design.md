# SharePoint sempre em dia — automação da sincronização (design)

**Status:** proposto (24/09/2026) · **Plano:** `docs/superpowers/plans/2026-09-24-sharepoint-automacao.md`
**Base:** `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md` (o que a sincronização faz).
Este documento trata de **quando** ela roda, **onde** e de **como se percebe** que parou.

## 1. Objetivo

O VerAI reflete a biblioteca ContratosReceita **sem ninguém rodar nada**. Quando deixar de refletir
(PC desligado, OneDrive parado, erro), **todo mundo vê na tela** — nunca desatualizado em silêncio.

## 2. Decisão: roda sempre do PC do Lucas

Decisão do usuário (24/09/2026): "ele vai vir da minha máquina sempre". Sem administrador, sem custo,
e já validado em dev (biblioteca inteira, conferência 1.171/1.171).

```
SharePoint (nuvem) ──OneDrive──▶ C:\Users\p017886\rede.sp\rede.sp - ContratosReceita
                                          │  Agendador do Windows, a cada 30 min
                                          ▼
                         scripts/sincronizar-sharepoint.bat  ──▶  banco de produção (Neon)
                                                              ──▶  arquivos no Cloudflare R2
                                                              ──▶  registro da execução (§5)
```

Descartado por ora: Microsoft Graph no servidor (precisa registrar app e consentimento da TI) e Power
Automate chamando o VerAI (conector HTTP é premium). Se um dia precisar, o núcleo já aceita outra fonte:
`sincronizarSharepoint({ fonte })` — troca-se `fonteDaPasta` por outra, o resto não muda.

**Prazo que o sistema promete:** arquivo salvo no SharePoint aparece no VerAI em até ~30 min + o tempo
do OneDrive trazer o arquivo, **enquanto o PC estiver ligado e com o Lucas logado**. PC desligado não perde
nada: a primeira execução depois de ligar alcança tudo (a sincronização compara estado, não eventos).

## 3. O que já está pronto (não muda)

- Uma passada só: arquivos → aba Documentos, pastas de termo → linhas do histórico, PDFs ligados por
  referência, conferência por cliente, auditoria das contas (spec lugar-certo §3.5, §10.3).
- Proteções: nada some se a listagem vier com menos da metade do que já estava (OneDrive desmontado);
  trava contra duas execuções ao mesmo tempo (expira em 2 h); idempotente — rodar de novo não duplica.
- Log em `logs/sincronizar-sharepoint.log` e `logs/sharepoint-sincronizacao.json` (no PC).

O que **falta**: o agendador instalado direito, e o VerAI saber que a sincronização rodou.

## 4. O que pode deixar o VerAI desatualizado — e a resposta para cada um

| Causa | Como se percebe | O que acontece |
|---|---|---|
| PC desligado, hibernado, Lucas deslogado | última execução OK fica velha | selo amarelo/vermelho no VerAI (§6); ao logar, a tarefa roda na hora e alcança tudo |
| OneDrive fechado, pausado ou deslogado | processo `OneDrive.exe` ausente → execução "com atenção"; listagem pela metade → remoção suspensa | selo amarelo com o motivo; nada é apagado |
| Erro (internet, Neon, R2, chave trocada) | execução "erro" com a mensagem | nova tentativa em 30 min; **duas** falhas seguidas → selo vermelho (uma falha isolada, como o 502 do R2, não alarma) |
| Execução morta no meio (PC desligou) | registro "em andamento" há mais de 2 h | tratada como interrompida; a trava expira sozinha |
| Arquivo que não entra (pasta sem cliente, > 50 MB) | pendência na execução | lista no painel (§6.3) pra mapear em `scripts/sharepoint-clientes.json` |
| Divergência na conferência | conferência ≠ tudo no VerAI | execução "com atenção"; clientes e arquivos listados no painel |
| Mudança de regra quebra a leitura | régua (`scripts/regua-sharepoint.ts`) + testes | processo de desenvolvimento, não de operação (CLAUDE.md) |

O que **não** dá pra perceber automaticamente: OneDrive rodando mas sem sincronizar (erro de conta
mostrado só no ícone da bandeja). Por isso a rotina mensal do §8.

## 5. Registro de cada execução (novo)

Tabela `ExecucaoSharepoint` no banco de produção — é o que permite ao VerAI saber da sincronização
sem acesso ao PC:

- `iniciadaEm`, `terminadaEm`, `maquina` (nome do PC), `situacao`: `andamento` | `ok` | `atencao` | `erro`.
- `resumo` (JSON): contagens da execução (listados, novos, removidos, contratos, linhas…).
- `pendencias` (JSON): sem cliente, falhas, divergências da conferência, remoção suspensa, OneDrive fora.
- `achados` (JSON): auditoria das contas (§3). `mensagem`: o erro, quando houver.

Regras: só execução com `--aplicar` registra. Cria a linha no começo (`andamento`) e fecha no fim.
`atencao` = terminou, mas com divergência, remoção suspensa, falha de arquivo ou OneDrive fora. Falha em
gravar o registro **nunca** derruba a sincronização (best-effort, como o histórico do Confere). Registros
com mais de 90 dias são apagados pela própria execução (é log técnico, não dado de negócio).

A auditoria passa a olhar **todos** os clientes na primeira execução do dia (e só os tocados nas
demais), para o painel sempre mostrar a lista completa de pendências de contas.

## 6. O que aparece no VerAI

### 6.1 Uma regra só para "em dia"

`estadoDaSincronizacao(execucoes, agora)` em `src/lib/arquivos/sharepoint/estado.ts`, usada pelo selo,
pelo painel e pelo aviso por e-mail. Conta **horas úteis** (seg–sex, 7h–20h) desde a última execução OK,
pra noite e fim de semana com o PC desligado não virarem alarme:

| Nível | Quando | Cor |
|---|---|---|
| `em-dia` | última OK há ≤ 2 h úteis e sem atenção | verde |
| `atencao` | última execução OK terminou com atenção | amarelo |
| `atrasada` | última OK há mais de 2 h úteis | amarelo |
| `parada` | última OK há mais de 8 h úteis (um dia de trabalho) | vermelho |
| `com-erro` | as duas execuções mais recentes falharam | vermelho |
| `nunca` | nenhuma execução registrada | cinza |

Execução em `andamento` há mais de 2 h conta como falha (interrompida). Feriado conta como dia útil (aceito: no máximo um alarme falso no dia seguinte).

### 6.2 Selo na aba Documentos

No cabeçalho da aba Documentos de todo cliente: "SharePoint atualizado há 12 min" (verde), "SharePoint
sem atualizar desde ontem 18:05" (amarelo/vermelho). Quem lê o documento sabe se pode confiar que está
tudo lá. Rota `GET /api/sharepoint/estado` (qualquer usuário logado; só o nível e o horário).

### 6.3 Painel do administrador

`/admin/sharepoint` (menu Configurações, "Sincronização SharePoint"): estado, últimas 30 execuções
(hora, máquina, situação, duração, novos/removidos), pendências da última execução e achados da última
auditoria completa agrupados por tipo (valor a digitar, duplicados, finalizado com vigência). É a lista
de trabalho da rotina semanal (§8). Rota `GET /api/admin/sharepoint`.

### 6.4 Aviso por e-mail quando parar

Cron diário da Vercel (`vercel.json`, 11h UTC = 8h em Brasília) chama `/api/sharepoint/verificar/cron`
(mesmo desenho do cron do assistente: `Authorization: Bearer $CRON_SECRET`). Se o nível for `parada` ou
`com-erro`, manda e-mail para todos os usuários admin pelo `enviarEmail` que já existe (Resend; sem
`RESEND_API_KEY` só registra no log). Cobre o caso "PC desligado nas férias e ninguém abriu o painel".
Plano Hobby da Vercel roda cron uma vez por dia — conferir o limite de crons do plano antes do deploy.

## 7. Agendador do Windows

Instalado por `scripts/agendador-sharepoint.ps1` (tarefa do próprio usuário — **não precisa de
administrador**), no lugar do `schtasks` da Task 14 do plano lugar-certo:

- Gatilhos: **ao fazer logon** e **a cada 30 min**, todos os dias.
- "Executar o quanto antes se um horário foi perdido"; **não** abrir segunda instância; parar após 2 h;
  roda na bateria; **só com o usuário logado** (o OneDrive vive na sessão dele).
- Sem janela piscando a cada 30 min: a ação chama `conhost.exe --headless` com o `.bat`.
- Se o Windows recusar o gatilho de logon sem administrador, fica só o de 30 min — com "executar o
  quanto antes", ele roda logo depois do logon do mesmo jeito.
- `-Instalar`, `-Remover`, `-Estado` (mostra última execução e resultado da tarefa).
- O `.bat` passa a girar o log: acima de 5 MB vira `sincronizar-sharepoint.1.log`.

Pré-requisito no PC: pasta da biblioteca com **"Sempre manter neste dispositivo"** (botão direito no
Explorer) — sem isso cada leitura de PDF novo espera o download do OneDrive.

## 8. Rotina das pessoas

- **Automático:** a cada 30 min, nada a fazer.
- **Toda semana (admin, ~5 min):** abrir `/admin/sharepoint`; resolver pendências (pasta sem cliente →
  mapear; valor a digitar; duplicado → decidir).
- **Todo mês (~2 min):** escolher dois arquivos recentes no SharePoint pela web e achar os dois na aba
  Documentos — confirma que o OneDrive do PC está de fato sincronizando.
- **Trocou senha do banco ou chave do R2:** atualizar `.env.production.local` / `.env.local` **no PC** e as
  variáveis na Vercel. O selo fica vermelho até isso ser feito.
- **Trocou de PC:** clonar o repositório, `npm ci`, copiar os dois arquivos `.env`, sincronizar a
  biblioteca no OneDrive, `agendador-sharepoint.ps1 -Instalar` — e `-Remover` no PC antigo (duas
  máquinas ao mesmo tempo não têm trava entre si).

### 8.1 Combinado com quem organiza o SharePoint (financeiro)

O VerAI se ajusta sozinho a: arquivo novo, trocado, renomeado ou movido; pasta de termo `TA XX`
renomeada para `TA 03`; contrato movido para "Contratos Finalizados"; `WORK/`; pasta de cliente nova
(vira cliente — o nome oficial vem de `scripts/sharepoint-clientes.json` → `nomes`, senão fica a sigla e
aparece no painel). Fica de fora e aparece como pendência: arquivo solto na raiz da biblioteca, arquivo
acima de 50 MB, pasta de cliente cujo nome não é a sigla nem está mapeado. Convenção que mantém tudo no
lugar: `<SIGLA>/TC 073-2019 - descrição/2) TC 073-2019 - TA 01 - prorrogação/arquivo.pdf`.

## 9. Entrada em produção (ordem)

1. Deploy do código (sincronização + registro de execução + selo + painel) e `prisma migrate deploy`
   (Task 14 do plano lugar-certo, Steps 1–4).
2. Variáveis na Vercel: `R2_*` (4) e `CRON_SECRET` (já existe, do assistente).
3. Primeira sincronização completa manual (Task 14 Step 5) → selo verde.
4. `agendador-sharepoint.ps1 -Instalar` → depois de 30 min, painel com a segunda execução OK.
5. Cada passo com o ok do usuário (mexe em produção ou em configuração persistente do Windows).

## 10. Fora do escopo

- Tempo real (webhook do SharePoint): 30 min atende.
- Escrever no SharePoint: o VerAI só lê a biblioteca, nunca altera.
- Feriados no cálculo de horas úteis.
- Rodar em servidor (Graph API) — só se o PC deixar de ser opção (§2).
