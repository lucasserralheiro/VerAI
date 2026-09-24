/**
 * Régua da leitura do SharePoint — rode ANTES e DEPOIS de mexer em regra de estrutura ou identidade
 * (`src/lib/importacao-sharepoint/estrutura.ts`, `src/lib/arquivos/sharepoint/regras.ts`,
 * `scripts/sharepoint-clientes.json`). Não usa banco nem baixa PDF: só nomes de pasta e arquivo.
 *
 *   npx tsx scripts/regua-sharepoint.ts --salvar   # ANTES: fotografa a leitura atual e guarda a lista de arquivos
 *   npx tsx scripts/regua-sharepoint.ts            # DEPOIS: relê A MESMA lista com o código novo e mostra o que mudou
 *
 * Opções: --pasta="C:\...\rede.sp - ContratosReceita" (padrão igual ao da sincronização),
 * --arquivo=logs/regua-sharepoint.json. Saída 1 quando há diferença — cada linha é uma pasta que passou a
 * ser lida de outro jeito (tipo, número, PDF do termo, contrato que sumiu/apareceu). Diferença esperada
 * pela mudança: confira e salve de novo; inesperada: a regra quebrou outro cliente.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fonteDaPasta, pastaPadraoDaBiblioteca } from '../src/lib/arquivos/sharepoint/fonte-pasta'
import { compararFotos, fotografarEstrutura, lerBiblioteca, type ArquivoListado, type FotoContrato } from '../src/lib/importacao-sharepoint/regua'

interface ReguaSalva {
  quando: string
  raiz: string
  arquivos: ArquivoListado[]
  foto: FotoContrato[]
}

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return achado?.slice(nome.length + 3).replace(/^"|"$/g, '')
}

function configuracao() {
  const arquivo = path.join(__dirname, 'sharepoint-clientes.json')
  const json = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {}
  return { mapa: json.pastas ?? {}, rotearPeloNome: json.rotearPeloNome ?? [] }
}

function resumo(foto: FotoContrato[]): string {
  const termos = foto.reduce((n, c) => n + c.termos.length, 0)
  return `${foto.length} contratos, ${termos} pastas de termo`
}

async function main() {
  const arquivoRegua = argumento('arquivo') ?? 'logs/regua-sharepoint.json'

  if (process.argv.includes('--salvar')) {
    const raiz = argumento('pasta') ?? pastaPadraoDaBiblioteca()
    if (!existsSync(raiz)) throw new Error(`pasta não encontrada: ${raiz}`)
    const arquivos = (await fonteDaPasta(raiz).listar()).map(({ caminho, tamanhoBytes }) => ({ caminho, tamanhoBytes }))
    const foto = fotografarEstrutura(lerBiblioteca(arquivos, configuracao()))
    mkdirSync(path.dirname(arquivoRegua), { recursive: true })
    const salva: ReguaSalva = { quando: new Date().toISOString(), raiz, arquivos, foto }
    writeFileSync(arquivoRegua, JSON.stringify(salva, null, 1))
    console.log(`Régua salva em ${arquivoRegua}: ${arquivos.length} arquivos → ${resumo(foto)}`)
    console.log('Agora mude a regra e rode de novo sem --salvar.')
    return
  }

  if (!existsSync(arquivoRegua)) throw new Error(`sem régua em ${arquivoRegua} — rode com --salvar ANTES de mudar a regra`)
  const salva: ReguaSalva = JSON.parse(readFileSync(arquivoRegua, 'utf8'))
  const foto = fotografarEstrutura(lerBiblioteca(salva.arquivos, configuracao()))
  const diferencas = compararFotos(salva.foto, foto)

  console.log(`Régua de ${salva.quando} (${salva.arquivos.length} arquivos, mesma lista nas duas leituras)`)
  console.log(`  antes: ${resumo(salva.foto)}`)
  console.log(`  agora: ${resumo(foto)}`)
  if (diferencas.length === 0) {
    console.log('\nNenhuma pasta mudou de leitura.')
    return
  }
  // Agrupado pela sigla do cliente (começo da chave do contrato) — é por cliente que se confere.
  const porCliente = new Map<string, string[]>()
  for (const linha of diferencas) {
    const sigla = linha.split('|')[0]
    porCliente.set(sigla, [...(porCliente.get(sigla) ?? []), linha])
  }
  console.log(`\n${diferencas.length} diferença(s) em ${porCliente.size} cliente(s):`)
  for (const [sigla, linhas] of porCliente) {
    console.log(`\n${sigla}`)
    for (const linha of linhas) console.log(`  ${linha}`)
  }
  process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
