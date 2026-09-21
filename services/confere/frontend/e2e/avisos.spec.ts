import { expect, test } from "@playwright/test";

import { prontoComAvisos } from "./estados";

/**
 * T-2352 · T-2353 — ESPEC 038, o bloco de avisos no estado `pronto`.
 *
 * O que estes testes medem é **onde** o aviso é lido, não o que ele diz: o texto
 * é do backend e é medido no `pytest`; a posição é da tela, e nunca esteve sob
 * teste — os dois dublês de `pronto` zeravam `avisos` de propósito e o piloto
 * não emite nenhum (ESPEC 038 §2.2).
 *
 * A ordem é afirmada por `compareDocumentPosition`, e não por coordenada de
 * pixel: pixel depende de viewport, de fonte e do que estiver aberto; ordem no
 * documento é o que a `R-AVI-01` decide.
 */

test.describe("ESPEC 038 — o aviso vem antes do relatório que ele ressalva", () => {
	test("T-2352 — o bloco de avisos precede o painel de análise", async ({ page }) => {
		await prontoComAvisos(page);

		const ordem = await page.evaluate(() => {
			// O bloco é localizado pelo **cartão**, não pelo cabeçalho: assim a
			// asserção vale dos dois lados da entrega, e o vermelho de antes dizia
			// `"depois"` — a regressão que se quer impedir — em vez de "não
			// encontrado", que diria apenas que a tela mudou.
			const cartao = document.querySelector("#conteudo li[class*='amber']");
			const bloco = cartao?.closest("ul") ?? null;
			const analise = document.getElementById("titulo-analise");
			if (!bloco || !analise) return "não montado";

			return bloco.compareDocumentPosition(analise) & Node.DOCUMENT_POSITION_FOLLOWING
				? "antes"
				: "depois";
		});

		expect(
			ordem,
			"o aviso chegava depois de três tabelas — e depois do botão que baixa o que ele ressalva",
		).toBe("antes");
	});

	test("T-2353 — o bloco tem cabeçalho, e é por ele que se chega nele", async ({ page }) => {
		await prontoComAvisos(page);

		// Navegação por títulos é o percurso que a ESPEC 008 §13 assume. Sem
		// cabeçalho, o último título da tela é o da seção anterior, e o bloco só
		// existe para quem rolar até o fim.
		await expect(page.getByRole("heading", { name: "2 avisos" })).toBeVisible();
	});

	test("T-2353 — a contagem aparece uma vez, e é a do cabeçalho", async ({ page }) => {
		await prontoComAvisos(page);

		// A metade que importa é **onde**: "aparece uma vez" já era verdade antes
		// da entrega — na faixa —, e um teste que só contasse passaria dos dois
		// lados (TASKS 038, regra 4).
		const placar = page.getByText(/itens com divergência entre contratado e medido/);
		await expect(placar).toBeVisible();
		await expect(
			placar,
			"o contador ficou na faixa, a quarenta linhas do que ele conta",
		).not.toContainText("aviso");
	});

	// Guarda da montagem, e **não** parte da rede: passa dos dois lados, de
	// propósito. É o que afirma que mover o bloco não mexeu no que está dentro
	// dele — `ListaDeAchados` e os dois cartões são intocados (TASKS 038, regra 1).
	test("os dois formatos de cartão continuam renderizando", async ({ page }) => {
		await prontoComAvisos(page);

		await expect(page.locator("li").filter({ hasText: "14.031.00023.00" })).toBeVisible();
		await expect(
			page.locator("li").filter({ hasText: "Nenhuma aba de detalhamento" }),
		).toBeVisible();
		await expect(page.locator("summary").filter({ hasText: "Detalhes técnicos" })).toBeVisible();
	});
});