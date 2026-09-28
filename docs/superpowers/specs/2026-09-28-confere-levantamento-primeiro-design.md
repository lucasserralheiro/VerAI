# ConfereAI — o levantamento como ação principal, o modal da busca e a janela de pastas (design)

**Status**: Aprovado com o usuário em 28/09/2026 e **implementado no mesmo dia** — plano
`docs/superpowers/plans/2026-09-28-confere-levantamento-primeiro.md`, commits `f0f0cc8`…`3352351`.
Sem migração, sem mudança de API.

**Ajuste visto na tela (fora do desenho original)**: nas larguras médias (abaixo de 1280 px) as
linhas de conferência têm duas colunas e as ações ficam embaixo do arquivo — lado a lado, as três
ações do Contrato espremiam o nome e a origem da proposta. Três colunas só de 1280 px para cima.
**Data**: 28/09/2026
**Continua**: `docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md` (começo guiado, arrastar
e soltar, a janela "Pastas do cliente") e `docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md`
(a busca do contrato pela planilha).

---

## 1. Pedido

Com três prints da tela (início com Contrato e Levantamento lado a lado; "buscando no cadastro…" em
texto pequeno no meio do formulário; a janela de pastas sem como voltar):

> *"preciso melhorar a ui e ux primeiro deixando apenas o levantamento como ação principal e enquanto
> carrega abrir um modal que tá buscando o contrato e os demais em vez de apenas aparecer igual o print
> 2 — as pastas deve ser melhor, tendo botão de voltar melhorando o ux"*

E a confirmação: *"mas o fluxo ainda continua de quando a pessoa colocar a planilha do levantamento
ele trazer os contratos diretos do banco"* — **sim**: a regra da busca (rota `/api/confere/levantamento`,
base = PA da última renovação em vigor na competência, senão a PC; aditivos = PAs depois dela) não
muda. Esta entrega é de apresentação.

## 2. Decisões (com o usuário)

1. **Fim da busca**: achou → o modal fecha sozinho e a tela mostra os documentos para conferir. Não
   achou / mais de um / sem número / ilegível / falha → o modal continua aberto e **pergunta ali**.
2. **Tela inicial**: só o levantamento. Contrato e Aditivos aparecem depois da busca, já preenchidos;
   um link discreto abre o preenchimento à mão.
3. **Janela de pastas**: Voltar, linha inteira clicável, duplo clique, "em uso", rodapé com o
   selecionado, janela de tamanho fixo (§4).

A paleta continua a `confere-*`: é reorganização do fluxo, não troca de estilo — o que o CLAUDE.md
proíbe é redesenhar no estilo institucional do VerAI ou vincular ao fluxo de cliente/competência.

## 3. A tela em três fases

A tela passa a ter uma **fase** explícita, decidida em `page.tsx`:

| Fase | Quando | O que aparece |
|---|---|---|
| `inicio` | sem levantamento e sem nada escolhido à mão | só o cartão grande do levantamento |
| `manual` | a pessoa clicou "Preencher à mão", ou "Enviar o contrato do computador" no modal | o formulário com os três documentos |
| `conferir` | há levantamento e a busca terminou achando (ou a pessoa escolheu o contrato) | resumo do contrato + os três documentos |

`manual` e `conferir` usam o mesmo formulário (§3.3); a diferença é que `conferir` tem o resumo do
contrato em cima. Limpar volta a `inicio`.

### 3.1 Início — só o levantamento

```
ConfereAI
Escolha o levantamento — o contrato e os aditivos vêm do cadastro do cliente.

┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
          (ícone de planilha)
   Arraste a planilha de levantamento aqui
          ou  [ Escolher planilha ]
       XLSX de medição da competência
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
Prefere enviar o contrato do computador? Preencher à mão
```

- Um cartão só, grande. **Borda tracejada no repouso** — aqui ela é verdade: soltar funciona no cartão
  inteiro (`R-ACE-17` pede o tracejado só quando arrastar faz alguma coisa; faz). Com arquivo por
  cima, o fundo muda e diz *"Solte a planilha aqui"*.
- Tipo errado: o aviso de sempre no cartão (*"O levantamento é a planilha .xlsx — X não é."*).
- Sem botão *Gerar relatório* e sem a dica "Escolha o levantamento para começar." — o cartão já diz.
- **"Preencher à mão"** vai para a fase `manual`.

### 3.2 Buscando — o modal

```
┌ Buscando os documentos do contrato ─────────────┐
│ CGM_Levantamento_06034_TC 16CGM2024…xlsx        │
│ ◌ Lendo a planilha e procurando o contrato, a   │
│   proposta e os aditivos da competência…        │
│                                     [Cancelar]  │
└─────────────────────────────────────────────────┘
```

- Abre ao escolher a planilha (no início, na fase `manual` ou trocando depois) e ao escolher um
  contrato à mão (pergunta do modal ou *trocar contrato*).
- **Uma frase só, sem etapas marcadas**: a busca é um pedido único ao servidor, e marcar ✓ em etapa
  que a tela não vê seria o indicador falso que o `ProgressoDaGeracao` recusa.
- **Tempo mínimo de 600 ms** aberto: resposta rápida não pisca o fundo escuro.
- **Cancelar** (e `Esc`) descarta a busca: o número do pedido avança, e a resposta que chegar depois é
  ignorada. A planilha sai. Se a pessoa tinha algo enviado do computador (contrato ou aditivo), ou
  estava na fase `manual`, a tela fica na fase `manual` com isso; senão, volta ao `inicio`.
- **Achou** (`encontrado`): fecha e vai para `conferir`.
- **Pergunta** — o conteúdo das caixas âmbar da `FaixaDoContrato` de hoje passa para dentro do modal,
  com os mesmos textos:
  - `ambiguo`: *"Mais de um contrato com o número X. Escolha qual:"* + a lista.
  - `nao-encontrado`: *"O contrato X não está no cadastro."* + sugestões + busca.
  - `sem-referencia`: *"Não achamos o número do contrato neste levantamento."* + busca.
  - `ilegivel`: a mensagem da rota + busca.
  - `falhou`: *"Não foi possível buscar o contrato agora."* + busca.
  - Sempre, embaixo: **"Enviar o contrato do computador"** (fecha e vai para `manual` com a planilha
    mantida) e **"Trocar planilha"** (abre o seletor de arquivo; a planilha nova recomeça a busca).
    Fechar a pergunta por `Esc` equivale a "Enviar o contrato do computador": a planilha fica.
- Escolher um contrato (lista ou busca) volta ao "buscando" (*"Buscando a proposta e os aditivos do
  contrato…"*) e fecha quando os documentos chegam. Falhou: volta à pergunta `falhou`.
- *trocar contrato* (no resumo da fase `conferir`) abre o modal direto na busca (*"Escolha outro
  contrato"*), com *Cancelar* que só fecha e deixa tudo como estava.
- `<dialog>` + `showModal()`, como `ConfirmarLimpeza`, `JanelaDePastas` e `ProgressoDaGeracao`; mora em
  `page.tsx`, fora do `<form>`. A busca de contrato dentro do modal fica fora do `<form>`, então o
  Enter dela já não gera relatório — o `keyDown` que segura o Enter continua, e não custa nada.

### 3.3 Conferir — os documentos

```
┌ Contrato TC 16/CGM/2024 · CGM · competência agosto/2026 ─────────┐
│ abrir contrato · trocar contrato     ▸ Como os documentos foram… │
└──────────────────────────────────────────────────────────────────┘
Documentos
 [xlsx] Levantamento  CGM_Levantamento_06034…xlsx        Trocar
 [pdf]  Contrato      PA-CGM-250912-127 v4.0.pdf          Ver PDF · Trocar
                      do cadastro · TA 02, renovação desde…
 [pdf]  Aditivos      Nenhum depois da proposta-base      + Procurar nas pastas
                                                          + Enviar do computador
[ Gerar relatório ]  [ Limpar ]
```

- **Resumo do contrato** (a `FaixaDoContrato`, só o caso achou): número, cliente, competência, *abrir
  contrato*, *trocar contrato* (abre o **modal**, §3.2, em vez de abrir a busca dentro da faixa), o
  aviso "competência não lida", "Usar a proposta do cadastro" quando o Contrato está com arquivo do
  computador, os avisos âmbar e o *"Como os documentos foram escolhidos"*.
- **Três linhas de conferência** no lugar dos dois cartões lado a lado + o cartão de aditivos: ícone,
  rótulo, nome do arquivo, de onde veio (*"do cadastro · …"* / *"do computador"*) e as ações à direita.
  - Levantamento: *Trocar* (seletor do computador; a planilha nova recomeça a busca, com modal).
  - Contrato: *Ver PDF* (quando do cadastro), *Procurar nas pastas*, *Enviar do computador*. Vazio
    (fase `manual`): *"Nenhum contrato — procure nas pastas do cliente ou envie do computador."*
  - Aditivos: a lista numerada de sempre, cada um com ×; *+ Procurar nas pastas*, *+ Enviar do
    computador*.
  - Cada linha continua aceitando **arrastar e soltar** do seu tipo, com os mesmos avisos.
- Ficam no formulário, como hoje: o aviso "parece um levantamento" (`R-DOC-08`), a pergunta de
  identidade (`R-IDT-10`), a dica do que falta embaixo do botão, *Gerar relatório* e *Limpar*.
- Na fase `manual` sem levantamento, a linha do Levantamento diz *"escolher arquivo… ou arraste para
  cá"*; ao escolher, a busca roda com modal como no início.
- **Ordem do Tab**: Levantamento → Contrato → Aditivos → *Gerar relatório* → *Limpar* (antes o Contrato
  vinha primeiro, ESPEC 008 §6). Segue a ordem do fluxo novo. O destino do foco depois de Limpar
  (`R-LMP-09`) passa a ser o *Escolher planilha* do cartão do início.
- As chaves de remontagem (`R-LMP-04`, `chaveContrato`, `chaveAditivos`) continuam: zeram o
  `<input type="file">` de cada documento.

## 4. A janela "Pastas do cliente"

```
┌ Pastas do cliente · CGM ──────────────────────────── Outro cliente ┐
│ Escolha a proposta (PDF) para o campo Contrato.                    │
│ [ Buscar por nome em todas as pastas                             ] │
│ [← Voltar]  CGM › TC 16-CGM-2024 - Sustentação… › 3) TA 02 - Pror… │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 📁 1) TC 16-CGM-2024 - Contrato inicial          4 arquivos  › │ │
│ │ 📁 3) TC 16-CGM-2024 - TA 02 - Prorrogação  em uso 2 arquivos › │ │
│ │ ◉ PDF PA-CGM- 250912-127 v4.0.pdf   em uso            ver ↗   │ │
│ │ ○ PDF TC 16-CGM-2024 - TA 02.pdf                      ver ↗   │ │
│ │   ·   Planilha.xlsx                 só PDF                    │ │
│ └────────────────────────────────────────────────────────────────┘ │
│ Selecionado: PA-CGM- 250912-127 v4.0.pdf   [Cancelar] [Usar este] │
└────────────────────────────────────────────────────────────────────┘
```

- **← Voltar**: sobe uma pasta; desabilitado na raiz do cliente. Depois de *Outro cliente*, na lista de
  clientes, vira **"← Voltar para <sigla>"** e devolve ao cliente anterior na pasta onde estava.
- **Tamanho fixo**: largura `min(48rem, 100vw − 2rem)`, lista com altura fixa (~24rem, rolagem
  interna) — a janela não muda de tamanho a cada pasta.
- **Linha inteira clicável**: pasta entra; PDF seleciona. A selecionada fica em destaque teal (o
  rádio/checkbox continua, para teclado e leitor de tela).
- **Duplo clique num PDF**: no Contrato, usa o arquivo e fecha; nos Aditivos, marca aquele (se ainda
  não estava) e adiciona os marcados, na ordem, e fecha.
- **Ícone por tipo** (pasta, PDF, outro) e **quantidade de arquivos** de cada pasta (todos os níveis
  abaixo dela).
- **"em uso"**: no arquivo que está no campo Contrato e nos aditivos já na lista — e na pasta (em
  qualquer nível) que contém um deles. Continua abrindo **na pasta do contrato** (o primeiro nível do
  caminho da proposta em uso), agora com a pasta do termo em uso marcada.
- **"já na lista"**: nos Aditivos, o PDF que já está na lista aparece marcado assim e não pode ser
  escolhido de novo.
- **Ordem**: pastas, depois PDFs, depois os outros arquivos (apagados, com *"só PDF"*), cada grupo em
  ordem natural ("2)" antes de "10)").
- **Busca**: resultado em duas linhas — nome e, embaixo, em cinza, a pasta (*"CGM › TC 16… › 3) TA
  02…"*). Continua buscando em todas as pastas do cliente.
- **Carregando**: linhas-esqueleto no lugar de *"Carregando as pastas…"* (com o texto para leitor de
  tela).
- **Rodapé**: à esquerda, *"Selecionado: <nome>"* (Contrato) ou *"<n> aditivo(s): 1º <nome>, 2º …"*;
  nada selecionado, *"Nenhum arquivo selecionado"*. À direita, *Cancelar* e o botão de sempre.
- Fica de fora, como antes: mexer nas pastas, escolher o levantamento pelas pastas, ver o PDF dentro
  da janela (*ver* continua abrindo em outra aba).

## 5. Por dentro

| Peça | Mudança |
|---|---|
| `src/app/confere/page.tsx` | a fase da tela (`inicio`/`manual`/`conferir`) e o estado do modal de busca; `identificar`, `aplicarDocumentos`, `escolherContrato` continuam com a mesma regra |
| `src/app/confere/components/EntradaDoLevantamento.tsx` (novo) | o cartão grande do início; usa `useSoltarArquivos` |
| `src/app/confere/components/BuscaDoContratoModal.tsx` (novo) | o modal: buscando (tempo mínimo), pergunta (os casos âmbar), Cancelar, Enviar do computador, Trocar planilha, trocar contrato |
| `src/app/confere/components/FaixaDoContrato.tsx` | só o caso achou; *trocar contrato* chama `onTrocarContrato` |
| `src/app/confere/components/UploadForm.tsx` | três linhas de conferência no lugar dos cartões; avisos, chaves e botões continuam |
| `src/app/confere/components/JanelaDePastas.tsx` | §4; recebe também os `arquivoId` em uso (contrato e aditivos) |
| `src/app/confere/components/BuscaDeContrato.tsx` | sem mudança de regra (usada dentro do modal) |

## 6. Testes

- **Tela** (`page.test.tsx`): o início mostra só o levantamento; escolher a planilha abre o modal;
  achou → o modal fecha e a tela mostra Contrato e Aditivos preenchidos; não achou → o modal pergunta e
  escolher a sugestão preenche; Cancelar volta ao início; "Preencher à mão" mostra os três documentos;
  "Enviar o contrato do computador" no modal vai para o manual com a planilha mantida; os testes que já
  existem (proposta do computador não é trocada, gera por referência, remover aditivo, soltar arquivo,
  pastas trocam a proposta) continuam, ajustados ao layout.
- **Modal** (`BuscaDoContratoModal.test.tsx`): tempo mínimo; cada caso de pergunta com o seu texto;
  escolher contrato volta ao buscando; Cancelar.
- **Janela** (`JanelaDePastas.test.tsx`): Voltar sobe e fica desabilitado na raiz; "Voltar para <sigla>"
  depois de Outro cliente; clique na linha seleciona/entra; duplo clique confirma; "em uso" no arquivo e
  na pasta; "já na lista" desabilita; quantidade de arquivos; busca em duas linhas; os testes que já
  existem continuam.
- **Faixa** (`FaixaDoContrato.test.tsx`): os casos âmbar saem daqui (vão para o teste do modal);
  *trocar contrato* chama `onTrocarContrato`.
