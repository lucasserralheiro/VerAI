/**
 * @jest-environment node
 */
import * as documentos from '@/app/api/documentos/route'
import * as documentoDetalhe from '@/app/api/documentos/[id]/route'
import * as documentoOriginal from '@/app/api/documentos/[id]/original/route'
import * as documentoRelatorio from '@/app/api/documentos/[id]/relatorio/route'
import * as documentoReprocessar from '@/app/api/documentos/[id]/reprocessar/route'
import * as notificacoes from '@/app/api/notificacoes/route'
import * as adminUsuarios from '@/app/api/admin/usuarios/route'
import * as adminRegras from '@/app/api/admin/regras-notificacao/route'

const rotas: Array<[string, () => Promise<Response>]> = [
  ['GET /api/documentos', documentos.GET],
  ['POST /api/documentos', documentos.POST],
  ['GET /api/documentos/[id]', documentoDetalhe.GET],
  ['GET /api/documentos/[id]/original', documentoOriginal.GET],
  ['GET /api/documentos/[id]/relatorio', documentoRelatorio.GET],
  ['POST /api/documentos/[id]/reprocessar', documentoReprocessar.POST],
  ['GET /api/notificacoes', notificacoes.GET],
  ['PATCH /api/notificacoes', notificacoes.PATCH],
  ['GET /api/admin/usuarios', adminUsuarios.GET],
  ['POST /api/admin/usuarios', adminUsuarios.POST],
  ['PATCH /api/admin/usuarios', adminUsuarios.PATCH],
  ['DELETE /api/admin/usuarios', adminUsuarios.DELETE],
  ['GET /api/admin/regras-notificacao', adminRegras.GET],
  ['POST /api/admin/regras-notificacao', adminRegras.POST],
  ['PATCH /api/admin/regras-notificacao', adminRegras.PATCH],
  ['DELETE /api/admin/regras-notificacao', adminRegras.DELETE],
]

describe('rotas stub retornam 501', () => {
  it.each(rotas)('%s retorna 501', async (_nome, handler) => {
    const response = await handler()
    expect(response.status).toBe(501)
  })
})
