import { expect, test } from "@playwright/test";

import { divergenciaComAditivo, divergenciaDeFonte } from "./estados";

/** T-1705, T-1724 e T-1726 — ESPEC 023, a divergência de contratado.
 *
 *  A tabela substitui as frases âmbar da `V-REC-01`. **O par piloto produz zero
 *  `V-REC-01`**, e por isso nenhum teste daqui usa `estados.pronto`: escrito
 *  contra ele, o teste da sigla nasceria verde e permaneceria verde qualquer que
 *  fosse a implementação. Os dois estados vêm de dublê (T-1700).
 *
 *  **Sem varredura `axe` própria (T-1733).** O `a11y-axe.spec.ts` varre os
 *  estados de `ESTADOS` nas duas larguras obrigatórias, e os dois novos entram
 *  ali de graça — mesmo caminho que a tabela da ESPEC 021 usou.
 */

const DIVERGENCIAS_DO_PGM = 5;

test.describe("divergência de contratado", () => {
	/** T-1705 · portão P1 — **este teste tem de reprovar contra o código
	 *  intocado**, acusando as cinco ocorrências de `V-REC-01` na tela.
	 *
	 *  A asserção é sobre o texto da **página inteira**, e não sobre o seletor do
	 *  bloco âmbar: o que a ESPEC 023 pede é que a sigla desapareça, e amarrar o
	 *  teste ao bloco o deixaria verde no dia em que alguém a movesse de lugar.
	 */
	test("a sigla V-REC-01 não aparece em lugar nenhum da tela", async ({ page }) => {
		await divergenciaDeFonte(page);

		const texto = await page.locator("body").innerText();

		expect(texto).not.toContain("V-REC-01");
	});

	/** `R-FON-01` e `R-FON-05` — a tabela existe, com uma linha por código e a
	 *  coluna que as frases não tinham. */
	test("a tabela traz os cinco itens, com a diferença", async ({ page }) => {
		await divergenciaDeFonte(page);

		// A `section` e o contêiner rolável compartilham o rótulo acessível — dois
		// `region` com o mesmo nome. A tabela é única, e é o que se quer medir.
		const tabela = page.getByRole("table", { name: /aditivo/i });
		await expect(tabela.locator("tbody tr")).toHaveCount(DIVERGENCIAS_DO_PGM);

		// A diferença é o conteúdo do aditivo que falta (ESPEC 023 §2.2). Sem ela
		// a tabela é um extrato reformatado; com ela, é um endereço.
		await expect(tabela.getByText("+1.100,00")).toBeVisible();
		await expect(tabela.getByText("+554,01")).toBeVisible();
		await expect(tabela.getByText("−80,00")).toBeVisible();
	});

	/** `R-FON-06` — magnitude relativa decrescente, não a ordem do contrato.
	 *
	 *  Quem lê está triando, não percorrendo: `+550%` e `+1%` não podem ter o
	 *  mesmo peso visual. */
	test("a ordem é por magnitude, com o maior primeiro", async ({ page }) => {
		await divergenciaDeFonte(page);

		const codigos = await page
			.getByRole("table", { name: /aditivo/i })
			.locator("tbody tr td:first-child")
			.allInnerTexts();

		expect(codigos).toEqual([
			"14.048.00027.00",
			"14.031.00020.00",
			"12.030.00001.00",
			"14.024.00006.00",
			"10.050.00001.00",
		]);
	});

	/** `R-FON-07` — a ação devolve o foco ao campo de aditivos.
	 *
	 *  **Não reenvia** (`D-05`): a aplicação é sem estado e não guarda os arquivos
	 *  entre duas chamadas. O rótulo diz as duas etapas justamente por isso. */
	test("a ação leva o foco ao campo de aditivos", async ({ page }) => {
		await divergenciaDeFonte(page);

		await page.getByRole("button", { name: /Anexar aditivo/i }).click();

		await expect(page.locator('input[type="file"]').nth(2)).toBeFocused();
	});

	/** `R-FON-02` e `R-FON-03` — o estado B é outro diagnóstico, e a tela diz.
	 *
	 *  É o conteúdo da espec. Sem esta distinção, o que se entregou foi uma tabela
	 *  mais bonita. */
	test("com aditivo aplicado, o título e o rótulo mudam", async ({ page }) => {
		await divergenciaComAditivo(page);

		await expect(page.getByText(/não fecha/i)).toBeVisible();
		await expect(page.getByText(/Contratado vigente/i)).toBeVisible();

		// `R-FON-04` — a decomposição é o que prova que a soma foi feita.
		//
		// Ancorada nos **números**, e não na cadeia `proposta … aditivo`: essa casa
		// também o rótulo do campo de upload e a frase do aviso, e o modo estrito
		// do Playwright resolve três elementos.
		await expect(
			page.getByText("proposta 200,00 + aditivo 1.100,00"),
		).toBeVisible();
	});

	/** `R-FON-12` / `D-07` — o silêncio precisa ser dito.
	 *
	 *  Sem esta frase, uma tabela de uma linha parece relatório incompleto: o
	 *  leitor não tem como saber que os outros foram conferidos e fecharam. */
	test("no estado com aditivo, o rodapé declara que os demais fecharam", async ({
		page,
	}) => {
		await divergenciaComAditivo(page);

		await expect(page.getByText(/fecharam/i)).toBeVisible();
	});

	/** `R-FON-07` — a ação **não** aparece quando o aditivo já foi anexado. */
	test("no estado com aditivo, não há ação de anexar", async ({ page }) => {
		await divergenciaComAditivo(page);

		await expect(page.getByRole("button", { name: /Anexar aditivo/i })).toHaveCount(0);
	});
});
