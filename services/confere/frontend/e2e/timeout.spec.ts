import { expect, type Page, test } from "@playwright/test";

import { escolherArquivos } from "./estados";

/** ESPEC 012 `R-RSP-06` e `R-RSP-07` — a tela não espera para sempre, e sabe
 *  distinguir demora de queda.
 *
 *  Antes desta espec o `fetch` não tinha `signal`: uma conexão pendurada deixava
 *  a tela girando indefinidamente, sem erro e sem saída.
 *
 *  **O teto é encurtado por página, não pela suíte.** A primeira versão o baixava
 *  por variável de ambiente no servidor, e com isso **abortava toda geração real
 *  da suíte aos 3 s** — os estados `pronto` levam ~30 s. `addInitScript` limita o
 *  encurtamento a esta página.
 */

const TIMEOUT_DE_TESTE = 3_000;

/** Encurta o teto só nesta página, antes de qualquer script da aplicação rodar. */
async function encurtarTeto(page: Page) {
	await page.addInitScript((ms) => {
		(globalThis as { __CONFERE_TIMEOUT_MS__?: number }).__CONFERE_TIMEOUT_MS__ =
			ms;
	}, TIMEOUT_DE_TESTE);
}

test("a geração que estoura o tempo vira mensagem de demora, não de rede", async ({
	page,
}) => {
	await encurtarTeto(page);

	// Nunca responde: é a conexão pendurada que o `AbortController` existe para
	// cortar.
	await page.route("**/reports", async () => {
		await new Promise(() => {});
	});

	await page.goto("/");
	await escolherArquivos(page);
	await page.getByRole("button", { name: /Gerar relat/ }).click();

	await expect(page.getByText(/passou de três minutos/i)).toBeVisible({
		timeout: TIMEOUT_DE_TESTE + 10_000,
	});

	// A distinção é o requisito, não a existência da mensagem: mandar conferir se
	// o backend está no ar, quando ele está no ar trabalhando, manda a pessoa
	// para o lugar errado.
	await expect(page.getByText(/Verifique se o backend está no ar/i)).toBeHidden();
});

test("a falha de rede continua com a mensagem de rede", async ({ page }) => {
	await page.route("**/reports", (rota) => rota.abort("connectionrefused"));

	await page.goto("/");
	await escolherArquivos(page);
	await page.getByRole("button", { name: /Gerar relat/ }).click();

	await expect(
		page.getByText(/Verifique se o backend está no ar/i),
	).toBeVisible();
	await expect(page.getByText(/passou de três minutos/i)).toBeHidden();
});
