# Sincronização da biblioteca "ContratosReceita" (SharePoint) com o repositório de documentos

> **Revisto em 23/09/2026** por `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`
> (aba Documentos completa, identidade estável, PC/PA–TC/TA por referência, uma execução só). Onde
> conflitarem, vale o novo.

**Data**: 24/09/2026 · **Status**: aprovado pelo usuário (caminho sem TI) · **Plano**:
`docs/superpowers/plans/2026-09-24-sincronizacao-sharepoint-contratos.md`

## 1. Problema

O financeiro (DAF/GFP) mantém no SharePoint `Prodam.DAF.GFP.Services`, biblioteca **ContratosReceita**,
todos os termos de contrato de receita da PRODAM: uma pasta por cliente, uma pasta por contrato, uma
subpasta por termo (contrato inicial, TA 01, TA 02...). O VerAI precisa desses arquivos no repositório
do cliente (`ArquivoCliente`) e precisa receber o que o financeiro alterar, sem ninguém subir à mão.

## 2. Decisão: OneDrive + script local agendado (sem TI)

Registro de aplicativo no Entra ID (Microsoft Graph, `Sites.Selected`) é o caminho oficial, mas
depende de aprovação do admin do tenant. Até lá:

```
SharePoint ──(cliente OneDrive, "Sincronizar")──> C:\Users\p017886\rede.sp\rede.sp - ContratosReceita
            ──(Agendador de Tarefas, a cada 30 min)──> scripts/sincronizar-sharepoint.ts
            ──> Vercel Blob + ArquivoCliente (origem = sharepoint)
```

- Usa o acesso do Lucas à biblioteca. Se o PC estiver desligado, nada se perde: a próxima execução
  compara a pasta inteira com o estado gravado e pega tudo que mudou.
- A leitura do arquivo no Windows baixa o conteúdo sob demanda (Arquivos On-Demand). Recomendado
  marcar a pasta como **"Sempre manter neste dispositivo"** pra execução não depender de download.
- Quando o Graph for liberado, só troca a **fonte** (listar/ler arquivo); estado, regras e gravação
  ficam iguais — por isso o estado vive no banco, não num arquivo local.

## 3. Estrutura observada (24/09/2026, ~510 arquivos, 46 pastas de cliente)

```
<CLIENTE>/                                   ADESAMPA, SMS, "SGM - CASA CIVIL", "SUB-GUAIANASES"...
  TC 073-2019 - Acesso a Rede/               pasta do contrato (começa com "TC ")
    1) TC 073-2019 - Contrato Inicial/       pasta do termo
      PC-ADESAMPA-191007-139 ... .pdf        proposta comercial
      TC 073-2019- ADESAMPA (assinado SEI).pdf
    2) TC 073-2019 - TA 01-2020 - acréscimo/
      TA 01 ao TC 073-2019 - assinado.pdf
      WORK/                                  rascunhos (memória de cálculo, .docx de proposta)
  Contratos Finalizados/TC .../...           contratos encerrados, um nível a mais
```

95% PDF; `.xlsx/.docx/.doc` quase só dentro de `WORK/`. Aparecem arquivos de trava do Office (`~$...`).

## 4. Regras

1. **Cliente = primeira pasta**, casada com `Cliente.siglaLegado` (sem caixa/acento). Pasta que não
   casa usa o mapa `scripts/sharepoint-clientes.json` (`{"SGM - CASA CIVIL": "SGM"}`); se ainda não
   casar, é **pulada e listada** no relatório — nunca cria cliente (mesma regra do importador GRC-1).
   Valor `null` no mapa = ignorar a pasta de propósito (ex.: "1. PUBLICAÇÕES NO DOC").
2. **Ignorados**: arquivo ou pasta começando com `.` ou `~$`; pastas `WORK` (rascunho — `--incluir-work`
   inclui); extensão fora de `CONTENT_TYPES` (`src/lib/arquivos/tipos.ts`); acima de 50 MB.
3. **Categoria** por `sugerirCategoria(nome)` (PC/PA/TC/TA pelo prefixo; senão OUTRO) — a pessoa
   reclassifica na aba Documentos se precisar.
4. **Sem contrato nem competência no arquivo** (§7 do repositório): o caminho de origem fica guardado
   em `ArquivoSharepoint.caminho` (e `pastaContrato`) só como informação, pra sugerir vínculo depois.
5. **Mesmo conteúdo = mesmo arquivo**: SHA-256 por cliente, igual ao upload. O mesmo PDF em dois
   termos (ex.: a proposta de aditivo repetida em TA 02 e TA 03) gera um `ArquivoCliente` e duas
   linhas de estado apontando pra ele.
6. **Detecção de mudança**: tamanho + data de modificação iguais ao estado → nada a fazer (não lê o
   arquivo). Diferente → lê, calcula hash; hash igual → só atualiza o estado.
7. **Conteúdo novo no mesmo caminho** (financeiro trocou o PDF): grava o novo `ArquivoCliente`; o
   anterior é removido (lógico) **se** nenhum uso (`usosDosArquivos`) e nenhuma outra linha de estado
   ativa apontar pra ele; senão fica, e o relatório avisa.
8. **Sumiu da pasta** (apagado ou movido): processado **depois** de todos os presentes, pra que mover
   de pasta (mesmo hash, caminho novo) não apague o arquivo. Remove (lógico) com as mesmas condições
   do item 7; a linha de estado recebe `removidoNaOrigemEm`.
9. **Nada gravado sem `--aplicar`** — sem ele o script só lista o que faria (padrão dos scripts).
10. Falha num arquivo (leitura, Blob) não para a execução: vai pro relatório e é tentada de novo na
    próxima rodada (o estado não é atualizado).

## 5. Modelo

```prisma
enum OrigemArquivo { upload gerado migrado sharepoint }

/// Estado da sincronização: uma linha por caminho de arquivo na biblioteca.
model ArquivoSharepoint {
  id                 String          @id @default(cuid())
  caminho            String          @unique   // relativo à raiz da biblioteca, com "/"
  pastaContrato      String?                   // primeiro segmento "TC ..." — só informativo
  tamanhoBytes       Int
  modificadoEm       DateTime
  sha256             String
  arquivoId          String?
  arquivo            ArquivoCliente? @relation(fields: [arquivoId], references: [id], onDelete: SetNull)
  vistoEm            DateTime
  removidoNaOrigemEm DateTime?
}
```

Sem `clienteId` próprio (o cliente é o do `ArquivoCliente`), então **excluir** e **mesclar** cliente
não precisam mudar: excluir apaga os arquivos e o `SET NULL` solta o estado (a próxima execução
recria, se a pasta ainda casar); mesclar move os arquivos e o estado continua apontando certo.
`enviadoPorId` fica `null` nos arquivos vindos do SharePoint.

## 6. Fora do escopo (agora)

- Vincular automaticamente o arquivo à linha do histórico do contrato (usar `pastaContrato` +
  casamento tolerante de `vincular-itens.ts`) — próximo passo.
- Microsoft Graph (delta + webhook) — quando a TI liberar `Sites.Selected`.
- Tela de acompanhamento da sincronização — por ora o log do agendador (`logs/sincronizar-sharepoint.log`).

## 8. Importação no fluxo de cliente (clientes, contratos, histórico)

Pedido do usuário (24/09): "cria todos de acordo com o fluxo de cliente e organiza os dados dentro
deles de acordo com o que tem em cada pasta". `scripts/importar-sharepoint-contratos.ts`, código em
`src/lib/importacao-sharepoint/`.

### 8.1 Estrutura (`estrutura.ts`) — só nomes de pasta/arquivo
- Contrato = pasta `TC <nº>-<ano>` (com ou sem sigla, "SN" = sem número, ano de 2 dígitos → 20xx).
  Identidade = `<pasta do cliente>|<nº> <ano>`, então termo solto no cliente (ICI) e pasta repetida
  (SUB-ITP / SUB-ITAM PAULISTA) caem no mesmo contrato. Contrato inicial aninhado dentro de um aditivo
  com número próprio (SMIT) vira contrato à parte.
- `Contratos Finalizados*` → `situacao = "Finalizado"`. Pasta de contrato sem subpasta → os arquivos
  dela são o contrato inicial.
- Termo pelo nome: "Contrato Inicial" → CONTRATO; `TRA`/rescisão/indenização → RESCISAO;
  prorrogação/"12m"/"N meses" → PRORROGACAO; TA/TAP (apostilamento)/acréscimo/redução/reajuste →
  ADITIVO. "(não virou)"/"substituído" → linha "Cancelado (não efetivado)", sem data; "TA XX" sem
  assinatura → "Em elaboração".
- PDF do termo = nome começando com TC/TA/TAP/TRA ou com "termo"/"assinado" (prefere "assinado");
  PDF da proposta = PC/PA. `WORK/` fica de fora.

### 8.2 Campos do PDF (`texto.ts`, `pdf-texto.ts`)
Determinístico, só as 8 primeiras e 3 últimas páginas, 30 s por PDF: nº do termo, SEI do cliente e
SEI PRODAM (7010.*), objeto, valor (contrato: "VALOR DO CONTRATO:"/"o valor estimado do presente
contrato é de"; aditivo: "passa a ser"/"totalizando o valor"), assinatura (última "Em dd/mm/aaaa, às"
do SEI, senão "São Paulo, dd de mês de aaaa"), vigência (perto de "a vigência do presente…",
"fica prorrogado", "por mais": prazo em meses, "a partir de"/"a contar de", "término em").
Medição em 24/09 (623 PDFs de termo): ~28% escaneados, sem texto — entram com estrutura e PDF, datas e
valor ficam pra preencher na tela. Dos com texto: valor do contrato ~80%, assinatura ~85%, prazo ~80%.

### 8.3 Gravação (`importar.ts`)
- Cliente: pela sigla (pasta ou `pastas` do JSON); cria o que falta com o nome de `nomes`; cliente
  cujo nome é só a sigla (ex.: "SMDET") recebe o nome oficial.
- Contrato: `Contrato.chaveSharepoint` (identidade); na primeira vez casa com contrato do legado pelo
  `chaveNumerica(numeroTermo)`, só se único. Linha do histórico: `HistoricoContrato.chaveSharepoint`;
  na primeira vez casa CONTRATO com a linha CONTRATO do legado e TA pelo número tolerante, só se único.
- **Só preenche o que está vazio** — nada digitado ou vindo do legado é sobrescrito; PDF já anexado
  fica. Vencimento de contrato = fim lido ou início + meses; prorrogação sem data explícita começa no
  dia seguinte ao vencimento anterior e soma os meses (do texto ou do nome da pasta).
- PDFs anexados como cópia no caminho da linha (`buildHistoricoContratoPdfPath`), igual à tela; acima
  de 15 MB fica só no repositório de documentos.
- Contrato novo roda `vincularItensOrfaos`. Migração `20260924160000_chave_sharepoint_contrato`.
- Agendador: `importar --somente-novos` e depois `sincronizar` (o .bat roda os dois).
