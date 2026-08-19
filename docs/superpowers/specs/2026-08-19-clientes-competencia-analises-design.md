# VerAI — Clientes, competência e análises consolidada/evolução (design)

**Módulo**: 9 (novo) do roteiro do VerAI — depende dos módulos 1-8 (já implementados)
**Status**: Aprovado para implementação
**Data**: 19/08/2026

---

## 1. Objetivo

Hoje o `Documento` é uma lista plana, sem noção de cliente nem de período de
competência. Na prática (faturamento de secretarias — SEGES, SMDET etc.,
relatórios de fornecedores como Microsoft/Azure, envio consolidado via SEI),
isso quebra o fluxo: não existe um lugar único que centralize "os documentos
reais da SEGES de agosto/2026" nem uma forma confiável de comparar valores
entre relatórios ou entre meses.

Este módulo introduz:

1. **Cliente** como entidade própria, com um espaço por competência
   (mês/ano) que centraliza os documentos reais daquele período.
2. **Análise individual por documento**, exatamente como já funciona hoje —
   sem mudança de comportamento.
3. **Análise consolidada**: o usuário seleciona N documentos do mesmo
   cliente/competência e recebe uma análise conjunta.
4. **Análise de evolução**: comparação automática entre a competência atual
   e a anterior do mesmo cliente.
5. **Permissão por cliente** e **exclusão/mesclagem de cliente**.

**Regra inegociável que atravessa todo o módulo**: nenhuma variação
percentual, soma ou comparação numérica é calculada pela IA. Todo cálculo
matemático é feito em código, determinístico, em cima de números
efetivamente extraídos do documento. A IA só recebe os números já prontos e
escreve interpretação/narrativa em cima deles — nunca inventa nem estima.

O documento original nunca é alterado — permanece somente leitura, como já
é hoje.

---

## 2. Modelo de dados

```prisma
model Cliente {
  id                 String              @id @default(cuid())
  nome               String              @unique   // ex: "SEGES", "SMDET"
  createdAt          DateTime            @default(now())
  documentos         Documento[]
  analisesConsolidadas AnaliseConsolidada[]
  analisesEvolucao   AnaliseEvolucao[]
  usuariosPermitidos Usuario[]           @relation("UsuarioClientes")
}

model Usuario {
  // ...campos atuais mantidos...
  clientesPermitidos Cliente[] @relation("UsuarioClientes")
}

model Documento {
  // ...campos atuais mantidos...
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  competenciaAno  Int      // ex: 2026
  competenciaMes  Int      // 1-12
  analisesConsolidadas AnaliseConsolidada[] @relation("DocumentosDaConsolidada")

  @@index([clienteId, competenciaAno, competenciaMes])
}
```

**`metricasChave` estruturado** (troca o shape atual `{ label, valor }` em
`Analise`, e é reusado em `AnaliseConsolidada`/`AnaliseEvolucao`):

```ts
{
  label: string
  valorNumerico: number | null   // número real extraído do documento; null se a métrica não for numérica
  unidade: string | null         // ex: "BRL", "%", "GB"
  valorExibicao: string          // como aparece formatado, ex: "R$ 11.200,00"
}
```

`valorNumerico` é o que entra em qualquer comparação de código. Quando não
há número real por trás de uma métrica (ex: um status textual), ela ainda
aparece na análise, só não participa de comparação.

**Análise consolidada** (documentos selecionados manualmente, mesma
competência):

```prisma
model AnaliseConsolidada {
  id                  String      @id @default(cuid())
  clienteId           String
  cliente             Cliente     @relation(fields: [clienteId], references: [id])
  competenciaAno      Int
  competenciaMes      Int
  documentos          Documento[] @relation("DocumentosDaConsolidada")
  selecaoAssinatura   String      // ids dos documentos selecionados, ordenados e concatenados
  resumo              String      @db.Text
  pontosCriticos      Json
  pontosPositivos     Json
  metricasComparadas  Json        // por label: valor de cada documento + divergência calculada em código
  recomendacoes       Json?
  promptVersion       String
  caminhoRelatorioPdf String?
  relatorioGeradoEm   DateTime?
  createdAt           DateTime    @default(now())

  @@unique([clienteId, competenciaAno, competenciaMes, selecaoAssinatura])
}
```

**Análise de evolução** (competência atual vs. anterior, automática, todos
os documentos concluídos — sem seleção manual):

```prisma
model AnaliseEvolucao {
  id                     String    @id @default(cuid())
  clienteId              String
  cliente                Cliente   @relation(fields: [clienteId], references: [id])
  competenciaAtualAno    Int
  competenciaAtualMes    Int
  competenciaAnteriorAno Int
  competenciaAnteriorMes Int
  metricasComparadas     Json      // por label: valor atual, valor anterior, delta absoluto, delta %, status
  resumo                 String    @db.Text
  pontosAtencao          Json      // altas/pioras significativas
  melhorias              Json      // quedas/melhoras significativas
  promptVersion          String
  caminhoRelatorioPdf    String?
  relatorioGeradoEm      DateTime?
  createdAt              DateTime  @default(now())

  @@unique([clienteId, competenciaAtualAno, competenciaAtualMes])
}
```

---

## 3. Migração de dados existentes

Ambiente é dev, sem dado de produção real até aqui — `clienteId`,
`competenciaAno` e `competenciaMes` entram como campos obrigatórios em
`Documento` direto, sem necessidade de backfill complexo. Se já existirem
documentos de teste no banco local no momento da migração, são apagados ou
reatribuídos manualmente antes de rodar a migration (decisão de execução,
não de design).

**Atenção pro deploy**: como `clientesPermitidos` começa vazio pra todo
usuário não-admin, todo `uploader`/`responsavel` já existente perde
visibilidade de tudo até o admin atribuir clientes a ele (seção 5) — passo
manual necessário logo após subir este módulo, antes de liberar pros
usuários.

---

## 4. Rotas e páginas

**Admin — CRUD de cliente** (mesmo padrão de `/admin/usuarios`):

```
/admin/clientes                         → lista + formulário (nome) + excluir/mesclar
GET/POST     /api/admin/clientes
DELETE       /api/admin/clientes/[id]           → 409 se houver documento vinculado
POST         /api/admin/clientes/[id]/mesclar    → { destinoClienteId }
PATCH        /api/admin/usuarios/[id]            → ganha campo clientesPermitidos (array de ids)
```

**Navegação nova**:

```
/clientes                            → lista de clientes visíveis ao usuário (cards/tabela)
/clientes/[clienteId]                → competências daquele cliente (mês/ano, contagem de
                                        documentos, ordenado desc) + "Novo mês" (escolhe
                                        mês/ano e navega abaixo, mesmo sem documento ainda)
/clientes/[clienteId]/[competencia]  → documentos reais daquele mês:
                                        - upload (já escopado pro cliente+competência da URL,
                                          sem selects manuais) — qualquer usuário com
                                          permissão sobre o cliente pode subir
                                        - tabela: nome, tipo, ENVIADO POR, QUANDO, status,
                                          ações (ver análise / baixar original / baixar
                                          relatório) — mesmo padrão de hoje
                                        - checkbox por linha + "Gerar análise consolidada"
                                        - "Comparar com mês anterior" (análise de evolução)
                                        - análises já geradas (consolidada/evolução) ficam
                                          listadas na própria página
```

Nav bar ganha o link **Clientes**.

**`/` (listagem global)**: ganha colunas Cliente/Competência e filtro por
cliente; upload sai de lá (agora é dentro da página cliente/mês); continua
existindo pra visão/auditoria cruzando todos os clientes visíveis ao
usuário. Regra de visibilidade por documento não muda.

---

## 5. Permissão por cliente

`lib/visibilidade.ts` ganha um filtro adicional, aplicado antes das regras
já existentes:

- `admin`: vê todos os clientes e documentos, sem alteração.
- `uploader`/`responsavel`: só enxergam documentos cujo `clienteId` esteja
  em `usuario.clientesPermitidos`. Dentro disso, as sub-regras atuais
  continuam valendo sem mudança (uploader = só o que ele subiu;
  responsável = o que subiu + o que bate em `RegraNotificacao`).
- Usuário sem nenhum cliente atribuído não vê nenhum documento (exceto
  admin).
- `/clientes` e `/clientes/[id]` aplicam o mesmo filtro na lista de
  clientes exibida.

---

## 6. Análise consolidada — fluxo

1. Só documentos com `status: "concluido"` (e `Analise` já existente) podem
   ser selecionados.
2. `POST /api/clientes/[clienteId]/competencias/[ano]-[mes]/analise-consolidada`
   com `{ documentoIds: string[] }`.
3. **Cálculo determinístico (código)**: agrupa `metricasChave` de todos os
   documentos selecionados por `label` igual (comparação normalizada:
   minúsculas, sem acento/espaço extra). Onde mais de um documento reporta
   o mesmo `label`, calcula divergência (diferença absoluta e percentual)
   entre os valores.
4. A IA recebe os resumos individuais **+ a tabela já calculada** (nunca os
   números crus pra recalcular), com instrução explícita de só interpretar
   os números fornecidos — nunca recalcular, estimar ou arredondar de
   forma diferente do que veio pronto. Gera resumo executivo, pontos
   críticos/positivos consolidados e recomendações (mesmo shape usado na
   análise individual).
5. Persiste `AnaliseConsolidada`: mesma seleção exata → upsert (equivalente
   ao "reprocessar" de hoje); seleção diferente → novo registro (histórico
   preservado).
6. `GET /api/analises-consolidadas/[id]/relatorio` — mesmo padrão do
   módulo 7 (cache em disco por `caminhoRelatorioPdf`, gera via
   `@react-pdf/renderer`, template estendido com seção de divergências).

---

## 7. Análise de evolução — fluxo

1. Baseada em **todos** os documentos `status: "concluido"` da competência
   (sem seleção manual) — é o retrato do mês inteiro.
2. Botão "Comparar com mês anterior" em `/clientes/[id]/[competencia]`,
   habilitado só se existir uma competência anterior do mesmo cliente com
   ao menos 1 documento concluído (a competência anterior mais recente com
   dado, não necessariamente o mês corrido -1).
3. `POST /api/clientes/[clienteId]/competencias/[ano]-[mes]/analise-evolucao`.
4. **Cálculo determinístico (código)**: soma `valorNumerico` por `label`
   em cada uma das duas competências; para cada `label` presente em pelo
   menos uma das duas, calcula delta absoluto, delta percentual e um
   status (`novo` | `removido` | `estavel` | `alta` | `baixa` — thresholds
   simples, ex: variação > 5% = alta/baixa, senão estável).
5. A IA recebe a tabela de deltas já calculada e escreve o resumo,
   `pontosAtencao` (altas/pioras relevantes) e `melhorias` (quedas/avanços
   relevantes) — mesma restrição: só interpreta, nunca recalcula.
6. Upsert por `[clienteId, competenciaAtualAno, competenciaAtualMes]` — se
   novos documentos entrarem em qualquer uma das duas competências depois,
   o usuário precisa gerar de novo manualmente (sem recomputo automático
   nesta v1).
7. `GET /api/analises-evolucao/[id]/relatorio` — mesmo padrão de PDF.

---

## 8. Exclusão / mesclagem de cliente

- `DELETE /api/admin/clientes/[id]`: `409` se existir qualquer `Documento`
  vinculado (orienta a mesclar em vez de excluir).
- `POST /api/admin/clientes/[id]/mesclar` `{ destinoClienteId }`: reatribui
  em massa (`clienteId`) todos os `Documento`, `AnaliseConsolidada` e
  `AnaliseEvolucao` do cliente de origem para o destino, dentro de uma
  transação; depois apaga o cliente de origem. Todo o histórico é
  preservado, só muda o dono.
- UI em `/admin/clientes`: ação "Mesclar com..." por linha (select do
  cliente destino + confirmação).

---

## 9. Mudança na camada de IA (módulo 1)

`lib/ia/analisar.ts`:
- Schema Zod de `metricasChave` passa de `{ label, valor }` para
  `{ label, valorNumerico, unidade, valorExibicao }`, com `valorNumerico` e
  `unidade` `.nullable()` (mesmo motivo já documentado no código atual —
  saída estruturada em modo estrito exige o campo presente, ainda que
  nulo).
- Prompt ganha uma instrução explícita: "para cada métrica numérica,
  extraia o valor exatamente como aparece no documento — nunca calcule,
  estime ou arredonde além do que está escrito".
- Duas novas funções no mesmo arquivo (ou em `lib/ia/consolidar.ts` e
  `lib/ia/evoluir.ts`, avaliar no plano — sem justificativa forte pra
  separar dado o volume): `analisarConsolidado(resumosIndividuais,
  metricasComparadas, promptVersion)` e `analisarEvolucao(metricasComparadas,
  promptVersion)`. Ambas seguem o mesmo padrão de `analisarDocumento` —
  `generateObject` + schema Zod próprio — mas recebem os números já
  calculados, nunca os documentos crus.

---

## 10. Fora de escopo (por ora)

- Testes automatizados (mesma linha dos módulos 1-8).
- Recomputo automático da análise de evolução quando novos documentos
  entram depois de já gerada — precisa ser regerada manualmente.
- Reatribuir cliente de um documento já enviado (troca de cliente pós-
  upload) — se o usuário errar o cliente/mês, a correção é subir de novo
  no lugar certo por enquanto.
