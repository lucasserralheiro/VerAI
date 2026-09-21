import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ESTADOS } from "./estados";

/**
 * T-402 / T-436 — Varredura `axe` nos estados da tela (ESPEC 008 §9.2).
 *
 * As etiquetas são restritas às da norma. O conjunto padrão do `axe` inclui
 * `best-practice`, que não é WCAG: um portão que reprova por regra não acordada
 * é um portão que se aprende a ignorar — e a ESPEC 008 §4 recusou AAA
 * explicitamente.
 *
 * Roda sobre `pnpm dev`, como todo o Playwright do projeto. Para o que o `axe`
 * mede, dev e produção não diferem (PLANO 008 §6.2).
 *
 * **O que esta varredura não pega** está no PLANO 008 §5, e é o motivo de T-417
 * e T-437 existirem: região viva que não anuncia, foco perdido ao desabilitar e
 * `title` inalcançável são todos marcação válida.
 */

const NORMA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** As duas larguras importam, e não por simetria: a 1366 px o grid mede 832 px
 *  dentro de 848 px úteis e **não transborda**. A rolagem não-focável da
 *  `R-ACE-05` só existe abaixo de ~880 px — varrer só no desktop daria a
 *  regra por cumprida. */
const LARGURAS = [
	{ nome: "1366", viewport: { width: 1366, height: 768 } },
	{ nome: "390", viewport: { width: 390, height: 844 } },
];

for (const { nome: largura, viewport } of LARGURAS) {
	test.describe(`${largura} px`, () => {
		test.use({ viewport });

		for (const [nome, montar] of Object.entries(ESTADOS)) {
			test(`axe no estado ${nome}`, async ({ page }) => {
				await montar(page);

				const { violations } = await new AxeBuilder({ page }).withTags(NORMA).analyze();

				const resumo = violations
					.map((v) => `  [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}×)`)
					.join("\n");

				expect(
					violations,
					`\n${nome} @ ${largura}px — ${violations.length} violações:\n${resumo}\n`,
				).toEqual([]);
			});
		}
	});
}
