import type { TemaDoManual } from './temas'

export const sei: TemaDoManual = {
  tema: 'sei',
  titulo: 'Processo SEI: trâmite interno',
  palavrasChave: ['SEI', 'processo', 'trâmite', 'número do processo', 'despacho', 'assinatura'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
O processo eletrônico (SEI) onde o contrato, os aditivos, as prorrogações e o faturamento são instruídos e assinados. Cada contrato costuma ter o SEI do cliente e o SEI da PRODAM.

## Como o VerAI trata
- Número do SEI sempre mostrado com máscara e clicável: abre o processo quando há link cadastrado (tabela de links por número) ou pelo modelo configurado; senão, o clique copia o número.
- O assistente escreve SEI como link \`sei:\` e acha onde um número aparece (contratos, faturamentos, demandas, fornecedores, termos) pela busca por SEI.
- SEI do cliente e SEI da PRODAM são campos separados no contrato.

## Passo a passo na PRODAM [confirmar]
1. Toda formalização (prorrogação, aditivo, apostilamento, rescisão) é instruída no SEI do contrato. [confirmar qual dos dois SEIs]
2. Documentos na ordem: solicitação/justificativa, proposta, manifestação técnica e jurídica, minuta, assinatura, publicação. [confirmar]
3. Depois de assinado, anexar o PDF final no histórico do contrato no VerAI (ou deixar na pasta do SharePoint, que a sincronização traz).

## Onde fazer no VerAI
Contrato → cabeçalho (SEI do cliente e da PRODAM); o link de cada número é cadastrado uma vez e vale em todas as telas.`,
}
