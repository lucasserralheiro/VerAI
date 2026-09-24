import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ArquivoFonte, FonteArquivos } from './sincronizar'

/** Onde o OneDrive sincroniza a biblioteca "ContratosReceita" no PC que roda o agendador. */
export function pastaPadraoDaBiblioteca(): string {
  return process.env.SHAREPOINT_PASTA ?? path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
}

/** A biblioteca lida da pasta local. Caminho relativo à raiz, com `/`. */
export function fonteDaPasta(raiz: string): FonteArquivos {
  return {
    async listar() {
      const saida: ArquivoFonte[] = []
      async function andar(relativo: string[]) {
        const entradas = await readdir(path.join(raiz, ...relativo), { withFileTypes: true })
        for (const e of entradas) {
          const proximo = [...relativo, e.name]
          if (e.isDirectory()) {
            await andar(proximo)
          } else if (e.isFile()) {
            // stat não baixa o conteúdo (Arquivos On-Demand) — só a leitura baixa.
            const s = await stat(path.join(raiz, ...proximo))
            saida.push({ caminho: proximo.join('/'), tamanhoBytes: s.size, modificadoEm: s.mtime })
          }
        }
      }
      await andar([])
      return saida
    },
    ler(caminho) {
      return readFile(path.join(raiz, ...caminho.split('/')))
    },
  }
}
