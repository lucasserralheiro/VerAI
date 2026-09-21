import { expect, type Page, test } from "@playwright/test";

import { LEVANTAMENTO, pronto } from "./estados";

/**
 * T-902 · T-903 · T-904 — ESPEC 015 §2.2, o vazamento dos dois blobs.
 *
 * A espec declarou este portão **humano**, herdando da ESPEC 008 §14 a
 * afirmação de que *"não há asserção de memória na suíte"*. A premissa está
 * certa e a conclusão não, e a distinção é o que torna este arquivo possível:
 *
 *   Liberar um blob não é **medir memória**. É **revogar um identificador** — e
 *   identificador revogado é observável: depois de `revokeObjectURL`, um `fetch`
 *   sobre aquela `blob:` URL falha.
 *
 * O `href` de *Baixar DOCX* **é** o identificador, exposto no DOM. Com isso o
 * defeito sai do fim da entrega, onde seria conferido por boa vontade, e vira o
 * teste que tem de falhar primeiro.
 */

/** As duas URLs de blob da tela.
 *
 *  Lidas **antes** da transição, sempre: depois dela os links não existem mais, e
 *  um auxiliar que lesse o `href` no fim mediria uma tela onde não há `href`
 *  nenhum — devolvendo "não resolve" para todo caso, e aprovando qualquer coisa.
 *
 *  Devolve um par, e não um valor: são **dois** blobs desde a ESPEC 009, e foi
 *  exatamente essa contagem que o comentário de `page.tsx` registrou como lugar
 *  de esquecimento. */
async function urlsDoBlob(page: Page): Promise<[string, string]> {
	const docx = await page.getByRole("link", { name: "Baixar DOCX" }).getAttribute("href");
	const analise = await page.getByRole("link", { name: /Baixar an/ }).getAttribute("href");
	expect(docx, "sem o href do DOCX não há o que medir").toMatch(/^blob:/);
	expect(analise, "sem o href da análise não há o que medir").toMatch(/^blob:/);
	return [docx as string, analise as string];
}

/** `blob:` é escopado por origem: o `fetch` roda no contexto **da página**, nunca
 *  do processo de teste — onde nenhuma das duas resolveria e o instrumento
 *  aprovaria o vazamento sem nunca o ter medido. */
async function resolvem(page: Page, urls: [string, string]): Promise<[boolean, boolean]> {
	return page.evaluate(async ([a, b]) => {
		const tenta = async (u: string) => {
			try {
				return (await fetch(u)).ok;
			} catch {
				return false;
			}
		};
		return [await tenta(a), await tenta(b)] as [boolean, boolean];
	}, urls);
}

test("T-903 — o instrumento acerta os dois lados", async ({ page }) => {
	// `fetch` falha por muitos motivos: CSP, rede, URL malformada, erro de
	// digitação. Um auxiliar que devolvesse "não resolve" para todos eles não
	// distinguiria correção de engano — e entraria na E2 como instrumento cego.
	// É a exigência da T-802 do PLANO 013 noutra roupa.
	await pronto(page);
	const urls = await urlsDoBlob(page);

	expect(
		await resolvem(page, urls),
		"as URLs de um relatório recém-gerado têm de resolver",
	).toEqual([true, true]);

	await page.evaluate(([a, b]) => {
		URL.revokeObjectURL(a);
		URL.revokeObjectURL(b);
	}, urls);

	expect(
		await resolvem(page, urls),
		"depois de revogadas, nenhuma pode resolver — se ainda resolvem, o instrumento não mede revogação",
	).toEqual([false, false]);
});

test("T-904 — trocar de arquivo libera os dois blobs", async ({ page }) => {
	await pronto(page);
	const urls = await urlsDoBlob(page);
	expect(await resolvem(page, urls)).toEqual([true, true]);

	// `selecionar()` leva `pronto → inicial` **sem passar por `enviar()`**, que era
	// onde a liberação estava ancorada. É o caminho de ESPEC 015 §2.2.
	await page.locator('input[type="file"]').nth(0).setInputFiles(LEVANTAMENTO);
	await expect(page.getByText("Relatório gerado")).toHaveCount(0);

	expect(
		await resolvem(page, urls),
		"pronto → inicial por troca de arquivo reteve os dois blobs — ~3,8 MB pela sessão (ESPEC 015 §2.2)",
	).toEqual([false, false]);
});

test("T-904 — reenviar libera os blobs anteriores", async ({ page }) => {
	// Este caminho **já funcionava** antes da entrega, e está aqui por isso: é a
	// regressão que prova que mover a âncora para `descartar()` não perdeu o que a
	// `R-ACE-18` já garantia.
	await pronto(page);
	const urls = await urlsDoBlob(page);
	expect(await resolvem(page, urls)).toEqual([true, true]);

	await page.getByRole("button", { name: /Gerar relat/ }).click();
	await page.getByRole("button", { name: /Processando/ }).waitFor({ timeout: 15_000 });

	expect(
		await resolvem(page, urls),
		"reenviar sem liberar os blobs anteriores é o defeito que R-ACE-18 já cobria",
	).toEqual([false, false]);

	// Esperar o fim antes de sair: a réplica serializa geração (`CapacityLimiter(1)`
	// da ESPEC 012), e deixar uma em voo faria o teste seguinte esperar por ela sem
	// saber por quê.
	await page.getByText("Relatório gerado").waitFor({ timeout: 120_000 });
});