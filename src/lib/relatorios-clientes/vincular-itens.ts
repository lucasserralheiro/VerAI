import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Vínculo automático dos itens órfãos (ItemContrato sem `contratoId`) aos contratos.
 *
 * O legado (T_ItensContrato) guarda o contrato como texto livre ("031/SEME/2017", "31/SEME/2017",
 * "TC 016/2026"...) e o importador só casava por igualdade exata com `numeroTermo`, então a maioria
 * dos itens ficava solta e o "valor contratado" dos clientes ficava sem base. Aqui o casamento é
 * tolerante a caixa, acento, pontuação e zero à esquerda, e olha todas as referências do contrato
 * (nº do termo, SEI do cliente, SEI PRODAM e o número de cada linha do histórico).
 *
 * Regra de ouro: só vincula quando o casamento é ÚNICO. Ambíguo ou sem correspondência continua
 * órfão, pra reconciliação manual — nunca chuta.
 *
 * Roda no importador, e é chamada pelas rotas que criam/editam contrato e histórico, pra que
 * contrato novo já nasça ligado aos itens que o citam.
 */

type Db = PrismaClient | Prisma.TransactionClient

/** "031/SEME/2017" → "31 seme 2017". Sem acento, minúsculo, pontuação vira espaço, zero à esquerda
 *  dos números cai. `null` quando sobra nada. */
export function chaveExata(texto: string | null | undefined): string | null {
  if (!texto) return null
  const tokens = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t))
  return tokens.length > 0 ? tokens.join(' ') : null
}

/** Só os blocos numéricos ("31 2017"). Exige ao menos dois (número + ano), senão é fraco demais. */
export function chaveNumerica(texto: string | null | undefined): string | null {
  const chave = chaveExata(texto)
  if (!chave) return null
  const numeros = chave.split(' ').filter((t) => /^\d+$/.test(t))
  return numeros.length >= 2 ? numeros.join(' ') : null
}

export interface ResultadoVinculo {
  vinculados: number
  ambiguos: number
  semCorrespondencia: number
}

/**
 * Vincula os itens órfãos. `contratoId` restringe a aplicação aos itens que casam com aquele
 * contrato (a unicidade continua sendo checada contra todos); `clienteId` restringe aos contratos
 * do cliente. Item que traz a sigla do cliente (`clienteSiglaLegado`) só casa com contrato DAQUELE
 * cliente — e, se o cliente ainda não existe no VerAI, fica aguardando (nunca cai no contrato de outro).
 */
export async function vincularItensOrfaos(
  db: Db,
  opcoes: { contratoId?: string; clienteId?: string } = {}
): Promise<ResultadoVinculo> {
  const resultado: ResultadoVinculo = { vinculados: 0, ambiguos: 0, semCorrespondencia: 0 }

  const orfaos = await db.itemContrato.findMany({
    where: { contratoId: null, contratoTextoLegado: { not: null } },
    select: { id: true, contratoTextoLegado: true, clienteSiglaLegado: true },
  })
  if (orfaos.length === 0) return resultado

  const [contratos, historico, clientes] = await Promise.all([
    db.contrato.findMany({ select: { id: true, clienteId: true, numeroTermo: true, seiCliente: true, seiProdam: true } }),
    db.historicoContrato.findMany({ where: { numero: { not: null } }, select: { contratoId: true, numero: true } }),
    db.cliente.findMany({ where: { siglaLegado: { not: null } }, select: { id: true, siglaLegado: true } }),
  ])
  const clientePorSigla = new Map(clientes.map((c) => [c.siglaLegado!.trim().toUpperCase(), c.id]))

  const clienteDoContrato = new Map(contratos.map((c) => [c.id, c.clienteId]))
  const exata = new Map<string, Set<string>>()
  const numerica = new Map<string, Set<string>>()
  const indexar = (mapa: Map<string, Set<string>>, chave: string | null, contratoId: string) => {
    if (!chave) return
    const conjunto = mapa.get(chave) ?? new Set<string>()
    conjunto.add(contratoId)
    mapa.set(chave, conjunto)
  }
  const referencias: Array<[string, string | null]> = [
    ...contratos.flatMap((c) => [c.numeroTermo, c.seiCliente, c.seiProdam].map((t) => [c.id, t] as [string, string | null])),
    ...historico.map((h) => [h.contratoId, h.numero] as [string, string | null]),
  ]
  for (const [contratoId, texto] of referencias) {
    indexar(exata, chaveExata(texto), contratoId)
    indexar(numerica, chaveNumerica(texto), contratoId)
  }

  const escolher = (candidatos: Set<string> | undefined, siglaDoItem: string | null): string | 'ambiguo' | null => {
    if (!candidatos || candidatos.size === 0) return null
    let ids = [...candidatos]
    if (opcoes.clienteId) ids = ids.filter((id) => clienteDoContrato.get(id) === opcoes.clienteId)
    if (siglaDoItem?.trim()) {
      const dono = clientePorSigla.get(siglaDoItem.trim().toUpperCase())
      // Cliente do item ainda não existe → o item espera por ele; nunca vai pro contrato de outro.
      ids = dono ? ids.filter((id) => clienteDoContrato.get(id) === dono) : []
    }
    if (ids.length === 0) return null
    return ids.length === 1 ? ids[0] : 'ambiguo'
  }

  const porContrato = new Map<string, string[]>()
  for (const item of orfaos) {
    const texto = item.contratoTextoLegado
    const k1 = chaveExata(texto)
    const k2 = chaveNumerica(texto)
    let alvo = k1 ? escolher(exata.get(k1), item.clienteSiglaLegado) : null
    if (alvo === null && k2) alvo = escolher(numerica.get(k2), item.clienteSiglaLegado)

    if (alvo === null) resultado.semCorrespondencia++
    else if (alvo === 'ambiguo') resultado.ambiguos++
    else if (opcoes.contratoId && alvo !== opcoes.contratoId) continue
    else {
      porContrato.set(alvo, [...(porContrato.get(alvo) ?? []), item.id])
      resultado.vinculados++
    }
  }

  for (const [contratoId, ids] of porContrato) {
    await db.itemContrato.updateMany({
      where: { id: { in: ids }, contratoId: null },
      data: { contratoId, contratoTextoLegado: null },
    })
  }
  return resultado
}

/** Versão pras rotas: nunca derruba a resposta — o vínculo é conveniência, a rota já fez o que
 *  o usuário pediu. */
export async function vincularItensDoContrato(db: Db, contratoId: string): Promise<void> {
  try {
    await vincularItensOrfaos(db, { contratoId })
  } catch (erro) {
    console.error('vincularItensDoContrato falhou (ignorado):', erro)
  }
}
