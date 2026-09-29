import { diferencasEntreVersoes } from './diferencas'
import type { ItemSerializado } from './tipos'

const i = (codigo: string, preco: string | null, sobDemanda = false): ItemSerializado => ({
  codigo,
  grupo: 'A',
  secoes: 'A',
  descricao: `Serviço ${codigo}`,
  unidade: 'UN',
  preco,
  sobDemanda,
  precoTexto: null,
  conferencia: 'confere',
  precoNoPdf: preco,
})

it('novos, retirados e preço que mudou (com %) — "269" e "269.00" são o mesmo preço', () => {
  const d = diferencasEntreVersoes(
    [i('1', '100.00'), i('2', '269'), i('3', '50.00'), i('4', null, true)],
    [i('1', '110.00'), i('2', '269.00'), i('5', '10.00'), i('4', '80.00')]
  )
  expect(d.novos.map((x) => x.codigo)).toEqual(['5'])
  expect(d.retirados.map((x) => x.codigo)).toEqual(['3'])
  expect(d.precoMudou).toEqual([
    { codigo: '1', descricao: 'Serviço 1', antes: '100.00', depois: '110.00', percentual: 10 },
    { codigo: '4', descricao: 'Serviço 4', antes: null, depois: '80.00', percentual: null },
  ])
})
