/**
 * @jest-environment node
 */
import * as adminUsuarios from '@/app/api/admin/usuarios/route'

// GET/POST /api/documentos, GET /api/documentos/[id], GET /api/documentos/[id]/original,
// GET /api/documentos/[id]/preview, GET /api/documentos/[id]/relatorio,
// POST /api/documentos/[id]/reprocessar, /api/notificacoes e
// /api/admin/regras-notificacao saíram da lista de stubs — implementados
// nos módulos 3, 4, 5, 6 e 7. Só falta /api/admin/usuarios (módulo 8).
const rotas: Array<[string, () => Promise<Response>]> = [
  ['GET /api/admin/usuarios', adminUsuarios.GET],
  ['POST /api/admin/usuarios', adminUsuarios.POST],
  ['PATCH /api/admin/usuarios', adminUsuarios.PATCH],
  ['DELETE /api/admin/usuarios', adminUsuarios.DELETE],
]

describe('rotas stub retornam 501', () => {
  it.each(rotas)('%s retorna 501', async (_nome, handler) => {
    const response = await handler()
    expect(response.status).toBe(501)
  })
})
