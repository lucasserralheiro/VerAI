import type { TemaDoManual } from './temas'

export const apostilamento: TemaDoManual = {
  tema: 'apostilamento',
  titulo: 'Apostilamento × termo aditivo',
  palavrasChave: ['apostilamento', 'apostila', 'aditivo', 'termo aditivo', 'formalizar', 'alteração'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
- **Apostilamento**: registro simples, sem nova assinatura das partes, de algo que o contrato já prevê (ex.: reajuste pelo índice contratado, atualização de dotação, correção de dado cadastral). [confirmar lista]
- **Termo aditivo**: alteração do contrato que exige acordo e assinatura (prazo, valor, quantidade, objeto dentro do permitido).

## Como o VerAI trata
- As duas formas entram como linhas do histórico do contrato. O VerAI só considera a linha para vigência e valor quando ela está **assinada** ("Assinada em" preenchida ou situação assinada/vigente/publicada).
- Na leitura dos PDFs do SharePoint, "apostila" é lida como aditivo pela régua de estrutura; mudar essa regra afeta outros clientes (ver régua do SharePoint).

## Como decidir [confirmar]
1. A mudança já está prevista e calculável pelo próprio contrato? → apostilamento.
2. Muda prazo, valor, quantidade ou condição acordada? → termo aditivo.
3. Em dúvida, tratar como aditivo e consultar o jurídico.

## Norma [confirmar]
As hipóteses de apostilamento e de aditivo são definidas pela lei que rege o contrato. Citar artigo só depois de o texto oficial estar na base de normas.

## Onde fazer no VerAI
Contrato → histórico: nova linha do tipo adequado, com o PDF do termo/apostila anexado e a data.`,
}
