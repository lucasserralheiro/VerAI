# Roteiro de demonstração — MVP de Análise de Medição Contratual

Duração prevista: **15 a 20 minutos**, com espaço para perguntas.
Público: quem hoje monta o relatório à mão e quem responde pelo contrato.

---

## Antes de começar

| Item | Conferir |
|---|---|
| Aplicação no ar | <http://localhost:3000> respondendo |
| Arquivos à mão | `contrato.pdf` e `levantamento.xlsx` — o catálogo vem com a aplicação |
| Impressos lado a lado | Páginas 2 e 3 do relatório GRC atual, e o documento gerado |
| Aba aberta | O relatório modelo, para comparar na tela |

Gere o documento **antes** da reunião. Mostre a geração ao vivo depois, quando o
resultado já estiver conhecido — demonstração ao vivo com resultado surpresa é
risco desnecessário.

---

## 1. O problema (3 min)

Abra o relatório GRC atual na página 2 e mostre a tabela.

> São 55 linhas em 22 seções. Para cada uma, alguém localiza o código no
> contrato, soma as linhas correspondentes, procura o mesmo código numa planilha
> de 22 abas e escolhe a variante certa da medição. Todo mês, para cada contrato.

Abra a planilha na aba `Levantamento` e mostre a extensão dela. Depois abra o
contrato na página 26 e mostre a tabela de itens.

**A frase que fixa o problema:** *nenhuma dessas etapas é difícil; a soma delas é
que consome o dia.*

---

## 2. A ferramenta (5 min)

Abra <http://localhost:3000>.

1. Envie os dois arquivos: o contrato e o levantamento.
2. Clique em **Gerar relatório**.
3. Baixe o `.docx` e **abra no Word**.

Abra a capa primeiro, depois passe à segunda página e coloque ao lado da página
2 do modelo.

> Capa institucional, papel timbrado, mesmas seções, mesma ordem, mesmas
> colunas. O que levava a manhã leva segundos, e o resultado é o mesmo
> documento — agora editável, para quem precisar revisar antes de assinar.

Não narre a arquitetura. Se perguntarem, uma frase basta: lê o contrato em PDF e
a planilha, compara por código de serviço e monta a tabela. Sem IA, sem
adivinhação — se algum dado não fecha, a ferramenta avisa em vez de inventar.

---

## 3. O achado (4 min) — **o ponto alto**

Vá ao item `11.027.00001.00`, certificado digital.

> O relatório atual diz **6**. O contrato diz **10**. O texto do aditivo diz, com
> todas as letras, "de 6 certificados para 10 certificados". A planilha também
> diz 10.

Mostre então os outros dois itens que o mesmo aditivo alterou:

| Item | Antes | Depois | No relatório atual |
|---|---|---|---|
| `12.030.00001.00` Conexão Internet | 130 | **60** | 60 ✅ |
| `14.070.00001.00` USN AWS | 107 | **120** | 120 ✅ |
| `11.027.00001.00` Certificado | 6 | **10** | **6** ❌ |

> Dois dos três aumentos foram incorporados e um ficou para trás. Não é
> interpretação: é o próprio documento em desacordo consigo mesmo.

**Feche assim:** a ferramenta não só reproduz o relatório — ela encontrou uma
divergência que a conferência manual não pegou. É a pergunta que levamos hoje
para vocês: **10 está correto?**

---

## 4. O que a ferramenta ainda não faz (3 min)

Diga isto antes que perguntem. Franqueza aqui compra credibilidade para o resto.

- **Consumo sem previsão contratual não aparece.** O relatório atual omite itens
  com quantidade contratada zero, e a ferramenta reproduz isso. No mês analisado
  há um caso: um servidor **medido 2 sem nada contratado**. Exibi-lo é barato e
  seria a primeira evolução.
- **Perfil contratado e perfil medido não são comparados.** O banco de dados foi
  contratado no perfil D e medido no perfil C, e o relatório mostra os dois como
  "1". O layout de duas colunas não comporta a diferença.
- **A capa é fixa.** Ela reproduz o modelo institucional, com o contrato e a
  proposta gravados. Para outro contrato, a capa sairia errada — torná-la
  dinâmica é o próximo passo natural, e as três caixas de texto já são
  exatamente onde os valores vivem.
- **Um contrato por vez.** Consolidar contrato original mais vários aditivos
  ficou fora deste MVP.
- **Análise de divergências ainda não existe.** O resumo executivo com itens
  críticos e divergências é o próximo passo natural, e o motor já produz os dados
  necessários.
- **Testado num único mês, de um único contrato.** É o pedido concreto que
  fazemos: um segundo levantamento, da competência anterior, para provar que
  generaliza.

---

## 5. Encerramento (2 min)

Três pedidos objetivos, nesta ordem:

1. **Confirmar a quantidade do certificado** — 10 ou 6.
2. **Revisar oito células do catálogo** — já preenchidas com proposta. Vale por
   contrato, não por competência: é conferência única.
3. **Um segundo levantamento**, da competência anterior do mesmo contrato.

E uma pergunta aberta: *o relatório de análise de divergências — resumo
executivo, itens críticos, o que divergiu — tem valor suficiente para ser o
próximo passo?*

---

## Perguntas prováveis

**"Usa inteligência artificial?"**
Não. As duas entradas são geradas por sistema e legíveis por máquina; o trabalho
é correspondência exata por código. Um modelo de IA aqui traria custo, lentidão e
resultado que muda entre execuções, sem resolver nada. A mesma entrada produz
sempre o mesmo relatório.

**"E se o layout da planilha mudar?"**
A leitura ancora em rótulo e código, nunca em posição fixa de linha. Mudanças
maiores fazem a ferramenta **falhar e avisar**, não produzir número errado.

**"Como sabemos que ele leu o contrato inteiro?"**
O contrato declara um total ao fim da tabela. A ferramenta recalcula a soma e
compara: hoje bate exatamente, `R$ 10.637.425,00`. Faltando uma linha, o valor
muda e o processamento é interrompido.

**"Serve para outros contratos?"**
O desenho é genérico: seções, ordem e tratamento de cada item vivem num catálogo
de apresentação, separado da lógica. O do contrato atual já acompanha a
ferramenta — por isso vocês só enviam dois arquivos. Um contrato com
apresentação diferente é um catálogo diferente, sem reescrever a comparação.
Falta a prova prática, e é daí que vem o pedido do segundo levantamento.

**"Dá para editar o documento?"**
Sim — é um `.docx`. Foi uma das razões de trocar o formato: um documento que
instrui faturamento passa por revisão, e revisar exige poder ajustar.

**"O documento sai sempre igual?"**
Sim. Duas execuções com os mesmos arquivos produzem documentos idênticos, byte a
byte. Não há data de geração nem identificador aleatório no conteúdo.

**"Quanto tempo para colocar em uso?"**
O que foi demonstrado está pronto. Falta acordar onde hospedar e fechar as três
pendências do encerramento.
