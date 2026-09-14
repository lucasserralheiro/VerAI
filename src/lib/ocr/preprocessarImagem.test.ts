import { binarizarEContrastar } from './preprocessarImagem'

describe('binarizarEContrastar', () => {
  it('estica o contraste: luminância mínima vira preto (0), máxima vira branco (255)', () => {
    // 2 pixels: cinza escuro (60,60,60) e cinza claro (180,180,180) — simula
    // scanner de baixo contraste (nunca preto/branco puro).
    const imagem = {
      data: new Uint8ClampedArray([60, 60, 60, 255, 180, 180, 180, 255]),
      width: 2,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(imagem.data[0]).toBe(0)
    expect(imagem.data[4]).toBe(255)
    expect(imagem.data[3]).toBe(255) // alpha preservado
    expect(imagem.data[7]).toBe(255)
  })

  it('página uniforme (sem variação de luminância) não altera nada', () => {
    const imagem = {
      data: new Uint8ClampedArray([128, 128, 128, 255, 128, 128, 128, 255]),
      width: 2,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(Array.from(imagem.data)).toEqual([128, 128, 128, 255, 128, 128, 128, 255])
  })

  it('pixel intermediário escala linearmente entre o mínimo e o máximo já presentes', () => {
    const imagem = {
      data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]),
      width: 3,
      height: 1,
    }

    binarizarEContrastar(imagem)

    expect(imagem.data[0]).toBe(0)
    expect(imagem.data[4]).toBe(128)
    expect(imagem.data[8]).toBe(255)
  })
})
