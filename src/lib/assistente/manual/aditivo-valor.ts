import type { TemaDoManual } from './temas'

export const aditivoValor: TemaDoManual = {
  tema: 'aditivo-valor',
  titulo: 'Aditivo de valor (acréscimo e supressão)',
  palavrasChave: ['aditivo', 'acréscimo', 'supressão', 'valor', 'saldo', 'estouro', 'faturado acima'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
Termo aditivo que aumenta (acréscimo) ou reduz (supressão) o valor ou as quantidades do contrato, mantido o objeto.

## Como o VerAI trata
- **Valor contratado** = valor do último termo **assinado** do histórico (nunca rescisão nem prospecção); sem ele, a soma dos itens; sem os dois, "sem valor cadastrado" e o contrato fica fora das somas.
- **Saldo** = valor contratado − faturado; faturamento **Cancelado** não conta no faturado.
- Os alertas avisam quando o faturado passa do contratado (crítico) e quando, no ritmo dos últimos meses, o saldo acaba antes do fim da vigência (crítico se em até 60 dias).
- Aditivo sem assinatura não muda o valor contratado.

## Passo a passo na PRODAM [confirmar]
1. Ao ver o saldo acabando, levantar a necessidade com o cliente e a área técnica.
2. Instruir o processo SEI com a justificativa e a proposta comercial do acréscimo. [confirmar documentos exigidos]
3. Conferir o limite legal de acréscimo sobre o valor inicial atualizado. [confirmar percentual e base de cálculo]
4. Assinar o termo aditivo e registrar a linha no histórico com o novo valor e a data de assinatura.

## Norma [confirmar]
O limite percentual de acréscimos e supressões depende da lei que rege o contrato. Não citar percentual nem artigo até o texto oficial estar na base de normas.

## Onde fazer no VerAI
Contrato → histórico: linha "Aditivo" com o valor total após o aditivo e "Assinada em". O saldo e o % faturado se atualizam sozinhos.`,
}
