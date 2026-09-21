# ESPEC 015 — Limpar para recomeçar

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-12. **Os três portões fechados**; 66 testes de navegador verdes. Cinco emendas em §14 |
| **Versão** | 1.1 — 2026-08-12 — implementada |
| **Depende de** | [ESPEC 008](008-acessibilidade-da-interacao.md) — implementada. A régua WCAG 2.1 AA que ela fixou (§13.4) vale para todo controle novo, e este é um |
| **Fecha** | ESPEC 007 §10 ponto 4 e ESPEC 008 §11 ponto 6 — o botão registrado como pergunta aberta em duas especs |
| **Revisa** | `R-ACE-18` da ESPEC 008 — a **âncora** da liberação, não a intenção. Ver §6 `D-05` |
| **Origem** | *"Atualmente para submeter novos arquivos e gerar novo relatório é necessário atualizar a página."* |

---

## 1. Problema

A tela não tem como voltar ao começo. Depois de uma geração — pronta, bloqueada ou com erro —
a única forma de devolver a aplicação ao estado inicial é **recarregar a página**.

Isso já estava registrado duas vezes e nunca foi decidido: a ESPEC 007 §10 ponto 4 o levantou
como candidato a ocupar a barra, e a ESPEC 008 §11 ponto 6 o reforçou com o argumento que
pesa mais — **recarregar descarta o foco e o contexto de quem navega por teclado**, que é
precisamente o percurso que aquela espec passou uma entrega inteira construindo (§6 da 008).

O que esta espec acrescenta é que o problema **não é só de conforto**. Inspecionado o código,
o caminho de recomeço que parece funcionar hoje tem um defeito silencioso — §2.2 — e o que
parece não funcionar tem um mecanismo mal compreendido — §2.3. Nenhum dos dois é resolvido
por recarregar mais rápido.

---

## 2. O que foi medido

Leitura do código em `feature/evolucao`. Nada aqui é lembrança.

### 2.1 Recomeçar **funciona em parte**, e é isso que torna o defeito difícil de ver

A premissa de origem — *"é necessário atualizar a página"* — é verdadeira para o caso que
importa, e falsa para um caso vizinho. A distinção decide o escopo:

| O que o usuário faz, estando em `pronto` | O que acontece hoje |
|---|---|
| Clica **Gerar relatório** de novo, com os mesmos arquivos | **Funciona.** `bloqueado = !completo \|\| processando`, e nenhum dos dois vale em `pronto`. O botão segue ativo. A `situacaoVazia` de `e2e/estados.ts` depende disto |
| Escolhe um arquivo **diferente** num dos cartões | **Funciona à vista** — e vaza. Ver §2.2 |
| Quer voltar à tela vazia, sem relatório e sem arquivos | **Impossível.** Não há transição de volta para `inicial` que não passe por `selecionar` |
| Quer trocar um arquivo pelo **mesmo arquivo**, corrigido e salvo com o mesmo nome | **Indefinido.** Ver §2.3 |

O terceiro caso é o pedido literal. O segundo e o quarto são o que a inspeção encontrou de
caminho, e são a razão de esta espec não ser um botão de três linhas.

### 2.2 O caminho que funciona **vaza os dois documentos**

`page.tsx` libera os *blobs* no envio, e só no envio:

```tsx
async function enviar() {
    if (estado.situacao === "pronto") {
        URL.revokeObjectURL(estado.urlDocx);
        URL.revokeObjectURL(estado.urlAnalise);
    }
```

O comentário ao lado justifica a escolha: *"Liberar no envio basta: qualquer transição para
`erro` ou `bloqueado` passa por aqui."* A frase está certa sobre `erro` e `bloqueado`, e
**omite a transição que não passa por ali**:

```tsx
function selecionar(campo, arquivo) {
    setArquivos((atual) => ({ ...atual, [campo]: arquivo }));
    setEstado({ situacao: "inicial" });   // ← as duas URLs somem daqui sem revoke
}
```

Escolher um arquivo novo estando em `pronto` substitui o estado por `{ situacao: "inicial" }`.
As duas URLs deixam de existir na aplicação **e continuam existindo no navegador**: não há
mais referência para passar ao `revokeObjectURL`, e o `enviar()` seguinte vê `inicial` e não
libera nada.

O tamanho está medido na ESPEC 012 §2.4: `.docx` de 3.766 KB e `.xlsx` de 12 KB. **Cada troca
de arquivo a partir de `pronto` retém ~3,8 MB pela sessão inteira**, e é exatamente o defeito
que `R-ACE-18` foi escrita para impedir.

Nada automatizado o pega — a ESPEC 008 §14 já registrou que não há asserção de memória na
suíte, e o próprio comentário de `page.tsx` antecipou o modo de falha: *"Nada automatizado
pega o esquecimento."* Pegou-se por leitura, ao desenhar este botão.

Isto muda a natureza da entrega: **o botão de limpar não acrescenta uma disposição de recurso,
ele obriga a corrigir a que existe.** Ver `D-05`.

### 2.3 Limpar o estado do React **não limpa o `<input type="file">`**

O rótulo do cartão lê de `arquivos`:

```tsx
{escolhido ? escolhido.name : "escolher arquivo…"}
```

Zerar `arquivos` devolve o texto `escolher arquivo…` — e o elemento do DOM continua com a
seleção anterior em `input.files` e em `input.value`. A tela passa a dizer uma coisa e o
formulário a conter outra.

A consequência prática é o quarto caso da §2.1, e ela é **dependente de navegador**: se
reescolher o mesmo arquivo dispara ou não um novo `change` não está fixado de forma
confiável entre motores. Esta espec não afirma o comportamento de nenhum deles — afirma que
**não se deve depender dele**, e por isso a limpeza alcança o elemento, não só o estado
(`R-LMP-04`). O portão `P1` verifica em navegador real.

### 2.4 O botão nasce dentro de um `<form>`

Desde `R-ACE-07` o envio é um `<form>` com botão `type="submit"`. Um segundo `<button>` sem
`type` explícito lá dentro **é `submit` por omissão do HTML**: clicar em *Limpar* dispararia
uma geração. É defeito de uma palavra, invisível em revisão e imediato em uso — daí `R-LMP-03`
ser regra e não convenção.

---

## 3. Objetivo

Um controle **Limpar** que devolve a aplicação ao estado inicial — sem arquivos, sem
relatório, sem recarregar —, precedido de confirmação, e sem perder o foco de quem opera por
teclado.

**Não é cancelar a geração em curso.** A ESPEC 012 registrou que o trabalho não é cancelável
(`run_sync` não aceita cancelamento; a réplica segue ocupada até o fim, sob o
`CapacityLimiter(1)`). Um botão que sumisse com a tela enquanto o servidor trabalha prometeria
uma interrupção que não acontece — ver `D-02`.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Controle **Limpar**, com confirmação, que devolve a tela ao estado `inicial`.
- Limpeza que alcança o **elemento** de arquivo, não só o estado do React (§2.3).
- Liberação dos dois *blobs* em **todo** caminho que abandona `pronto` — inclusive o de §2.2.
- Foco e anúncio da volta ao estado inicial.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Cancelar a geração em curso | Não é cancelável — ESPEC 012 §10. Oferecer o botão durante `processando` seria prometer o que não se cumpre (`D-02`) |
| Limpar **um** cartão de cada vez | O pedido é recomeçar. Um "x" por cartão é outra interação, com outra afordância e outro alvo de toque, e resolve um problema que ninguém relatou. Registrado em §10 `I-14` |
| Desfazer a limpeza | A aplicação é sem estado (ESPEC 001 §7.2): não há onde guardar o relatório descartado. A defesa contra o engano é a confirmação, e é ela que a origem pediu |
| Pôr o controle na **barra** | `R-CAB-05` — o slot de contexto só existe quando há relatório e só mostra dado real. A ESPEC 008 §13.3 já registrou que uma espec nova seria o pretexto fácil para furá-la. Ver `D-03` |
| Arrastar e soltar, validação de extensão no `onChange` | ESPEC 008 §11 pontos 1 e 3. Continuam abertos e não entram de carona |
| Qualquer camada de `backend/` | Nenhuma. O contrato da API não é tocado |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-LMP-01` | Existe um controle **Limpar** que devolve a aplicação ao estado `inicial`: nenhum arquivo escolhido, nenhum relatório, nenhuma mensagem de erro ou de bloqueio |
| `R-LMP-02` | O controle é exibido **quando há o que limpar** — algum arquivo escolhido **ou** estado diferente de `inicial` — e **nunca durante `processando`** (`D-02`) |
| `R-LMP-03` | O controle é `type="button"`. Dentro do `<form>` de `R-ACE-07`, a omissão o tornaria `submit` e o clique geraria relatório (§2.4) |
| `R-LMP-04` | A limpeza alcança o **elemento** `input[type=file]`, e não apenas o estado do React: depois dela, `input.value` é vazio nos dois cartões (§2.3) |
| `R-LMP-05` | A limpeza só ocorre após **confirmação explícita** do usuário. Fechar, cancelar ou `Esc` **não limpam** — só o acionamento do controle de confirmação limpa |
| `R-LMP-06` | A confirmação nomeia **o que se perde**, e o texto acompanha o que está em risco: havendo relatório gerado, ele diz que o relatório será descartado e que não há como recuperá-lo sem gerar de novo. Ver `D-04` |
| `R-LMP-07` | O diálogo de confirmação é **modal e operável por teclado**: foco vai para dentro dele ao abrir, `Esc` fecha, e o foco não escapa para a página atrás |
| `R-LMP-08` | Ao abrir, o foco pousa no controle **não destrutivo** (*Cancelar*). Confirmação de descarte não pré-seleciona o descarte |
| `R-LMP-09` | Cancelada a confirmação, o foco **volta ao botão Limpar**. Confirmada, o foco vai para o **primeiro campo de upload** — que é onde a próxima ação está, e é o análogo de `R-ACE-15` para o caminho inverso |
| `R-LMP-10` | A volta ao estado inicial é **anunciada**. O invólucro `aria-live` de `R-ACE-13` esvazia nesta transição, e região viva que esvazia não anuncia nada (`D-06`) |
| `R-LMP-11` | **Todo** caminho que abandona `pronto` libera as duas URLs de *blob* — inclusive `selecionar` (§2.2). `R-ACE-18` é revisada na âncora: a liberação deixa de ser "no envio" e passa a ser "ao deixar de haver relatório" |
| `R-LMP-12` | O controle **Limpar** é secundário na hierarquia visual. **Gerar relatório** continua sendo o primário: a ação destrutiva não disputa atenção com a ação do trabalho |
| `R-LMP-13` | Nenhuma regra da ESPEC 008 §5 é enfraquecida. O estado com o diálogo aberto entra nas varreduras `axe` como os quatro já cobertos (§8) |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **O rótulo é *Limpar***, e não *Novo relatório* como a ESPEC 007 §10 propôs | *Novo relatório* promete o que o botão não faz: ele não gera nada, ele descarta. O nome que descreve o efeito é o que impede o clique enganado — e a confirmação de `R-LMP-05` existe justamente porque o efeito é irreversível. Nomear pela promessa e depois avisar do descarte seria corrigir com diálogo um problema criado pelo rótulo |
| `D-02` | **Nada de Limpar durante `processando`** | Um botão presente ali é lido como cancelar, e a ESPEC 012 §10 registrou que a geração **não é cancelável**: a thread termina o trabalho e a réplica fica ocupada até o fim. Limpar a tela sem parar o servidor daria a impressão de ter cancelado — e a resposta chegaria depois, sobre uma tela já limpa. Esconder é mais honesto que desabilitar: controle desabilitado convida a esperar que habilite |
| `D-03` | **O controle mora no formulário**, ao lado de *Gerar relatório* | É onde está o estado que ele apaga e onde o percurso de teclado da ESPEC 008 §6 já termina — entra como Tab ⑤, sem reordenar nada. A barra está descartada por `R-CAB-05`, e o painel de resultado não serve: o botão precisa existir também quando **não há** resultado (arquivos escolhidos e nada gerado) |
| `D-04` | **Dois textos de confirmação**, conforme o que está em risco | Descartar dois arquivos escolhidos e descartar um relatório de ~30 s que talvez não tenha sido baixado não são a mesma perda. Um aviso único teria de escolher entre exagerar no caso leve — o que treina a pessoa a confirmar sem ler, e aí ela confirma sem ler no caso grave — ou minimizar no caso grave. Dois textos custam uma expressão condicional |
| `D-05` | **A liberação dos *blobs* muda de âncora**, e a correção entra **junto** | Não é escopo esticado: a limpeza é mais um caminho que abandona `pronto`, e implementá-la sobre a âncora atual acrescentaria um terceiro lugar para lembrar de liberar. §2.2 mostra que o segundo já foi esquecido. A âncora certa é uma função única de descarte, chamada por `selecionar`, por `enviar` e por `limpar` |
| `D-06` | **A limpeza tem anúncio próprio**, e não confia no `aria-live` de `R-ACE-13` | Aquela região anuncia a **mutação** que traz conteúdo. Na volta a `inicial` o conteúdo **sai**, e região viva que esvazia é silêncio na maioria dos leitores. O foco em `R-LMP-09` ajuda mas não basta: ele anuncia *"Contrato, campo de arquivo"*, que não diz que houve limpeza. É o mesmo raciocínio do `D-03` da ESPEC 008 — regra sobre o mecanismo, porque o atributo sozinho engana |
| `D-07` | **`<dialog>` nativo com `showModal()`**, não `window.confirm()` | `confirm()` custa zero e traz quatro problemas: bloqueia a *thread* principal, não é estilizável, é **suprimível pelo navegador** ("impedir que esta página crie mais caixas de diálogo") — e uma vez suprimido o fluxo quebra em silêncio — e fica fora do DOM, logo fora do `axe` e da comparação de captura que a ESPEC 008 §9.2 fixou como protocolo. O `<dialog>` modal traz de graça o que `R-LMP-07` pede: retenção de foco, `Esc` e inércia do fundo. Sem dependência nova |
| `D-08` | **Remontar o formulário** para zerar os campos de arquivo (`R-LMP-04`) | `input.value = ""` imperativo exige uma `ref` por cartão e sobrevive a qualquer refatoração pior do que remontar. Uma `key` que muda na limpeza devolve dois elementos novos e vazios, sem código de limpeza para manter em sincronia com o número de campos. **Alternativa considerada:** `form.reset()` nativo — funciona, mas a `<form>` vive em `UploadForm` e o estado em `page.tsx`, e expor uma `ref` por essa fronteira custa mais que um contador |
| `D-09` | **Sem confirmação quando não há nada a perder** — resolvido por `R-LMP-02`, não por exceção na confirmação | Confirmar um efeito nulo ensina a confirmar sem ler. Em vez de abrir exceção no diálogo, o botão **não aparece** quando não há o que limpar. Assim toda confirmação exibida corresponde a uma perda real, que é o que a mantém sendo lida |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` · `api/` | **Nenhuma** |
| `frontend/src/lib/types.ts` | **Nenhuma.** `Estado` já tem `inicial`; limpar é uma transição para um estado que existe |
| `frontend/src/lib/api.ts` | **Nenhuma** |
| `frontend/src/app/page.tsx` | Função única de descarte dos *blobs* (`D-05`), chamada por `selecionar`, `enviar` e `limpar`; contador de remontagem (`D-08`); estado de abertura do diálogo |
| `frontend/src/app/components/UploadForm.tsx` | Botão **Limpar** ao lado do primário (`R-LMP-01`, `03`, `12`) e o gatilho da confirmação |
| `frontend/src/app/components/ConfirmarLimpeza.tsx` | **Novo.** O `<dialog>` de `D-07`, com os dois textos de `D-04` e o foco de `R-LMP-08` |
| `frontend/src/app/components/Barra.tsx` · `ResultadoPanel.tsx` | **Nenhuma** — `R-CAB-05` preservada, `D-03` |
| `frontend/e2e/estados.ts` | Um estado novo: diálogo aberto, para as varreduras de `R-LMP-13` |
| `frontend/e2e/limpar.spec.ts` | **Novo.** §8 |

Um arquivo novo de componente, um de teste. **Nenhuma dependência nova** — `<dialog>` é do
navegador. O *bundle* entregue não ganha biblioteca alguma, o que mantém a emenda 1 da
ESPEC 008 §14.2 válida.

Esboço da função de descarte, para fixar a forma e não a sintaxe:

```tsx
// D-05 — a âncora deixa de ser "no envio" e passa a ser "ao deixar de haver
// relatório". Os três caminhos que abandonam `pronto` chamam esta função.
function descartar(estado: Estado) {
    if (estado.situacao !== "pronto") return;
    URL.revokeObjectURL(estado.urlDocx);
    URL.revokeObjectURL(estado.urlAnalise);
}
```

---

## 8. Testes e critério de aceite

### 8.1 Playwright — `e2e/limpar.spec.ts`

| Regra | Verificação |
|---|---|
| `R-LMP-01` | Estando em `pronto`, confirmar a limpeza faz sumir *Relatório gerado*, *Baixar DOCX*, o painel de análise e o grid, e os dois cartões voltam a `escolher arquivo…` |
| `R-LMP-02` | *Limpar* **não existe** no estado inicial sem arquivos; **existe** com um arquivo escolhido; **não existe** durante `processando` — este último com a resposta segurada por `route`, como `timeout.spec.ts` já faz |
| `R-LMP-03` | Clicar *Limpar* **não** dispara requisição a `/reports`. É o teste que pega o `type` omitido, e ele falha de forma barulhenta se a regra for esquecida |
| `R-LMP-04` | Depois de limpar, `input.value` é `""` nos dois campos — **avaliado no elemento**, não no rótulo. Asserir o rótulo passaria com o defeito de §2.3 presente |
| `R-LMP-05` | *Cancelar* e `Esc` deixam a tela **intacta**: o relatório continua, os arquivos continuam. Dois casos, porque `Esc` percorre outro caminho no `<dialog>` |
| `R-LMP-06` | Em `pronto` a confirmação menciona o relatório; com apenas arquivos escolhidos, não menciona |
| `R-LMP-08` | Com o diálogo aberto, `document.activeElement` está **dentro** dele e é o controle de cancelar |
| `R-LMP-09` | Cancelando, o foco volta ao botão *Limpar*; confirmando, o foco está no primeiro `input[type=file]` |
| `R-LMP-10` | A mensagem de limpeza está presente após a confirmação |
| `R-LMP-13` | `axe` sem violações A/AA com o diálogo aberto, nas duas larguras (1366 e 390) que a ESPEC 008 §14.3 tornou obrigatórias |

### 8.2 Regressão

| Verificação | Critério |
|---|---|
| `smoke.spec.ts` e `timeout.spec.ts` | **Passam sem alteração.** Nada muda no caminho de gerar; o botão novo não entra em nenhum seletor existente |
| Percurso de teclado da ESPEC 008 §6 | Os 8 passos continuam verdes. O novo controle **acrescenta** um Tab depois do primário, não reordena |
| Comparação de captura, 1366 × 768 e 390 px | A única diferença admitida no estado `pronto` e nos com arquivo escolhido é o botão novo. `inicial` sem arquivos fica **idêntico** — é o que `R-LMP-02` garante, e é a asserção mais barata de todas |
| `tsc --noEmit` · `next lint` · `next build` | Limpos |
| Backend | **Não tocado.** A contagem de testes não muda |

### 8.3 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **§2.3 verificada em navegador** | Limpar, reescolher **o mesmo arquivo** e ver a seleção reaparecer — em Chrome e em Firefox. É o caso que a §2.3 se recusou a afirmar de memória, e o único que `R-LMP-04` existe para garantir |
| `P2` | **O vazamento de §2.2 fechado** | Em `pronto`, trocar um arquivo e confirmar no *DevTools* que as duas URLs anteriores deixaram de resolver. Não há asserção automatizada para isto — a ESPEC 008 §14 já registrou por quê —, então é verificação humana ou não é verificação |

`P2` não é opcional e não é conferência de rotina: é a única prova de que `R-LMP-11` corrigiu
o defeito em vez de acrescentar um quarto caminho a lembrar.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Limpar por engano, com o relatório não baixado** | É o risco central, e é o que a origem pediu para tratar. `R-LMP-05` exige confirmação, `R-LMP-06` nomeia a perda, `R-LMP-08` não pré-seleciona o descarte e `D-09` garante que toda confirmação exibida corresponda a uma perda real — que é o que a mantém sendo lida |
| **O `type` omitido transformar Limpar em Gerar** | `R-LMP-03` como regra e um teste dedicado. É o defeito de uma palavra que revisão não pega |
| **Limpar durante `processando` parecer cancelamento** | `D-02` esconde o controle. O risco só volta se alguém "melhorar" mostrando-o desabilitado |
| **Foco perdido no `<body>`** ao confirmar, já que o botão desaparece | É o mesmo modo de falha do `D-04` da ESPEC 008, e a resposta é a mesma: mover o foco explicitamente (`R-LMP-09`). Sem isso a pessoa que operava por teclado recomeça do zero, no exato momento em que a espec deveria estar poupando-a de recarregar |
| **A limpeza anunciar silêncio** | `D-06`. É o erro sutil desta espec, o análogo do `D-03` da 008, e nenhum teste visual o acusa — daí `R-LMP-10` ser sobre a mensagem, e não sobre o atributo |
| **O `<dialog>` escapar da varredura de acessibilidade** por ser um estado que `estados.ts` não monta | `R-LMP-13` e o estado novo em `e2e/estados.ts`. Um modal fora do inventário é a forma mais comum de conformidade presumida |
| **A correção de §2.2 mudar comportamento observável** | Não muda: liberar uma URL que nada mais referencia é invisível para a tela. Se algo quebrar, é sinal de que havia uma referência que não deveria existir |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-14` | Limpar **um** cartão de cada vez tem uso real, ou trocar o arquivo já resolve? | Não. Fora do escopo por §4.2. Só ganha peso se o campo de upload crescer para além de dois |
| `I-15` | A limpeza deve ocorrer sem confirmação quando **nada** foi gerado — só arquivos escolhidos? `D-09` decidiu por confirmar sempre que o botão aparece, e `D-04` já suaviza o texto | Não. Decide-se com uso, não com argumento. Se a confirmação leve virar clique automático, ela deixou de valer o que custa |
| `I-16` | O relatório deveria ser retido ao trocar de arquivo, em vez de a tela voltar a `inicial` no primeiro `selecionar`? Hoje o resultado some ao tocar num cartão, e é discutível | Não. É comportamento anterior a esta espec, e mudá-lo aqui misturaria duas decisões. Registrado porque §2.2 esbarrou nele |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `descartar()` e as três chamadas — fecha §2.2 e `R-LMP-11` | PP |
| B | Botão *Limpar*, visibilidade e `type` (`R-LMP-01`, `02`, `03`, `12`) | PP |
| C | `ConfirmarLimpeza.tsx` — modal, dois textos, foco (`R-LMP-05` a `09`) | P |
| D | Remontagem e anúncio (`R-LMP-04`, `10`) | PP |
| E | `limpar.spec.ts`, estado novo em `estados.ts`, varredura `axe` | P |
| F | `P1` e `P2` — navegador real, dois motores | PP |

**Total: meio dia.** O que torna barato é não haver estado novo a inventar: `inicial` já existe
em `Estado` e a tela já sabe renderizá-lo. O que exige atenção é o foco e o anúncio — as duas
coisas que a ESPEC 008 provou que passam despercebidas até alguém escrever a regra.

A fase A vale por si e pode entrar antes das outras: ela corrige um defeito que existe hoje,
independentemente de o botão ser aprovado.

---

## 12. Relação com as especs anteriores

### 12.1 ESPEC 007 e 008 — a pergunta aberta é fechada

ESPEC 007 §10 ponto 4 e §347 ponto 3, e ESPEC 008 §11 ponto 6, registram o mesmo controle
como pendente. Esta espec o decide, e decide **contra** a proposta original em dois pontos:
o nome (`D-01`) e o lugar (`D-03`) — a barra está descartada por `R-CAB-05`, que a própria
ESPEC 008 §13.3 apontou como o principal ativo do desenho da barra.

### 12.2 ESPEC 008 — `R-ACE-18` revisada na âncora

> Cada *blob* de documento é **liberado** (`URL.revokeObjectURL`) quando substituído por outro.

A intenção está certa e a implementação a cumpre pela metade: §2.2 mostra um caminho de
substituição que não libera. Redação proposta:

> Cada *blob* de documento é liberado quando a aplicação deixa de ter relatório — por envio,
> por troca de arquivo ou por limpeza. A liberação é de responsabilidade **única**, e não de
> cada caminho.

Nenhuma outra regra da ESPEC 008 é alterada. `R-ACE-13`, `R-ACE-15` e `R-ACE-06` são
**estendidas** ao controle novo pelas regras `R-LMP-10`, `R-LMP-09` e `R-LMP-08`, que é o que
a §13.4 daquela espec estabeleceu para toda espec futura que acrescentasse controle ou estado.

### 12.3 ESPEC 012 — o motivo de não haver cancelamento

`D-02` se apoia inteiramente na §10 da ESPEC 012: `run_sync` não é cancelável e a réplica fica
ocupada até o fim. A decisão de esconder o botão durante `processando` não é preferência de
interface — é a única leitura honesta do que o servidor faz.

---

## 14. Emendas da implementação — 2026-08-12

Cinco afirmações desta espec não sobreviveram ao contato com o código. Registradas, não
contornadas — conduta da ESPEC 007 §13.

### 14.1 O `P2` era automatizável, e virou o teste que define a entrega

A §8.3 declarou o vazamento como verificação **humana**: *"não há asserção automatizada para isto
— a ESPEC 008 §14 já registrou por quê"*.

**A premissa herdada não se aplicava.** A ESPEC 008 falava de *memória retida*, que a suíte de
fato não vê. A pergunta aqui é outra e é discreta: *aquele identificador ainda resolve?* Depois de
`revokeObjectURL`, não resolve — e o `href` de *Baixar DOCX* **é** o identificador, exposto no DOM.

O `e2e/vazamento.spec.ts` fecha isso em três testes, e o portão mudou de natureza: saiu do fim da
entrega e virou o **primeiro** a fechar.

| | Resultado |
|---|---|
| Contra o código anterior | **Reprovou** — `[true, true]` onde exigia `[false, false]` |
| Depois da correção | **Passou** |
| O instrumento é cego? | Não — o teste que revoga à mão acerta os dois lados |

Emenda aplicada também na ESPEC 008 §15, que é onde `R-ACE-18` mora.

### 14.2 A `D-08` remonta demais, e o escopo certo são **os campos**

`D-08` decidiu remontar *"o formulário"* por `key`. Remontá-lo inteiro destruiria também o botão
*Limpar*, o diálogo e a região que anuncia — no exato instante em que o foco está sendo movido, e
justamente onde `R-LMP-10` esbarra no `D-03` da ESPEC 008: uma região viva que **nasce junto com o
conteúdo** é inserção, não mutação, e não anuncia.

A `key` foi para os **dois campos de arquivo**; o diálogo e a região de status moram em `page.tsx`,
fora dela. É a mesma armadilha do `D-03`, alcançada por um caminho novo.

### 14.3 `role="status"`, não `aria-live="polite"`

A implementação intuitiva de `R-LMP-10` seria repetir o atributo do `ResultadoPanel`. Isso
**quebraria** o teste T-416 da ESPEC 008, que conta `[aria-live="polite"]` esperando **um**.

`role="status"` implica a região viva sem acrescentar o atributo: mesma semântica, contagem
intacta. Um teste novo (`R-LMP-13`) registra a razão antes que alguém "corrija".

### 14.4 O texto do diálogo não pode conter a sequência "relatório gerado"

A primeira redação dizia *"O relatório gerado será descartado"*. `getByText` com string casa por
**substring e sem diferenciar maiúsculas**, e `estados.ts` e `smoke.spec.ts` esperam o resultado com
`getByText("Relatório gerado")`: o localizador passou a resolver **dois** elementos e derrubou as
duas suítes em modo estrito.

Corrigida a redação, não o localizador — mexer no auxiliar afetaria sete suítes por causa de uma
frase. Fica o registro: **qualquer texto novo de tela que contenha essa sequência derruba sete
suítes**, e a mensagem de erro não diz isso; diz *"strict mode violation"*.

### 14.5 O botão secundário cresce a página em 2 px

Não previsto. O secundário tem `border` e o primário não: 1 px em cima e 1 embaixo. Em `pronto` e
`bloqueado` a página cresce 2 px; em `erro` a 1366 px **não cresce** — ali o conteúdo é menor que a
viewport e o `flex-1` do `<main>` absorve, o que empurra tudo abaixo do botão e produz diferença de
pixels **sem** diferença de altura.

É a quinta exceção de aparência sancionada do projeto, na linha das quatro do TASKS 008 §1.1.
`inicial` e `processando` saem **idênticas** nas duas larguras, que é o que `R-LMP-02` e `D-02`
precisavam provar.

---

## 15. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-11 | Redação inicial. A §2.2 mudou o escopo depois de escrita: o que começou como "um botão e um diálogo" passou a incluir a correção da âncora de `R-ACE-18`, porque a limpeza seria o **terceiro** caminho a lembrar de liberar os *blobs* e o segundo já estava esquecido |
| 1.1 | 2026-08-12 | **Implementada.** `P1` e `P2` fechados. Cinco emendas em §14, sendo a §14.1 a que mais muda o método: o portão declarado humano era automatizável, e virou o teste que teve de falhar primeiro |