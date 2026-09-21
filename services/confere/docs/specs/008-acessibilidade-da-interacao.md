# ESPEC 008 — Acessibilidade da camada de interação

| | |
|---|---|
| **Status** | **Implementada, com o portão P2 pendente de insumo — ver §14** |
| **Versão** | 1.1 — 2026-08-07 — implementada; três emendas e um defeito que o P3 pegou (§14) |
| **Depende de** | [ESPEC 002](002-painel-de-divergencias.md), [ESPEC 005](005-identidade-confere.md), [ESPEC 006](006-rodape-institucional.md), [ESPEC 007](007-barra-de-aplicacao.md) — todas implementadas |
| **Revisa** | `R-UI-04` e `R-UI-08` da ESPEC 002 — ver §13 |
| **Referência normativa** | WCAG 2.1 nível AA |

---

## 1. Problema

A identidade desta aplicação foi auditada com rigor incomum. A ESPEC 005 §D-04 amostrou cor dos
pixels do logo e calculou contraste WCAG antes de promover um token; a ESPEC 006 §3 mediu 11,23:1 no
rodapé e recusou a imagem do modelo em favor de texto vivo justamente por causa do leitor de tela;
a ESPEC 007 discutiu o nome acessível do `<h1>` em uma seção própria.

**Nada disso alcançou a parte da tela que o usuário opera.**

A marca é acessível. O formulário, o painel de resultado e o grid de divergências — os três
elementos que existem para fazer o trabalho — não são. A auditoria parou onde a atenção estava, e a
atenção estava na identidade, porque foi ali que houve espec.

O resultado é uma tela que **não pode ser operada por teclado com confiança** e que **não diz nada a
quem não vê**, num produto cuja saída instrui faturamento de contrato público.

---

## 2. O que foi medido

Nada aqui é lembrança. Duas medições, sobre o código em `feature/evolucao`.

### 2.1 A busca que não devolve nada

```
grep -rn "focus:|focus-visible|aria-live|role=|tabIndex|<form" frontend/src/
→ 0 ocorrências
```

Existem seis `aria-hidden` — todos corretos, todos em divisores e ícones decorativos da barra e do
rodapé, todos herdados das ESPECs 006 e 007. **Fora deles, a camada ARIA da aplicação é vazia.** Não
há um estilo de foco, uma região viva, um `role`, um `scope`, um `<form>` sequer.

### 2.2 O contraste do token cinza

`navy-300` = `#628A93`. Calculado pela fórmula WCAG 2.1 (luminância relativa, coeficientes
0,2126 / 0,7152 / 0,0722):

| Par renderizado | Contraste | AA texto (4,5:1) |
|---|---|---|
| `navy-300` sobre `surface` `#F4F7F8` | **3,50:1** | ❌ |
| `navy-300` sobre branco | **3,77:1** | ❌ |
| `navy-300` sobre `teal-50/40` | **3,57:1** | ❌ |
| `navy-300` sobre `navy-100` — botão desabilitado | **2,60:1** | ❌ |

O restante da paleta é sólido e não é questionado por esta espec:

| Par | Contraste | |
|---|---|---|
| `navy-800` sobre branco | 16,22:1 | ✅ |
| `navy-600` sobre branco | 10,47:1 | ✅ |
| `teal-700` sobre `teal-50` | 10,21:1 | ✅ |
| branco sobre `teal-500` | 7,05:1 | ✅ |

**O problema é um token, não a paleta.** `navy-300` tem **8 usos**, e carrega o parágrafo de abertura
da tela, as descrições dos dois campos de upload, o rótulo `escolher arquivo…`, o texto do botão
desabilitado, o subtítulo do grid, a coluna **Unidade** e — o pior caso — o cabeçalho das tabelas, a
11 px.

### 2.3 O silêncio dura até um minuto

`frontend/e2e/smoke.spec.ts` espera o resultado com `timeout: 90_000`. O número não é folga
defensiva: o backend extrai 60 linhas de PDF, reconcilia 55, monta 19 anexos e serializa ~41 páginas
de DOCX.

Durante essa espera o único sinal na tela é o rótulo do botão virar `Processando…`. Não há região
viva: quem usa leitor de tela clica e recebe **silêncio absoluto por até noventa segundos**, sem ter
como distinguir processamento de travamento.

---

## 3. Objetivo

Levar a camada de interação ao mesmo nível de conformidade que a camada de identidade já alcançou:
**WCAG 2.1 AA verificável**, em regras testáveis, sem redesenhar a tela.

A restrição de desenho é deliberada e vale como critério: **nenhuma regra desta espec deve alterar o
layout.** O que muda é semântica, foco, anúncio e um valor de cor. Se uma mudança exigir redesenho,
ela não pertence aqui — pertence a §11.

---

## 4. Não-objetivos

| Fora | Motivo |
|---|---|
| Nível AAA | Contraste 7:1 e alvo de 44 px reprovariam a paleta TRIADE inteira e a densidade do grid. AA é a régua do setor público, e é a que a ESPEC 005 já usou |
| Tema escuro | Não é requisito de acessibilidade e dobra a superfície de verificação de contraste |
| Layout de cartões no celular | O grid de seis colunas em 390 px é problema real, mas de desenho — §11, ponto 2 |
| Filtro e ordenação do grid | Funcionalidade nova. `R-UI-05` decidiu conscientemente por nenhuma paginação e nenhuma busca |
| Arrastar e soltar | A `R-ACE-13` resolve a afordância enganosa **removendo a promessa**, não implementando a função — ver D-08 |
| Acessibilidade do `.docx` gerado | Documento é outro artefato, com outra norma. §11, ponto 4 |
| Auditoria do backend | Nenhuma camada de `backend/` é tocada |

---

## 5. Regras

### 5.1 Percepção

| ID | Regra |
|---|---|
| `R-ACE-01` | Nenhum token usado em **texto** fica abaixo de **4,5:1** contra o fundo em que é efetivamente renderizado — não contra um fundo hipotético. Vale inclusive para texto de controle desabilitado, que a norma isenta mas que aqui é o **estado inicial** do botão primário |
| `R-ACE-02` | Nenhuma informação é transmitida **só por cor**. O destaque do saldo negativo (`R-UI-08`) ganha portador textual |
| `R-ACE-03` | O atributo `title` **não é o único portador** de informação em lugar nenhum da interface. Ele não abre por teclado, não existe em toque e é lido de forma inconsistente |

### 5.2 Operação por teclado

| ID | Regra |
|---|---|
| `R-ACE-04` | Todo elemento acionável tem indicador de foco **visível**, com no mínimo 3:1 contra o fundo adjacente. Inclui o `input[type=file]`, que é `sr-only` e cujo foco hoje não aparece em lugar nenhum |
| `R-ACE-05` | Todo contêiner com rolagem horizontal é **focável** (`tabIndex={0}`) e tem nome acessível. Sem isso as colunas **Quantidade Medida** e **Saldo** ficam inalcançáveis para quem não usa mouse |
| `R-ACE-06` | Nenhum controle recebe `disabled` **enquanto está com foco**. Onde o estado desabilitado coincide com o foco, usa-se `aria-disabled` com guarda no manipulador |
| `R-ACE-07` | O envio é um `<form>` com botão `type="submit"`: **Enter envia** |
| `R-ACE-08` | O primeiro elemento focável do documento é um **link de pulo** para o conteúdo, que salta a barra fixa |

### 5.3 Compreensão por software

| ID | Regra |
|---|---|
| `R-ACE-09` | Toda `<table>` tem **nome acessível** e todo `<th>` de coluna tem `scope="col"` |
| `R-ACE-10` | Os títulos de grupo e de seção do grid são **cabeçalhos reais** (`<h3>`/`<h4>`), **sem alteração de pixel** — a estrutura hoje existe para o olho e não para o software |
| `R-ACE-11` | O nome acessível de cada campo de upload é **o rótulo do campo, e nada mais**. Descrição e arquivo escolhido vão por `aria-describedby` |
| `R-ACE-12` | A hierarquia de cabeçalhos é contínua: `<h1>` na barra, `<h2>` por bloco de resultado, `<h3>`/`<h4>` no grid. Nenhum cabeçalho de situação grave é menor que o de situação comum |

### 5.4 Mudança de estado

| ID | Regra |
|---|---|
| `R-ACE-13` | A transição para `pronto`, `bloqueado` e `erro` é **anunciada**. A região viva é **montada desde o primeiro render**, mesmo vazia — ver D-03 |
| `R-ACE-14` | `erro` e `bloqueado` usam `role="alert"`; `pronto` usa `aria-live="polite"` |
| `R-ACE-15` | Ao término do processamento o **foco vai para o título do resultado** |
| `R-ACE-16` | Durante o processamento a tela informa que está trabalhando e **quanto pode demorar**, sem prometer progresso que não mede. A `R-CAB-05` continua valendo: o indicador fica no formulário, **nunca na barra** |
| `R-ACE-17` | Afordância corresponde a comportamento: borda tracejada **só onde o arraste funciona** |

### 5.5 Higiene que a espec aproveita para fechar

| ID | Regra |
|---|---|
| `R-ACE-18` | Cada blob de documento é liberado quando a aplicação **deixa de ter relatório** — por envio, por troca de arquivo ou por limpeza. A liberação é de responsabilidade **única**, e não de cada caminho. *Revisada na âncora pela [ESPEC 015](015-limpar-para-recomecar.md) — ver §15* |
| `R-ACE-19` | O nome do arquivo baixado identifica **contrato e competência** |
| `R-ACE-20` | Mensagens de erro voltadas ao usuário começam em maiúscula |

---

## 6. Estrutura

O que muda não se desenha em wireframe — o layout é o mesmo. O que muda é o **percurso**.

**Hoje** — percurso de teclado a partir do carregamento:

```
Tab ①  → input Contrato        · foco INVISÍVEL (sr-only, sem focus-within)
Tab ②  → input Levantamento    · foco INVISÍVEL
Tab ③  → botão                 · disabled, PULADO enquanto falta arquivo
                                  Enter no formulário: NADA acontece
[clique]
         → botão vira disabled com o foco dentro
           foco cai no <body>, posição perdida
         → … até 90 s de silêncio absoluto …
         → resultado monta: NENHUM anúncio
Tab ④  → link "Baixar DOCX"
         (as colunas Medida e Saldo do grid: INALCANÇÁVEIS — rolagem não focável)
```

**Proposto:**

```
Tab ①  → "Pular para o conteúdo"   · aparece ao receber foco          R-ACE-08
Tab ②  → input Contrato            · anel de foco no cartão           R-ACE-04
                                     nome acessível: "Contrato"       R-ACE-11
Tab ③  → input Levantamento        · idem
Tab ④  → botão                     · aria-disabled, FOCÁVEL           R-ACE-06
                                     Enter envia                      R-ACE-07
[Enter]
         → botão mantém o foco, aria-busy
           "Processando… pode levar até um minuto"                    R-ACE-16
         → resultado monta → região viva ANUNCIA                      R-ACE-13/14
           foco vai para <h2> "Relatório gerado"                      R-ACE-15
Tab ⑤  → link "Baixar DOCX"        · confere-TC-52-2026-07.docx       R-ACE-19
Tab ⑥  → região rolável da 1ª tabela · nome: seção; setas rolam       R-ACE-05
```

---

## 7. Decisões de engenharia

### D-01 — A auditoria parou onde havia espec

Não é acaso que a marca esteja conforme e o formulário não. A ESPEC 005 mediu contraste porque
**alguém escreveu que mediria**. Onde não houve espec, não houve régua — e o formulário, o painel e
o grid nasceram nas ESPECs 001 e 002, que trataram de domínio, reconciliação e correspondência com o
PDF, não de interação.

Isto está registrado porque é a lição transferível: acessibilidade não sobrevive por diligência
difusa. Ela sobrevive quando vira regra numerada e critério de aceite — que é o que esta espec faz.

### D-02 — Um valor de cor, oito usos, nenhum redesenho

`navy-300` foi verificado uso a uso: **os 8 são `text-`**. Nenhum é borda, nenhum é fundo. Isso
significa que escurecer o token é seguro e **não pede token companheiro** — não há elemento
decorativo que dependa do valor claro e que ficaria pesado demais.

Valor proposto: **`#4E747E`**.

| Fundo | `#628A93` atual | `#4E747E` proposto |
|---|---|---|
| `surface` `#F4F7F8` | 3,50:1 ❌ | **4,73:1** ✅ |
| branco | 3,77:1 ❌ | **5,09:1** ✅ |
| `teal-50/40` | 3,57:1 ❌ | **4,83:1** ✅ |

É o menor deslocamento que passa AA nos **três** fundos com folga — e a folga importa, pela mesma
razão que a ESPEC 005 §D-04 criou o `green-ink`: margem de 0,09 não sobrevive a monitor ruim.

O texto do botão desabilitado, sobre `navy-100`, não se resolve pelo token — ele vira `navy-600`,
que dá **7,24:1** contra os 2,60:1 de hoje.

**Alternativa descartada:** manter o token e aumentar o corpo do texto para 18 px, que rebaixaria a
exigência para 3:1. Reprovaria mesmo assim no cabeçalho da tabela, e engordaria a tela que a
ESPEC 007 passou uma versão inteira tentando adelgaçar.

### D-03 — A região viva precisa nascer vazia

O ponto mais sutil desta espec, e o único com risco real de ser implementado errado.

`ResultadoPanel` hoje devolve `null` no estado inicial. Envolver o conteúdo em `aria-live` **por
dentro** desse retorno não funciona: leitores de tela anunciam a **mutação** de uma região viva já
presente na árvore. Uma região que entra na árvore junto com seu conteúdo não é mutação — é
inserção, e o anúncio **não dispara de forma confiável em nenhum leitor**.

Portanto o invólucro `aria-live` é montado **sempre**, desde o primeiro render, e o conteúdo
condicional passa a viver dentro dele. É uma inversão de duas linhas cujo esquecimento produz
exatamente o sintoma que a `R-ACE-13` existe para eliminar — e que **não aparece em teste visual
nenhum**. Daí a regra ser explícita quanto à montagem, e não só quanto ao atributo.

### D-04 — `aria-disabled` no lugar de `disabled`

Desabilitar um elemento que está com foco joga o foco para o `<body>` no Chrome e no Safari. O
usuário perde a posição na página **no exato instante em que a espera começa** — e a espera pode
chegar a 90 s (§2.3).

`aria-disabled` mantém o botão na ordem de tabulação e no leitor de tela, anunciando-o como
indisponível. O custo é que a inibição deixa de ser do navegador e passa a ser do código: a guarda
vai para o manipulador de envio. É uma linha, e é onde ela deve estar de qualquer forma, já que
`R-ACE-07` introduz o `<form>` e o Enter também precisa ser barrado.

### D-05 — O `title` sai; a legenda entra, visível e única

Duas informações estão hoje presas em `title`: a marca **perfil** e o significado do saldo negativo.

A do perfil é a mais séria. `R-DIV-04` a criou porque **um banco de dados contratado no perfil D e
medido no perfil C aparece como se não houvesse diferença** — é a ressalva que impede concluir
"confere" quando não confere. Deixá-la num mecanismo que não existe em toque, não abre por teclado e
não é lido de forma confiável é o oposto do que a regra pretendia.

A proposta é uma **legenda visível abaixo do título do grid**, explicando as duas marcas uma vez só.
Ganha o leitor de tela, ganha quem usa tablet, e ganha o usuário de mouse que hoje só descobre a
ressalva se por acaso repousar o cursor sobre a etiqueta certa.

**Alternativa descartada:** tooltip acessível de verdade — `<button>` com `aria-describedby`, foco,
`Esc` para fechar. Resolve a norma e custa mais código do que a legenda, para exibir **duas frases
fixas** que não dependem da linha. Informação que é a mesma em todas as linhas não pertence à linha.

### D-06 — Cabeçalhos reais, mesmo pixel

As faixas navy de grupo e seção são `<div>`. Elas **já têm peso tipográfico de cabeçalho**, já
carregam a hierarquia do relatório e já são o que permite conferir uma linha do grid contra a mesma
linha do PDF (`R-DIV-03`). São cabeçalhos em tudo menos no elemento.

Trocar `<div>` por `<h3>`/`<h4>` mantendo as mesmas classes **não muda um pixel** — Tailwind já
normaliza o `font-size` do heading — e devolve navegação por cabeçalhos num grid de 22 seções, que é
o modo como leitor de tela percorre documento longo.

É o mesmo raciocínio da ESPEC 007 §291: quem navega por cabeçalhos deve ouvir a estrutura que existe.

### D-07 — O extracontratual sobe

Único ajuste de ordenação, e não é de acessibilidade — é de gravidade.

`R-DIV-05` colocou os itens medidos **sem previsão contratual** em bloco próprio "ao final". Em
produção isso significa: depois de 22 seções e 36 linhas. Mas medir o que não foi contratado é o
achado que **mais compromete o faturamento** — mais que uma quantidade divergente, porque não há
linha de contrato para sustentá-lo.

A proposta inverte: o bloco vem **logo abaixo da legenda**, antes das seções. `R-DIV-05` continua
valendo em tudo — bloco próprio, só com medição maior que zero, rótulo "não constam no Contrato" —,
muda só a posição.

**Alternativa descartada:** manter ao final e criar uma âncora no resumo. Adiciona um controle para
compensar uma ordenação que pode simplesmente estar certa.

### D-08 — Borda sólida: retirar a promessa é mais honesto que cumpri-la

Os dois cartões de upload usam `border-dashed`. Tracejado é a convenção universal de área de
arraste. **Arrastar um arquivo ali não faz nada** — e o usuário que tenta não recebe erro, recebe
inércia, que é pior porque não ensina.

Há duas saídas honestas, e esta espec escolhe a segunda:

| Saída | Efeito |
|---|---|
| Implementar `onDragOver`/`onDrop` | ~15 linhas, mais tratamento de arquivo inválido e estado visual de arraste. Funcionalidade nova, com superfície de teste própria |
| **Trocar para borda sólida** | Uma palavra. A afordância passa a descrever o que o componente faz |

O arraste é bem-vindo, mas como incremento com sua própria espec — não embutido numa entrega de
conformidade, onde ele seria a única mudança capaz de introduzir defeito funcional. Fica em §11,
ponto 1.

### D-09 — O que esta espec não conserta com `sr-only`

Texto para leitor de tela é ferramenta legítima e a espec usa três (`R-ACE-02`, `R-ACE-09`,
`R-ACE-11`). Mas `sr-only` **não é lugar de estacionar problema visual**.

O contraste de §2.2 poderia ser "resolvido" duplicando o texto em `sr-only` e deixando o cinza como
está. Seria conformidade de auditoria e nenhuma melhoria para o usuário com baixa visão, que é
quem o defeito atinge. Por isso `R-ACE-01` exige a mudança de **cor**, não de marcação.

Regra de bolso adotada: `sr-only` acrescenta contexto que o layout já dá aos olhos. Nunca substitui
o layout.

---

## 8. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` · `application/` · `infrastructure/` · `api/` | **Nenhuma** |
| `frontend/src/lib/types.ts` | **Nenhuma** |
| `frontend/tailwind.config.ts` | `navy.300` → `#4E747E`, com o cálculo em comentário, como a ESPEC 005 fez com `brand` |
| `frontend/src/app/globals.css` | Regra `:focus-visible` global — não existe nenhuma hoje (`R-ACE-04`) |
| `frontend/src/app/layout.tsx` | Link de pulo como primeiro filho do `<body>` (`R-ACE-08`) |
| `frontend/src/app/page.tsx` | `id="conteudo"` no `<main>`; `revokeObjectURL` antes de novo envio (`R-ACE-18`) |
| `frontend/src/app/components/UploadForm.tsx` | `<form>`, `focus-within`, `aria-label`/`aria-describedby`, `aria-disabled`, `aria-busy`, indicador de atividade, borda sólida |
| `frontend/src/app/components/ResultadoPanel.tsx` | Invólucro `aria-live` sempre montado (D-03), `role="alert"`, foco no título, hierarquia de `<h2>`, nome do arquivo |
| `frontend/src/app/components/DivergenciaGrid.tsx` | `scope`, `aria-labelledby`, rolagem focável, `<h3>`/`<h4>`, legenda, ordem do bloco extracontratual, chave de seção por índice |
| `frontend/src/app/components/Barra.tsx` | **Nenhuma** — já conforme desde a ESPEC 007 |
| `frontend/src/app/components/Rodape.tsx` | **Nenhuma** — já conforme desde a ESPEC 006 |
| `frontend/e2e/smoke.spec.ts` | Uma asserção — ver §9.3 |

Nenhum arquivo novo. Nenhuma dependência nova. **O backend não é tocado.**

---

## 9. Testes e critério de aceite

### 9.1 Automatizável no Playwright

| Regra | Verificação |
|---|---|
| `R-ACE-04` | Após dois `Tab` a partir do carregamento, `document.activeElement` está no primeiro `input[type=file]` **e** o cartão tem `outline`/`ring` com largura computada > 0 |
| `R-ACE-05` | Cada `div[role=region]` do grid tem `tabIndex = 0` e nome acessível não vazio |
| `R-ACE-06` | Durante o processamento o botão **permanece** em `document.activeElement` e tem `aria-disabled="true"` |
| `R-ACE-07` | `Enter` com os dois arquivos escolhidos dispara o envio |
| `R-ACE-08` | O primeiro focável do documento tem `href="#conteudo"` e sai de `sr-only` ao receber foco |
| `R-ACE-09` | Todo `th` do grid tem `scope="col"`; toda `table` tem nome acessível |
| `R-ACE-10` | Existe ao menos um `h4` cujo texto é o título de seção; a contagem de `h3`+`h4` iguala grupos + seções |
| `R-ACE-13` | O invólucro `aria-live` existe no DOM **no estado inicial**, antes de qualquer envio — é o teste que pega o erro de D-03 |
| `R-ACE-15` | Após o resultado, `document.activeElement` é o `h2` do painel |
| `R-ACE-19` | `suggestedFilename()` casa `/^confere-.+\.docx$/` |

### 9.2 Verificação medida, no *build* de produção

Mesmo protocolo da ESPEC 005 §8 e da ESPEC 007 §13 — navegador real, não estimativa.

| Verificação | Critério |
|---|---|
| Contraste computado de cada texto em `navy-300` | **≥ 4,5:1** contra o fundo real, medido do `getComputedStyle` de ambos |
| Contraste do texto do botão desabilitado | **≥ 4,5:1** |
| Varredura `axe-core` em `inicial`, `processando`, `pronto`, `bloqueado` | **zero violações** de nível A e AA |
| `title` como portador único | **zero ocorrências** em `frontend/src/` (`R-ACE-03`) |
| Percurso completo por teclado, sem mouse | Escolher dois arquivos, enviar, ler o grid e baixar o DOCX — **executável de ponta a ponta** |
| Leitor de tela (NVDA ou Narrator) | O anúncio de conclusão é ouvido; a coluna **Saldo** é lida com o cabeçalho associado |
| Layout | Captura em 1366 × 768 e 390 px **idêntica** à anterior, salvo cor de texto e legenda — §3 |
| Regressão | Os dois `input[type=file]` e o botão "Gerar relatório" seguem presentes, com os mesmos nomes acessíveis |

O critério de layout idêntico é o que impede esta espec de virar redesenho por dentro.

### 9.3 Impacto no teste de fumaça

Uma asserção quebra, e é a única:

```diff
- expect(arquivo.suggestedFilename()).toBe("levantamento-comprovacao.docx");
+ expect(arquivo.suggestedFilename()).toMatch(/^confere-.+\.docx$/);
```

Tudo o mais passa sem alteração — `getByRole("button", { name: "Gerar relatório" })` continua
resolvendo com `type="submit"`, `columnheader` e `link` não mudam de papel, e `getByText` sobre os
títulos de seção funciona igual em `<h3>`. As **âncoras** citadas nas ESPECs 005 §8 e 007 §8 seguem
intactas.

---

## 10. Riscos

| Risco | Mitigação |
|---|---|
| **`aria-live` implementado por dentro do retorno condicional** — não anuncia, e nenhum teste visual acusa | D-03 explica o mecanismo; `R-ACE-13` e o teste de §9.1 verificam a montagem no estado inicial, não o atributo |
| `navy-300` mais escuro achatar a hierarquia entre texto primário e secundário | `navy-800` (16,22:1) e `navy-600` (10,47:1) seguem muito à frente; a distância relativa se mantém |
| `aria-disabled` sem a guarda no manipulador — botão clicável sem os dois arquivos | Guarda única no `onSubmit`, cobrindo clique e Enter. Teste de `R-ACE-07` com um só arquivo |
| Foco programático (`R-ACE-15`) desorientar quem enxerga | O foco vai para o **título** do resultado, não para um controle. Nada é acionado, e o alvo é o topo do que acabou de surgir |
| A legenda de D-05 crescer e empurrar o grid | Duas linhas, texto fixo. Se crescer, é sinal de que a marcação do grid ficou complexa demais — problema anterior |
| O anúncio competir com o `role="alert"` do bloqueio | São estados mutuamente exclusivos de `Estado`; um só existe por vez |
| Regressão silenciosa: alguém reintroduzir `title` ou remover `focus-visible` | Verificação de §9.2 é `grep`-ável e cabe em CI |

---

## 11. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | Arrastar e soltar entra como incremento próprio? D-08 retirou a promessa, não a função | Escopo |
| 2 | O grid de seis colunas deve virar cartões abaixo de `md`? Hoje são 52 rem dentro de 56 rem, e `R-ACE-05` torna a rolagem **operável**, não confortável | Desenho |
| 3 | Validação de extensão e tamanho no `onChange`, antes da viagem ao servidor? Trocar os dois arquivos de campo é o erro provável, e hoje custa até 90 s para ser descoberto | Fluxo |
| 4 | O `.docx` gerado deve ser acessível — idioma, texto alternativo nas 2 figuras, cabeçalho de tabela repetido? Outra norma, outro artefato | Produto |
| 5 | `axe-core` entra no `playwright.config.ts` como verificação permanente, ou roda uma vez na aceitação? | Processo |
| 6 | O ponto 4 da ESPEC 007 §10 — botão "Novo relatório" — ganha peso aqui: sem ele, a única forma de recomeçar é recarregar a página, e recarregar **descarta o foco e o contexto** de quem navega por teclado | Escopo |

O ponto 6 é o único que esta espec fortalece em vez de apenas listar.

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Cor e foco — `tailwind.config.ts`, `globals.css`, `focus-within` no upload (`R-ACE-01`, `04`) | P |
| B | Formulário — `<form>`, `aria-disabled`, nomes acessíveis, indicador de atividade (`R-ACE-06`, `07`, `11`, `16`, `17`) | P |
| C | Anúncio e foco de resultado — invólucro vivo, `role="alert"`, hierarquia (`R-ACE-12`, `13`, `14`, `15`) | P |
| D | Grid — `scope`, nomes, rolagem focável, cabeçalhos, legenda, ordem (`R-ACE-02`, `03`, `05`, `09`, `10`) | M |
| E | Higiene — blob, nome de arquivo, mensagens (`R-ACE-18`, `19`, `20`) | P |
| F | Verificação — §9.2 completa, incluindo leitor de tela e comparação de captura | M |

**Total: cerca de um dia**, com a verificação de F respondendo por boa parte. Nada no backend muda e
uma única asserção de teste é tocada.

As fases A a C são independentes entre si e podem entrar em qualquer ordem. **A fase F não é
opcional:** conformidade que não foi medida em navegador é conformidade presumida, e §2 mostra
exatamente aonde a presunção leva.

---

## 13. Relação com as especs anteriores

### 13.1 ESPEC 002 — duas regras revisadas

**`R-UI-04`** — *"Itens de perfil ou pacote trazem marcação, com explicação **ao passar o cursor**"*.

A regra institui o mecanismo, e o mecanismo é o problema. Proposta de nova redação:

> Itens de perfil ou pacote trazem marcação, com a explicação em **legenda visível** junto ao grid
> (`R-DIV-04`). A explicação não depende de cursor, de foco nem de toque.

**`R-UI-08`** — *"Saldo negativo é destacado"*. O destaque existe e está correto; ele é apenas
**exclusivamente cromático**. Proposta de acréscimo:

> O destaque não é só cromático: o saldo negativo carrega portador textual acessível.

`R-DIV-05` **não é alterada** — o bloco extracontratual continua em bloco próprio, com o mesmo
critério de entrada e o mesmo rótulo. D-07 muda só a posição, e a expressão "ao final" em `R-DIV-05`
descrevia arranjo, não requisito.

`R-UI-05` — nenhuma paginação, nenhuma busca — segue **intacta e reforçada**: §4 recusa filtro e
ordenação pelo mesmo motivo.

### 13.2 ESPEC 005 — método emprestado

Esta espec não altera nenhuma regra da 005. Ela **aplica ao resto da interface** o método que a
§D-04 daquela espec inaugurou: medir contraste antes de aprovar token, e registrar o cálculo em
comentário no `tailwind.config.ts`, onde quem for usar o valor vai lê-lo.

`R-MRC-06` — o verde que não é cor de texto — permanece o precedente citado por D-02: quando a
margem é fina, cria-se o token, não se releva a régua.

### 13.3 ESPEC 006 e 007 — nada a fazer

`Rodape.tsx` e `Barra.tsx` foram auditados e **não requerem mudança**. Os seis `aria-hidden` da
aplicação estão nesses dois arquivos e estão corretos; o `<h1>` com nome acessível vindo do `alt`
(`R-MRC-05`) está correto; o `<address>` (`R-ROD-05`) e a caixa alta por CSS (`R-ROD-04`) estão
corretos.

`R-CAB-05` — o slot de contexto que só existe quando há dado real — é **explicitamente preservada**
por `R-ACE-16`: o indicador de atividade fica no formulário e a barra segue vazia até haver
relatório. A disciplina daquela regra continua sendo o principal ativo do desenho da barra, e uma
espec de acessibilidade seria o pretexto fácil para furá-la.

### 13.4 O que esta espec estabelece para as próximas

WCAG 2.1 AA passa a ser **régua permanente da interface**, não entrega pontual. Toda espec futura
que acrescentar controle, estado ou tabela responde pelas regras da §5 — e a §9.2 é o protocolo de
verificação, do mesmo modo que a ESPEC 006 fixou 1366 × 768 como tela de referência para orçamento
vertical.

---

## 14. Verificação — 2026-08-07

Executada sobre o código, na ordem do [PLANO 008](../plans/008-plano-acessibilidade-da-interacao.md).
O backlog e os desvios estão em [TASKS 008](../tasks/008-tasks-acessibilidade-da-interacao.md).

### 14.1 Resultado

| Verificação | Antes | Depois | |
|---|---|---|---|
| Nós de texto abaixo de 4,5:1 | **155** | **0** | `R-ACE-01` ✅ |
| Pior contraste medido | 2,60:1 (botão desabilitado) | 7,24:1 | ✅ |
| Violações `axe` A/AA — 4 estados × 2 larguras | `color-contrast` 8× · `scrollable-region-focusable` 1× | **0** | ✅ |
| Percurso de teclado, 8 passos | falha no **passo 1** | **8 de 8** | `R-ACE-04`…`08` ✅ |
| Região viva montada no estado inicial | ausente | presente, verificada nas duas direções | `R-ACE-13` ✅ |
| `title` como portador único | 2 | **0** | `R-ACE-03` ✅ |
| `th` sem `scope` · tabelas anônimas | todos · 22 | 0 · 0 | `R-ACE-09` ✅ |
| Transbordo horizontal da página a 390 px | não | não | ✅ |
| `tsc --noEmit` · `next lint` · `next build` | — | limpos | ✅ |
| Testes de backend | 308 | **308, não tocados** | ✅ |
| **Escuta em leitor de tela** | — | **não executada** | `P2` ⬜ `K-01` |

### 14.2 Três emendas que a implementação obrigou

**1 — §8: "nenhuma dependência nova" → nenhuma dependência de produção.**
`@axe-core/playwright`, `axe-core` e `sharp` entraram como `devDependency`. O *bundle*
entregue ao navegador não ganhou um byte. A redação original não distinguia as duas
coisas.

**2 — §9.2: as exceções de aparência são cinco, não duas.** A §9.2 listava cor e legenda.
Faltavam o corpo do `<h2>` do estado bloqueado (`R-ACE-12`), o indicador de atividade
(`R-ACE-16`) e o traço da borda dos cartões (`R-ACE-17`) — todos exigidos por regras desta
mesma espec. A lista foi escrita contando só as mudanças óbvias. A relação completa está
em TASKS 008 §1.1, e a T-438 mede contra ela.

**3 — §9.2: o que roda em dev e o que roda no *build*.** `axe`, percurso de teclado e
testes de estrutura rodam sobre `pnpm dev`, pelo Playwright — `next start` não funciona
com `output: standalone`, e a decisão já estava comentada no `playwright.config.ts`.
Contraste, captura e leitor de tela rodam sobre o *build*, como as ESPECs 005 e 007
fizeram. Para o que `axe` e o teclado medem, os dois modos não diferem.

### 14.3 O que a medição ensinou, e a espec não previa

**O `axe` encontra menos do que o PLANO 008 §5 estimou.** Sobre o código quebrado ele
acusou **duas** regras: `color-contrast` e `scrollable-region-focusable`. Não acusou
`scope` ausente, tabela sem nome, região viva ausente, foco perdido ao desabilitar nem
`title` inalcançável — nenhuma é marcação inválida. A tabela do §5 daquele plano dava
`th`/`scope` como coberto pelo `axe`, e não é: `scope` ausente é técnica recomendada, não
violação. Quem verifica `R-ACE-09` é o teste de estrutura.

**O grid não transborda no desktop.** A 1366 px a tabela mede 832 px dentro de 848 px
úteis. A `R-ACE-05` só tem efeito abaixo de ~880 px — uma varredura só no desktop teria
dado a regra por cumprida. As varreduras passaram a rodar nas duas larguras.

**O instrumento precisou de duas calibragens antes de servir.** Ele acusou 2,86:1 num
botão medido no meio da `transition` — uma cor que não existe em estado nenhum — e 1,45:1
no divisor `·`, que é `aria-hidden` e decoração pura, isenta pela 1.4.3. Os dois eram
reprovação sobre defeito inexistente, o modo de falha oposto ao que o P1 vigia e
igualmente corrosivo.

### 14.4 O defeito que o P3 pegou

A T-428 e a T-427 acrescentaram `sr-only` **dentro das células da tabela**. `sr-only` é
`position: absolute`, e sem ancestral posicionado ele se ancora no bloco inicial: os
trechos escaparam do contêiner que rola e se depositaram em x ≈ 832 nas coordenadas da
**página**, levando o `scrollWidth` de 390 para **845 px** a 390 px de largura.

O efeito é rolagem horizontal do documento inteiro no celular — regressão de *reflow*
introduzida por uma correção de acessibilidade. Não aparece a 1366 px, não quebra teste
nenhum, e **nenhuma varredura `axe` o pega**: a marcação está correta.

Quem pegou foi a comparação de captura, pela largura da imagem. Corrigido com `relative`
nas duas células.

É a confirmação prática do PLANO 008 §5, e vale como registro: **a régua que pegou o pior
defeito desta entrega não foi a de acessibilidade.**

### 14.5 O que não foi verificado

**A escuta.** O portão **P2** exige ouvir o anúncio de conclusão em NVDA ou Narrator, e
isso não foi feito — depende do insumo `K-01`. A região viva está montada desde o primeiro
render e o teste da T-416 falha quando ela é movida para dentro do retorno condicional,
que é a armadilha da D-03. **Isso não é o mesmo que o anúncio ter sido ouvido**, e o §5 do
plano diz exatamente por quê.

**O percurso com o mouse desconectado.** A T-437 roda automatizada, com os 8 passos
verdes. A forma escrita da tarefa — mouse fisicamente desconectado — é humana e não foi
executada.

Enquanto os dois não forem feitos, a espec fica **implementada com o P2 declarado em
aberto**, que é o estado honesto.

---

## 15. Emenda de 2026-08-12 — `R-ACE-18` revisada na âncora

Registrada pela [ESPEC 015](015-limpar-para-recomecar.md), na conduta da ESPEC 007 §13: a regra é
**revisada, não revogada**. A intenção sempre esteve certa; errada estava a âncora.

### 15.1 O defeito

A redação original — *"cada blob é liberado quando substituído por outro"* — foi implementada
liberando **no envio**, e o comentário que a justificava dizia:

> *"Liberar no envio basta: qualquer transição para `erro` ou `bloqueado` passa por aqui."*

A frase está certa sobre `erro` e `bloqueado` e omite a transição que **não** passa por lá:
`selecionar()` leva `pronto → inicial` sem tocar em `enviar()`, e as duas URLs sumiam do estado sem
nunca terem sido revogadas.

| | |
|---|---|
| Caminhos que abandonam `pronto` | 3 — enviar, trocar de arquivo, limpar |
| Cobertos pela âncora anterior | **1** |
| Retido por troca de arquivo | ~3,8 MB, pela sessão inteira |
| Tempo em que sobreviveu | Da ESPEC 008 à 015, atravessando a 009 e a 012 |

O próprio comentário previu o modo de falha — *"nada automatizado pega o esquecimento"* — e
descreveu como risco de um **terceiro** documento entrar. O que entrou foi um terceiro **caminho**.

### 15.2 O que a §14 afirmou, e que precisa ser corrigido

A §14 registrou que *"não há asserção de memória na suíte"*, e a ESPEC 015 herdou daí a decisão de
declarar a verificação **humana**. **A premissa está certa e a conclusão não era.**

> Liberar um *blob* não é **medir memória**. É **revogar um identificador** — e identificador
> revogado é observável: depois de `revokeObjectURL`, um `fetch` sobre aquela `blob:` URL falha.

O `href` de *Baixar DOCX* **é** o identificador, exposto no DOM. O `e2e/vazamento.spec.ts` o lê,
provoca a transição e pergunta se ainda resolve. Contra o código anterior ele reprovou com
`[true, true]` onde exigia `[false, false]`; depois da correção, passou.

A lição é transferível, e é o motivo de esta emenda existir: **"a suíte não vê memória" não implica
"a suíte não vê o defeito"**. O que importava aqui era discreto e estava no DOM. Vale reler
qualquer outro ponto do projeto onde uma verificação foi declarada humana por analogia com esta.

---

## 16. Emenda de 2026-09-02 — `D-05` tem o alcance precisado pela ESPEC 039

Registrada pela [ESPEC 039](039-a-legenda-que-descrevia-o-que-nao-aconteceu.md). A `D-05` continua
de pé em tudo o que decidiu: a explicação sai do `title`, vira legenda visível, única, e explica as
duas marcas uma vez só em vez de por linha. Nenhuma dessas escolhas foi revisitada.

O que a `D-05` não previu foi a legenda continuar afirmando as duas marcas mesmo em um relatório
onde só uma delas ocorre — um par real de arquivos processado sem nenhuma linha de saldo negativo
ainda exibia "Saldo negativo: medido acima do contratado", levando quem confere a procurar uma linha
que não existe. A ESPEC 039 fecha essa lacuna com `R-LEG-01`: cada entrada da legenda passa a
depender de o relatório ter, de fato, algum item com a condição que ela descreve.
