# Rodapé de página não atravessa página — design

## Contexto

Usuário reportou, olhando a conversão de `SEI_147453498_Proposta_Comercial_934.pdf` (o mesmo
arquivo do defeito do marcador órfão, já corrigido — ver
`docs/superpowers/specs/2026-09-21-reencaixe-marcador-orfao-descritivo-design.md`): "tem como
fazer pra nao pegar o rodape da pagina quando for nem cabeçalho".

Importante notar o que este pedido NÃO é: `CLAUDE.md` documenta a regra "nenhuma linha é
descartada" — rodapé de paginação precisa continuar aparecendo no HTML, nunca ser removido. A
investigação confirmou que o problema real não é o rodapé estar presente, é o rodapé **engolir o
título da página seguinte pro mesmo parágrafo**, porque rodapé de paginação nunca termina em
pontuação final (é "... / pg. 1", não uma frase).

## Causa raiz (medida no PDF real)

Saída ANTES desta correção (depois do reencaixe de marcador órfão, que já estava corrigido):

```html
<p><u>Proposta Comercial 934 PC-HSPM-250813-095 v2 (147453498)</u> <u>SEI 7010.2024/0005575-1 /
pg. 1</u> C4. CONEXÃO INTERNET - COM REDUNDANCIA DE OPERADORAS</p>
```

O rodapé da página 1 e o título da SEÇÃO C4, que abre a página 2, saem como um `<p>` só. O mesmo
padrão se repetia, no mesmo arquivo, em "DIMENSIONAMENTO E PREÇO DOS SERVIÇOS" (abre página 9) e
"ALOCAÇÃO DE RISCOS" (abre página 13) — cada um grudado no rodapé da página anterior.

Mecanismo: `absorverBloco` (`pdfHtml.ts`) decide quantas `Linha`s seguintes entram no mesmo
parágrafo continuando enquanto o texto acumulado não termina em pontuação final. Rodapé de
paginação nunca termina em pontuação final — então o loop nunca parava nele, e seguia pra próxima
`Linha` da lista (que é, sem checagem nenhuma, a primeira linha da PRÓXIMA página). O mesmo buraco
existia em `absorverTabelaPorPosicao` (linha de vão largo no fim de uma página podia crescer a
tabela com uma linha de vão largo do início da PRÓXIMA página).

`detectarTabelaPorBordas`, a terceira função que decide quais `Linha`s formam um bloco, **já
tinha** a guarda equivalente (`if (linha.pagina !== primeiraLinha.pagina) break`) — ponto de
partida usado aqui, não descoberta nova.

## Decisão

Adicionar a mesma guarda de página nas outras duas funções que também decidem "quais linhas
seguintes entram neste bloco":

- `absorverBloco`: `if (candidata.pagina !== linhas[indiceInicial].pagina) break`, checado
  primeiro no corpo do loop, antes de qualquer outra condição de parada (marcador de lista,
  título, início de tabela).
- `absorverTabelaPorPosicao`: a condição de crescimento do `while` ganha
  `linhas[j].pagina === linhas[indiceInicial].pagina`, na mesma posição que já tinha
  `temVaoLargo(linhas[j])`.

Em nenhum dos dois casos a linha é descartada — ela só passa a ser avaliada como o INÍCIO de um
novo bloco (própria iteração do loop principal de `montarHtml`) em vez de continuação forçada do
bloco anterior. Rodapé continua no HTML, exatamente como a regra exige; só para de arrastar
conteúdo de outra página junto.

## Achado adicional durante a verificação (não pedido, encontrado ao rodar a régua)

A mesma guarda em `absorverTabelaPorPosicao` eliminou duas "tabelas" fantasma em
`SEI_162636771_Proposta_Comercial_1068 VN.pdf`, sem relação com o arquivo original que motivou a
correção — descobertas comparando a régua com e sem a guarda (21 tabelas → 19 tabelas nesse
arquivo):

```html
<!-- rodapé da página 11 + rodapé da página 12, mesmo alinhamento de coluna por coincidência -->
<table><thead><tr><th>Proposta Comercial 1068 PC-HSPM-260629-855 v4 (162636771)</th>
<th>SEI 7010.2026/0008528-0 / pg. 11</th></tr></thead><tbody><tr>
<td>Proposta Comercial 1068 PC-HSPM-260629-855 v4 (162636771)</td>
<td>SEI 7010.2026/0008528-0 / pg. 12</td></tr></tbody></table>

<!-- duas linhas de sumário (título + número de página, com líder de pontos) de páginas
     diferentes, viradas "linha de tabela" uma da outra -->
<table><thead><tr><th>13</th><th>Cronograma Executivo:</th></tr></thead><tbody><tr>
<td>14</td><td>Equipe do Projeto</td></tr></tbody></table>
```

Depois da correção, cada um vira parágrafo próprio, sem se misturar com o vizinho de outra página.

## O que este design NÃO resolve

- **Fusão de rodapé/título DENTRO da mesma página.** No mesmo `SEI_162636771...pdf`, a página 2
  tem `<p><u>C7. SD-WAN</u> <u>C7.3. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (SOLUÇÃO: SERVIÇO E
  GESTÃO)</u> Proposta Comercial 1068 PC-HSPM-260629-855 v4 (162636771) SEI
  7010.2026/0008528-0 / pg. 2</p>` — dois títulos de seção grudados no rodapé da PRÓPRIA página
  (não da seguinte). A guarda de página não se aplica aqui porque as três linhas realmente são da
  mesma página; o mecanismo é outro (nenhuma das três termina em pontuação final e nenhuma bate no
  heurístico de título do jeito que está calibrado hoje). Pré-existente, confirmado idêntico antes
  e depois desta correção — precisa de investigação própria (provavelmente: reconhecer padrão de
  rodapé — "Proposta Comercial <n> ... SEI ... / pg. <n>" repete literalmente em toda página do
  documento — como uma parada válida no meio do bloco, não só na borda de página).
- **Blocos grandes e cheios de dígito pré-existentes que só mudaram de tamanho.** Em
  `PA-HSPM-260821-925 v2.pdf` e `Q-00910-20260916-1049 1.pdf`, a régua passou a apontar 1 "bloco
  gigante" a mais em cada um depois da correção — inspecionado: em ambos é uma lista de perfis/
  tipos de servidor ("Perfil A - até 10 GB Perfil B - de 11GB a 100 GB..."/"TIPO A - 1 vCPU, 2 GB
  RAM..."), conteúdo coerente de um assunto só, sem mistura de página. A causa é a posição do
  bloco ter mudado (um bloco anterior, em página diferente, agora para mais cedo por causa desta
  mesma correção, o que desloca onde o bloco seguinte começa) cruzando o limiar de 400 caracteres
  da régua — não é conteúdo de duas fontes misturado. Sinalizado, não corrigido: esse tipo de
  lista sem separador nenhum (só hífen) já era candidato a virar lista/tabela própria antes desta
  correção, é problema de heurística de detecção de lista, não de fronteira de página.

## Verificação

- `SEI_147453498_Proposta_Comercial_934.pdf` (arquivo que originou o pedido): as três seções que
  abriam página grudadas no rodapé da anterior — "C4. CONEXÃO INTERNET...", "DIMENSIONAMENTO E
  PREÇO DOS SERVIÇOS", "ALOCAÇÃO DE RISCOS" — saem cada uma em `<p>` próprio, o rodapé anterior
  intacto em `<p>` separado antes.
- Régua no corpus completo (20 arquivos), comparação controlada: rodada com a guarda ativa vs.
  rodada com a guarda temporariamente revertida (mesma sessão, mesmo corpus, único código
  diferente são as duas linhas de guarda). Toda métrica que não seja `blocos gigantes`/`tabelas`
  bateu IDÊNTICA nas duas rodadas em TODOS os 20 arquivos: correções de letra, alertas, preço não
  reconhecido, moldura⇒tabela, aritmética (linha e soma), linhas irregulares, código grudado,
  valor solto, prosa em tabela — zero diferença. As únicas mudanças (`blocos gigantes`, `tabelas`)
  foram inspecionadas arquivo por arquivo (ver "Achado adicional" e "O que este design NÃO
  resolve" acima) — nenhuma é regressão de conteúdo, todas são: (a) o próprio defeito sendo
  corrigido, (b) duas tabelas fantasma adicionais eliminadas de brinde, ou (c) deslocamento de
  fronteira de bloco pré-existente sem mistura de conteúdo.
- `tsc --noEmit`: 179 erros, igual à baseline conhecida (`services/confere/`, `src/app/confere/`,
  fora de escopo) — nenhum novo, nenhum em `pdfHtml.ts`/`pdfHtml.test.ts`.
- Testes escritos em `pdfHtml.test.ts` (um por função: `absorverBloco` não funde rodapé sem
  pontuação com a primeira linha da página seguinte; `absorverTabelaPorPosicao` não forma tabela
  com linha de vão largo de páginas diferentes). Não executados nesta sessão — mesmo impedimento
  já registrado no design do marcador órfão (bridge Linux sem o binário nativo do SWC que o Jest
  usa; `node_modules` instalado no Windows). Verificação aqui foi feita por leitura direta do
  código-fonte atual (constantes e funções auxiliares conferidas linha a linha, não por memória) e
  por execução real do conversor (`npx tsx`) contra os PDFs citados.
