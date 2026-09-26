import type { TemaDoManual } from './temas'

export const confere: TemaDoManual = {
  tema: 'confere',
  titulo: 'Quando usar o ConfereAI',
  palavrasChave: ['ConfereAI', 'Confere', 'medição', 'levantamento', 'comprovação', 'contratado × utilizado'],
  status: 'rascunho',
  validadoPor: null,
  validadoEm: null,
  texto: `## O que é
Ferramenta que compara o contratado (contrato e aditivos) com o utilizado (planilha de levantamento/medição) e gera o relatório de comprovação em DOCX e XLSX.

## Quando usar [confirmar]
- Na comprovação mensal de uso de um contrato por item/serviço, antes do faturamento. [confirmar periodicidade]
- Quando o cliente questiona quantidades faturadas.
- Antes de um aditivo de valor, para mostrar o consumo real.

## Como o VerAI trata
- Em "ConfereAI", ao escolher a planilha de levantamento, o sistema lê o cabeçalho ("conforme contrato", "Data do Levantamento") e preenche contrato e aditivos com as PC/PA do SharePoint: a base é a proposta da última renovação em vigor na competência; os aditivos, as propostas depois dela. A escolha manual nunca é trocada sozinha.
- A geração leva de 1 a 2 minutos (o serviço pode estar "dormindo" e demorar mais na primeira).
- Cada execução fica no histórico (ConfereAI → Histórico) com os nomes dos arquivos, o contrato e a competência, para baixar de novo o DOCX e o XLSX; os arquivos de entrada não são guardados.

## Passo a passo
1. ConfereAI → escolher a planilha de levantamento.
2. Conferir contrato e aditivos sugeridos (ou escolher pela janela "Pastas do cliente").
3. Gerar e baixar o relatório; ele fica no histórico.`,
}
