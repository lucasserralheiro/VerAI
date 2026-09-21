# TASKS 004 — Backlog dos Anexos de Detalhamento

| | |
|---|---|
| **Especificação** | [ESPEC 004](../specs/004-anexos-de-detalhamento.md) v1.3 |
| **Plano** | [PLANO 004](../plans/004-plano-anexos-de-detalhamento.md) v1.0 |
| **Versão** | 1.0 — 2026-08-06 |
| **Total** | 25 tarefas · 2 insumos |
| **Status** | **Concluído** — 25 tarefas · P1, P2 e P3 fechados no que é automatizável · `K-01` e `K-02` pendentes |

> Escrito **antes** da implementação, como o TASKS 003.

---

## 1. Convenções

**Identificadores** `T-3nn` seguem a numeração do PLANO 004. `K-nn` são insumos do
solicitante.

**Definição de pronto de qualquer tarefa:** código e teste na mesma entrega; `ruff`,
`mypy` e `pytest` verdes; comentário explicando o *porquê* onde a escolha não for
óbvia.

**Convenção de commit** `<tipo>(T-3nn): descrição`.

**Duas regras que atravessam o backlog:**

1. **Nada antes dos anexos muda.** Se uma tarefa exigir alterar a capa, a tabela de
   comprovação ou o teste-âncora, **pare** — os anexos entram depois (`R-ANX-09`).
2. **O leitor lê forma, não significado.** Se uma tarefa exigir que o leitor conheça o
   conteúdo de uma aba específica, **pare** — é sinal de que a informação deveria estar
   no `anexos.json`, não no código.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** Fundação: o leitor e a fixture | T-301 … T-304 | — | ✅ |
| **E1** A fatia vertical: `NAS` | T-305 … T-310 | **P1** | ✅ |
| **E2** Os dois extremos ⚠️ | T-311 … T-315 | **P2** | ✅ |
| **E3** Os dezesseis restantes | T-316 … T-318 | — | ✅ |
| **E4** Verificação do conjunto | T-319 … T-322 | **P3** | ✅ automático · ⬜ `K-01` |
| **E5** Documentação | T-323 … T-325 | — | ✅ |

### Resultado

| O que | Resultado |
|---|---|
| Anexos no documento | **19**, ~41 páginas, 14 retrato e 5 paisagem |
| **Teste-âncora** | **54 de 55 linhas**, sem uma linha do teste alterada |
| Determinismo | duas execuções, bytes idênticos — com 698 mesclagens em jogo |
| Suíte | **290 testes**, de 224 · cerca de 6 min |
| Tempo de geração | **36 s** de ponta a ponta, de 3 s |
| Pacote | 3,6 MB, de 3,3 MB |
| `api/` e `frontend/` | **não tocados**, como o plano previa |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-305** | `anexos.json` foi para `infrastructure/annex/`, não `infrastructure/report/` | O leitor de anexos precisa da configuração; deixá-la em `report/` faria `measurement/` depender de `report/`. O pacote `annex/` reúne as duas metades sem inverter nada |
| **T-302** | Integrado ao `sanitize_fixture.py` em vez de script novo | A fixture é **um** artefato. Dois scripts que a produzem seriam um estilingue: rodar um depois do outro desfaria o primeiro |
| **T-309** | Exigiu **partir o anexo em duas tabelas** | Ver abaixo — foi a descoberta que mais mudou o desenho |
| **T-301** | O leitor preserva também **cor da fonte e bordas** | `R-ANX-06` não as listava. Sem a cor, cabeçalho preto sobre `A52A2A`; sem as bordas da aba, caixas vazias nas linhas de respiro |
| **T-321** | 36 s, não os 20–25 s projetados | Abaixo do gatilho de 40 s. Registrado no README |

### As duas coisas que a implementação ensinou

**A repetição de cabeçalho só vale nas primeiras fileiras de uma tabela.** É
restrição do Word, e derruba a leitura ingênua de `R-ANX-11`: em `Usuários` o
cabeçalho é a 8ª linha da aba, e marcá-lo no meio de uma tabela única não produz
efeito nenhum. Pior: um teste que só verificasse a presença da marca passaria, e
o documento sairia errado. Daí `Anexo.corte` e o teste que exige a marca **na
primeira fileira**.

**Resolver a grade de uma tabela custa a grade inteira.** `Table.cell(i, j)` e
`linha.cells` a remontam a cada acesso. Com 15 mil células em `Usuários` e 698
mesclagens em `Office365`, a primeira versão levava **cinco minutos** e a suíte
não terminava. A correção — resolver a grade uma vez por tabela e reaproveitá-la
inclusive nas mesclagens — levou a geração de 308 s para 28 s.

### O que ainda não foi verificado

**A aparência.** É o que os testes não pegam, e a ESPEC 003 já cobrou esse preço
uma vez: seis defeitos passaram pela suíte inteira e só apareceram no Word. Os
insumos `K-01` e `K-02` seguem abertos.

**Este backlog não tem ponto de não retorno.** Nada é substituído — o incremento
acrescenta páginas ao fim do documento. Reverter é remover entradas do `anexos.json`.

---

## 3. Épico E0 — Fundação: o leitor e a fixture

> A peça nova mais importante do incremento e a condição para testá-la sem dado
> pessoal. Nenhum anexo aparece no documento ainda.

#### T-301 — Leitor genérico de aba
**Tamanho:** G · **Ref:** `R-ANX-05`, `R-ANX-06`, `R-ANX-07`

Em `backend/src/infrastructure/measurement/`, um leitor que recebe o caminho da
planilha e o nome de uma aba e devolve sua **forma**: matriz de células com valor,
mesclagens, preenchimento e negrito.

As 19 abas têm de 3 a 22 colunas e **nenhuma semântica em comum**. O leitor não pode
conhecer nenhuma delas — é isso que faz um anexo novo não exigir código.

Três cuidados que a implementação atual já ensinou:

| Cuidado | Por quê |
|---|---|
| `data_only=True` | Sem isso vêm as fórmulas, não os valores. Custou a fixture uma vez (`sanitize_fixture.py`) |
| Números e datas com a formatação da planilha | `openpyxl` devolve `float`; `str()` produz ponto decimal e o relatório é pt-BR |
| Célula vazia sai vazia | Não confundir com string vazia nem com zero (`R-ANX-07`) |

**Pronto quando:** dado `NAS`, devolve 42 linhas × 7 colunas, com as mesclagens e os
preenchimentos que a aba tem, e as células vazias vazias.

---

#### T-302 — Fixture sintética para `Usuários` e `Office365`
**Tamanho:** M · **Ref:** `R-ANX-10` · **Risco**

Um script ao lado de `sanitize_fixture.py` que **acrescenta** à fixture sanitizada as
duas abas removidas, com dados gerados: mesma estrutura, mesma contagem de linhas e
colunas, mesmos cabeçalhos, nomes e logins sintéticos.

Hoje a fixture do repositório é sanitizada justamente por remover essas duas abas
(`PLANO 001` D-04). Com os anexos, ela deixaria de cobrir **dois dos dezenove** — e
logo os dois mais difíceis.

**Vem antes de tudo.** Sem ela, os testes de `Usuários` só rodariam com o arquivo
íntegro, que o hook de pré-commit bloqueia: seriam testes que passam numa máquina só.

**Pronto quando:** a fixture do repositório tem 1.021 linhas em `Usuários` e 363 em
`Office365`, nenhuma com dado real, e o script é reexecutável com o mesmo resultado.

---

#### T-303 — Testes do leitor contra abas de forma variada
**Tamanho:** M · **Depende de:** T-301, T-302

Três abas escolhidas pelo que têm de diferente, não por conveniência:

| Aba | O que exercita |
|---|---|
| `NAS` | retrato, 7 colunas, mesclagens e preenchimentos — o caso completo |
| `Comunicação Dados` | 22 colunas — o extremo de largura |
| `BD` | 24 linhas, 7 colunas — o caso pequeno, para conferir que nada é inventado |

**Pronto quando:** as três passam, e a contagem de linhas e colunas de cada uma bate
com a tabela da ESPEC 004 §3.

---

#### T-304 — Teste de guarda de dados pessoais
**Tamanho:** P · **Depende de:** T-302 · **Ref:** `R-ANX-10`

Um teste que varre as fixtures do repositório procurando padrão de e-mail, e confere
que os logins de `Usuários` e `Office365` são os sintéticos.

O hook de pré-commit já bloqueia a planilha íntegra. Este teste pega o outro caminho:
alguém regenerar a fixture a partir do arquivo real por engano.

**Pronto quando:** o teste passa; e falha se a fixture for regenerada do arquivo real.

---

**Verificação do E0:** o leitor devolve a forma das três abas; a fixture tem as duas
abas sintéticas; os 224 testes existentes seguem verdes.

---

## 4. Épico E1 — A fatia vertical: `NAS` `[portão P1]`

> Um anexo só, de ponta a ponta. É onde os erros de estrutura custam uma correção em
> vez de dezenove.

#### T-305 — `anexos.json` com uma entrada ✅
**Tamanho:** P · **Ref:** `R-ANX-04`, §4.1

> **Desvio:** o arquivo ficou em `backend/src/infrastructure/annex/`. Ver §2.

`anexos.json`, com **apenas** `NAS`:

```json
[{ "aba": "NAS", "ordem": 7, "orientacao": "retrato",
   "corpo": 6.4, "linha_cabecalho": 7 }]
```

Cinco campos, porque é só isso que **não** está na planilha (§3.2) mais a escolha de
§4.2. Título, resumo, subtítulos, mesclagens e cores vêm da aba.

Mesmo padrão do catálogo padrão: JSON versionado ao lado do código, diffável na
revisão.

**Pronto quando:** um teste carrega o arquivo e valida os cinco campos.

---

#### T-306 — Entidade `Anexo` no domínio
**Tamanho:** P · **Depende de:** T-305

Em `domain/entities/`, uma entidade com nome, orientação, corpo de fonte, linha de
cabeçalho e as linhas lidas. Sem menção a `openpyxl` ou `python-docx` — como todo o
resto do domínio.

**Pronto quando:** a entidade existe, é imutável e tem teste de construção.

---

#### T-307 — Uma seção por anexo, com orientação e quebra
**Tamanho:** M · **Depende de:** T-306 · **Ref:** `R-ANX-01`, `R-ANX-02`, `R-ANX-03`

O renderizador ganha, **depois** da tabela de comprovação, uma seção nova por anexo.

`_abrir_secao_paisagem` já faz isso para a tabela atual; generalizar para receber a
orientação. Retrato é 21,0 × 29,7 cm e paisagem 29,7 × 21,0, margens de 1,4 cm — as
medidas já estão em `layout.py`.

> Cuidado do modelo: a capa traz uma quebra de página e folhas timbradas em branco.
> `_encerrar_a_capa` já resolveu isso uma vez — conferir que o mesmo não reaparece
> entre a tabela e o primeiro anexo.

**Pronto quando:** o documento tem 4 páginas — capa, comprovação, `NAS` — e a seção do
`NAS` está em retrato.

---

#### T-308 — Tabela do anexo com a formatação da aba
**Tamanho:** G · **Depende de:** T-301, T-307 · **Ref:** `R-ANX-06`

Despejar a matriz do leitor numa tabela, aplicando o que veio da aba: **mesclagens,
preenchimento, negrito** e o corpo de fonte declarado.

As primitivas de `ooxml.py` já existem — `sombrear`, `mesclar_linha`,
`margens_apertadas`, `fixar_larguras`. Nenhuma cor entra em código: `A52A2A`,
`6A5ACD` e `0000FF` foram medidas nas células e vêm de lá.

**Pronto quando:** a página do `NAS` traz as mesclagens e os preenchimentos da aba.

---

#### T-309 — Cabeçalho repetido entre páginas
**Tamanho:** P · **Depende de:** T-308 · **Ref:** `R-ANX-11`

`w:tblHeader` na linha declarada em `linha_cabecalho`. O Word cuida da repetição ao
paginar — não é código novo, é um atributo.

É a **única divergência deliberada** em relação ao GRC (§4.2). Reversível: um anexo que
não deva repetir declara isso no JSON.

**Pronto quando:** a linha 7 do `NAS` tem `w:tblHeader`; um anexo sem o campo não tem.

---

#### T-310 — Testes de estrutura e formatação do anexo
**Tamanho:** M · **Depende de:** T-309 · **Portão P1**

Estrutura (seção, orientação, quebra), formatação (mesclagens, preenchimentos,
negrito, corpo) e a contagem de linhas.

**Pronto quando:** passam **e** a página do `NAS` foi conferida ao lado da página 25
do GRC — insumo `K-02`.

---

**Verificação do E1 · portão P1:** o `NAS` sai visualmente igual ao GRC. **Se não
sair, parar aqui** — corrigir o leitor antes de escalar o erro por dezenove anexos.

---

## 5. Épico E2 — Os dois extremos ⚠️ `[portão P2]`

> Nada aqui é anexo comum. São os dois casos que quebram o que funcionou no `NAS`.

#### T-311 — `Usuários`: volume e paginação
**Tamanho:** G · **Depende de:** P1 · **Risco**

1.021 linhas, 15 colunas, paisagem, corpo 5,6 — 16 páginas de GRC e 15.315 células, o
maior anexo por uma ordem de grandeza.

**Pronto quando:** o documento traz 1.021 linhas de dados no anexo, em paisagem.

---

#### T-312 — Cabeçalho repetido em todas as páginas do anexo
**Tamanho:** P · **Depende de:** T-311 · **Ref:** `R-ANX-11`

É aqui que `R-ANX-11` deixa de ser teoria: com um anexo de uma página, `w:tblHeader`
não tem o que provar.

**Pronto quando:** aberto no Word, o cabeçalho aparece no topo das 16 páginas — o
problema que a regra existe para resolver (quem confere a página 18 via oito colunas
de datas sem saber qual é qual).

---

#### T-313 — `Comunicação Dados`: 22 colunas em 3,5 pt
**Tamanho:** M · **Depende de:** P1 · **Risco**

O extremo oposto: poucas linhas, largura impossível.

**Pronto quando:** as 22 colunas cabem na área útil, nenhuma cortada.

---

#### T-314 — Larguras proporcionais à planilha
**Tamanho:** M · **Depende de:** T-313

Dividir a área útil na proporção das larguras de coluna da aba.

> **A margem interna conta.** Foi o defeito que a conferência visual pegou na ESPEC
> 003: 108 twips por lado × 5 colunas = 1,9 cm perdidos. Com 22 colunas o padrão do
> Word somaria **4,7 cm** — mais de um sexto da largura útil. `margens_apertadas` já
> resolve, com `MARGEM_CELULA = 28`.
>
> O outro: `fixar_larguras` precisa escrever `w:gridCol` **e** `w:tcW`. Só o segundo
> deixa as colunas uniformes, e isso também já custou uma correção.

**Pronto quando:** um teste soma as larguras e confere que cabem na área útil, com as
margens internas incluídas na conta.

---

#### T-315 — Medir o tempo dos dois
**Tamanho:** P · **Depende de:** T-311, T-313 · **Ref:** PLANO §5

Medir a geração de `Usuários` + `Comunicação Dados` e comparar com a projeção.

**Se já passar de 25 s aqui**, a projeção da ESPEC 004 §6 estava otimista, e vale
reabrir a conversa **antes** da E3 — não depois de dezenove anexos prontos.

**Pronto quando:** o número está registrado neste documento.

---

**Verificação do E2 · portão P2:** os dois anexos conferidos no Word — insumo `K-02`.

---

## 6. Épico E3 — Os dezesseis restantes

> Sem novidade técnica. Se o E1 e o E2 fecharam, este épico é preencher um JSON.

#### T-316 — `anexos.json` completo
**Tamanho:** M · **Depende de:** P2 · **Ref:** §3

As 19 entradas, com a orientação e o corpo **medidos** na ESPEC 004 §3 — não
estimados. 14 retrato, 5 paisagem.

`Capa`, `Levantamento` e `Comunicação Dados Histórico` **não entram** (`R-ANX-08`).

**Pronto quando:** as 19 entradas estão no arquivo, na ordem, e um teste confere cada
orientação contra a tabela da spec.

---

#### T-317 — Aba vazia
**Tamanho:** P · **Depende de:** T-316

Um anexo sem linhas deve sair com o título e uma observação — **não quebrar**.

`Comunicação Dados Histórico` já mostra que abas vazias existem nesta planilha. Ela
não entra como anexo, mas outra pode chegar vazia numa competência futura.

**Pronto quando:** um teste com aba vazia produz a página, sem exceção.

---

#### T-318 — Teste de cobertura dos 19
**Tamanho:** M · **Depende de:** T-316

Os 19 anexos presentes, na ordem, cada um com a orientação certa.

**Pronto quando:** o documento tem cerca de 41 páginas e o teste confere os 19.

---

## 7. Épico E4 — Verificação do conjunto `[portão P3]`

#### T-319 — Teste-âncora intacto
**Tamanho:** P · **Depende de:** T-318 · **Ref:** `R-ANX-09` · **Portão P3**

**54 de 55 linhas, sem alteração no teste.**

É a rede deste incremento. Os anexos entram **depois** da tabela de comprovação; se o
âncora quebrar, alguma coisa foi deslocada — e o defeito está no incremento, não no
teste. **Não ajustar o teste para acomodar.**

**Pronto quando:** passa sem que uma linha dele tenha mudado.

---

#### T-320 — Determinismo
**Tamanho:** P · **Depende de:** T-318 · **Ref:** `R-DOC-10`

Duas execuções produzem documentos byte a byte idênticos.

Um DOCX é um ZIP, e o ZIP grava a hora em cada entrada — `_normalizar_pacote` já fixa
os carimbos em `(1980,1,1,0,0,0)`. Com 19 tabelas novas, conferir que nada de
relógio entrou no conteúdo.

**Pronto quando:** o teste de determinismo passa com o documento completo.

---

#### T-321 — Tempo real de ponta a ponta
**Tamanho:** P · **Depende de:** T-318 · **Ref:** PLANO §5

Medir a requisição completa e comparar com a projeção de 20 a 25 s.

**Acima de 40 s**, a opção 2 da ESPEC 004 §6 — emitir o XML das tabelas grandes
diretamente — deixa de ser escape e vira necessidade. **Registrar, não decidir
sozinho:** a otimização está fora do escopo por decisão do solicitante.

**Pronto quando:** o número está neste documento e no README.

---

#### T-322 — Conferência do documento completo no Word
**Tamanho:** M · **Depende de:** T-319 … T-321 · **Insumo `K-01`** · **Portão P3**

Abrir as ~41 páginas e percorrer os 19 anexos.

**É a única verificação de aparência que existe.** Na ESPEC 003, seis defeitos
passaram pela suíte inteira — página em branco, coluna cortada, colunas
desproporcionais, timbrado torto, faixa navy sobrando, borda faltando — e todos
apareceram quando o documento foi aberto. Nenhum quebrava teste.

O padrão comum era **supor a estrutura em vez de medir**. Se algo sair errado aqui, a
correção começa medindo no GRC.

**Pronto quando:** o documento abre sem aviso do Word e os 19 anexos foram
percorridos.

---

## 8. Épico E5 — Documentação

#### T-323 — README
**Tamanho:** P

O documento passa de 3 para ~41 páginas; registrar o **tempo medido** em T-321, que é
o que o usuário vai esperar na tela.

---

#### T-324 — CHANGELOG
**Tamanho:** P

O incremento e a decisão de manter os anexos **fora da tela** (§3.4) — inclusive por
que, que é o que evita a pergunta voltar.

---

#### T-325 — Fechamento deste documento
**Tamanho:** P

Resultado, desvios e o que só a conferência visual pegou — como no TASKS 003 §2.

---

## 9. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **K-01** | Aceite visual do documento completo no Word | T-322 | É a única verificação de aparência que existe |
| **K-02** | Aceite visual de `NAS`, `Usuários` e `Comunicação Dados` | P1 e P2 | Risco de repetir um erro de formatação por 19 anexos |

`K-02` é o que torna `K-01` barato.

---

## 10. Sequência

```
E0 ──► E1 ──► E2 ──► E3 ──► E4 ──► E5
       P1     P2            P3
```

| | |
|---|---|
| **Caminho crítico** | T-302 → T-301 → T-308 → T-311 → T-316 → T-322 |
| **Duração** | 3 a 5 dias, 1 desenvolvedor |

Sem paralelização útil: E1 prova o que E2 estressa e E3 repete.

---

## 11. O que este backlog não faz

- **Não otimiza o desempenho** — fora do escopo, com o gatilho de T-321 registrado.
- **Não muda `api/` nem `frontend/`** — ESPEC 004 §3.4.
- **Não mapeia item de serviço para anexo** — insumo que não existe, registrado como
  evolução na ESPEC 004 §12.
- **Não altera a capa nem a tabela de comprovação** — `R-ANX-09`.
