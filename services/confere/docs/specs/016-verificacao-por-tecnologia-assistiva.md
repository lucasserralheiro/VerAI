# ESPEC 016 — Verificação por tecnologia assistiva

| | |
|---|---|
| **Status** | **Proposta** — 2026-08-12 |
| **Versão** | 1.1 — 2026-08-12 — §8 reescrita, `R-TA-10` e `R-TA-11` acrescentadas |
| **Depende de** | [ESPEC 008](008-acessibilidade-da-interacao.md) — implementada com o `P2` em aberto |
| **Fecha** | `P2` da ESPEC 008 e `K-10` da ESPEC 015 |
| **Revisa** | A **T-416** da ESPEC 008 — o mecanismo, não a intenção. Ver §12.3 |
| **Corrige** | Uma afirmação de fato do PLANO 015 e do TASKS 015 — ver §2.1 |
| **Referência normativa** | WCAG 2.1 nível AA, régua permanente desde a ESPEC 008 §13.4 |
| **Origem** | A ESPEC 015 fechou os três portões dela e deixou uma dívida que já não é da ESPEC 015: **o anúncio nunca foi ouvido, em espec nenhuma** |

---

## 1. Problema

A ESPEC 008 §13.4 declarou **WCAG 2.1 AA como régua permanente da interface**. Desde então o
projeto acumulou instrumentos de medida com rigor incomum: varredura `axe` em cinco estados por
duas larguras, contraste calculado nó a nó no navegador, percurso de teclado em oito passos,
comparação de captura pixel a pixel, 66 testes de navegador.

**Nenhum deles mede o que uma pessoa cega ouve.**

Todos medem **marcação e pixel**. O anúncio de conclusão do processamento — a regra que a
ESPEC 008 §2.3 identificou como o defeito mais grave da tela, *"silêncio absoluto por até noventa
segundos"* — foi implementado, testado quanto à **presença** e **nunca escutado**.

Isso não é lacuna de uma entrega. É lacuna do método: a régua foi declarada permanente e o único
instrumento que a verifica de fato nunca foi usado.

---

## 2. O que foi medido

Leitura do repositório em 2026-08-12. Nada aqui é lembrança.

### 2.1 A dívida é maior do que o projeto registrou, e de espécie diferente

O PLANO 015 §8 e o TASKS 015 §10 afirmam que o leitor de tela é *"a terceira espec seguida a
esbarrar"* no mesmo insumo, dizendo que o `K-10` é *"o mesmo `K-01` da ESPEC 009"*.

**É falso.** O `K-01` da ESPEC 009 é *"arquivo aberto no Excel"* ([TASKS 009 §1021](../tasks/009-tasks-analise-da-medicao.md)),
e nada tem de leitor de tela. A afirmação conflou duas famílias de dívida que compartilham o
**padrão** e não o **insumo**.

O quadro verdadeiro é pior:

| Família | Espec | Portão | Aberto desde |
|---|---|---|---|
| **Leitor de tela** | ESPEC 008 | `P2` — ouvir o anúncio | 2026-08-07 |
| | ESPEC 015 | `K-10` — ouvir a limpeza | 2026-08-12 |
| **Abrir no Excel** | ESPEC 009 | `P2` / `K-01` | 2026-08-10 |
| | ESPEC 013 | `P2` / `K-08` | 2026-08-11 |

**Quatro portões, quatro especs, uma espécie só:** *alguém precisa abrir o artefato de verdade.*
Duas famílias, e as duas com 100% de não execução.

O erro de atribuição é registrado aqui porque ele **também** é sintoma: uma dívida que ninguém
executa é uma dívida que ninguém confere, e a contabilidade dela apodrece sem que nada acuse.
Emenda a aplicar nos dois documentos.

### 2.2 A superfície de anúncio da aplicação — ~~cinco~~ **seis** mecanismos, zero escutados

> **Emenda de 2026-08-12, na implementação.** Esta seção contou **cinco** varrendo
> `frontend/src/`. **São seis.** O Next.js injeta o próprio anunciador de rota em toda página —
> `<div role="alert" aria-live="assertive" id="__next-route-announcer__">` —, e a primeira execução
> do `anuncio.spec.ts` reprovou por modo estrito ao encontrá-lo.
>
> A lição é do método, e é a mesma da §2.3 noutra direção: **varrer o código-fonte não é varrer o
> DOM.** O framework acrescenta região viva que espec nenhuma declarou, e um inventário escrito só
> das regras nunca a veria. Ela entrou no inventário marcada como `origem: "framework"`, com a
> asserção que lhe cabe — existir e **calar**, já que esta aplicação tem uma rota só.
>
> A estrutura real também não é a lista plana abaixo: são **duas** regiões de topo da aplicação,
> **duas aninhadas** dentro da `polite`, e a do framework fora do `<main>`. Ver PLANO 016 §6.2.

Varrida em `frontend/src/`:

| # | Mecanismo | Onde | Estado que dispara |
|---|---|---|---|
| 1 | `aria-live="polite"` + `aria-atomic="false"` | [`ResultadoPanel.tsx:71`](../../frontend/src/app/components/ResultadoPanel.tsx#L71) | `pronto` |
| 2 | `role="alert"` | [`ResultadoPanel.tsx:96`](../../frontend/src/app/components/ResultadoPanel.tsx#L96) | `erro` |
| 3 | `role="alert"` | [`ResultadoPanel.tsx:106`](../../frontend/src/app/components/ResultadoPanel.tsx#L106) | `bloqueado` |
| 4 | `sr-only` dentro da região viva | [`ResultadoPanel.tsx:90`](../../frontend/src/app/components/ResultadoPanel.tsx#L90) | `processando` |
| 5 | `role="status"` | [`page.tsx:159`](../../frontend/src/app/page.tsx#L159) | volta a `inicial` |

Mais dois **portadores de conteúdo** que não são anúncio e entram na escuta por outra razão — eles
mudam o que é **lido** de uma célula: os `sr-only` de saldo negativo e de marca de perfil
(`DivergenciaGrid.tsx`, `AnaliseMedicaoPanel.tsx`), e o `aria-busy` do botão (`UploadForm.tsx:149`).

**Cinco mecanismos de anúncio. Nenhum foi ouvido.** E eles não são independentes: 1, 2, 3 e 4
convivem na mesma região, e 5 nasceu justamente porque 1 **esvazia** na volta a `inicial`.

### 2.3 O que o `axe` não pega — já medido, e não por suposição

A ESPEC 008 §14.3 registrou o resultado da varredura contra o código quebrado: o `axe` acusou
**duas** regras — `color-contrast` e `scrollable-region-focusable`. **Não** acusou região viva
ausente, foco perdido ao desabilitar, `scope` ausente nem `title` inalcançável.

O motivo é estrutural e vale como princípio: **nenhuma delas é marcação inválida.** Uma região viva
montada no lugar errado é HTML perfeito. Um anúncio que não dispara é HTML perfeito.

> Ferramenta automática de acessibilidade encontra **marcação errada**. Ela não encontra
> **comportamento ausente** — e anúncio é comportamento.

### 2.4 O que **é** mecanicamente testável, e não está testado

O `D-03` da ESPEC 008 descreveu o mecanismo com precisão:

> Leitores anunciam a **mutação** de uma região viva já presente na árvore. Uma região que entra na
> árvore junto com seu conteúdo é **inserção**, e o anúncio não dispara de forma confiável em
> leitor nenhum.

Mutação e inserção são distinguíveis **em JavaScript**: é identidade de nó. O teste existente
(T-416) verifica que a região existe no estado inicial — o que é bom e insuficiente: ele não
verifica que **o mesmo nó** sobrevive à transição.

Essa é a diferença entre o que hoje se sabe e o que se poderia saber sem leitor nenhum.

### 2.5 Uma restrição de projeto disfarçada de asserção de teste

A T-416 da ESPEC 008 ([`a11y-estrutura.spec.ts:19-23`](../../frontend/e2e/a11y-estrutura.spec.ts#L19-L23))
afirma que existe **exatamente um** `[aria-live="polite"]` no DOM:

```ts
await expect(viva).toHaveCount(1);
```

A intenção é correta e importante — ela é o teste que pega a armadilha do `D-03`. **O número é
arbitrário.** Ele descrevia o estado da aplicação em 2026-08-07, e virou requisito sem nunca ter
sido decidido como requisito.

O custo já foi cobrado uma vez. A ESPEC 015 precisou anunciar a volta ao estado inicial e **não pôde
usar `aria-live="polite"`**: o atributo explícito faria a contagem virar 2 e derrubaria a T-416. A
saída foi `role="status"`, que implica região viva sem acrescentar o atributo — e um teste novo
(`R-LMP-13`) precisou existir só para registrar a razão, *antes que alguém "corrigisse"*.

Funcionou, e é o sintoma: **a marcação foi escolhida pelo teste, não pela necessidade.** No dia em
que uma segunda região viva legítima for necessária, a leitura será *"o teste está errado"* — e o
teste está certo; errado está o número.

`R-TA-11` resolve isso onde o problema mora: a contagem passa a vir do inventário.

---

## 3. Objetivo

Fechar a distância entre *"a marcação de anúncio está correta"* e *"o anúncio acontece"*, por dois
caminhos:

1. **Automatizar tudo o que é mecanismo** — mutação contra inserção, ordem de anúncio, conteúdo
   anunciado — para que a escuta humana verifique só o que é irredutivelmente humano.
2. **Tornar a escuta executável**, com leitor declarado, roteiro escrito e falas esperadas, para
   que ela deixe de ser um insumo adiável e passe a ser uma tarefa de cinco minutos.

**Não é ampliar a conformidade.** Nenhuma regra de WCAG nova entra. O que muda é que as que já
existem passam a ser verificadas pelo instrumento que corresponde a elas.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Inventário explícito dos mecanismos de anúncio da aplicação.
- Teste mecânico de **mutação contra inserção** para toda região viva.
- Leitor e navegador de referência declarados.
- Roteiro de escuta com falas esperadas, limitado no tempo.
- Fechamento do `P2` da ESPEC 008 e do `K-10` da ESPEC 015.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| A família "abrir no Excel" (`P2` da ESPEC 009 e da 013) | É a mesma **espécie** de dívida (§2.1) e outro artefato, outro instrumento, outro avaliador. Misturar as duas faria uma spec de acessibilidade carregar a conferência de uma planilha. Registrado em `I-19` |
| Nível AAA | ESPEC 008 §4 recusou, e continua recusado |
| JAWS | Licença paga. `I-17` |
| Validação com pessoa cega usuária real | É outra coisa, e é melhor — mas é pesquisa com usuário, não verificação de entrega. `I-18` |
| Acessibilidade do `.docx` gerado | Outro artefato, outra norma. ESPEC 008 §11 ponto 4 |
| Qualquer mudança de aparência | Esta spec não move um pixel |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-TA-01` | Existe um **inventário** dos mecanismos de anúncio, com um item por mecanismo, o estado que o dispara e a fala esperada. Anúncio que não está no inventário **não existe** para efeito de verificação |
| `R-TA-02` | Toda região viva declara sua **espécie**. As de espécie `mutada` — `aria-live="polite"`, `role="status"` — têm teste de identidade de nó: o nó é o mesmo antes e depois da transição, e o conteúdo mudou. As de espécie `inserida` — `role="alert"` — têm teste de que **aparecem** com o papel e a mensagem certos. *Emendada na implementação: a redação original mandava testar mutação em **toda** região viva, e para `alert` isso é o oposto do correto — ver PLANO 016 §6.1* |
| `R-TA-03` | O leitor e o navegador de referência são **declarados**, e a escuta registra qual par foi usado. Verificação sem instrumento nomeado não é reproduzível |
| `R-TA-04` | O roteiro de escuta é **escrito, numerado e limitado** — passos contados, falas esperadas por extenso. Um portão sem roteiro é um portão que se adia (§2.1) |
| `R-TA-05` | O critério é a **fala**, não o atributo. "O `aria-live` está no DOM" não fecha portão nenhum desta spec |
| `R-TA-06` | O que **não** é automatizável fica declarado no inventário, item a item. Omissão silenciosa é o que produziu a dívida de §2.1 |
| `R-TA-07` | Toda espec futura que acrescentar mecanismo de anúncio acrescenta **a entrada no inventário e o teste de `R-TA-02`**. É a extensão natural da ESPEC 008 §13.4 |
| `R-TA-08` | Os **cinco** mecanismos já existentes (§2.2) entram no inventário e na escuta. A spec é retroativa: não há mecanismo herdado isento |
| `R-TA-09` | A escuta fecha `P2` da ESPEC 008 e `K-10` da ESPEC 015 **na mesma sessão**, porque os dois observam a mesma região viva em transições diferentes |
| `R-TA-10` | O inventário é verificado **nos dois sentidos**: mecanismo no DOM sem entrada reprova, **e** entrada sem mecanismo correspondente reprova. Um sentido só deixa o inventário apodrecer cheio, que é o modo de falha mais provável de um documento de estado |
| `R-TA-11` | A **contagem** de regiões vivas no DOM vem do inventário, nunca de uma constante. Hoje a T-416 da ESPEC 008 afirma que existe *exatamente um* `[aria-live="polite"]` — número arbitrário que já obrigou a ESPEC 015 a contornar (§2.5) e que quebra no dia em que uma segunda região legítima entrar |

---

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **NVDA + Chrome como par de referência; Narrator aceito como mínimo** | NVDA é gratuito e é o leitor de fato no setor público brasileiro; Chrome é o navegador que a suíte já usa, então a escuta observa o mesmo motor que os 66 testes. Mas **Narrator já está instalado neste Windows 11**, e verificação feita vale mais que verificação correta e adiada — foi adiada duas vezes. O par usado fica registrado (`R-TA-03`) |
| `D-02` | **A escuta continua sendo portão bloqueante — mas só porque agora é executável** | A tentação é rebaixá-la a "conferência periódica", já que bloquear não funcionou. **O diagnóstico está errado:** ela não foi adiada por ser bloqueante, foi adiada por ser **ilimitada**. "Ouvir o anúncio" não diz quantos passos, com o quê, nem o que se espera ouvir — e tarefa sem contorno é tarefa que nunca começa. Com `R-TA-04` ela vira cinco minutos com roteiro. Portão que cabe em cinco minutos não se adia |
| `D-03` | **Identidade de nó é o teste que mais rende** | É o único ponto onde o mecanismo do `D-03` da ESPEC 008 — mutação contra inserção — é observável sem leitor. Ele pega a armadilha inteira, para sempre, e sem depender de insumo humano. Tudo o que ele cobre sai da lista da escuta |
| `D-04` | **Não simular leitor de tela** | Existe a tentação de asserir a árvore de acessibilidade computada e chamar isso de escuta. Ela mede o que o navegador **expõe**, não o que o leitor **fala** — e a distância entre os dois é exatamente onde moram os defeitos que esta spec existe para pegar. Simular seria trocar um portão honesto e aberto por um portão fechado e falso |
| `D-05` | **Uma sessão fecha os dois portões pendentes** | `P2` da 008 e `K-10` da 015 observam a **mesma** região viva, em transições diferentes. Separá-los em duas sessões duplicaria o custo do que já foi adiado por custo |
| `D-06` | **O inventário mora no repositório, não nesta spec** | Spec é decisão; inventário é estado, e muda a cada mecanismo novo. Enterrado aqui, envelheceria — e `R-TA-07` obriga especs futuras a atualizá-lo. Vai para um arquivo próprio, ao lado dos testes que o consomem |
| `D-07` | **A família "abrir no Excel" fica de fora, e não por desimportância** | §2.1 mostra que as duas famílias somam quatro portões abertos, e a tentação é resolver as duas de uma vez. São instrumentos diferentes (leitor × Excel), avaliadores diferentes e critérios diferentes. O que elas compartilham é o **padrão de adiamento**, e é esse padrão que `D-02` ataca — a solução é transferível mesmo com o escopo separado |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `backend/` | **Nenhuma** |
| `frontend/src/` | **Nenhuma.** Esta spec verifica; não corrige. Se a escuta achar defeito, ele vira entrega própria (`I-20`) |
| `frontend/e2e/anuncio.spec.ts` | **Novo.** `R-TA-02` (identidade de nó), `R-TA-10` (inventário nos dois sentidos) e `R-TA-11` (contagem orientada a dado) |
| `frontend/e2e/inventario-de-anuncios.ts` | **Novo.** O inventário de `D-06`: mecanismo, estado que dispara, fala esperada, automatizável sim/não |
| `frontend/e2e/a11y-estrutura.spec.ts` | **Alterado — o único.** A T-416 troca a constante `1` pela contagem do inventário (`R-TA-11`). A reescrita sai **mais forte**: hoje ela afirma um número; passa a afirmar a correspondência |
| `docs/` | Roteiro de escuta e registro do resultado |

**Nenhuma dependência nova.** Nenhuma mudança de aparência — a comparação de captura da ESPEC 008
§9.2 tem de sair **idêntica em todos os estados**, e é o critério que impede esta spec de virar
correção disfarçada.

Esboço do núcleo de `R-TA-02`, para fixar a forma:

```ts
// Guarda o nó, provoca a transição, e pergunta se é o MESMO nó com conteúdo novo.
// Inserção — nó novo — é o defeito que o D-03 da ESPEC 008 descreve e que nenhuma
// inspeção de atributo distingue de mutação.
await page.evaluate(() => {
    (window as any).__regiao = document.querySelector('[aria-live="polite"]');
});
await provocarTransicao(page);
const { mesmoNo, mudou } = await page.evaluate(() => {
    const antes = (window as any).__regiao;
    const agora = document.querySelector('[aria-live="polite"]');
    return { mesmoNo: antes === agora, mudou: antes?.textContent !== "" };
});
expect(mesmoNo, "a região foi recriada: é inserção, e leitor nenhum anuncia").toBe(true);
```

---

## 8. Testes e critério de aceite

### 8.1 Validação do mecanismo

| Regra | Verificação |
|---|---|
| `R-TA-02` | Para cada entrada do inventário: o nó da região é **o mesmo** antes e depois da transição, e o conteúdo mudou |
| `R-TA-02` | O teste **falha** quando a região é movida para dentro do retorno condicional — provado quebrando de propósito, como a T-704 do PLANO 012 e a T-802 do PLANO 013 exigiram |
| `R-TA-01` · `R-TA-10` | **DOM → inventário:** todo `[aria-live]`, `[role=status]` e `[role=alert]` encontrado tem entrada. **Inventário → DOM:** toda entrada tem mecanismo correspondente no estado que ela declara. Os dois sentidos, varridos nos **cinco** estados de `e2e/estados.ts` |
| `R-TA-08` | O inventário tem as **cinco** entradas de §2.2 — nem uma a menos |
| `R-TA-11` | A contagem de `[aria-live="polite"]` no DOM **iguala** o número de entradas do inventário que declaram esse mecanismo. Nenhuma constante literal no teste |
| `R-TA-06` | Toda entrada declara se é automatizável, e a soma das não automatizáveis **é** a lista de passos da §8.3. Se divergirem, um dos dois está desatualizado |

### 8.2 Regressão — nomeada, não presumida

A §7 dá a garantia mais forte possível: **`frontend/src/` não é tocado.** O que pode regredir,
portanto, é a **suíte**, e ela se verifica inteira:

| Suíte / verificação | Critério | Por que pode ser afetada |
|---|---|---|
| `a11y-estrutura.spec.ts` | Verde, **com a T-416 reescrita** por `R-TA-11` | É a única alterada. A reescrita tem de sair **mais forte**, não mais permissiva — §12.3 |
| `a11y-axe.spec.ts` · `a11y-contraste.spec.ts` | Zero violações e zero abaixo de 4,5:1 nos **cinco** estados × duas larguras | Consomem `ESTADOS`, que a spec não altera |
| `a11y-teclado.spec.ts` | Os 8 passos verdes | Nada aqui toca foco |
| `smoke.spec.ts` · `analise.spec.ts` · `timeout.spec.ts` | Verdes, **sem alteração** | Se alguma quebrar, esta spec saiu do escopo que declarou |
| `limpar.spec.ts` · `vazamento.spec.ts` | Verdes, **sem alteração**. O `R-LMP-13` é o único candidato a mudar — ver §12.3 | Cobrem a ESPEC 015, que compartilha a região viva |
| **Total de navegador** | **66 + os novos**, todos verdes numa **única execução** | A `R-LMP-04` da ESPEC 015 passou isolada e falhou em conjunto: execução fragmentada não é execução |
| Backend | **379 verdes, não tocados** — contagem idêntica | Nenhum arquivo de `backend/` entra em tarefa nenhuma. Divergência é sintoma, não ajuste |
| `tsc --noEmit` · `next lint` · `next build` | Limpos | Arquivos de teste novos entram na compilação |
| Comparação de captura | **Idêntica em todos os estados, nas duas larguras** | É o critério que impede esta spec de virar correção disfarçada — §7 |

A última linha é a régua central: **uma spec de verificação que muda um pixel deixou de ser uma
spec de verificação.** Diferente da ESPEC 015, aqui não há exceção de aparência sancionada — zero é
zero.

### 8.3 A escuta — `R-TA-04`

Roteiro, cinco passos, com as falas esperadas:

| # | Ação | Fala esperada |
|---|---|---|
| 1 | `Tab` até o primeiro campo | *"Contrato, botão procurar arquivo"* |
| 2 | Escolher os dois arquivos, `Enter` no primário | *"Processando o relatório. Pode levar até um minuto."* |
| 3 | Aguardar a conclusão | **O anúncio de conclusão** — é o `P2` da ESPEC 008 |
| 4 | `Tab` até *Limpar*, `Enter`, confirmar | *"Formulário limpo. Envie novos arquivos…"* — é o `K-10` da ESPEC 015 |
| 5 | Entrada inválida | O `role="alert"` do erro interrompe e é lido |

**Silêncio em qualquer passo é reprovação**, e o passo diz qual mecanismo falhou.

### 8.4 Portões

| ID | Portão | Fecha quando |
|---|---|---|
| `P1` | **A escuta, uma vez** | Os cinco passos de §8.3, com o par de `D-01` registrado. Fecha `P2` da ESPEC 008 e `K-10` da ESPEC 015 |
| `P2` | **Mecanismo verificado** | `R-TA-02`, `R-TA-10` e `R-TA-11` verdes para as cinco entradas, **e vistos falhar** contra a armadilha do `D-03` |
| `P3` | **Nada regrediu** | A tabela inteira de §8.2, numa única execução |

**`P1` antes de `P2`, e a v1.0 desta spec dizia o contrário.** O argumento anterior era de
eficiência: cada coisa automatizada é uma a menos para o humano observar. Ele valia enquanto a
escuta era cara e ilimitada, e deixou de valer quando `R-TA-04` a reduziu a cinco passos.

O argumento que substitui é de **risco**: esta aplicação nunca foi ouvida **uma vez**. Automatizar
meio dia em torno do mecanismo *mutação × inserção* pressupõe que é ele que importa — premissa que
nunca foi confrontada. Se a escuta revelar que o anúncio sai com o texto errado, fora de ordem, ou
lido pela metade por causa do `aria-atomic="false"`, a automação teria sido escrita em volta do
problema errado.

**Ouvir uma vez custa cinco minutos e desrisca meio dia.** Emenda registrada em §13.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **A escuta ser adiada uma terceira vez** | É o risco central, e `D-02` é a resposta: o portão foi adiado por ser ilimitado, não por ser bloqueante. `R-TA-04` o reduz a cinco passos com falas escritas |
| **A escuta achar defeito e a spec virar correção** | Fica declarado: correção é entrega própria (`I-20`). Uma spec de verificação que corrige de passagem perde o critério de "captura idêntica" que a mantém honesta |
| **O teste de identidade de nó passar por acidente** | `P1` exige vê-lo **falhar** contra a armadilha, como a T-704 do PLANO 012 e a T-802 do PLANO 013 |
| **Achar que a árvore de acessibilidade substitui a escuta** | `D-04`. É a tentação mais provável, porque é a que parece rigor |
| **O inventário envelhecer** | `R-TA-07` obriga espec futura a atualizá-lo, e `R-TA-01` reprova mecanismo sem entrada — o teste é quem cobra, não a disciplina |
| **Narrator e NVDA divergirem** | Registrar o par usado (`R-TA-03`). Divergência entre leitores é achado, não falha do método — e é o que `I-17` decide |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-17` | JAWS entra? É o leitor mais usado em ambiente corporativo e é pago | Não. `D-01` fixa um par gratuito; JAWS entraria se houver licença |
| `I-18` | A verificação deveria ser feita por uma pessoa cega usuária, e não por quem desenvolveu? | Não bloqueia, e **é melhor** — desenvolvedor que escreveu a fala sabe o que esperar ouvir, o que é a pior condição possível para julgar se ela basta |
| `I-19` | A família "abrir no Excel" (§2.1) merece o mesmo tratamento — roteiro escrito e portão limitado? | Não. Fora do escopo por `D-07`, mas a resposta provavelmente é sim, e pelo mesmo diagnóstico |
| `I-20` | Se a escuta achar defeito, ele entra aqui ou vira espec própria? | Não. Vira entrega própria — §9 |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| **A** | **A escuta** — cinco passos, um leitor (**P1**) | **PP — cinco minutos** |
| B | Inventário das cinco entradas (`R-TA-01`, `R-TA-06`, `R-TA-08`) | PP |
| C | `anuncio.spec.ts` — identidade de nó e inventário nos dois sentidos, e vê-los falhar (`R-TA-02`, `R-TA-10`, **P2**) | P |
| D | T-416 reescrita pela contagem do inventário (`R-TA-11`) | PP |
| E | Suíte inteira, captura e conferência da §8.2 (**P3**) | P |
| F | Registro do resultado e emendas nas ESPECs 008 e 015 | PP |

**Total: meio dia**, e a fase A — a que está pendente desde 2026-08-07 — custa **cinco minutos**.

Essa desproporção é o argumento inteiro desta spec: o que travou não foi o custo, foi a ausência de
contorno. E é também por isso que a fase A vem **primeiro**: ela é a única que pode mudar o desenho
das outras cinco.

---

## 12. Relação com as especs anteriores

### 12.1 ESPEC 008 — o método dela aplicado ao instrumento que faltava

A ESPEC 008 §D-01 diagnosticou por que a acessibilidade não sobrevivia: *"ela sobrevive quando vira
regra numerada e critério de aceite"*. A escuta nunca virou regra numerada — virou **insumo**, que
é a categoria das coisas que se adiam.

Esta spec faz com a verificação o que a 008 fez com a conformidade. `R-ACE-13`, `R-ACE-14` e
`R-ACE-15` não são alteradas: ganham o instrumento que as mede.

### 12.2 ESPEC 015 — a dívida que ela herdou e nomeou

A ESPEC 015 §14.1 registrou que um portão declarado humano era automatizável, e o converteu em
teste. Esta spec é o mesmo movimento aplicado ao que **sobrou**: separar o que é mecanismo do que é
percepção, automatizar o primeiro, tornar o segundo executável.

E corrige um fato que a 015 propagou — §2.1.

### 12.3 T-416 revisada no mecanismo, não na intenção

A T-416 é um bom teste: ela pega a armadilha do `D-03`, que nenhuma varredura automática enxerga, e
foi escrita afirmando **a montagem** em vez do atributo — exatamente onde a implementação intuitiva
erra. Nada disso muda.

O que muda é a constante. Redação proposta da intenção dela, para a T-416 reescrita:

> A região viva é montada desde o primeiro render, e **o número de regiões vivas no DOM corresponde
> ao inventário** — não a um número fixado quando a tela tinha uma só.

Isso torna a T-416 **mais forte**: hoje ela passa com uma região viva no lugar errado, desde que
seja uma. Depois, ela exige que cada região exista, seja a declarada, e esteja no estado declarado.

**Consequência para a ESPEC 015:** o `R-LMP-13` — o teste que registrou por que o anúncio da
limpeza usa `role="status"` — pode ser **absorvido** pela verificação de inventário. Ele foi escrito
para impedir que alguém "corrigisse" a marcação e derrubasse a T-416; com a contagem orientada a
dado, a correção deixa de derrubar. A decisão de absorvê-lo ou mantê-lo fica para a implementação, e
mantê-lo é a escolha conservadora.

### 12.4 O que esta spec estabelece para as próximas

**Portão sem roteiro é portão que se adia.** Toda espec futura que criar verificação humana escreve
o roteiro junto com o portão: passos contados e resultado esperado por extenso. Um portão que não
cabe numa sessão delimitada não é portão — é uma intenção.

**Contagem em teste vem de dado, não de constante.** Um número literal numa asserção descreve o
estado do dia em que foi escrito e vira requisito sem nunca ter sido decidido como requisito — §2.5
mostra o caso, com o custo já cobrado uma vez.

---

## 13. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-12 | Redação inicial. A §2.1 mudou a premissa depois de escrita: a verificação mostrou que o leitor de tela bloqueou **duas** especs, não três, e que existe uma **segunda** família de dívida com o mesmo padrão — quatro portões abertos, e não três |
| 1.1 | 2026-08-12 | **§8 reescrita.** A v1.0 despachava a regressão em uma célula de tabela, sem nomear suíte nenhuma — formulação que permite rodar menos do que se devia. Três acréscimos: `R-TA-10` (inventário nos dois sentidos, senão ele apodrece cheio), `R-TA-11` (a contagem de regiões vivas vem do inventário — §2.5 e §12.3), e a tabela de regressão nomeada de §8.2. **E a ordem dos portões inverteu**: a escuta passou a vir **antes** da automação, por risco e não por eficiência — automatizar em torno de um mecanismo nunca observado é escrever meio dia de teste sobre uma premissa |