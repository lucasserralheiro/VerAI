# Reparo da camada de texto do PDF — design

Data: 2026-09-21

## Problema

A proposta `PC-SPTURIS-260831-939` saiu da conversão com palavras trocadas:
`licenşas`, `medişões`, `atualizaşões`, `atribuiçäo`, `configuraçăo`, `confìrmação`,
`execuçáo`, `MiddIeware` — 14 ocorrências em 6 páginas.

## Causa raiz (medida, não suposta)

**Não é bug da nossa extração.** O `pdfminer` (Python, biblioteca sem nenhuma
relação com o `unpdf`/pdf.js) devolve exatamente os mesmos erros, e quem copia o
texto do Acrobat com Ctrl+C recebe a mesma coisa. O defeito está no ARQUIVO.

Metadados do PDF:

```
Producer: Microsoft: Print To PDF
Title:    Microsoft Word - PC-SPTURIS-260831-939 (1)
```

A pessoa **imprimiu** o Word em PDF em vez de exportar ("Salvar como PDF"). Esse
driver monta a tabela `ToUnicode` da fonte embutida errada. Na fonte
`/CIDFont+F1` (`Identity-H`), entre outros:

```
glifo 0x00FA → U+015F (ş)   devia ser ç
glifo 0x0103 → U+0103 (ă)   devia ser ã
glifo 0x006C → U+00E4 (ä)   devia ser ã
glifo 0x0075 → U+00EC (ì)   devia ser i
```

O DESENHO na página está correto (por isso o PDF parece perfeito e o OCR leria
certo); errada está só a informação "esse desenho é a letra tal". O defeito é
esporádico dentro do mesmo arquivo — a mesma palavra sai certa num parágrafo e
quebrada em outro, porque o Word usou glifos diferentes pra mesma letra em
operações de desenho diferentes.

Isso divide o universo de propostas recebidas em dois: as impressas via
"Microsoft Print to PDF" (quebram) e as exportadas pelo Word/Acrobat (`ToUnicode`
correto — são as que sempre funcionaram). Dá pra separar os dois casos pelos
metadados, antes de converter.

## Decisão

Reparo **determinístico**, sem IA, sem dicionário externo, sem rede, aplicado
nos itens de texto logo depois de `extractTextItems` e antes de qualquer
agrupamento em linha/bloco — `src/lib/extracao/repararTextoPdf.ts`.

Aplicar ANTES de montar linha é obrigatório por um motivo não óbvio: o texto
corrigido precisa alimentar tanto o HTML quanto o `textoOriginal` de
`paginasConvertidas`. Reparar só o HTML faria a checagem por IA comparar um HTML
certo contra um "original" podre e acusar divergência em cima de uma correção
legítima.

### Três regras, em ordem de confiança

1. `glifo-impossivel` — o caractere não existe no alfabeto do português (ş, ă,
   ä, ì...). Os substitutos vêm por FAMÍLIA DE ACENTO (cedilha só pode virar ç;
   `a` com diacrítico estranho vira ã/á/â/à/a) e, entre os candidatos, ganha o
   que já aparece escrito em outro ponto do MESMO documento.
2. `padrao-impossivel` — caractere válido em posição impossível: depois de `ç`,
   o português só tem `ão`/`ões`. Pega `execuçáo`, que a regra 1 não enxerga
   porque `á` é letra legítima.
3. `auto-consistencia` — confusão `I`/`l` (mesmo desenho em Arial). Só dispara
   quando a forma certa aparece ≥2x no documento e mais vezes que a suspeita.

O princípio que sustenta as três: **o documento é o próprio dicionário dele**.
Como o defeito é esporádico, a forma certa quase sempre está escrita em outro
lugar do mesmo arquivo — a correção é evidência tirada do original, nunca
invenção.

### Invariantes

- **Token com dígito nunca é alterado, por regra nenhuma.** Isto é proposta
  comercial: um `1` virando `l` dentro de `R$ 17.263,43` é pior que qualquer
  erro de acento. Glifo impossível dentro de número vira ALERTA, não correção.
- Glifo fora do alfabeto e fora de `CANDIDATOS_POR_GLIFO` é reportado, nunca
  adivinhado.
- PDF são entra e sai byte a byte igual (verificado com texto de controle
  contendo `Müller`, `Muñoz`, `1º` e valores em R$ — zero alterações).
- Toda troca volta em `correcoesDeTexto` (página, antes, depois, regra,
  contexto). Nada muda em silêncio.

### Campos novos em `ResultadoConversaoPdf`

Aditivos — nenhum consumidor existente precisou mudar:
`correcoesDeTexto`, `alertasDeTexto`, `camadaDeTextoSuspeita`.

## Resultado medido

No PC-SPTURIS: 14 correções, 0 alertas, e o diff do HTML antes×depois mostra que
**só as 14 palavras mudaram** — nada mais no documento foi tocado. Em texto
português limpo: 0 correções, saída idêntica à entrada.

## Famílias de gerador (o eixo certo de classificação)

Defeito de conversão anda junto com o GERADOR do PDF, não com o cliente nem com
o tipo de proposta. Medido até agora com `npm run diag:pdf`:

| Gerador | Origem | Camada de texto | Tabela |
|---|---|---|---|
| `Microsoft: Print To PDF` | Word impresso | letra trocada (14 no PC-SPTURIS) | borda desenhada pela metade → tabela de preço sai com 1 coluna |
| `wkhtmltopdf` / `Qt` | SEI da PMSP | sã | 7 colunas corretas; CÓD. come o começo do PRODUTO em célula multi-linha |

Princípio de arquitetura que decorre disso: **o conversor não deve ramificar por
gerador.** Cada decisão continua saindo da evidência presente no documento
(borda quando existe, corredor quando não existe). O gerador serve pra MEDIR e
pra AVISAR, nunca pra ligar um caminho de código paralelo — senão o projeto vira
uma pilha de remendos por fornecedor, e o próximo modelo que chegar não é
coberto por nenhum deles.

## Régua: `npm run diag:pdf`

`scripts/diagnostico-conversao.mts` foi reescrito pro pipeline de HTML (estava
morto desde a migração — importava `pdfMarkdown.js`, que não existe mais). Mede
por arquivo e agrega por gerador: correções de glifo, alertas, tabelas e colunas,
tabela não reconhecida (1 coluna), linha irregular, código grudado, valor solto,
conferência aritmética soma×total, prosa em tabela e bloco gigante.

Regra de uso: rode ANTES e DEPOIS de mexer em qualquer heurística, nos MESMOS
arquivos, e compare. A primeira rodada dela já ensinou sobre si mesma — aprovou o
PC-SPTURIS ("nenhum sinal de problema") com a tabela de preço destruída, porque
faltava a contagem de tabela de 1 coluna. Régua que aprova documento quebrado não
serve de régua.

## Medição no corpus real (11 arquivos / 7 documentos distintos, 6 geradores)

| Gerador | Arq. | Letras trocadas | Preço não reconhecido | Moldura⇒tabela | Código grudado | Aritmética |
|---|---|---|---|---|---|---|
| `Microsoft: Print To PDF` | 2 | 28 | 2 | 0 | 0 | — |
| `Microsoft® Word 365` | 4 | 0 | 0 | 4 | 0 | 3/104 |
| `wkhtmltopdf` / `Qt` (SEI) | 2 | 0 | 0 | 0 | 4 | 0/2 |
| `Apache FOP 2.2` | 1 | 0 | 0 | 1 | 0 | 0/53 |
| `Chrome` / `Skia/PDF` | 1 | 0 | 0 | 0 | 0 | 0/9 |
| `iLovePDF` | 1 | 0 | 0 | 0 | 11 | 0/11 |

Duas conclusões que mudam a prioridade do trabalho:

1. **Só o "Print To PDF" quebra a camada de texto.** O Word exportando direto
   ("Microsoft® Word para Microsoft 365") dá ZERO correções em 4 arquivos. Isso
   confirma com dado a recomendação de processo: exportar, não imprimir.
2. **A aritmética das propostas sobrevive à conversão** — 176 de 179 linhas de
   tabela de preço fecham PREÇO × QUANT (× PERÍODO). As 3 exceções são período pro-rata escrito
   por extenso ("2 meses 16 dias"), não erro de conversão. Ou seja: o estrago
   não está nos números, está na ESTRUTURA (célula deslocada, moldura virando
   tabela, tabela de preço não reconhecida).

### O que a régua ensinou sobre ela mesma

Três alarmes dela eram falsos e foram corrigidos antes de virarem trabalho:

- "tabela não reconhecida" juntava dois casos muito diferentes — tabela de
  preço destruída (grave) e moldura decorativa virando célula (leve). 3 dos 4
  casos eram moldura. Agora são duas métricas.
- "soma não fecha" comparava a coluna TOTAL com uma linha que quase nunca soma
  aquela tabela ("Elementos Originais TOTAL", total de seção, tabela partida
  entre páginas). 10 de 12 alarmes eram isso, e 1 era arredondamento de 4
  centavos em 13 parcelas. Trocada por conferência de aritmética POR LINHA, que
  não depende de nada externo à linha.
- a conferência por linha, na primeira versão, exigia TOTAL = PREÇO × QUANT ×
  PERÍODO e acusava 28 de 104 linhas do Word 365. Todas certas: nas propostas
  da PRODAM convivem duas convenções (QUANT já do período inteiro, ou QUANT por
  mês), e o período nem sempre está na coluna que o cabeçalho indica. Hoje a
  linha conta como consistente se fechar com QUALQUER inteiro presente nela.

Régua nova pede ceticismo igual ao do código que ela mede: todo alarme foi
aberto e conferido contra o documento antes de ser tratado como defeito.

## Correção 1: grade de uma coluna nunca é tabela (`pdfTabelas.ts`)

`construirGradeDaPagina` rejeitava só a grade 1x1. Uma moldura com UMA divisória
horizontal (2 linhas x 1 coluna) passava e virava tabela HTML de 1 coluna.

Medido antes × depois, nos mesmos 11 arquivos:

| Métrica | Antes | Depois |
|---|---|---|
| moldura ⇒ tabela | 5 | **0** |
| preço não reconhecido | 2 | **0** |
| valor solto | 3 | 5 |
| blocos gigantes | 4 | 6 |
| aritmética quebrada | 3/179 | 3/179 |
| código grudado | 15 | 15 |

Conteúdo conferido nos dois documentos afetados, porque placar não é prova:

- **PA-HSPM (Word 365)**: o bloco DESCRITIVOS voltou a sair como `<h2>` por
  seção e `<ul><li>` por item. Ganho limpo.
- **PC-SPTURIS (Print to PDF)**: a tabela de preço deixou de existir como
  tabela e virou parágrafo — mas o CONTEÚDO voltou inteiro: os códigos
  `14.071.00006.00` e `14.071.00007.00`, que a tabela de 1 coluna engolia,
  agora aparecem, e o total também. Trocou "tabela errada com conteúdo
  faltando" por "texto corrido com conteúdo completo", que é estritamente
  melhor e é o que o `valor solto`/`blocos gigantes` a mais está marcando.

Falta dar estrutura de volta a essa tabela — é o problema de CÉLULA
MULTI-LINHA: a linha de dado quebra em duas linhas visuais
("MIDDLEWARE - DIREITO DE USO" / "DE SOFTWARE") e os corredores verticais não
alinham. Próximo alvo.

## Achado aberto: `conferirTotais.ts` não enxerga sinal negativo

`REGEX_VALOR = /(R\$|BRL)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/` não captura o menos, e
`normalizarValor` trabalha sobre a string do número sem sinal. Numa Proposta de
Aditivo — documento que existe justamente pra somar e subtrair — `BRL - 7.948,25`
(Redução) e `BRL 7.948,25` (Inclusão) normalizam para o MESMO `7948,25`. A
conferência determinística de totais é cega ao sinal exatamente na classe de
documento onde o sinal é o conteúdo.

Medido na `PA-SMDET-260428-782`: com o parser da régua (que captura o menos,
inclusive separado por espaço e antes da moeda), as duas tabelas fecham a
aritmética; sem ele, a tabela de Redução acusa divergência de sinal invertido.

## O que este design NÃO resolve

- **Tabela.** Defeito separado e ainda aberto: o mesmo "Print to PDF" desenha as
  bordas verticais de forma parcial (a linha depois de "CÓD." existe só na
  altura do cabeçalho; entre QUANT/PERÍODO/TOTAL não há linha na primeira linha
  de dados). `pdfTabelas.ts` pede à grade uma informação que não está no
  arquivo, devolve 1 coluna e cai no fallback posicional, que embaralha célula
  que quebra em duas linhas e perde os códigos de serviço. Caminho proposto:
  híbrido — linhas vindas das bordas horizontais (confiáveis), colunas vindas
  dos corredores de texto (já funcionam; o cronograma acerta as 7 colunas
  sozinho).
- **Fidelidade garantida.** A partir de um PDF que já perdeu informação na
  origem, toda conversão é reconstrução. Fica muito boa; "idêntica" com
  garantia, não.

## Recomendação de processo (fora do código)

O caminho que resolve camada de texto E tabela de uma vez é não receber o PDF
impresso: o VerAI já converte `.docx` com `mammoth` (`converterDocxParaHtml`),
que lê tabela, negrito e lista da estrutura do arquivo, sem heurística nenhuma.
Pedir à GRC o `.docx` — ou, no mínimo, "Salvar como PDF" em vez de "Imprimir" —
custa um e-mail e elimina a classe inteira de defeito nas propostas futuras. O
reparo do PDF continua existindo como rede de segurança pra documento de
terceiro.

## Arquivos

- `src/lib/extracao/repararTextoPdf.ts` — o módulo
- `src/lib/extracao/repararTextoPdf.test.ts` — testes unitários
- `src/lib/extracao/pdfHtml.ts` — ponto de aplicação e campos novos
- `arquivos-teste-conversao/PC-SPTURIS-260831-939.pdf` — fixture de regressão
- `arquivos-teste-conversao/verificar-reparo-texto.mts` — régua contra PDF real
