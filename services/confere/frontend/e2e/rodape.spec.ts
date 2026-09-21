import { expect, test, type Page } from "@playwright/test";

/**
 * ESPEC 056 / TASKS 056 `T-2830` — logo, Instagram e LinkedIn do rodapé
 * viram link, em nova aba. `/prodamsp` continua texto (`R-ROD-17`, `D-08`).
 */

const LOGO = {
	href: "https://portal.prodam.sp.gov.br/",
	nome: "Prodam — abrir o portal institucional em nova aba",
};
const INSTAGRAM = {
	href: "https://www.instagram.com/prodamsp/",
	nome: "Instagram da Prodam — abre em nova aba",
};
const LINKEDIN = {
	href: "https://br.linkedin.com/company/prodamsp",
	nome: "LinkedIn da Prodam — abre em nova aba",
};

/** Mesma técnica de `a11y-teclado.spec.ts` (T-408): `ring`/`shadow` não contam,
 *  só `outline` computado — e a cor entra na conta, porque `outline-none` do
 *  Tailwind não remove o contorno, só o torna transparente. */
async function ativo(page: Page) {
	return page.evaluate(() => {
		const el = document.activeElement as HTMLElement | null;
		if (!el || el === document.body) return null;
		const s = getComputedStyle(el);
		const transparente = /rgba?\([^)]*,\s*0\s*\)/.test(s.outlineColor);
		const contorno = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && !transparente;
		return {
			href: el.getAttribute("href"),
			contorno,
		};
	});
}

test.describe("os links do rodapé (ESPEC 056)", () => {
	test("logo, Instagram e LinkedIn têm href, nova aba e rel seguro", async ({ page }) => {
		await page.goto("/");

		for (const { href, nome } of [LOGO, INSTAGRAM, LINKEDIN]) {
			const link = page.getByRole("link", { name: nome });
			await expect(link).toHaveAttribute("href", href);
			await expect(link).toHaveAttribute("target", "_blank");
			await expect(link).toHaveAttribute("rel", /noopener/);
			await expect(link).toHaveAttribute("rel", /noreferrer/);
		}
	});

	test("os três nomes acessíveis são distintos entre si", async ({ page }) => {
		await page.goto("/");

		const nomes = await Promise.all(
			[LOGO, INSTAGRAM, LINKEDIN].map(({ nome }) =>
				page.getByRole("link", { name: nome }).getAttribute("aria-label"),
			),
		);
		for (const nome of nomes) expect(nome?.length ?? 0).toBeGreaterThan(0);
		expect(new Set(nomes).size).toBe(3);
	});

	test("/prodamsp continua texto — sem ancestral <a>", async ({ page }) => {
		await page.goto("/");

		const dentroDeLink = await page
			.getByText("/prodamsp", { exact: true })
			.evaluate((el) => el.closest("a") !== null);
		expect(dentroDeLink).toBe(false);
	});

	test("Tab alcança os três links em sequência, cada um com contorno visível", async ({ page }) => {
		await page.goto("/");

		const esperados = [LOGO.href, INSTAGRAM.href, LINKEDIN.href];
		const encontrados: string[] = [];

		// Limite generoso: cobre o link de pulo, os campos de upload, o botão de
		// envio e qualquer outro focável antes do rodapé, no estado inicial.
		for (let i = 0; i < 40 && encontrados.length < esperados.length; i++) {
			await page.keyboard.press("Tab");
			const estado = await ativo(page);
			if (estado?.href && esperados.includes(estado.href)) {
				encontrados.push(estado.href);
				expect(estado.contorno, `contorno de foco ausente em ${estado.href}`).toBe(true);
			}
		}

		expect(encontrados).toEqual(esperados);
	});
});
