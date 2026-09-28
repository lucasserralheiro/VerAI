# TC/TA abre a mesma janela da PC/PA — design

**Data:** 28/09/2026 · **Pedido do usuário:** "preciso igualar no sentido de TC/TA abrir assim também
em vez de abrir o arquivo" (aba Contratos da ficha do cliente).

## Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Ícone **PC/PA** | abre a janela com todas as propostas do contrato (Abrir PDF, Converter/Abrir em Markdown) | igual |
| Ícone **TC/TA** | abre direto o PDF do termo **mais recente** | abre a **mesma janela**, com todos os termos do contrato (TC e cada TA), cada um com Abrir PDF e Converter/Abrir em Markdown |

Nada novo nas janelas (sem "copiar link" nem "baixar" — o usuário escolheu só igualar).

## Como

- **Uma janela só** — `PropostasDoContrato` (`src/app/clientes/[id]/contratos/propostas-do-contrato.tsx`)
  vira `DocumentosDoContrato` (`documentos-do-contrato.tsx`) e recebe `coluna: 'proposta' | 'termo'`.
  Muda só o texto (título "TC/TA do …", "Escolha o termo…", "Nenhum TC/TA ligado a este contrato") e o
  filtro; abrir, converter e "já convertida → Abrir em Markdown" são os mesmos (`useConverterArquivo`).
  Copiar a janela numa `TermosDoContrato` foi descartado: as duas divergiriam, que é o problema que o
  usuário apontou.
- **Filtro** — `propostasDoContrato` (`abas/documentos/derivados.ts`) vira
  `documentosDoContrato(arquivos, contratoId, coluna)`: arquivo com uso deste contrato na coluna pedida
  do histórico, ou com uso deste contrato e categoria daquela coluna (PC/PA = `PROPOSTA_COMERCIAL`/
  `PROPOSTA_ADITIVO`; TC/TA = `TERMO_CONTRATO`/`TERMO_ADITIVO`). É a regra da PC/PA espelhada.
- **Aba Contratos** — o ícone TC/TA vira botão igual ao da PC/PA; aparece quando
  `resumoHistorico.termo` existe, senão o traço (mesma condição de hoje para a PC/PA). O componente
  `IconePdf`, que abria o PDF direto, sai; o traço fica.
- **Detalhe da linha** — "TC/TA de TA 01", tirado do rótulo do uso da coluna, como a PC/PA já faz;
  sem uso na coluna, a categoria do arquivo.

## Fora de escopo

Mudar o que conta como termo do contrato (vem do SharePoint e do anexo à mão, spec
`2026-09-23-sharepoint-lugar-certo-design.md`), ordem da lista (a mesma do repositório) e o
comportamento do detalhe do contrato (`/clientes/[id]/contratos/[contratoId]`).
