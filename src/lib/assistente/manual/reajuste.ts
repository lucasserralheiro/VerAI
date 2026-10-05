import type { TemaDoManual } from './temas'

export const reajuste: TemaDoManual = {
  tema: 'reajuste',
  titulo: 'Reajuste e repactuação',
  palavrasChave: ['reajuste', 'repactuação', 'índice', 'IPC-FIPE', 'IPCA', 'IGP-M', 'ICTI', 'correção', 'data-base'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
- **Reajuste**: atualização do preço por um índice definido no contrato (ex.: IPC-FIPE, IPCA, ICTI), depois do prazo mínimo contado da data-base.
- **Repactuação**: revisão pela variação real dos custos (comum em serviços com mão de obra), mediante demonstração.

## Como o VerAI trata
- O índice e a periodicidade estão na **ficha** de cada PDF do histórico (proposta e termo), com a página de onde saíram. Para o texto exato da cláusula, o assistente busca no documento.
- Reajuste aplicado deve aparecer no histórico (apostilamento ou aditivo) para o valor contratado refletir o novo preço.

## Passo a passo na PRODAM [confirmar]
1. Conferir na proposta/termo o índice, a data-base (proposta ou assinatura) e a periodicidade. As propostas da PRODAM costumam prever reajuste anual, contado da apresentação da proposta. [confirmar]
2. Calcular o índice acumulado do período. [confirmar fonte oficial do índice]
3. Formalizar: reajuste previsto no contrato costuma ser por **apostilamento**; repactuação e mudança de condição, por **aditivo**. [confirmar]
4. Registrar no histórico o novo valor e a data.

## Norma [confirmar]
A exigência de cláusula de reajuste, o prazo mínimo e a forma de formalização dependem da lei que rege o contrato e do decreto municipal. Citar artigo só depois de o texto oficial estar na base de normas.

## Como a ferramenta Reajuste IPC-Fipe corrige planilha
- Corrige o **preço unitário** (× fator acumulado, 2 casas). Quantidade e meses nunca são corrigidos.
- Total, subtotal e cronograma **refazem a conta** da planilha com o preço corrigido (a fórmula é copiada para a coluna corrigida), em vez de multiplicar o total pelo fator — assim o total bate com a soma dos itens.

## Onde fazer no VerAI
Contrato → histórico: linha do apostilamento/aditivo com o novo valor. Pergunte ao assistente "qual o índice de reajuste do contrato X" para ver a ficha com a página.`,
}
