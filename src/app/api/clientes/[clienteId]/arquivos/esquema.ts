import { CategoriaArquivo } from '@prisma/client'
import { z } from 'zod'
import { textoObrigatorio } from '@/lib/relatorios-clientes/validacao'
import { urlTemporariaValida } from '@/lib/arquivos/caminhos'

// Contrato e competência não são do arquivo (spec §7.1): o envio e a reclassificação tratam só a
// categoria. Campos a mais no corpo são ignorados (o zod descarta chave desconhecida).

const categoria = z.enum(CategoriaArquivo, { error: 'categoria inválida' })

/** POST: registro de um arquivo que o navegador acabou de subir pro caminho temporário. */
export const esquemaRegistro = z.object({
  urlTemporaria: z.string().refine(urlTemporariaValida, 'upload inválido'),
  nome: textoObrigatorio,
  categoria,
})

/** PATCH /api/arquivos/[id]: reclassificação — só a categoria. */
export const esquemaEdicao = z.object({ categoria })

export const ROTULOS_ARQUIVO = {
  urlTemporaria: 'Arquivo',
  nome: 'Nome',
  categoria: 'Categoria',
}
