import path from "node:path";

import { expect, test } from "@playwright/test";

import { avisoDeIdentidade, CONTRATO, LEVANTAMENTO } from "./estados";

/** T-2105 / ESPEC 029 `P5` — o ciclo do portão, de ponta a ponta.
 *
 *  É o portão que faz esta entrega ser **uma pergunta e não uma tranca**: sem
 *  ele, `Severity.PERGUNTA` impede a emissão e não há botão que responda —
 *  exatamente o que o dono do negócio recusou em `I-04`.
 */

const LEVANTAMENTO_DO_PGM = path.resolve(
	__dirname,
	"../../backend/tests/fixtures/levantamento_pgm.xlsx",
);

/** O cruzamento **na outra direção**, e é escolha de custo: a geração que segue
 *  o *Gerar assim mesmo* lê os anexos do levantamento, e os do piloto são bem
 *  mais leves que os do PGM (1.947 linhas contra 3.462). O par é igualmente
 *  divergente nos dois sentidos. */
const CONTRATO_DO_PGM = path.resolve(
	__dirname,
	"../../backend/tests/fixtures/contrato_pgm.pdf",
);

test.describe("o portão de identidade", () => {
	test("pergunta antes de processar, e o par trocado é real", async ({ page }) => {
		// **Sem dublê no portão**: os arquivos são o contrato do SMIT e o
		// levantamento da PGM, e quem responde é o backend, lendo a página 1 e o
		// cabeçalho da aba. Custa ~1 s — é o que `D-10` comprou.
		await page.goto("/");
		await page.locator('input[type="file"]').first().waitFor();

		// Nenhuma geração pode sair enquanto a pergunta está de pé: se algum
		// `POST /reports` escapar daqui, o teste falha por esta contagem.
		let geracoes = 0;
		page.on("request", (requisicao) => {
			const url = requisicao.url();
			if (url.endsWith("/reports") && requisicao.method() === "POST") geracoes += 1;
		});

		await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
		await page.locator('input[type="file"]').nth(1).setInputFiles(LEVANTAMENTO_DO_PGM);
		await page.getByRole("button", { name: /Gerar relat/ }).click();

		const caixa = page.locator("#identidade-aviso");
		await expect(caixa).toBeVisible({ timeout: 30_000 });
		await expect(caixa).toContainText("52/SMIT/2024");
		await expect(caixa).toContainText("015/PGM/2024");
		// A frase da consequência é o que `D-02` exige: quem decide precisa saber
		// o que acontece se decidir seguir.
		await expect(caixa).toContainText(/se seguir assim mesmo/i);
		expect(geracoes, "o portão deixou a geração passar").toBe(0);
	});

	test("*Trocar arquivo* recolhe a pergunta sem processar nada", async ({ page }) => {
		await avisoDeIdentidade(page);

		let geracoes = 0;
		page.on("request", (requisicao) => {
			if (requisicao.url().endsWith("/reports")) geracoes += 1;
		});

		await page.getByRole("button", { name: "Trocar arquivo" }).click();

		await expect(page.locator("#identidade-aviso")).toHaveCount(0);
		expect(geracoes).toBe(0);
	});

	test("*Gerar assim mesmo* emite o documento e mantém a ressalva", async ({ page }) => {
		test.setTimeout(300_000);

		// **Nada é falsificado neste teste**, e a primeira versão dele errou
		// justamente aí: o portão vinha de um dublê, mas os arquivos eram o par
		// que *combina*. A geração real não tinha divergência que confirmar, e a
		// ressalva de `R-IDT-11` não podia existir. Um dublê no portão e arquivos
		// reais na geração são duas afirmações sobre pares diferentes.
		await page.goto("/");
		await page.locator('input[type="file"]').first().waitFor();
		await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO_DO_PGM);
		await page.locator('input[type="file"]').nth(1).setInputFiles(LEVANTAMENTO);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await expect(page.locator("#identidade-aviso")).toBeVisible({ timeout: 60_000 });

		const envio = page.waitForRequest(
			(requisicao) =>
				requisicao.url().endsWith("/reports") && requisicao.method() === "POST",
		);
		await page.getByRole("button", { name: "Gerar assim mesmo" }).click();

		// **O corpo não é inspecionável**: o Playwright não expõe o `multipart`
		// de uma requisição com arquivo — `postData()` devolve `null` e
		// `postDataBuffer()`, vazio. E não faz falta: o que provaria a presença
		// de `identidade_confirmada` no envio é exatamente o que as três
		// asserções abaixo afirmam. Sem o campo, este par volta 422 e **nenhum
		// relatório aparece** — é a `T-2095`, do outro lado.
		expect(await envio).toBeTruthy();
		await expect(page.locator("#identidade-aviso")).toHaveCount(0);
		await page.getByText("Relatório gerado").waitFor({ timeout: 240_000 });
		// `R-IDT-11` — um portão que some ao ser atravessado não deixa rastro de
		// que existiu.
		await expect(page.getByText(/Par confirmado no envio/i)).toBeVisible();
	});
});
