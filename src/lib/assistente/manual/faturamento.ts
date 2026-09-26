import type { TemaDoManual } from './temas'

export const faturamento: TemaDoManual = {
  tema: 'faturamento',
  titulo: 'Faturamento: lançamento e envio ao cliente e ao GFP',
  palavrasChave: ['faturamento', 'faturar', 'competência', 'nota fiscal', 'NF', 'GFP', 'envio', 'cancelado', 'complementar'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
O lançamento mensal, por contrato e competência, do que foi executado, com as notas fiscais, e o envio ao cliente e ao GFP.

## Como o VerAI trata
- **Um lançamento principal** por contrato + competência; o que vier depois é **complementar**, à parte.
- Situação em lista fechada: Em aberto, Emitido, Pago, **Cancelado**. Cancelado não entra no faturado, no saldo, no % nem no "faturado no último mês"; se foi substituído, conta o novo lançamento.
- "Enviado ao cliente" e "Enviado ao GFP" são marcados no próprio lançamento.
- Alertas: lançamento das 3 últimas competências encerradas criado há mais de 10 dias sem os dois envios marcados; e, a partir do dia 15, competência encerrada sem lançamento num contrato que faturou em pelo menos 3 das 6 anteriores.

## Passo a passo na PRODAM [confirmar]
1. Fechar a medição da competência com a área técnica. [confirmar prazo]
2. Lançar o faturamento no VerAI, com valor, SEI e notas fiscais.
3. Enviar ao cliente e ao GFP e marcar os envios no lançamento. [confirmar prazo interno]
4. Nota substituída: cancelar o lançamento antigo e lançar o novo, nunca editar o valor por cima.

## Onde fazer no VerAI
Ficha do cliente → aba Faturamento (ou contrato → faturamentos): novo lançamento; abrir o lançamento para marcar os envios e anexar o PDF.`,
}
