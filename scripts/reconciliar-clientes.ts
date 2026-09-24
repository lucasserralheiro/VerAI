/**
 * Diagnóstico + reconciliação dos dados dos clientes (contratos, itens, histórico, faturamento).
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/reconciliar-clientes.ts            # só relatório
 *   npx dotenv -e .env.development -- npx tsx scripts/reconciliar-clientes.ts --aplicar  # vincula
 *
 * Mostra, por cliente, o que alimenta os cartões da ficha (contratos ativos, valor contratado,
 * faturamento) e o que está faltando; com `--aplicar` liga os itens órfãos aos contratos pelo
 * mesmo casamento tolerante usado no importador e nas rotas (src/lib/relatorios-clientes/
 * vincular-itens.ts). Idempotente: pode rodar quantas vezes quiser.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { competenciaValida, contratoAtivo, contratoVazio, vigenciaEfetiva } from '../src/lib/relatorios-clientes/regras'
import { chaveExata, vincularItensOrfaos } from '../src/lib/relatorios-clientes/vincular-itens'
import { digitosDoSei } from '../src/lib/relatorios-clientes/sei'

if (!process.env.DATABASE_URL) config({ path: '.env.local' })

const prisma = new PrismaClient()

async function relatorio(titulo: string) {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: {
      nome: true,
      siglaLegado: true,
      contratos: {
        select: {
          numeroTermo: true,
          _count: { select: { itens: true, historico: true, faturamentos: true } },
          historico: { select: { valor: true } },
        },
      },
      _count: { select: { faturamentos: true, demandas: true, responsaveis: true } },
    },
  })
  console.log(`\n=== ${titulo} ===`)
  for (const c of clientes) {
    const semValor = c.contratos.filter(
      (k) => k._count.itens === 0 && !k.historico.some((h) => h.valor !== null && Number(h.valor) > 0)
    )
    console.log(
      `${(c.siglaLegado ?? '—').padEnd(8)} ${c.nome.slice(0, 44).padEnd(44)} ` +
        `contratos=${c.contratos.length} semValor=${semValor.length} ` +
        `faturamentos=${c._count.faturamentos} demandas=${c._count.demandas} responsaveis=${c._count.responsaveis}`
    )
    for (const k of semValor) console.log(`           · contrato ${k.numeroTermo ?? '(sem nº)'} sem histórico com valor e sem itens`)
  }
  const orfaos = await prisma.itemContrato.count({ where: { contratoId: null } })
  console.log(`\nItens sem contrato: ${orfaos}`)
}


/** `--detalhe`: por contrato, o que decide se entra nos cartões da ficha (ativo? valor?) e, por
 *  cliente, a última competência válida de faturamento e quantos lançamentos têm valor/nota. */
async function detalhe() {
  const hoje = new Date()
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: {
      nome: true,
      siglaLegado: true,
      contratos: {
        select: {
          numeroTermo: true,
          situacao: true,
          dataVencimento: true,
          historico: { select: { tipo: true, valor: true, data: true, situacao: true, dataVencimento: true } },
          _count: { select: { itens: true } },
        },
      },
      faturamentos: {
        select: { competenciaAno: true, competenciaMes: true, valor: true, _count: { select: { notasFiscais: true } } },
      },
    },
  })
  console.log('\n=== DETALHE ===')
  for (const c of clientes) {
    console.log(`\n${c.siglaLegado ?? '—'} ${c.nome}`)
    for (const k of c.contratos) {
      const fim = vigenciaEfetiva(k.dataVencimento, k.historico)
      const rescindido = k.historico.some((h) => h.tipo === 'RESCISAO')
      const ativo = !rescindido && contratoAtivo({ situacao: k.situacao, dataVencimento: fim }, hoje)
      const comValor = k.historico.filter((h) => h.valor !== null && Number(h.valor) > 0).length
      const dia = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '—'
      console.log(
        `  ${(k.numeroTermo ?? '(sem nº)').padEnd(28)} situacao=${k.situacao ?? '—'} venc.cadastro=${dia(k.dataVencimento)} ` +
          `vigencia.efetiva=${dia(fim)}${rescindido ? ' RESCINDIDO' : ''} ativo=${ativo ? 'sim' : 'NAO'} ` +
          `historico=${k.historico.length}(${comValor} c/valor) itens=${k._count.itens}`
      )
    }
    const validos = c.faturamentos.filter((f) => competenciaValida(f.competenciaAno, f.competenciaMes))
    const ultima = validos.reduce((m, f) => Math.max(m, f.competenciaAno! * 100 + f.competenciaMes!), 0)
    const semValorNemNota = c.faturamentos.filter((f) => f.valor === null && f._count.notasFiscais === 0).length
    console.log(
      `  faturamentos=${c.faturamentos.length} validos=${validos.length} ultimaCompetencia=${ultima || '—'} sem valor e sem nota=${semValorNemNota}`
    )
  }
}

/**
 * `--integridade`: varredura de dado solto/divergente em tudo que se liga a cliente e contrato.
 * Com `--aplicar` corrige só o que tem resposta única e segura (faturamento com cliente diferente
 * do contrato; termo sem contrato que casa com UM contrato do mesmo cliente). O resto só é listado.
 */
async function integridade(aplicar: boolean) {
  const linha = (rotulo: string, n: number) => console.log(`  ${n === 0 ? 'ok ' : '!! '} ${rotulo}: ${n}`)
  console.log('\n=== INTEGRIDADE ===')

  // 1. Faturamento: cliente do lançamento tem que ser o cliente do contrato.
  const fats = await prisma.faturamento.findMany({
    select: { id: true, clienteId: true, sei: true, contrato: { select: { clienteId: true, numeroTermo: true, cliente: { select: { siglaLegado: true } } } }, _count: { select: { notasFiscais: true } }, valor: true, competenciaAno: true, competenciaMes: true },
  })
  const clienteDivergente = fats.filter((f) => f.clienteId !== f.contrato.clienteId)
  linha('faturamentos com cliente diferente do cliente do contrato', clienteDivergente.length)
  if (aplicar) {
    for (const f of clienteDivergente) await prisma.faturamento.update({ where: { id: f.id }, data: { clienteId: f.contrato.clienteId } })
    if (clienteDivergente.length) console.log(`     -> corrigidos: ${clienteDivergente.length}`)
  }
  const invalidos = fats.filter((f) => !competenciaValida(f.competenciaAno, f.competenciaMes))
  linha('faturamentos com competência inválida (ano/mês fora do normal)', invalidos.length)
  let anosCorrigidos = 0
  for (const f of invalidos) {
    // Ano de 2 dígitos (26 → 2026) com mês válido é digitação inequívoca; o resto só é listado.
    const consertavel = f.competenciaAno !== null && f.competenciaAno >= 0 && f.competenciaAno < 100 && f.competenciaMes !== null && f.competenciaMes >= 1 && f.competenciaMes <= 12
    console.log(`     -> ${f.contrato.cliente.siglaLegado ?? '—'} · contrato ${f.contrato.numeroTermo ?? '(sem nº)'} · SEI ${f.sei ?? '—'} · ano=${f.competenciaAno} mês=${f.competenciaMes}${consertavel ? '  (ano de 2 dígitos: ' + (aplicar ? 'corrigido' : '--aplicar corrige') + ')' : '  (corrigir na tela do faturamento)'}`)
    if (consertavel && aplicar) {
      await prisma.faturamento.update({ where: { id: f.id }, data: { competenciaAno: 2000 + f.competenciaAno! } })
      anosCorrigidos++
    }
  }
  if (anosCorrigidos) console.log(`     -> anos corrigidos: ${anosCorrigidos}`)
  const totalNotas = await prisma.notaFiscal.count()
  console.log(`  ..  notas fiscais no banco: ${totalNotas} (se for pouco perto do nº de faturamentos, rode o importador de novo e leia as "puladas")`)
  linha('faturamentos sem valor lançado e sem nota fiscal (entram como R$ 0,00)', fats.filter((f) => f.valor === null && f._count.notasFiscais === 0).length)

  // 2. Termos de confirmação: precisam de contrato do MESMO cliente.
  const termos = await prisma.termoConfirmacao.findMany({
    select: { id: true, numero: true, sei: true, clienteId: true, contratoId: true, contrato: { select: { clienteId: true } } },
  })
  linha('termos de confirmação com contrato de outro cliente', termos.filter((t) => t.contrato && t.contrato.clienteId !== t.clienteId).length)
  const semContrato = termos.filter((t) => !t.contratoId)
  const contratos = await prisma.contrato.findMany({
    select: {
      id: true,
      clienteId: true,
      numeroTermo: true,
      descricao: true,
      seiCliente: true,
      seiProdam: true,
      situacao: true,
      dataInicio: true,
      dataVencimento: true,
      cliente: { select: { siglaLegado: true } },
      historico: { select: { tipo: true, valor: true, data: true, situacao: true, dataVencimento: true } },
      _count: { select: { itens: true, faturamentos: true } },
    },
  })
  let vinculadosTermo = 0
  for (const t of semContrato) {
    const doCliente = contratos.filter((c) => c.clienteId === t.clienteId)
    const chaves = [chaveExata(t.numero)].filter(Boolean)
    const sei = digitosDoSei(t.sei)
    const candidatos = doCliente.filter(
      (c) =>
        (chaves.length > 0 && chaveExata(c.numeroTermo) === chaves[0]) ||
        (sei.length >= 10 && [c.seiCliente, c.seiProdam].some((x) => digitosDoSei(x) === sei))
    )
    if (candidatos.length === 1) {
      vinculadosTermo++
      if (aplicar) await prisma.termoConfirmacao.update({ where: { id: t.id }, data: { contratoId: candidatos[0].id } })
    }
  }
  linha('termos de confirmação sem contrato', semContrato.length)
  if (semContrato.length) console.log(`     -> ${vinculadosTermo} têm casamento único ${aplicar ? '(vinculados agora)' : '(--aplicar vincula)'}`)

  // 3. Contratos.
  const vazios = contratos.filter((c) =>
    contratoVazio({ ...c, historico: c.historico.length, itens: c._count.itens, faturamentos: c._count.faturamentos })
  )
  linha('linhas de contrato vazias (sem número, datas, histórico, itens nem faturamento — não contam nos indicadores)', vazios.length)
  for (const c of vazios) console.log(`     -> ${c.cliente.siglaLegado ?? '—'} ${c.id}`)
  if (vazios.length && process.argv.includes('--remover-vazios')) {
    const r = await prisma.contrato.deleteMany({ where: { id: { in: vazios.map((c) => c.id) } } })
    console.log(`     -> removidas: ${r.count}`)
  } else if (vazios.length) {
    console.log('     -> --remover-vazios apaga essas linhas (só elas; nada mais está ligado a elas)')
  }
  const hoje = new Date()
  const conflitos = contratos.filter((c) => {
    const fim = vigenciaEfetiva(c.dataVencimento, c.historico)
    const ativo = contratoAtivo({ situacao: c.situacao, dataVencimento: fim }, hoje)
    return !ativo && fim !== null && fim.getTime() > hoje.getTime() && !c.historico.some((h) => h.tipo === 'RESCISAO')
  })
  linha('contratos com situação de encerrado mas vigência ainda em curso (conferir o cadastro)', conflitos.length)
  for (const c of conflitos) console.log(`     -> ${c.cliente.siglaLegado ?? '—'} ${c.numeroTermo ?? '(sem nº)'} situação=${c.situacao}`)
  linha('contratos sem número do termo (fora as linhas vazias acima)', contratos.filter((c) => !c.numeroTermo?.trim() && !vazios.includes(c)).length)
  linha('contratos sem data de vencimento', contratos.filter((c) => !c.dataVencimento).length)
  linha(
    'contratos sem nenhum valor no histórico e sem itens (ver --detalhe)',
    contratos.filter((c) => c._count.itens === 0 && !c.historico.some((h) => h.valor !== null && Number(h.valor) > 0)).length
  )
  const porChave = new Map<string, string[]>()
  for (const c of contratos) {
    const k = chaveExata(c.numeroTermo)
    if (!k) continue
    const chave = `${c.clienteId}::${k}`
    porChave.set(chave, [...(porChave.get(chave) ?? []), c.numeroTermo!])
  }
  const duplicados = [...porChave.values()].filter((v) => v.length > 1)
  linha('números de termo repetidos no mesmo cliente', duplicados.length)
  for (const d of duplicados) console.log(`     -> ${d.join(' | ')}`)

  // 4. Itens sem contrato (o que sobrou depois do vínculo automático).
  const orfaos = await prisma.itemContrato.groupBy({ by: ['contratoTextoLegado'], where: { contratoId: null }, _count: { _all: true }, orderBy: { _count: { contratoTextoLegado: 'desc' } }, take: 12 })
  const totalOrfaos = await prisma.itemContrato.count({ where: { contratoId: null } })
  linha('itens sem contrato', totalOrfaos)
  for (const o of orfaos) console.log(`     -> ${String(o._count._all).padStart(4)} × ${o.contratoTextoLegado ?? '(sem texto de contrato)'}`)

  // 5. Demandas atribuídas por regra de importação (não vieram com cliente do legado).
  const atribuidas = await prisma.demanda.count({ where: { notaImportacao: { not: null } } })
  linha('demandas atribuídas a cliente por decisão da importação (notaImportacao)', atribuidas)
}

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  if (process.argv.includes('--integridade')) {
    if (aplicar) await vincularItensOrfaos(prisma)
    await integridade(aplicar)
    await prisma.$disconnect()
    return
  }
  if (process.argv.includes('--detalhe')) {
    await detalhe()
    await prisma.$disconnect()
    return
  }
  await relatorio('ANTES')
  if (aplicar) {
    const r = await vincularItensOrfaos(prisma)
    console.log(`\nVinculados: ${r.vinculados} | ambíguos (ficam órfãos): ${r.ambiguos} | sem correspondência: ${r.semCorrespondencia}`)
    await relatorio('DEPOIS')
  } else {
    console.log('\n(Nada foi alterado. Rode com --aplicar para vincular os itens.)')
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('✗', e)
  await prisma.$disconnect()
  process.exit(1)
})
