import { expect, test } from "@playwright/test";

import { pronto } from "./estados";

/** T-1506, T-1519 e T-1533 — ESPEC 021, as linhas que saem `1 / 1`.
 *
 *  A tabela substitui as frases amarelas do `V-REC-02`. O par piloto tem quatro
 *  linhas derivadas — 88, 89, 98 e 114 da aba `Levantamento` —, e é com ele que
 *  `estados.ts::pronto` monta a tela.
 *
 *  **Sem varredura `axe` própria (T-1533).** O `a11y-axe.spec.ts` já varre o
 *  estado `pronto` nas duas larguras obrigatórias, parametrizado por `ESTADOS`,
 *  e a tabela entra nele de graça. Duplicar aqui daria dois testes com a mesma
 *  cobertura e mensagem de falha pior — o de lá monta um resumo por violação.
 */

const LINHAS_DERIVADAS_DO_PILOTO = 4;

test.describe("linhas derivadas", () => {
	/** T-1506 · portão P1 — **este teste tem de reprovar contra o código
	 *  intocado**, acusando as quatro ocorrências de `V-REC-02` na tela.
	 *
	 *  A asserção é sobre o texto da **página inteira**, e não sobre o seletor do
	 *  bloco amarelo: o que a ESPEC 021 pede é que a sigla desapareça, e amarrar
	 *  o teste ao bloco o deixaria verde no dia em que alguém a movesse de lugar.
	 */
	test("a sigla V-REC-02 não aparece em lugar nenhum da tela", async ({ page }) => {
		await pronto(page);

		const texto = await page.locator("body").innerText();

		expect(texto).not.toContain("V-REC-02");
	});

	/** `R-PER-01` a `R-PER-06` — a tabela existe, com uma linha por célula
	 *  derivada, e traz a coluna que diz o que o sistema fez.
	 */
	test("a tabela traz as quatro linhas do piloto, com as colunas da planilha", async ({
		page,
	}) => {
		await pronto(page);

		const tabela = page.getByRole("table", { name: /perfil ou pacote/i });
		await expect(tabela).toBeVisible();

		for (const coluna of [
			"Linha",
			"Código",
			"Descrição",
			"Quantidade Contratada",
			"Quantidade Medida",
			"Saiu no relatório",
		]) {
			await expect(tabela.getByRole("columnheader", { name: coluna })).toBeVisible();
		}

		await expect(tabela.getByRole("row")).toHaveCount(LINHAS_DERIVADAS_DO_PILOTO + 1);
	});

	/** T-1521 · portão P2 — o `14.048.00008.00` do piloto é o banco de dados
	 *  **contratado no perfil IV(D) e medido no III(C)**.
	 *
	 *  A ESPEC 001 §9.3 declarou essa perda de informação e a aceitou; a
	 *  `R-PAN-06` a transformou numa ressalva de texto. Vinte especs depois, é
	 *  aqui que ela aparece na tela. Se esta asserção cair, a tabela não é melhor
	 *  que a frase que ela substituiu.
	 */
	test("o perfil contratado e o medido aparecem lado a lado", async ({ page }) => {
		await pronto(page);

		const linha = page.getByRole("row", { name: /14\.048\.00008\.00/ });
		const celulas = linha.getByRole("cell");

		await expect(celulas.nth(0)).toHaveText("88");
		await expect(celulas.nth(1)).toHaveText("14.048.00008.00");
		await expect(celulas.nth(3)).toHaveText("D");
		await expect(celulas.nth(4)).toHaveText("C");
		await expect(celulas.nth(5)).toHaveText("1 / 1");
	});

	/** `R-PER-02` — o texto da célula chega **como o leitor o entrega**.
	 *
	 *  `PACOTE` é o caso fácil; o `-` do PGM é o que quebra. Aqui vale o piloto,
	 *  onde a linha 98 traz `2` contratado e `PACOTE` medido — um `2` que sai
	 *  `1`, e que nem o documento nem o grid nem a análise mencionam.
	 */
	test("a célula de texto não é convertida a número", async ({ page }) => {
		await pronto(page);

		const linha = page.getByRole("row", { name: /14\.025\.00011\.00/ });
		const celulas = linha.getByRole("cell");

		await expect(celulas.nth(3)).toHaveText("2");
		await expect(celulas.nth(4)).toHaveText("PACOTE");
	});
});
