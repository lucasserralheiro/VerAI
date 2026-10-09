import { siglaComparavel } from '@/lib/confere/identidade'

// Chaves de casamento VerAI × AIBertinho (dashboard DRM). Os dois sistemas não compartilham id
// nenhum: cliente casa pela SIGLA, gerência pela SIGLA DA GERÊNCIA e contrato pelo NÚMERO (resolvido
// aqui, pela mesma regra do Confere). O AIBertinho tem uma cópia destas duas funções
// (`src/lib/integracao/chaves.ts` lá) com os MESMOS testes — mudou aqui, muda lá.
// Spec docs/superpowers/specs/2026-10-07-integracao-verai-aibertinho-design.md §3.

export { siglaComparavel }

/** "GRC-4", "grc4", "grc4-beatriz" (id do gerente no AIBertinho), "KAM 2", "GRC-C" → "GRC4",
 *  "GRC4", "GRC4", "KAM2", "GRCC". `null` quando o texto não começa por GRC/KAM. */
export function chaveDaGerencia(texto: string | null | undefined): string | null {
  if (!texto) return null
  const m = /^\s*(GRC|KAM)\s*-?\s*([A-Za-z0-9]{1,2})(?![A-Za-z0-9])/i.exec(texto)
  return m ? `${m[1]}${m[2]}`.toUpperCase() : null
}

/** Mesma sigla de cliente? "SP REGULA" = "SP-REGULA" = "spregula". Vazio nunca casa. */
export function mesmaSigla(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = siglaComparavel(a ?? '')
  return x !== '' && x === siglaComparavel(b ?? '')
}
