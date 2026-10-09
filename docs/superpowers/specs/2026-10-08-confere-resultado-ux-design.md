> **Atualização (08/10/2026):** o Confere não pode ser alterado. Ficam valendo só as mudanças de tela (seção única,
> tabela única, itens sem divergência). Saem a coluna "Onde conferir", `todos_os_itens` no backend e o acabamento do
> XLSX/DOCX, que dependiam de mudar o backend.

# ConfereAI — tela de resultado sem repetição (08/10/2026)

Revisa a apresentação da ESPEC 009 (`R-PAN-01`, `D-03`), 018 (`R-REL-05`) e 038. Só tela: nenhum dado, regra de
domínio ou API muda.

## Problema
A tela de resultado (e o detalhe em `/confere/historico/[id]`) dizia a mesma coisa em vários lugares e o usuário
não sabia por onde começar:
- contrato e competência: no título, no cartão "Relatório gerado" e no cabeçalho de "Análise da medição";
- as mesmas divergências: no painel por gravidade **e** de novo no grid "na ordem do relatório" (a contagem parecia dobrar);
- o título da página no histórico era o nome do PDF;
- os quatro grupos nasciam fechados: a tela abria com quatro linhas e nenhum item à vista.

## Decisões
- **D-01 Um cartão de resumo** (`ResultadoPanel`): "N de M itens com divergência", uma frase de orientação
  (`orientacao()` — "Há 1 item crítico. Comece por ele."), contrato · proposta · competência (só nele) e os dois downloads
  com uma linha dizendo qual é qual. Botão primário em navy; tamanho padrão.
- **D-02 Uma seção "Itens para conferir"** (`ItensParaConferir`) com seletor **Por gravidade** (padrão) /
  **Na ordem do documento**. As duas listas nunca aparecem juntas. `R-PAN-01` e `R-REL-05` seguem valendo, uma por vez.
- **D-03 (revisa a D-03 da ESPEC 009)** Grupos com itens nascem **abertos**; *Sem divergência* fica fechado; grupo
  vazio é uma linha sem chevron. Nada fica atrás de clique para quem veio ver o problema.
- **D-04 Uma tabela só** (`TabelaDeItens`) para as duas visões. Texto 15 px, cabeçalho 12 px, marcas 12 px, cor de texto
  de contraste normal (o `navy-300` dos rótulos saiu). Cabeçalhos: "Qtd. contratada", "Qtd. medida", "Saldo".
- **D-05 Legenda única**: "Saldo = contratado − medido"; a frase do saldo negativo só aparece se houver saldo negativo.
- **D-06 Histórico**: título = contrato · competência (não mais o nome do PDF); os arquivos usados ficam numa lista
  abaixo; o cartão de resumo usa `semIdentificacao` para não repetir.
- Fora do escopo, intactos: avisos (`R-AVI-*`), linhas derivadas, divergência de fonte e a ordem entre elas.

## Arquivos
`ResultadoPanel.tsx`, `ItensParaConferir.tsx` (novo), `TabelaDeItens.tsx` (novo), `AnaliseMedicaoPanel.tsx` (só os
quatro grupos), `DivergenciaGrid.tsx` (só a tabela/mensagem vazia), `historico/[id]/page.tsx`.

## Addendum — XLSX de análise (08/10/2026)
Só apresentação; geometria do gabarito, nomes de aba e colunas existentes intactos.
- **Resumo:** nome da situação vira link para a aba; bloco "Como ler esta planilha" abaixo do total.
- **Abas de detalhe:** cor da aba = cor da tarja da tela; bordas finas, zebra, descrição que quebra linha, filtro no
  cabeçalho, saldo negativo em vermelho (formatação condicional, valor intacto), impressão em paisagem com cabeçalho
  repetido.
- **Colunas "Linha na planilha" e "Página no contrato"** (numéricas) nas três abas com divergência. **Não** em
  *Sem Divergência*: a v1.3 da ESPEC 009 fixou essa aba nas quatro colunas do gabarito, e o teste exige igualdade.
