import { montarEstrutura } from './estrutura'
import { compararFotos, fotografarEstrutura, lerBiblioteca } from './regua'

const caminhos = [
  'SMIT/TC 52-SMIT-2024 - Infra/1) TC 52-SMIT-2024 - Contrato inicial/TC 52-SMIT-2024.pdf',
  'SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses/TA 01.pdf',
  'SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses/PA-SMIT-01.pdf',
]

it('a foto guarda, por contrato, como cada pasta de termo foi lida', () => {
  const [foto] = fotografarEstrutura(montarEstrutura(caminhos))
  expect(foto).toMatchObject({ chave: 'SMIT|52 2024', finalizado: false })
  expect(foto.termos[1]).toEqual({
    pasta: 'SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses',
    tipo: 'PRORROGACAO',
    numero: 'TA 01',
    aviso: null,
    termoPdf: 'TA 01.pdf',
    propostaPdf: 'PA-SMIT-01.pdf',
    arquivos: 2,
  })
})

it('mesma leitura → nenhuma diferença', () => {
  const foto = fotografarEstrutura(montarEstrutura(caminhos))
  expect(compararFotos(foto, foto)).toEqual([])
})

it('mudança de regra aparece campo a campo, contrato a contrato', () => {
  const antes = fotografarEstrutura(montarEstrutura(caminhos))
  const depois: typeof antes = JSON.parse(JSON.stringify(antes)) // jsdom não tem structuredClone
  depois[0].finalizado = true
  depois[0].termos[1].tipo = 'ADITIVO'
  depois[0].termos[1].termoPdf = null
  depois.push({ chave: 'SMS|1 2025', finalizado: false, numeroTermo: 'TC 1/2025', termos: [] })
  expect(compararFotos(antes, depois)).toEqual([
    'SMIT|52 2024: finalizado false → true',
    'SMIT|52 2024 · SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses: tipo PRORROGACAO → ADITIVO',
    'SMIT|52 2024 · SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses: termoPdf TA 01.pdf → (nenhum)',
    'SMS|1 2025: contrato novo (0 termos)',
  ])
})

it('contrato ou termo que sumiu da leitura também aparece', () => {
  const antes = fotografarEstrutura(montarEstrutura(caminhos))
  const semTa = fotografarEstrutura(montarEstrutura(caminhos.slice(0, 1)))
  expect(compararFotos(antes, semTa)).toEqual(['SMIT|52 2024 · SMIT/TC 52-SMIT-2024 - Infra/2) TC 52-SMIT-2024 - TA 01 - Prorrogação 12 meses: termo sumiu'])
  expect(compararFotos(antes, [])).toEqual(['SMIT|52 2024: contrato sumiu'])
})

it('lê a biblioteca como a sincronização: sem lixo, sem pasta ignorada, sem publicação do DOC, sigla pelo mapa', () => {
  const arquivo = (caminho: string, tamanhoBytes = 10) => ({ caminho, tamanhoBytes })
  const estrutura = lerBiblioteca(
    [
      arquivo('SGM - CASA CIVIL/TC 17-SGM-2025 - Portal/TC 17-SGM-2025.pdf'),
      arquivo('SGM - CASA CIVIL/TC 17-SGM-2025 - Portal/desktop.ini'),
      arquivo('SGM - CASA CIVIL/TC 18-SGM-2025 - Vazio/TC 18-SGM-2025.pdf', 0),
      arquivo('MODELOS/TC 1-2020 - Modelo/TC 1-2020.pdf'),
      arquivo('1. PUBLICAÇÕES NO DOC/TC 2-2026 - DOC/2026.09.17 - SIURB - TC 2-2026.pdf'),
    ],
    { mapa: { 'SGM - CASA CIVIL': 'SGM', MODELOS: null }, rotearPeloNome: ['1. PUBLICAÇÕES NO DOC'] }
  )
  expect(estrutura.map((c) => c.chave)).toEqual(['SGM|17 2025'])
  expect(estrutura[0].termos[0].arquivos).toEqual(['SGM - CASA CIVIL/TC 17-SGM-2025 - Portal/TC 17-SGM-2025.pdf'])
})
