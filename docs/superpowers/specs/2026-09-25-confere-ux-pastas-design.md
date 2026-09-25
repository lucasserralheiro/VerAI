# ConfereAI — ajustes de UX e a janela "Pastas do cliente" (design)

**Status**: Aprovado com o usuário em 25/09/2026 (tarde) e **implementado no mesmo dia** — plano
`docs/superpowers/plans/2026-09-25-confere-ux-pastas.md`, commits `141f576`…`c91a1bf`. Sem migração.
**Data**: 25/09/2026
**Continua**: `docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md` (a busca do
contrato pela planilha, implementada no mesmo dia).

---

## 1. Pedido

Depois de testar a busca do contrato pela planilha: *"preciso so melhorar um pouco a UX"* e *"precisa
ter um botao tbm para navegar na app nas pasta do cliente tipo um modal para ele encontrar oq quer"*.

No print do usuário, o menu "Trocar" abriu por cima da faixa do contrato (cobrindo o nome do cliente
e o "trocar contrato"), e a tela inicial ainda sugeria começar pelo Contrato.

## 2. Decisões (com o usuário)

1. **Os quatro ajustes** (todos marcados): começo guiado, textos mais claros, aditivos mais limpo,
   arrastar e soltar.
2. **Arrastar e soltar por cartão**: cada cartão aceita o seu tipo (recomendação aceita).
3. **A janela organiza os arquivos igual ao SharePoint** (*"1"*): cliente › pasta do contrato ›
   pasta do termo › arquivos.
4. **A janela substitui os menus "Trocar" e "+ Adicionar do cadastro".**
5. O levantamento continua vindo só do computador (a janela é para PDF; só 1 levantamento está no
   cadastro hoje).

A decisão de 23/09/2026 — *nenhuma árvore de pastas paralela no VerAI* — continua valendo: a janela
só mostra os caminhos que a sincronização já guarda em `ArquivoSharepoint.caminho`. Nada novo para
manter.

## 3. A tela

### 3.1 Começo guiado

- O cartão **Levantamento** mostra o selo **"comece aqui"** enquanto não há planilha.
- O **Contrato** vazio diz *"vem do levantamento — ou escolha um arquivo"*; enquanto a planilha é
  lida, *"buscando no cadastro…"* com o indicador de atividade.
- O Levantamento vazio diz *"escolher arquivo… ou arraste para cá"*.

### 3.2 Textos

- Abertura: *"Escolha o levantamento — o contrato e os aditivos vêm do cadastro do cliente — e gere
  o relatório de comprovação."*
- Embaixo do botão, o que falta (some quando nada falta):
  - sem planilha e sem contrato: *"Escolha o levantamento para começar."*
  - com contrato, sem planilha: *"Falta o levantamento."*
  - lendo a planilha: *"Buscando o contrato no cadastro…"*
  - com planilha, sem contrato: *"Falta o contrato: procure nas pastas do cliente ou envie do
    computador."*

### 3.3 Aditivos

Vazio, uma linha só: *"Nenhum aditivo · + Procurar nas pastas · + Enviar do computador"* (com
contrato achado: *"Nenhum aditivo depois da proposta-base"*). Com aditivos, a lista de sempre e a
mesma linha de ações embaixo.

### 3.4 Arrastar e soltar

- **Levantamento** aceita um `.xlsx`; **Contrato**, um `.pdf`; **Aditivos**, um ou mais `.pdf`
  (acrescentados no fim da lista, como pelo computador).
- Enquanto um arquivo passa por cima do cartão: borda tracejada e *"Solte a planilha aqui"* /
  *"Solte o PDF aqui"* / *"Solte os PDFs aqui"*. A borda sólida de sempre continua (`R-ACE-17`): o
  tracejado só aparece quando arrastar faz alguma coisa.
- Tipo errado: aviso no próprio cartão — *"O levantamento é a planilha .xlsx — X não é."*, *"O
  contrato é a proposta em PDF — X não é PDF."*, *"Aditivos são PDFs — X ficou de fora."*
- Arquivo solto fora dos cartões é ignorado: o navegador não o abre (e a pessoa não perde o que já
  preencheu).
- Durante a geração, nada é aceito (como os campos, que ficam desabilitados).

### 3.5 A janela "Pastas do cliente"

- **Botões**: "Procurar nas pastas do cliente" no cartão Contrato (sempre, ao lado de "Ver PDF"
  quando a proposta veio do cadastro) e "+ Procurar nas pastas" nos Aditivos.
- **Cliente**: o do contrato achado. Sem contrato achado, a janela pede o cliente primeiro (lista dos
  clientes que a pessoa pode ver, com busca). "Outro cliente" troca.
- **Abre** na pasta do contrato da proposta que está no campo Contrato (ou da proposta-base); sem
  ela, na raiz do cliente.
- **Navegação**: caminho clicável (sigla › pasta do contrato › pasta do termo), subpastas e arquivos
  da pasta atual, em ordem natural ("2)" antes de "10)"). **Busca** por nome em todas as pastas do
  cliente (lista com a pasta de cada um).
- **Pastas extras**: arquivos sem caminho do SharePoint ficam em **"Enviados pelo VerAI"**; os que
  saíram do SharePoint mas continuam no VerAI (em uso), em **"Fora do SharePoint"**. Publicação
  roteada de outra pasta da biblioteca ("1. PUBLICAÇÕES NO DOC") aparece com o caminho dela.
- **Escolha**: para o Contrato, um PDF (opção única); para os Aditivos, vários, na ordem dos cliques
  (marcados 1º, 2º…). Arquivo que não é PDF aparece, com "só PDF", e não pode ser escolhido. Cada
  arquivo tem **"ver"** (abre em `/api/arquivos/{id}?modo=inline`).
- **Confirmar**: "Usar este arquivo" (Contrato) ou "Adicionar N aditivo(s)". O arquivo escolhido
  entra como proposta do cadastro; quando ele é uma das propostas do histórico do contrato, mostra a
  origem de sempre ("TA 02, renovação desde…"); senão, *"pasta <nome da pasta>"*.
- **Modal nativo** (`<dialog>` + `showModal()`), como o `ConfirmarLimpeza`: foco preso, `Esc` fecha,
  fundo inerte. Mora em `page.tsx`, fora do `<form>`.

## 4. Por dentro

| Peça | O que é |
|---|---|
| `src/lib/confere/pastas.ts` | `pastasDoCliente(clienteId)`: `ArquivoCliente` não removidos do cliente + os caminhos em `ArquivoSharepoint`; tira a pasta do cliente (a primeira pasta mais comum nos caminhos) |
| `GET /api/confere/clientes/[clienteId]/pastas` | `exigirAcessoCliente`; devolve `{ cliente, arquivos: [{ arquivoId, nome, extensao, categoria, pasta: string[] }] }` — nunca `urlBlob` |
| `src/lib/confere/tipos-cadastro.ts` | tipos `ArquivoNaPasta`/`PastasDoCliente`, as duas pastas extras; `DocumentoDoCadastro` ganha `pasta?` |
| `src/app/confere/components/JanelaDePastas.tsx` | a janela |
| `src/app/confere/components/useSoltarArquivos.ts` | arrastar e soltar de um cartão (profundidade para o `dragleave` dos filhos, tipo pela extensão) |
| `UploadForm.tsx`, `page.tsx` | selo, textos, dica do botão, aditivos em uma linha, botões da janela, arrastar e soltar, e a trava de soltar fora; `MenuDeDocumentos.tsx` sai |
| lista de clientes | `GET /api/clientes` (já existe; só os visíveis) |

## 5. Testes

- `pastas.ts`: caminho sem a pasta do cliente, "Enviados pelo VerAI", "Fora do SharePoint", publicação
  de outra raiz.
- Rota: 401, 403 sem acesso ao cliente, 404, 200.
- Janela: abre na pasta do contrato, entra em pasta, caminho clicável, busca, não-PDF desabilitado,
  aditivos na ordem dos cliques, pede o cliente quando não há.
- Tela: selo, textos da dica, aditivos em uma linha, soltar a planilha no Levantamento dispara a
  busca, tipo errado avisa, soltar PDFs nos Aditivos acrescenta, escolher pela janela preenche o
  Contrato.

## 6. Fora de escopo

- Levantamento escolhido nas pastas (continua do computador).
- Mexer nas pastas (criar, renomear, mover) — a janela só lê.
- Pré-visualização do PDF dentro da janela ("ver" abre em outra aba).
