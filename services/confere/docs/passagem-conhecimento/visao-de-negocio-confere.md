# Confere — visão de negócio

| | |
|---|---|
| **Sistema** | Confere |
| **Mantenedor / responsável** | PRODAM |
| **Natureza** | Aplicação web de apoio a processo administrativo (conferência de faturamento) |
| **Órgãos já validados** | SMIT (Sustentação) e PGM |
| **Data desta análise** | 2026-09-21 |

Documento de leitura funcional para público de negócio: descreve o problema, o
processo, as regras e o valor entregue, sem entrar em código ou arquitetura.
Fontes: [README](../../README.md), [especificações 001–056](../specs/) e
[roteiro de demonstração](../roteiro-demonstracao.md).

---

## 1. O problema de negócio

Todo mês, para cada contrato de prestação de serviços de TIC, alguém precisa provar,
por escrito, que **o que foi medido bate com o que foi contratado** — é essa prova que
instrui o faturamento do fornecedor. Hoje esse trabalho é manual:

1. abrir a proposta comercial do contrato (PDF) e localizar a tabela de itens;
2. abrir a planilha de medição da competência, com dezenas de abas;
3. para cada item, localizar o código no contrato, somar os valores certos e
   escolher a variante correta da medição;
4. montar à mão o documento de comprovação que vai para o processo administrativo.

Nenhum passo é difícil isoladamente — **a soma deles consome o dia de um analista**,
e o resultado é uma peça lida por fiscal de contrato, controle interno e órgão de
fiscalização, onde um erro tem consequência.

## 2. O que o Confere entrega

Duas entradas, dois produtos:

| Entra | Sai |
|---|---|
| Contrato vigente (PDF) — proposta e aditivos | **Relatório de comprovação** (`.docx`, timbrado PRODAM), pronto para instruir o faturamento |
| Planilha de medição da competência (XLSX) | **Relatório de análise por gravidade** (`.xlsx`), que classifica cada item |

Nada mais é exigido: sem cadastro, sem login, sem arquivo de configuração.

## 3. Quem usa e quem lê o resultado

| Ator | Papel |
|---|---|
| **Analista de contrato** | Envia os dois arquivos e revisa o resultado na tela |
| **Fiscal de contrato** | Usa o relatório de comprovação para autorizar o faturamento |
| **Controle interno / órgão de fiscalização** | Lê o mesmo documento como peça de processo administrativo |
| **PRODAM** | Responde pelo documento emitido (identidade institucional no papel timbrado) |

## 4. O processo, antes e depois

| | Hoje, manual | Com o Confere |
|---|---|---|
| Tempo | Um dia de trabalho por contrato/competência | Cerca de 20 a 30 segundos de processamento |
| Fonte da verdade | Julgamento do analista, linha a linha | Regras fixas: contrato define o contratado, planilha define o medido |
| Divergência | Só aparece se alguém notar | Sinalizada automaticamente, com origem e ação recomendada |
| Repetibilidade | Duas pessoas podem chegar a números diferentes | Mesma entrada produz sempre o mesmo resultado |

## 5. As regras de negócio que definem o número

Estas são as decisões que qualquer área de negócio precisa validar, porque mudam o
resultado:

| Regra | O que ela decide |
|---|---|
| **Contratado vem do contrato, medido vem da planilha** | A coluna "quantidade contratada" da planilha nunca é usada — só o contrato tem autoridade sobre o que foi contratado |
| **Aditivos se aplicam em sequência** | Inclusão, Exclusão, Aumento e Redução de itens, sobre a proposta original, na ordem em que ocorreram |
| **Desconto de desenvolvimento sempre prevalece** | Quando a medição repete o mesmo código em mais de um bloco, vale o valor que já desconta recursos usados em ambiente de desenvolvimento — o cliente não paga por isso |
| **Identidade do par é conferida antes de processar** | Se contrato e planilha parecem falar de instrumentos diferentes, o sistema pergunta antes de emitir qualquer documento — nunca assume |
| **Item sem contrato e sem medição não entra em lugar nenhum** | Uma linha com as duas quantidades zeradas não prova nem desmente nada |
| **Consumo sem previsão contratual aparece à parte** | Item medido mas ausente do contrato não é escondido — sai em bloco próprio, tanto no relatório de comprovação quanto na tela |

## 6. Como cada item é classificado (análise por gravidade)

Além do relatório de comprovação, o Confere classifica cada item em quatro situações
exclusivas, para apoiar a leitura de risco:

| Situação | Significado para o negócio |
|---|---|
| **Crítico** | Foi medido mais do que foi contratado — dinheiro já gasto sem cobertura contratual |
| **Sem medição / maior relevância** | Há contrato e nada foi medido no período — não entregue ou não demandado |
| **Parcial / divergente** | Entrega abaixo do contratado, com saldo a acompanhar |
| **Conforme** | Contratado e medido batem |

No último par de arquivos processado (58 itens): **0 críticos, 20 sem medição, 16
parciais, 22 conformes**.

## 7. O que o sistema garante — e como avisa quando algo não fecha

O princípio de funcionamento é **avisar em vez de inventar**. Antes de gerar
qualquer documento, o sistema roda verificações que se dividem em dois efeitos:

- **Bloqueia**: nada é emitido — nem documento, nem linha parcial. Ocorre quando o
  sistema não consegue confiar no que leu (ex.: tabela de itens não localizada,
  total do contrato não confere).
- **Avisa**: o documento é emitido, mas com a ressalva registrada e visível (ex.:
  divergência entre a quantidade do contrato e da planilha).

Cada aviso e bloqueio tem título em português e uma ação recomendada — não é só um
código técnico.

## 8. Por que não usa Inteligência Artificial

As duas entradas são geradas por sistema e legíveis por máquina; o trabalho é
correspondência exata por código de serviço, não interpretação. Introduzir IA aqui
adicionaria custo, tempo de resposta e resultados que poderiam variar entre
execuções — sem resolver nada que o problema realmente peça. **A mesma entrada
sempre produz o mesmo relatório, byte a byte.**

## 9. Valor entregue

- **Tempo**: de um dia de trabalho manual para menos de meio minuto de
  processamento.
- **Achado real já comprovado**: numa comparação piloto, o Confere identificou uma
  divergência que a conferência manual não havia detectado — um item de aditivo
  contratual (certificado digital) cujo valor não foi corrigido no relatório vigente.
- **Rastreabilidade**: o relatório de comprovação vem acompanhado de anexos que
  mostram, aba por aba, de onde cada quantidade medida veio — quem revisa não
  precisa voltar à planilha original.
- **Consistência**: o mesmo critério é aplicado a todo contrato e toda competência,
  eliminando variação entre analistas.

## 10. O que ainda está fora do escopo, ou pendente de decisão do negócio

| Ponto | Situação |
|---|---|
| Consolidar mais de um contrato por execução | Fora do escopo — um único instrumento vigente por vez |
| Comparar perfil contratado × perfil medido (ex.: banco de dados perfil D contratado, perfil C medido) | O documento tem apenas duas colunas numéricas; a diferença de perfil não aparece hoje |
| Autenticação e controle de acesso | **Pendência de negócio, não técnica** — a aplicação está no ar sem login, e o documento gerado carrega dados nominais de servidores públicos (login, nome, e-mail). Precisa ser resolvida antes de sair de demonstração |
| Confirmação da quantidade de um item específico (certificado digital) | Aguardando validação da área de negócio sobre qual valor é o correto |
| Prova de generalização para um terceiro contrato | Dois contratos reais já validados (SMIT e PGM); um terceiro confirmaria que as regras não são específicas de um caso |

## 11. Glossário

| Termo | Significado |
|---|---|
| **Competência** | O mês a que a medição se refere |
| **Contratado** | Quantidade prevista no contrato (proposta + aditivos) |
| **Medido** | Quantidade apurada na planilha de medição do período |
| **Divergência** | Item em que contratado ≠ medido |
| **Item crítico** | Item medido acima do contratado |
| **Relatório de comprovação** | O `.docx` que instrui o faturamento |
| **Relatório de análise** | O `.xlsx` que classifica os itens por gravidade |
| **Aditivo** | Alteração contratual posterior à proposta original (inclusão, exclusão, aumento ou redução de item) |

---

## Para aprofundar

| Assunto | Documento |
|---|---|
| Visão técnica-funcional completa (estado de 2026-09-21) | [resumo-funcional.md](../resumo/resumo-funcional.md) |
| Regras de negócio e validações completas | [ESPEC 001](../specs/001-mvp-analise-medicao.md) |
| Aditivos contratuais | [ESPEC 019](../specs/019-contrato-e-aditivos.md) · [ESPEC 022](../specs/022-o-contratado-e-a-proposta-mais-os-aditivos.md) |
| Análise da medição por gravidade | [ESPEC 009](../specs/009-analise-da-medicao.md) |
| Estado atual e pendências de hospedagem | [README](../../README.md) |
| Apresentação a público não técnico | [Roteiro de demonstração](../roteiro-demonstracao.md) |
