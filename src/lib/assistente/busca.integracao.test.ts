/** @jest-environment node */
// Só roda com banco de verdade:
//   npx dotenv -e .env.development -v ASSISTENTE_TESTE_BANCO=1 -- npx jest src/lib/assistente/busca.integracao.test.ts
import { prisma } from '@/lib/prisma'
import { indexarFonte } from './indexacao/sincronizar'
import { buscarTrechos } from './busca'

const descrever = process.env.ASSISTENTE_TESTE_BANCO ? describe : describe.skip
const admin = { id: 'teste', nome: 'Teste', email: 't@x', role: 'admin' as const }
const ORIGEM_ID = 'teste-integracao-assistente'

descrever('buscarTrechos (Postgres real)', () => {
  beforeAll(async () => {
    await indexarFonte({
      origem: 'PROPOSTA_COMERCIAL_ARQUIVO',
      origemId: ORIGEM_ID,
      url: 'teste://nada',
      nomeArquivo: 'teste.pdf',
      tipo: 'pdf',
      clienteId: null,
      contratoId: null,
      textoPronto: '<p>O reajuste contratual será aplicado pelo IPCA acumulado. Processo SEI 6018.2023/0001234-5.</p>',
    })
  })
  afterAll(async () => {
    await prisma.indiceDocumento.deleteMany({ where: { origemId: ORIGEM_ID } })
    await prisma.$disconnect()
  })

  it('acha por palavra sem acento e com flexão', async () => {
    // Desvio do brief: 'contratuais' (plural) stemiza para 'contratu' no dicionário
    // 'portuguese' do Postgres, enquanto 'contratual' (singular, no texto) fica 'contratual' —
    // quirk real do snowball stemmer pt, não bug da nossa SQL (confirmado com
    // `to_tsvector('portuguese', 'contratual')` x `to_tsvector('portuguese', 'contratuais')`
    // direto no banco). Troquei por 'acumulados', que stemiza igual a 'acumulado' (no texto),
    // mantendo a mesma verificação (acento fora + flexão) sem o par problemático.
    const [primeiro] = await buscarTrechos({ consulta: 'reajustes acumulados ipca' }, admin)
    expect(primeiro?.origemId).toBe(ORIGEM_ID)
  })

  it('acha pelo número SEI com outra pontuação', async () => {
    const achados = await buscarTrechos({ consulta: '6018202300012345' }, admin)
    expect(achados.map((a) => a.origemId)).toContain(ORIGEM_ID)
  })
})
