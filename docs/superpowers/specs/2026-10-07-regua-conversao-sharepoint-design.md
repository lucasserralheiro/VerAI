# Régua da conversão sobre o corpus do SharePoint

Data: 07/10/2026 · Estado: implementado (`npm run regua:conversao`)

## Problema

A régua da conversão (`npm run diag:pdf -- ./arquivos-teste-conversao`) mede ~20 PDFs escolhidos à
mão. Com ela dá pra ver se uma mudança de heurística consertou o exemplar da vez, mas não se
quebrou outro: 20 arquivos cobrem poucos geradores, e a comparação antes × depois era feita no olho,
somando o resumo por gerador. Agora a biblioteca ContratosReceita está inteira no PC (pasta do
OneDrive lida pela sincronização) e cada pasta de termo guarda a proposta (PC/PA) que originou o
termo — ~450 PDFs de todos os clientes e anos, a amostra mais próxima do que chega na "Nova
conversão".

## O que foi feito

1. **Métricas numa definição só** — `src/lib/extracao/regua/metricas.ts` (`medirConversao`), tiradas
   de `scripts/diagnostico-conversao.mts`, que passou a importá-las. Puras, testadas com HTML escrito
   à mão.
2. **Fidelidade** (`fidelidade.ts`) — a pergunta "saiu exatamente igual?" em número: palavras do
   texto do PDF (`paginasConvertidas[].textoOriginal`) que somem, sobram ou mudam de ordem no texto
   visível do HTML, e o mesmo para **números** (valor, código de serviço, data), que é o invariante:
   número perdido ou a mais deveria ser sempre zero. Não depende de conhecer o defeito — célula
   engolida, parágrafo duplicado na quebra de página, valor trocado de coluna aparecem todos. O
   absoluto tem ruído estável (hifenização juntada, "BRL269,00" grudado no PDF); o que vale é o
   antes × depois do mesmo arquivo.
3. **Corpus** (`corpus.ts`) — PDFs da biblioteca cujo nome é de proposta (`PC-…`, `PA-…`,
   "Proposta…"), mais todos os PDFs de `arquivos-teste-conversao`; cópia idêntica (mesmo sha256)
   conta uma vez. Gerador agrupado por família, sem versão.
4. **Comparação arquivo a arquivo** (`comparar.ts`) — pareia pelo sha256 do PDF e classifica cada
   arquivo: piorou, misto, melhorou, só o HTML mudou, igual. Qualquer indicador de problema que sobe
   (ou acerto que desce) é piora. Pontuação ponderada ordena os piores arquivos e os geradores —
   é a lista de onde trabalhar a seguir.
5. **Script** `scripts/regua-conversao.ts` — `--salvar` guarda a base em `logs/regua-conversao.json`
   e o HTML de cada PDF em `logs/regua-conversao/base/`; sem `--salvar` reconverte os MESMOS PDFs,
   grava em `logs/regua-conversao/agora/` e compara. Saída 1 quando algo piorou. `--detalhe=<trecho>`
   mostra o diff do HTML por bloco; `--filtro`, `--gerador`, `--por-gerador=N` para iterar rápido
   (com `--salvar`, filtro só atualiza esses arquivos na base). Nada vai pro banco nem pro Git
   (`logs/` está no `.gitignore`; documento de cliente não sobe).

## Quem converte não roda régua (adendo do mesmo dia)

O usuário sobe o documento e não tem como testar nada — então a régua precisa rodar sozinha nos
dois lados:

1. **Na tela, em toda proposta** — o card "Conferência de totais" ganhou uma linha a mais,
   `ConferenciaTexto` (`src/app/propostas-comerciais/[id]/conferencia-texto.tsx`): "Todos os N
   números do original estão no documento" ou "K números do original não estão no documento". Vem da
   mesma chamada e do mesmo cache (`conferir-totais/route.ts`, campo `texto` em `conferenciaTotais`,
   sem migração; cache antigo sem o campo é refeito uma vez). Regra em `conferirTextoDoOriginal`
   (`fidelidade.ts`): TODO número do original (valor, código de serviço, data, quantidade), contando
   repetição, contra o documento como está AGORA; cada número perdido traz página, a linha do
   original e "Ver no PDF". "A mais" só quando há uma fonte só, sem planilha e sem OCR (senão é
   número de outro arquivo). Diferença para a conferência de totais: lá só valor monetário e só
   "existe em algum lugar"; aqui valor que aparecia 3 vezes e ficou 2 é acusado.
2. **No corpus, todo documento real** — `--do-sistema` baixa o original de cada conversão de PDF
   (`PropostaComercialArquivo`, R2) para `logs/regua-conversao/sistema/`, com cache; daí em diante
   eles entram em toda rodada. O que os usuários sobem vira caso de teste sem ninguém separar arquivo.
   Rodar com o `.env` da produção (é onde estão as conversões reais); só lê.

## Ciclo de trabalho

1. `npx dotenv -e .env.production.local -- npm run regua:conversao -- --salvar --do-sistema` (demora —
   ~450 propostas do SharePoint + as conversões reais). Sem `--do-sistema` não precisa de `.env`.
2. Escolher o alvo no PANORAMA: gerador e arquivos com maior pontuação.
3. Mexer na heurística, com teste unitário do caso (TDD, como sempre).
4. `npm run regua:conversao -- --gerador=<o do alvo>` para iterar; depois sem filtro.
5. Piorou algo? `--detalhe=<arquivo>` e decidir: regressão (corrigir) ou mudança esperada.
6. Aceito: `--salvar` de novo — a base passa a ser o novo patamar.

Mesmas regras de sempre da conversão: o conversor não ramifica por gerador (o gerador serve pra
medir), e ajuste no olho em cima de um exemplar é o que a régua existe pra impedir.

## Fora do escopo

- Imagem não entra no HTML da régua (sem `salvarImagem`, como no `diag:pdf`).
- Não compara com o `.docx` original (não temos o Word de origem das propostas). Se um dia a pasta
  tiver o par PDF + DOCX, o texto do DOCX vira um gabarito melhor que a camada de texto do PDF.
- Termos (TC/TA) ficam fora por padrão; `--todos-pdfs` inclui (mais geradores, inclusive SEI).
