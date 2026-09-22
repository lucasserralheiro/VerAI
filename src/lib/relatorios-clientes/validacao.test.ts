/** @jest-environment node */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  booleanoOpcional,
  dataOpcional,
  decimalObrigatorio,
  decimalOpcional,
  emailOpcional,
  lerCorpo,
  textoObrigatorio,
  textoOpcional,
} from './validacao'

describe('textoOpcional', () => {
  it('apara espaços', () => {
    expect(textoOpcional.parse('  SMS  ')).toBe('SMS')
  })

  it('vazio ou só espaço vira null', () => {
    expect(textoOpcional.parse('  ')).toBeNull()
    expect(textoOpcional.parse('')).toBeNull()
    expect(textoOpcional.parse(null)).toBeNull()
  })

  it('ausente continua ausente (update parcial não apaga o campo)', () => {
    expect(textoOpcional.parse(undefined)).toBeUndefined()
  })
})

describe('textoObrigatorio', () => {
  it('apara e aceita texto', () => {
    expect(textoObrigatorio.parse(' Fulano ')).toBe('Fulano')
  })

  it('rejeita vazio, só espaço e ausente', () => {
    expect(textoObrigatorio.safeParse('  ').success).toBe(false)
    expect(textoObrigatorio.safeParse(undefined).success).toBe(false)
    expect(textoObrigatorio.safeParse(null).success).toBe(false)
  })
})

describe('decimalOpcional / decimalObrigatorio', () => {
  it('aceita formato brasileiro e devolve string normalizada', () => {
    expect(decimalOpcional.parse('1.234,56')).toBe('1234.56')
    expect(decimalOpcional.parse('1234,5')).toBe('1234.5')
    expect(decimalOpcional.parse('1.234.567')).toBe('1234567')
  })

  it('aceita formato com ponto decimal e número', () => {
    expect(decimalOpcional.parse('1234.56')).toBe('1234.56')
    expect(decimalOpcional.parse(1234.56)).toBe('1234.56')
    expect(decimalOpcional.parse(0)).toBe('0')
  })

  it('um único ponto seguido de 3 dígitos, sem vírgula, é ambíguo e é rejeitado', () => {
    for (const ambiguo of ['1.500', '12.345']) {
      const resultado = decimalOpcional.safeParse(ambiguo)
      expect(resultado.success).toBe(false)
      expect(resultado.error?.issues[0].message).toBe('valor ambíguo — use vírgula para decimais (ex.: 1.500,00)')
    }
  })

  it('ponto decimal sem ambiguidade, milhar com vírgula, vários pontos e vírgula inicial', () => {
    expect(decimalOpcional.parse('1.5')).toBe('1.5')
    expect(decimalOpcional.parse('1.50')).toBe('1.50')
    expect(decimalOpcional.parse('1.500,00')).toBe('1500.00')
    expect(decimalOpcional.parse('1.234.567')).toBe('1234567')
    expect(decimalOpcional.parse(',5')).toBe('0.5')
  })

  it('número JS com 3 casas decimais não é ambíguo', () => {
    expect(decimalOpcional.parse(1234.567)).toBe('1234.567')
  })

  it('rejeita negativo', () => {
    expect(decimalOpcional.safeParse(-1).success).toBe(false)
    expect(decimalOpcional.safeParse('-1').success).toBe(false)
    expect(decimalObrigatorio.safeParse(-1).success).toBe(false)
  })

  it('rejeita texto que não é número', () => {
    expect(decimalOpcional.safeParse('abc').success).toBe(false)
    expect(decimalOpcional.safeParse('1,2,3').success).toBe(false)
  })

  it('opcional: vazio vira null, ausente continua ausente', () => {
    expect(decimalOpcional.parse('  ')).toBeNull()
    expect(decimalOpcional.parse(null)).toBeNull()
    expect(decimalOpcional.parse(undefined)).toBeUndefined()
  })

  it('obrigatório: rejeita vazio e ausente', () => {
    expect(decimalObrigatorio.safeParse('').success).toBe(false)
    expect(decimalObrigatorio.safeParse(undefined).success).toBe(false)
    expect(decimalObrigatorio.parse('10,00')).toBe('10.00')
  })
})

describe('dataOpcional', () => {
  it('AAAA-MM-DD vira Date em UTC', () => {
    expect(dataOpcional.parse('2026-09-22')).toEqual(new Date('2026-09-22T00:00:00.000Z'))
  })

  it('rejeita data inexistente e formato errado', () => {
    expect(dataOpcional.safeParse('2026-02-30').success).toBe(false)
    expect(dataOpcional.safeParse('22/09/2026').success).toBe(false)
  })

  it('vazio vira null, ausente continua ausente', () => {
    expect(dataOpcional.parse('')).toBeNull()
    expect(dataOpcional.parse(null)).toBeNull()
    expect(dataOpcional.parse(undefined)).toBeUndefined()
  })
})

describe('booleanoOpcional', () => {
  it('aceita booleano e "true"/"false"', () => {
    expect(booleanoOpcional.parse(true)).toBe(true)
    expect(booleanoOpcional.parse('false')).toBe(false)
    expect(booleanoOpcional.parse(undefined)).toBeUndefined()
  })

  it('rejeita outros valores', () => {
    expect(booleanoOpcional.safeParse('talvez').success).toBe(false)
  })
})

describe('emailOpcional', () => {
  it('aceita e-mail válido e vazio', () => {
    expect(emailOpcional.parse(' a@b.gov.br ')).toBe('a@b.gov.br')
    expect(emailOpcional.parse('')).toBeNull()
    expect(emailOpcional.parse(undefined)).toBeUndefined()
  })

  it('rejeita e-mail inválido', () => {
    expect(emailOpcional.safeParse('nao-e-email').success).toBe(false)
  })
})

describe('lerCorpo', () => {
  const schema = z.object({ nome: textoObrigatorio, valor: decimalOpcional })
  const requisicao = (corpo: string) =>
    new NextRequest('http://localhost/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
    })

  it('devolve os dados validados', async () => {
    const resultado = await lerCorpo(requisicao(JSON.stringify({ nome: ' X ', valor: '1.234,56' })), schema)
    expect(resultado).toEqual({ dados: { nome: 'X', valor: '1234.56' } })
  })

  it('campo opcional ausente fica de fora; obrigatório ausente é erro', async () => {
    await expect(lerCorpo(requisicao(JSON.stringify({ nome: 'X' })), schema)).resolves.toEqual({ dados: { nome: 'X' } })
    const resultado = await lerCorpo(requisicao(JSON.stringify({})), schema)
    if (!('erro' in resultado)) throw new Error('esperava erro')
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'nome: campo obrigatório' })
  })

  it('devolve 400 com a mensagem do primeiro campo inválido, em português', async () => {
    const resultado = await lerCorpo(requisicao(JSON.stringify({ nome: '  ', valor: '-1' })), schema)
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(400)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'nome: campo obrigatório' })
  })

  it('usa o locale pt do zod quando o schema não tem mensagem própria', async () => {
    const resultado = await lerCorpo(requisicao(JSON.stringify({ nome: 5 })), z.object({ nome: z.string() }))
    if (!('erro' in resultado)) throw new Error('esperava erro')
    await expect(resultado.erro.json()).resolves.toEqual({
      error: 'nome: Tipo inválido: esperado string, recebido número',
    })
  })

  it('JSON malformado vira 400', async () => {
    const resultado = await lerCorpo(requisicao('{isso não é json'), schema)
    if (!('erro' in resultado)) throw new Error('esperava erro')
    expect(resultado.erro.status).toBe(400)
    await expect(resultado.erro.json()).resolves.toEqual({ error: 'corpo da requisição inválido' })
  })
})
