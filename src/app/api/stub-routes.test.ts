/**
 * @jest-environment node
 */
import * as documentoRelatorio from '@/app/api/documentos/[id]/relatorio/route'
import * as notificacoes from '@/app/api/notificacoes/route'
import * as adminUsuarios from '@/app/api/admin/usuarios/route'
import * as adminRegras from '@/app/api/admin/regras-notificacao/route'

// GET/POST /api/documentos, GET /api/documentos/[id], GET /api/documentos/[id]/original,
// GET /api/documentos/[id]/preview e POST /api/documentos/[id]/reprocessar saíram da
// lista de stubs — implementados nos módulos 3, 4 e 5.
const rotas: Array<[string, () => Promise<Response>]> = [
  ['GET /api/documentos/[id]/relatorio', documentoRelatorio.GET],
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
