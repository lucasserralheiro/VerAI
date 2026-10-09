import { prisma } from '@/lib/prisma'
import { alertasDosContratos } from '@/lib/relatorios-clientes/alertas-banco'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import { carregarPainelCarteiras } from '@/lib/relatorios-clientes/painel-carteiras'

import { hashDaEntidade, hashDe } from './canonico'
import { chaveDaGerencia, siglaComparavel } from './chaves'
import { contratoParaIntegracao, diaIso, listarClientes, USUARIO_INTEGRACAO } from './consultas'

// Os RECURSOS que o VerAI expõe na API de plataforma (/api/v1/:recurso): cada um sai inteiro, registro
// a registro, com hash — quem consome guarda a cópia e só regrava o que mudou. Recurso novo = um
// carregador aqui + rótulo em RECURSOS_DO_VERAI + tabelas no mapa de src/lib/integracao/aviso.ts.
// Spec docs/superpowers/specs/2026-10-08-api-plataforma-design.md.
// Formato do registro é contrato público: campo novo pode entrar; renomear/remover = v2.

export interface RegistroDoFeed {
  id: string
  /** `siglaComparavel` do cliente — a chave que o AIBertinho usa para juntar. */
  chaveCliente: string | null
  /** `chaveDaGerencia` ("GRC4"). */
  chaveGerencia: string | null
  dados: Record<string, unknown>
}

const chaveCli = (sigla: string | null | undefined) => (sigla ? siglaComparavel(sigla) || null : null)
const texto = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : v.toString())

async function carteiraPorCliente(): Promise<Map<string, string | null>> {
  const linhas = await prisma.carteiraCliente.findMany({ select: { clienteId: true, gerencia: { select: { sigla: true, nome: true } } } })
  return new Map(linhas.map((l) => [l.clienteId, chaveDaGerencia(l.gerencia.sigla) ?? chaveDaGerencia(l.gerencia.nome)]))
}

const CARREGADORES: Record<string, (hoje: Date) => Promise<RegistroDoFeed[]>> = {
  async clientes(hoje) {
    const [clientes, cadastro] = await Promise.all([
      listarClientes({}, hoje),
      prisma.cliente.findMany({ select: { id: true, endereco: true, numero: true, bairro: true } }),
    ])
    const enderecos = new Map(cadastro.map((c) => [c.id, c]))
    return clientes.map((c) => {
      const e = enderecos.get(c.id)
      return {
        id: c.id,
        chaveCliente: chaveCli(c.sigla),
        chaveGerencia: c.carteira?.chave ?? null,
        dados: { ...c, endereco: e?.endereco ?? null, numero: e?.numero ?? null, bairro: e?.bairro ?? null },
      }
    })
  },

  async gerencias(hoje) {
    const [gerencias, painel] = await Promise.all([
      prisma.gerencia.findMany({
        select: {
          id: true,
          nome: true,
          sigla: true,
          ativa: true,
          membros: { select: { papel: true, usuario: { select: { nome: true, email: true } } } },
          carteira: { select: { cliente: { select: { siglaLegado: true, nome: true } } } },
        },
      }),
      carregarPainelCarteiras(USUARIO_INTEGRACAO, hoje),
    ])
    const totais = new Map(painel.carteiras.map((c) => [c.id, c.totais]))
    return gerencias.map((g) => ({
      id: g.id,
      chaveCliente: null,
      chaveGerencia: chaveDaGerencia(g.sigla) ?? chaveDaGerencia(g.nome),
      dados: {
        id: g.id,
        nome: g.nome,
        sigla: g.sigla,
        ativa: g.ativa,
        membros: g.membros
          .map((m) => ({ nome: m.usuario.nome, email: m.usuario.email, papel: m.papel }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        clientes: g.carteira
          .map((c) => ({ sigla: c.cliente.siglaLegado, nome: c.cliente.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        totais: totais.get(g.id) ?? null,
      },
    }))
  },

  async contratos(hoje) {
    const [contratos, carteiras] = await Promise.all([
      prisma.contrato.findMany({
        select: {
          id: true,
          clienteId: true,
          numeroTermo: true,
          chaveSharepoint: true,
          descricao: true,
          situacao: true,
          seiProdam: true,
          seiCliente: true,
          dataInicio: true,
          dataVencimento: true,
          vigente: true,
          cliente: { select: { nome: true, siglaLegado: true } },
        },
      }),
      carteiraPorCliente(),
    ])
    const consolidados = await consolidarContratos(contratos, hoje)
    return contratos.flatMap((c) => {
      const k = consolidados.get(c.id)
      if (!k || k.vazio) return []
      return [
        {
          id: c.id,
          chaveCliente: chaveCli(c.cliente.siglaLegado),
          chaveGerencia: carteiras.get(c.clienteId) ?? null,
          dados: {
            ...contratoParaIntegracao(c, k),
            cliente: { id: c.clienteId, nome: c.cliente.nome, sigla: c.cliente.siglaLegado },
            chaveSharepoint: c.chaveSharepoint,
            dataInicio: diaIso(c.dataInicio),
            vencimentoDoCabecalho: diaIso(c.dataVencimento),
            vigenteNoCadastro: c.vigente,
          },
        },
      ]
    })
  },

  async historico() {
    const [linhas, carteiras] = await Promise.all([
      prisma.historicoContrato.findMany({
        select: {
          id: true,
          contratoId: true,
          tipo: true,
          numero: true,
          data: true,
          valor: true,
          objeto: true,
          proposta: true,
          situacao: true,
          dataInicio: true,
          dataVencimento: true,
          dataEnvio: true,
          observacao: true,
          contrato: { select: { numeroTermo: true, clienteId: true, cliente: { select: { siglaLegado: true } } } },
        },
      }),
      carteiraPorCliente(),
    ])
    return linhas.map((l) => ({
      id: l.id,
      chaveCliente: chaveCli(l.contrato.cliente.siglaLegado),
      chaveGerencia: carteiras.get(l.contrato.clienteId) ?? null,
      dados: {
        id: l.id,
        contratoId: l.contratoId,
        contrato: l.contrato.numeroTermo,
        tipo: l.tipo,
        numero: l.numero,
        assinadaEm: diaIso(l.data),
        valor: texto(l.valor),
        objeto: l.objeto,
        proposta: l.proposta,
        situacao: l.situacao,
        inicio: diaIso(l.dataInicio),
        vencimento: diaIso(l.dataVencimento),
        envio: diaIso(l.dataEnvio),
        observacao: l.observacao,
      },
    }))
  },

  async faturamentos() {
    const [linhas, carteiras] = await Promise.all([
      prisma.faturamento.findMany({
        select: {
          id: true,
          contratoId: true,
          clienteId: true,
          competenciaAno: true,
          competenciaMes: true,
          valor: true,
          situacao: true,
          sei: true,
          complementar: true,
          observacao: true,
          unidadeDestino: true,
          enviadoCliente: true,
          enviadoGfp: true,
          contrato: { select: { numeroTermo: true } },
          cliente: { select: { siglaLegado: true } },
          notasFiscais: {
            select: { id: true, numero: true, valor: true, dataEmissao: true, servico: true, quantidade: true, complementar: true },
          },
        },
      }),
      carteiraPorCliente(),
    ])
    return linhas.map((f) => ({
      id: f.id,
      chaveCliente: chaveCli(f.cliente.siglaLegado),
      chaveGerencia: carteiras.get(f.clienteId) ?? null,
      dados: {
        id: f.id,
        contratoId: f.contratoId,
        contrato: f.contrato.numeroTermo,
        competencia:
          f.competenciaAno && f.competenciaMes ? `${f.competenciaAno}-${String(f.competenciaMes).padStart(2, '0')}` : null,
        valor: texto(f.valor),
        situacao: f.situacao,
        sei: f.sei,
        complementar: f.complementar,
        observacao: f.observacao,
        unidadeDestino: f.unidadeDestino,
        enviadoCliente: f.enviadoCliente,
        enviadoGfp: f.enviadoGfp,
        notasFiscais: f.notasFiscais
          .map((n) => ({
            id: n.id,
            numero: n.numero,
            valor: texto(n.valor),
            emissao: diaIso(n.dataEmissao),
            servico: n.servico,
            quantidade: texto(n.quantidade),
            complementar: n.complementar,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      },
    }))
  },

  async alertas(hoje) {
    const [alertas, clientes, carteiras] = await Promise.all([
      alertasDosContratos({ clienteIds: null }, hoje),
      prisma.cliente.findMany({ select: { id: true, siglaLegado: true } }),
      carteiraPorCliente(),
    ])
    const siglas = new Map(clientes.map((c) => [c.id, c.siglaLegado]))
    const vistos = new Map<string, number>()
    return alertas.map((a) => {
      const base = `${a.codigo}|${a.contratoId ?? a.clienteId}`
      const n = (vistos.get(base) ?? 0) + 1
      vistos.set(base, n)
      return {
        id: n === 1 ? base : `${base}|${n}`,
        chaveCliente: chaveCli(siglas.get(a.clienteId)),
        chaveGerencia: carteiras.get(a.clienteId) ?? null,
        dados: { ...a, temaManual: a.temaManual ?? null },
      }
    })
  },

  async demandas() {
    const [linhas, carteiras] = await Promise.all([
      prisma.demanda.findMany({
        select: {
          id: true,
          clienteId: true,
          assunto: true,
          tipo: true,
          tipoAssunto: true,
          responsavel: true,
          situacao: true,
          dataAbertura: true,
          documento: true,
          sei: true,
          cliente: { select: { siglaLegado: true } },
          tramites: {
            select: { id: true, data: true, posicao: true, acao: true, observacao: true, responsavelAtual: true, dataRetorno: true, assinado: true },
          },
        },
      }),
      carteiraPorCliente(),
    ])
    return linhas.map((d) => ({
      id: d.id,
      chaveCliente: chaveCli(d.cliente.siglaLegado),
      chaveGerencia: carteiras.get(d.clienteId) ?? null,
      dados: {
        id: d.id,
        assunto: d.assunto,
        tipo: d.tipo,
        tipoAssunto: d.tipoAssunto,
        responsavel: d.responsavel,
        situacao: d.situacao,
        abertura: diaIso(d.dataAbertura),
        documento: d.documento,
        sei: d.sei,
        tramites: d.tramites
          .map((t) => ({ ...t, data: diaIso(t.data), dataRetorno: diaIso(t.dataRetorno) }))
          .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || a.id.localeCompare(b.id)),
      },
    }))
  },

  async solicitacoes() {
    const [linhas, carteiras] = await Promise.all([
      prisma.solicitacao.findMany({
        select: {
          id: true,
          clienteId: true,
          tipo: true,
          numero: true,
          descricao: true,
          situacao: true,
          dataAbertura: true,
          dataFinal: true,
          comVisita: true,
          observacao: true,
          cliente: { select: { siglaLegado: true } },
        },
      }),
      carteiraPorCliente(),
    ])
    return linhas.map(({ cliente, clienteId, dataAbertura, dataFinal, ...s }) => ({
      id: s.id,
      chaveCliente: chaveCli(cliente.siglaLegado),
      chaveGerencia: carteiras.get(clienteId) ?? null,
      dados: { ...s, abertura: diaIso(dataAbertura), final: diaIso(dataFinal) },
    }))
  },
}

/** Catálogo público: o que cada recurso é. A tela /admin/api e o /api/v1/openapi.json saem daqui. */
export const RECURSOS_DO_VERAI: Record<string, { rotulo: string; descricao: string }> = {
  clientes: { rotulo: 'Clientes', descricao: 'Cadastro, sigla, carteira e totais (ativos, valor contratado, faturado, saldo, vencimentos).' },
  gerencias: { rotulo: 'Gerências e carteiras', descricao: 'Gerências, managers e clientes de cada carteira, com os totais.' },
  contratos: { rotulo: 'Contratos', descricao: 'Contratos consolidados: vigência efetiva, valor, faturado, saldo, avisos e SEI.' },
  historico: { rotulo: 'Histórico dos contratos', descricao: 'Contrato, aditivos, prorrogações e rescisões, com datas e valores.' },
  faturamentos: { rotulo: 'Faturamento', descricao: 'Faturamentos por competência, com as notas fiscais.' },
  alertas: { rotulo: 'Alertas', descricao: 'Vencimentos, saldo, faturamento parado e achados da auditoria.' },
  demandas: { rotulo: 'Demandas', descricao: 'Demandas/documentos dos clientes, com os trâmites.' },
  solicitacoes: { rotulo: 'Solicitações', descricao: 'Chamados de TI (RDM/Solicitação) dos clientes.' },
}

export const RECURSOS = Object.keys(CARREGADORES)

export function recursoExiste(nome: string): boolean {
  return Object.prototype.hasOwnProperty.call(CARREGADORES, nome)
}

export type RegistroPublico = RegistroDoFeed & { hash: string }

export interface ListaDoRecurso {
  recurso: string
  /** Hash do conjunto inteiro (todas as páginas, com os filtros) — igual ao da última vez = nada mudou. */
  hash: string
  total: number
  pagina: number
  paginas: number
  limite: number
  registros: RegistroPublico[]
}

export const LIMITE_MAXIMO = 1000

async function todos(recurso: string, hoje: Date): Promise<RegistroPublico[]> {
  return (await CARREGADORES[recurso](hoje))
    .map((r) => ({ ...r, hash: hashDe(r.dados) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Uma página do recurso, opcionalmente filtrada por cliente (sigla) ou gerência ("GRC-4"). Registros em
 *  ordem de id (paginação estável). `null` para recurso desconhecido. */
export async function listarRecurso(
  recurso: string,
  opcoes: { pagina?: number; limite?: number; cliente?: string | null; gerencia?: string | null } = {},
  hoje: Date = new Date()
): Promise<ListaDoRecurso | null> {
  if (!recursoExiste(recurso)) return null
  let registros = await todos(recurso, hoje)
  if (opcoes.cliente) {
    const chave = siglaComparavel(opcoes.cliente)
    registros = registros.filter((r) => r.chaveCliente === chave)
  }
  if (opcoes.gerencia) {
    const chave = chaveDaGerencia(opcoes.gerencia)
    registros = registros.filter((r) => r.chaveGerencia === chave)
  }
  const limite = Math.min(Math.max(1, Math.floor(opcoes.limite ?? 100)), LIMITE_MAXIMO)
  const paginas = Math.max(1, Math.ceil(registros.length / limite))
  const pagina = Math.min(Math.max(1, Math.floor(opcoes.pagina ?? 1)), paginas)
  return {
    recurso,
    hash: hashDaEntidade(registros),
    total: registros.length,
    pagina,
    paginas,
    limite,
    registros: registros.slice((pagina - 1) * limite, pagina * limite),
  }
}

/** Um registro pelo id; `undefined` quando não existe, `null` para recurso desconhecido. */
export async function obterRegistro(recurso: string, id: string, hoje: Date = new Date()): Promise<RegistroPublico | undefined | null> {
  if (!recursoExiste(recurso)) return null
  return (await todos(recurso, hoje)).find((r) => r.id === id)
}
