# SharePoint sempre em dia — automação da sincronização (design)

**Status:** implementado (aguardando produção) — agendador instalado no PC do Lucas em 24/09/2026, já
apontado para produção (§7) · **Plano:** `docs/superpowers/plans/2026-09-24-sharepoint-automacao.md`
**Base:** `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md` (o que a sincronização faz).
Este documento trata de **quando** e **onde** ela roda.

## 1. Objetivo

O VerAI reflete a biblioteca ContratosReceita **sem ninguém rodar nada**.

## 2. Decisões do usuário (24/09/2026)

- **Roda sempre do PC do Lucas** ("ele vai vir da minha máquina sempre"). Sem administrador, sem custo,
  já validado em dev (biblioteca inteira, conferência 1.171/1.171).
- **Nada de e-mail, painel ou selo na tela** ("vamos esquecer email, dashboard ou algo"). A automação é
  só o agendador; conferir se rodou é pelo próprio PC (§5).

```
SharePoint (nuvem) ──OneDrive──▶ C:\Users\p017886\rede.sp\rede.sp - ContratosReceita
                                          │  Agendador do Windows, a cada 30 min
                                          ▼
                         scripts/sincronizar-sharepoint.bat  ──▶  banco de produção (Neon)
                                                              ──▶  arquivos no Cloudflare R2
```

**Prazo:** arquivo salvo no SharePoint aparece no VerAI em até ~30 min + o tempo do OneDrive trazer o
arquivo, **enquanto o PC estiver ligado e com o Lucas logado**. PC desligado não perde nada: a primeira
execução depois de ligar alcança tudo (a sincronização compara estado, não eventos).

## 3. O que já está pronto (não muda)

- Uma passada só: arquivos → aba Documentos, pastas de termo → linhas do histórico, PDFs ligados por
  referência, conferência por cliente, auditoria das contas (spec lugar-certo §3.5, §10.3).
- Proteções: nada some se a listagem vier com menos da metade do que já estava (OneDrive desmontado);
  trava contra duas execuções ao mesmo tempo (expira em 2 h); idempotente — rodar de novo não duplica.
- Log em `logs/sincronizar-sharepoint.log` e `logs/sharepoint-sincronizacao.json` (no PC).

O que **falta**: o agendador instalado direito.

## 4. Agendador do Windows

Instalado por `scripts/agendador-sharepoint.ps1` (tarefa do próprio usuário — **não precisa de
administrador**), no lugar do `schtasks` da Task 14 do plano lugar-certo:

- Gatilhos: **ao fazer logon** e **a cada 30 min**, todos os dias.
- "Executar o quanto antes se um horário foi perdido"; **não** abrir segunda instância; parar após 2 h;
  roda na bateria; **só com o usuário logado** (o OneDrive vive na sessão dele).
- Sem janela piscando a cada 30 min: a ação chama `conhost.exe --headless` com o `.bat`.
- Se o Windows recusar o gatilho de logon sem administrador, fica só o de 30 min — com "executar o
  quanto antes", ele roda logo depois do logon do mesmo jeito.
- `-Instalar`, `-Remover`, `-Estado` (horários do Agendador e o resumo da última execução: conferência,
  auditoria e o código de saída).
- **O resultado vem do log, não do Agendador.** O `conhost --headless` devolve sempre 0 ao Agendador,
  qualquer que seja o código do `.bat` (medido em 24/09: `cmd /c exit 3` → 0). Por isso o `.bat` grava
  `[inicio …]` e `[fim … - codigo N]` no log (0 = ok, 1 = erro, 2 = divergência na conferência) e o
  `-Estado` lê dali. O "resultado" do Agendador só aparece quando ele nem conseguiu abrir o `.bat`.
- O `.bat` passa a girar o log: acima de 5 MB vira `sincronizar-sharepoint.1.log`.

Pré-requisito no PC: pasta da biblioteca com **"Sempre manter neste dispositivo"** (botão direito no
Explorer) — sem isso cada leitura de PDF novo espera o download do OneDrive.

## 5. O que pode deixar o VerAI desatualizado

| Causa | O que acontece | Como conferir / resolver |
|---|---|---|
| PC desligado, hibernado, Lucas deslogado | não roda; ao logar, roda e alcança tudo | nada a fazer |
| OneDrive fechado, pausado ou deslogado | pasta local para no tempo; listagem pela metade → nada é apagado | abrir o OneDrive; conferir o ícone da bandeja |
| Erro (internet, Neon, R2) | tenta de novo em 30 min | `agendador-sharepoint.ps1 -Estado` mostra `codigo 1` e a mensagem do erro |
| Senha do banco ou chave do R2 trocada | toda execução falha | atualizar `.env.production.local` / `.env.local` no PC |
| Pasta sem cliente, arquivo > 50 MB | fica de fora, listado no log | mapear em `scripts/sharepoint-clientes.json` |
| Mudança de regra quebra a leitura | — | régua (`scripts/regua-sharepoint.ts`) + testes antes do deploy (CLAUDE.md) |

## 6. Rotina

- **Automático:** a cada 30 min, nada a fazer.
- **De vez em quando:** `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Estado`
  — `TUDO NO VERAI` e `codigo 0` na última execução = em dia. O resumo traz também "Sem cliente" e a
  contagem da auditoria das contas; a lista inteira (valor a digitar, duplicados) fica no log.
- **Trocou de PC:** clonar o repositório, `npm ci`, copiar os dois arquivos `.env`, sincronizar a
  biblioteca no OneDrive, `-Instalar` — e `-Remover` no PC antigo (duas máquinas ao mesmo tempo não
  têm trava entre si).

### 6.1 Combinado com quem organiza o SharePoint (financeiro)

O VerAI se ajusta sozinho a: arquivo novo, trocado, renomeado ou movido; pasta de termo `TA XX`
renomeada para `TA 03`; contrato movido para "Contratos Finalizados"; `WORK/`; pasta de cliente nova
(vira cliente — o nome oficial vem de `scripts/sharepoint-clientes.json` → `nomes`, senão fica a sigla).
Fica de fora: arquivo solto na raiz da biblioteca, arquivo acima de 50 MB, pasta de cliente cujo nome
não é a sigla nem está mapeado. Convenção que mantém tudo no lugar:
`<SIGLA>/TC 073-2019 - descrição/2) TC 073-2019 - TA 01 - prorrogação/arquivo.pdf`.

## 7. Entrada em produção (ordem)

O agendador **já está instalado e ligado, apontado para produção** (24/09/2026, a pedido do usuário). Até a
migração de produção, cada execução para na checagem de migração pendente — a primeira coisa que ela faz
no banco, só leitura — e o log registra `codigo 1`, sem gravar nada.

1. Variáveis `R2_*` (4) na Vercel; pasta com "Sempre manter neste dispositivo".
2. **Pausar a tarefa** (`Disable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'`): entre o
   `migrate deploy` e o código novo no ar, uma execução automática poderia gravar `r2:` que o código antigo
   não abre. Depois: `prisma migrate deploy`; `migrar-sharepoint-lugar-certo.ts` listagem → `--aplicar`;
   deploy do código (Task 14 do plano lugar-certo, Steps 2–4).
3. Primeira sincronização completa manual (Task 14 Step 5) → `TUDO NO VERAI`.
4. Religar (`Enable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'`) → depois de 30 min,
   `-Estado` com `TUDO NO VERAI` e `codigo 0`.
5. Cada passo com o ok do usuário (mexe em produção ou em configuração persistente do Windows).

## 8. Fora do escopo

- E-mail, painel do admin, selo "atualizado há X min" e registro de execuções no banco — decisão do
  usuário (§2). Se um dia fizer falta, o caminho é gravar cada execução numa tabela e mostrar dali.
- Rodar em servidor (Microsoft Graph, Power Automate): precisaria da TI ou de licença.
- Tempo real (webhook): 30 min atende.
- Escrever no SharePoint: o VerAI só lê a biblioteca, nunca altera.
