# Marcador de lista órfão no DESCRITIVO — design

## Contexto

Reclamação recorrente de quem usa o VerAI: "o descritivo some" na conversão de Proposta
Comercial. Investigado a partir de `SEI_147453498_Proposta_Comercial_934.pdf` (gerador
wkhtmltopdf — o próprio gerador do SEI), que veio com o texto colado do usuário mostrando a seção
DESCRITIVO DOS SERVIÇOS PRODAM claramente presente no PDF mas irreconhecível no HTML gerado.

## Causa raiz (medida, não suposta)

Dump direto de `extractTextItems` (unpdf) no arquivo real mostra que **todo marcador "•" do
documento sai como um trecho de UM CARACTERE só**, com `hasEOL: true` fechando o próprio trecho
ali mesmo — sem espaço nem conteúdo nenhum depois dele no mesmo trecho do content stream. O PDF
desenha, em sequência, TODOS os marcadores de uma página inteira (dezenas seguidos), bem longe —
na ordem de desenho — do trecho que desenha o rótulo de cada item. O Y de cada marcador bate
exatamente com o Y do rótulo correspondente (é a mesma linha impressa); só a ORDEM DE DESENHO os
separa.

Exemplo real (página 6 do PDF, valores brutos do extrator):

```
{ str: "Fornecimento de infra de rede para instalação dos Access Point.", x: 76.6, y: 787.7 }
...
{ str: "•", x: 68.4, y: 787.7, hasEOL: true }   ← mesmo Y do rótulo acima, trecho isolado
```

Isso quebra dois pontos em cadeia dentro de `src/lib/extracao/pdfHtml.ts`:

1. `agruparEmLinhas` produz uma `Linha` de um item só pro marcador (`itens: [{texto: "•"}]`) —
   correta como extração, mas isolada do rótulo.
2. `ehMarcadorDeLista`/`REGEX_LISTA_MARCADOR` exigem espaço + conteúdo depois do marcador — um
   "•" sozinho nunca casa.
3. Sem marcador reconhecido, o rótulo (curto, Title Case, do tamanho do corpo) cai na faixa
   "mesmo tamanho do corpo + capitalização de título" de `ehTitulo` e vira `<h2>` falso — OU,
   quando `absorverBloco` já estava formando um parágrafo vizinho, o marcador solto e o rótulo são
   engolidos como continuação daquele parágrafo (ex.: `<p>Como solicitar • Através da Gerência de
   Relacionamento responsável pelo atendimento ao Cliente.</p>` — campo e valor grudados, sem
   marcador de lista nenhum).

Medido no arquivo real, ANTES da correção: 10 parágrafos que são só um "•" sozinho, e boa parte
dos 37 `<h2>` do documento são na verdade rótulo de item de lista (ex.: "Central de Serviços",
"Monitoramento", "Disponibilidade", "Suporte ao Serviço" — repetidos por serviço, não seções
novas).

## Decisão

Reencaixar o marcador órfão na `Linha` seguinte da MESMA PÁGINA, como um passo único sobre todas
as linhas do documento já ordenadas por leitura, ANTES de qualquer decisão de título/lista/
parágrafo — função `reencaixarMarcadoresOrfaos` em `pdfHtml.ts`, chamada logo depois de
`agruparEmLinhas` rodar em todas as páginas.

- **Preserva o X do marcador** (não o do rótulo) na `Linha` fundida — é o X do marcador que
  `nivelDoMarcador`/`ancorasDeNivelDeMarcador` usam pra decidir nível de indentação, e é o X
  verdadeiro na página impressa.
- **Nunca funde através de página** — cada `Linha` já carrega `pagina`; a fusão só acontece
  quando marcador e linha seguinte são da mesma página.
- **Não funde órfão com órfão** — dois marcadores soltos em sequência (sem rótulo entre eles)
  ficam como estão; caso residual, não observado no corpus atual.
- Escopo do que conta como "marcador órfão": `Linha` de item único cujo texto, aparado, é
  exatamente `•`, `-` ou `*` — o mesmo alfabeto já aceito por `REGEX_LISTA_MARCADOR`. Não cobre
  lista numerada órfã (`"1."` sozinho) — sem evidência desse caso no corpus até agora.

## O que este design NÃO resolve

- **Rótulo de campo promovido a `<h2>` quando repete menos de `LIMIAR_REPETICOES_ROTULO_TEMPLATE`
  (3) vezes no documento.** Depois da correção acima, ainda sobram casos como `<h2>Disponibilidade
  </h2>` ou `<h2>Suporte ao Serviço</h2>`: esses rótulos NUNCA tiveram marcador de lista (não são
  item de lista, são campo de um mini-formulário dentro do descritivo) e só viram título porque
  batem no heurístico de tamanho+capitalização e não repetem vezes suficientes pra cair na trava
  de "rótulo de template". Causa diferente, não é o mecanismo do marcador órfão — precisa de
  investigação própria (possivelmente: taxa de repetição por SEÇÃO em vez de documento inteiro,
  já que o mesmo campo aparece uma vez por serviço descrito). Medido no arquivo de referência:
  24 `<h2>` sobrando depois desta correção (era 37 antes), a maioria títulos institucionais
  legítimos (cabeçalho, OBSERVAÇÕES, TERMOS E CONDIÇÕES) mas alguns ainda são rótulo de campo.
- A régua (`scripts/diagnostico-conversao.mts`) não tem métrica pra este defeito — as métricas
  existentes são todas de tabela/preço/aritmética. Verificação aqui foi feita com script pontual
  contando `<h2>`/`<li>`/parágrafo-só-marcador antes e depois no PDF de referência. Fica em aberto
  se vale a pena instrumentar a régua com uma métrica de "possível título que deveria ser item de
  lista" pra pegar regressão automática no futuro.

## Verificação

- `SEI_147453498_Proposta_Comercial_934.pdf`: parágrafo-só-marcador 10→0, `<li>` 81→115, `<h2>`
  37→24 (queda de 13, todos rótulo de item de lista real).
- Régua no corpus completo (11 arquivos originais + este): confirmada pelo próprio usuário rodando
  na máquina dele — todas as métricas batem exatamente com a baseline documentada em
  `docs/superpowers/specs/2026-09-21-reparo-camada-texto-pdf-design.md` (a diferença bruta em
  "valor solto"/"blocos gigantes"/"código grudado" é só a contribuição do arquivo novo somada ao
  corpus; cada arquivo original manteve seu número exato). Zero regressão.
- `tsc --noEmit`: nenhum erro novo em `src/lib/extracao/` — os 179 erros existentes são todos em
  `services/confere/` e `src/app/confere/` (integração separada, já conhecida, fora de escopo).
- Testes unitários escritos em `pdfHtml.test.ts` (reproduzem o formato exato medido no PDF real:
  marcador de um item só + rótulo separado, mesma página vs. página seguinte). Não executados
  nesta sessão — o ambiente ponte (Linux) não tinha o binário nativo do SWC que o Jest usa (
  `node_modules` foi instalado no Windows); usuário roda localmente.
