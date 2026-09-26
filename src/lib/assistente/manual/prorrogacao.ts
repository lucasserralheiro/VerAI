import type { TemaDoManual } from './temas'

export const prorrogacao: TemaDoManual = {
  tema: 'prorrogacao',
  titulo: 'Prorrogação de vigência',
  palavrasChave: ['prorrogar', 'prorrogação', 'vigência', 'vencimento', 'renovar', 'renovação', 'prazo'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
Estender o prazo de vigência de um contrato que ainda está vigente, por termo aditivo (ou termo de prorrogação) assinado pelas partes.

## Como o VerAI trata
- O fim de vigência é o **maior vencimento** entre o cabeçalho do contrato e as linhas do histórico **assinadas** (contrato, aditivo, prorrogação).
- Aditivo ou prorrogação **sem assinatura** (sem "Assinada em" nem situação assinada/vigente/publicada) **não estende** o prazo: vira o aviso "prorrogação sem assinatura".
- Situação "Ativo" com a vigência já vencida continua ativo, com o aviso "situação desatualizada" para quem mantém o cadastro decidir.
- Os alertas avisam quando faltam 90 dias (atenção) e 30 dias (crítico) sem prorrogação.

## Passo a passo na PRODAM [confirmar]
1. Antes do vencimento, confirmar com o cliente se há interesse em prorrogar. [confirmar prazo de antecedência]
2. Abrir/instruir o processo SEI com a justificativa e a proposta atualizada. [confirmar documentos exigidos]
3. Conferir se o limite de prorrogações do contrato permite mais uma. [confirmar]
4. Assinar o termo **antes** do fim da vigência: contrato vencido não se prorroga, é preciso contratar de novo. [confirmar]
5. Registrar a linha no histórico do contrato com a data de assinatura e o novo vencimento.

## Norma [confirmar]
Os limites de duração e de prorrogação dependem da lei que rege o contrato (Lei 14.133/2021 ou Lei 13.303/2016, e contratos antigos ainda regidos pela 8.666/1993). O artigo exato só pode ser citado depois que o texto oficial estiver na base de normas.

## Onde fazer no VerAI
Ficha do cliente → aba Contratos → contrato → histórico: nova linha "Prorrogação" (ou "Aditivo"), com "Assinada em", início e vencimento.`,
}
