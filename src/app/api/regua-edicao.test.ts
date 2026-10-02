/** @jest-environment node */
// Régua da spec 2026-10-02-gerencias §6: todo POST/PUT/PATCH/DELETE das rotas de cliente pede edição. Rota nova
// de cliente entra sozinha (pelo prefixo); exceção só com motivo escrito em EXCECOES.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const API = join(process.cwd(), 'src', 'app', 'api')
const PREFIXOS = [
  'clientes', 'contratos', 'historico-contrato', 'itens-contrato', 'faturamentos', 'notas-fiscais', 'demandas',
  'tramites-demanda', 'solicitacoes', 'termos-confirmacao', 'responsaveis', 'arquivos', 'documentos',
]
const EXCECOES: Record<string, string> = {
  'arquivos/upload-token/route.ts POST': 'só emite o token do Blob; o registro (clientes/[clienteId]/arquivos POST) confere a edição',
}
const PROVA = /'editar'|exigirAdmin\(|role !== 'admin'/

function rotas(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return rotas(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

function metodosDeGravacao(fonte: string): Array<{ metodo: string; corpo: string }> {
  const marcas = [...fonte.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)]
  return marcas
    .map((m, i) => ({ metodo: m[1], corpo: fonte.slice(m.index!, marcas[i + 1]?.index ?? fonte.length) }))
    .filter((m) => m.metodo !== 'GET')
}

const alvos = PREFIXOS.flatMap((p) => rotas(join(API, p)))

it('acha as rotas de cliente', () => expect(alvos.length).toBeGreaterThan(25))

it.each(alvos.map((a) => [relative(API, a).split(sep).join('/'), a]))('%s pede edição em toda gravação', (rel, caminho) => {
  const sem = metodosDeGravacao(readFileSync(caminho, 'utf8'))
    .filter((m) => !PROVA.test(m.corpo) && !EXCECOES[`${rel} ${m.metodo}`])
    .map((m) => m.metodo)
  expect(sem).toEqual([])
})
