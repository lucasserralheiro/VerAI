import { CategoriaArquivo } from '@prisma/client'
import { z } from 'zod'
import { inteiroEntre, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'
import { urlTemporariaValida } from '@/lib/arquivos/caminhos'

const categoria = z.enum(CategoriaArquivo, { error: 'categoria inválida' })

const competenciaJunta = (dados: { competenciaAno?: number | null; competenciaMes?: number | null }) =>
  (dados.competenciaAno == null) === (dados.competenciaMes == null)

const COMPETENCIA_JUNTA = { message: 'informe mês e ano juntos', path: ['competencia'] }

/** POST: registro de um arquivo que o navegador acabou de subir pro caminho temporário. */
export const esquemaRegistro = z
  .object({
    urlTemporaria: z.string().refine(urlTemporariaValida, 'upload inválido'),
    nome: textoObrigatorio,
    categoria,
    contratoId: textoOpcional,
    competenciaAno: inteiroEntre(2000, 2100).nullable().optional(),
    competenciaMes: inteiroEntre(1, 12).nullable().optional(),
  })
  .refine(competenciaJunta, COMPETENCIA_JUNTA)

/** PATCH /api/arquivos/[id]: reclassificação. Campo ausente não muda. */
export const esquemaEdicao = z
  .object({
    categoria: categoria.optional(),
    contratoId: textoOpcional,
    competenciaAno: inteiroEntre(2000, 2100).nullable().optional(),
    competenciaMes: inteiroEntre(1, 12).nullable().optional(),
  })
  .refine(competenciaJunta, COMPETENCIA_JUNTA)

export const ROTULOS_ARQUIVO = {
  urlTemporaria: 'Arquivo',
  nome: 'Nome',
  categoria: 'Categoria',
  contratoId: 'Contrato',
  competenciaAno: 'Ano',
  competenciaMes: 'Mês',
  competencia: 'Competência',
}
