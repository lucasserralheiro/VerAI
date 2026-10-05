/** @jest-environment node */
import JSZip from 'jszip'
import { AnexoRecusado, MAX_DESCOMPRIMIDO_ANEXO, ZipGrandeDemais, ZipIlegivel, paginasDoAnexo, tamanhoDescomprimido } from './extrair'

/** Zip só com o diretório central (sem conteúdo), declarando os tamanhos dados. */
function zipFalso(tamanhos: number[]): Buffer {
  const entradas = tamanhos.map((t, i) => {
    const nome = Buffer.from(`f${i}.xml`)
    const e = Buffer.alloc(46)
    e.writeUInt32LE(0x02014b50, 0)
    e.writeUInt32LE(t, 24)
    e.writeUInt16LE(nome.length, 28)
    return Buffer.concat([e, nome])
  })
  const central = Buffer.concat(entradas)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(tamanhos.length, 8)
  fim.writeUInt16LE(tamanhos.length, 10)
  fim.writeUInt32LE(central.length, 12)
  fim.writeUInt32LE(0, 16)
  return Buffer.concat([central, fim])
}

describe('tamanhoDescomprimido', () => {
  it('soma os tamanhos de um zip de verdade', async () => {
    const zip = new JSZip()
    zip.file('a.xml', 'x'.repeat(1000))
    zip.file('b.xml', 'y'.repeat(500))
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    expect(tamanhoDescomprimido(buf)).toBe(1500)
  })

  it('lê o diretório central declarado; zip64 (0xFFFFFFFF) conta como infinito', () => {
    expect(tamanhoDescomprimido(zipFalso([150 * 1024 * 1024, 60 * 1024 * 1024]))).toBe(210 * 1024 * 1024)
    expect(tamanhoDescomprimido(zipFalso([0xffffffff]))).toBe(Infinity)
  })

  it('null quando não é zip', () => {
    expect(tamanhoDescomprimido(Buffer.from('não sou zip'))).toBeNull()
  })
})

describe('paginasDoAnexo', () => {
  it('docx/xlsx acima de 200 MB descomprimidos: recusa antes de extrair', async () => {
    const grande = zipFalso([MAX_DESCOMPRIMIDO_ANEXO, 1])
    await expect(paginasDoAnexo(grande, 'docx')).rejects.toBeInstanceOf(ZipGrandeDemais)
    await expect(paginasDoAnexo(grande, 'xlsx')).rejects.toBeInstanceOf(ZipGrandeDemais)
  })
  it('docx/xlsx com diretório central ilegível (não é zip, zip64 com mais de 65.535 entradas): recusa', async () => {
    const zip64 = zipFalso([10])
    zip64.writeUInt16LE(0xffff, zip64.length - 22 + 10)
    zip64.writeUInt32LE(0xffffffff, zip64.length - 22 + 16)
    for (const buf of [Buffer.from('não sou zip'), zip64]) {
      for (const formato of ['docx', 'xlsx'] as const) {
        const erro = await paginasDoAnexo(buf, formato).catch((e) => e)
        expect(erro).toBeInstanceOf(ZipIlegivel)
        expect(erro).toBeInstanceOf(AnexoRecusado)
        expect(erro.message).toBe('arquivo compactado ilegível')
      }
    }
  })
})
