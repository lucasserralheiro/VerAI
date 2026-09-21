import { expect, test, type Page } from "@playwright/test";

import { escolherArquivos } from "./estados";

/**
 * T-404 — Percurso de teclado (`R-ACE-04` a `R-ACE-08`).
 *
 * Escrito contra o percurso **proposto** da ESPEC 008 §6, não contra o atual.
 * Nasce vermelho e fica verde tarefa a tarefa — é o painel de progresso do
 * backlog.
 *
 * Cuidado que derruba o teste ingênuo: `ring-2` do Tailwind compila para
 * `box-shadow`, não para `outline`. Pior, o cartão do formulário já tem
 * `shadow-sm`, então procurar "alguma sombra em algum ancestral" dá falso
 * positivo. Os dois rótulos de upload são comparados **entre si**: o focado tem
 * de diferir do outro.
 */

async function ativo(page: Page) {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return null;
		return {
			tag: el.tagName.toLowerCase(),
			tipo: el.getAttribute("type"),
			papel: el.getAttribute("role"),
			texto: (el.textContent || "").trim().slice(0, 40),
			href: el.getAttribute("href"),
			tabindex: el.getAttribute("tabindex"),
			nome:
				el.getAttribute("aria-label") ||
				(el as HTMLElement).innerText?.trim().slice(0, 40) ||
				"",
		};
	});
}

/** `outline` do `:focus-visible` global (T-408).
 *
 *  A cor precisa entrar na conta: `outline-none` do Tailwind **não** remove o
 *  contorno, põe `outline: 2px solid transparent` — a variante existe para não
 *  quebrar o modo de alto contraste do Windows. Medir só estilo e largura daria
 *  contorno por presente no `<h2>` que recebe foco por programa. */
async function temContorno(page: Page) {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (!el) return false;
		const s = getComputedStyle(el);
		const transparente = /rgba?\([^)]*,\s*0\s*\)/.test(s.outlineColor);
		return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && !transparente;
	});
}

/** Anel no rótulo que envolve o input `sr-only` (T-409), medido por diferença. */
async function rotuloFocadoDifere(page: Page) {
	return page.evaluate(() => {
		const el = document.activeElement;
		const meu = el?.closest("label");
		if (!meu) return false;
		const todos = Array.from(document.querySelectorAll("label"));
		const outro = todos.find((l) => l !== meu);
		if (!outro) return false;
		return getComputedStyle(meu).boxShadow !== getComputedStyle(outro).boxShadow;
	});
}

test("percurso completo por teclado, sem mouse", async ({ page }) => {
	await page.goto("/");
	await page.locator('input[type="file"]').first().waitFor();

	await test.step("1 — o primeiro focável é o link de pulo", async () => {
		await page.keyboard.press("Tab");
		const el = await ativo(page);
		expect(el?.tag, `primeiro Tab caiu em ${JSON.stringify(el)}`).toBe("a");
		expect(el?.href).toBe("#conteudo");
		expect(await temContorno(page), "link de pulo sem contorno de foco").toBe(true);
	});

	await test.step("2 — campo Contrato, com anel visível no cartão", async () => {
		await page.keyboard.press("Tab");
		const el = await ativo(page);
		expect(el?.tipo).toBe("file");
		expect(el?.nome).toBe("Contrato");
		expect(await rotuloFocadoDifere(page), "cartão do Contrato sem anel de foco").toBe(true);
	});

	await test.step("3 — campo Levantamento, com anel visível no cartão", async () => {
		await page.keyboard.press("Tab");
		const el = await ativo(page);
		expect(el?.tipo).toBe("file");
		expect(el?.nome).toBe("Levantamento");
		expect(await rotuloFocadoDifere(page), "cartão do Levantamento sem anel de foco").toBe(true);
	});

	// T-2119 / ESPEC 030 — o degrau que faltava.
	//
	// A ESPEC 019 `R-ADT-10` acrescentou o campo de aditivos, e a `D-10` daquela
	// espec o pôs **em terceiro**: depois dos dois obrigatórios, antes de *Gerar
	// relatório*. O percurso da ESPEC 008 §6 manteve contrato ① e levantamento ②
	// onde estavam, e este é ③.
	//
	// O `input` é `sr-only`; o foco funciona e o anel aparece no rótulo por
	// `has-[:focus-visible]`. Por isso este degrau afirma o **nome**, e não o anel.
	await test.step("4 — campo de aditivos, opcional e alcançável", async () => {
		await page.keyboard.press("Tab");
		const el = await ativo(page);
		expect(el?.tipo, "o campo opcional foi pulado pela tabulação").toBe("file");
		expect(el?.nome).toBe("Aditivos da proposta");
	});

	await test.step("5 — o botão é alcançável mesmo indisponível", async () => {
		await page.keyboard.press("Tab");
		const el = await ativo(page);
		expect(el?.tag, "o botão desabilitado é pulado pela tabulação").toBe("button");
		// T-924 — o nome, e não só a etiqueta. Até a ESPEC 015 havia um botão só na
		// tela e "algum botão" bastava; com o *Limpar* ao lado, a asserção antiga
		// passaria com o controle errado e o percurso da ESPEC 008 §6 estaria
		// medindo outra coisa. Aqui não há arquivo escolhido, então `R-LMP-02`
		// mantém o *Limpar* fora da tela — e é isso que esta linha afirma.
		expect(el?.nome, "o percurso alcançou outro botão que não o primário").toBe(
			"Gerar relatório",
		);
	});

	await test.step("6 — Enter envia e o foco permanece no botão", async () => {
		await escolherArquivos(page);
		await page.getByRole("button", { name: /Gerar relat/ }).focus();
		await page.keyboard.press("Enter");

		await page.getByRole("button", { name: /Processando/ }).waitFor({ timeout: 15_000 });
		const el = await ativo(page);
		expect(el?.tag, "o foco saiu do botão ao iniciar o processamento").toBe("button");
	});

	await test.step("7 — o foco vai para o título do resultado", async () => {
		await page.getByText("Relatório gerado").waitFor({ timeout: 120_000 });
		const el = await ativo(page);
		expect(el?.tag).toBe("h2");
		expect(el?.tabindex).toBe("-1");
		expect(await temContorno(page), "o título recebeu contorno; ele não é acionável").toBe(
			false,
		);
	});

	await test.step("8 — o link de download é alcançável", async () => {
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press("Tab");
			const el = await ativo(page);
			if (el?.tag === "a" && /Baixar/.test(el.texto)) return;
		}
		throw new Error("o link de download não foi alcançado em 6 tabulações");
	});

	await test.step("9 — a rolagem do grid é alcançável", async () => {
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press("Tab");
			const el = await ativo(page);
			if (el?.papel === "region" && el.tabindex === "0") return;
		}
		throw new Error("nenhuma região rolável recebeu foco — colunas Medida e Saldo inalcançáveis");
	});
});
