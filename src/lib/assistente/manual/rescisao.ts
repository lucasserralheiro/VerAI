import type { TemaDoManual } from './temas'

export const rescisao: TemaDoManual = {
  tema: 'rescisao',
  titulo: 'Rescisão e encerramento',
  palavrasChave: ['rescisão', 'rescindir', 'encerrar', 'encerramento', 'distrato', 'extinção', 'finalizado'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
- **Encerramento**: o contrato termina no fim da vigência, sem prorrogação.
- **Rescisão**: extinção antes do prazo, por acordo (distrato) ou por uma das hipóteses previstas no contrato e na lei. [confirmar]

## Como o VerAI trata
- Linha "Rescisão" no histórico marca o contrato como **rescindido**: ele deixa de ser ativo e sai dos alertas de vencimento.
- Situação com encerramento ("Finalizado", "Encerrado") também tira o contrato dos ativos. "Finalizado" com a vigência ainda correndo aparece na auditoria das contas para conferência.
- Rescisão nunca é usada como valor contratado.

## Passo a passo na PRODAM [confirmar]
1. Registrar o motivo e a data pretendida no processo SEI.
2. Conferir pendências: faturamento das competências até a data, entregas, garantia a liberar. [confirmar]
3. Formalizar o termo de rescisão (ou distrato) assinado. [confirmar]
4. Registrar a linha "Rescisão" no histórico e atualizar a situação do contrato.

## Norma [confirmar]
Hipóteses, prazos de aviso e efeitos da rescisão dependem da lei que rege o contrato. Citar artigo só depois de o texto oficial estar na base de normas.

## Onde fazer no VerAI
Contrato → histórico: linha "Rescisão" com a data e o PDF; cabeçalho do contrato: situação.`,
}
