import { expect, test } from "@playwright/test";

import { bloqueado, escolherArquivos, inicial, pronto } from "./estados";
import { MUTADAS } from "./inventario-de-anuncios";

/**
 * Estrutura acessível — o que o `axe` não cobre.
 *
 * A linha vermelha da T-405 mostrou que o `axe` acusou **duas** regras nesta
 * tela. `scope` ausente, tabela sem nome e região viva que não anuncia são
 * marcação válida para ele. Estas asserções são a outra metade.
 */

test.describe("T-416 — a região viva nasce montada", () => {
	// O teste que pega o erro da D-03. Ele **não** afirma o atributo: afirma o
	// momento da montagem, que é onde a implementação intuitiva erra.
	//
	// **Reescrito pela ESPEC 016 `R-TA-11`, e mais forte.** A versão anterior
	// afirmava `toHaveCount(1)` sobre `[aria-live="polite"]` — número que
	// descrevia a tela de 2026-08-07 e virou requisito sem nunca ter sido
	// decidido como tal. O custo já foi cobrado: a ESPEC 015 precisou anunciar a
	// limpeza com `role="status"` **para não derrubar este teste**, e escrever
	// outro só para registrar a razão.
	//
	// O que se afirma agora é **correspondência**, não cardinalidade: cada região
	// que o inventário declara como `mutada` preexiste em `inicial`. Trocar a
	// constante por `inventario.length` teria sido trocar uma constante cega por
	// outra — continuaria passando com as regiões certas em número e erradas em
	// identidade.
	//
	// O `1` que sobrou é estrutural, e não arbitrário: uma região é **um** nó.
	const PREEXISTENTES = Array.from(new Set(MUTADAS.map((a) => a.seletor)));

	for (const seletor of PREEXISTENTES) {
		const declarantes = MUTADAS.filter((a) => a.seletor === seletor)
			.map((a) => a.id)
			.join(", ");

		test(`a região ${seletor} existe antes de qualquer envio (${declarantes})`, async ({
			page,
		}) => {
			await inicial(page);

			await expect(
				page.locator(seletor),
				`a região viva de '${declarantes}' só existe depois do conteúdo: leitores anunciam mutação de região presente, não inserção (ESPEC 008 D-03)`,
			).toHaveCount(1);
		});
	}

	test("a mesma região continua sendo a que recebe o resultado", async ({ page }) => {
		await pronto(page);

		const viva = page.locator('#conteudo [aria-live="polite"]');
		await expect(viva).toHaveCount(1);
		await expect(viva).toContainText("Relatório gerado");
	});
});

test.describe("T-423 — formulário", () => {
	test("Enter envia quando os dois arquivos estão escolhidos", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);

		await page.getByRole("button", { name: /Gerar relat/ }).focus();
		await page.keyboard.press("Enter");

		await expect(page.getByRole("button", { name: /Processando/ })).toBeVisible({ timeout: 15_000 });
	});

	test("com um só arquivo, nem Enter nem clique enviam", async ({ page }) => {
		await inicial(page);
		await page.locator('input[type="file"]').nth(0).setInputFiles(
			require("node:path").resolve(__dirname, "../../backend/tests/fixtures/contrato.pdf"),
		);

		const botao = page.getByRole("button", { name: /Gerar relat/ });
		await botao.focus();
		await page.keyboard.press("Enter");
		await botao.click({ force: true });

		// A guarda saiu do navegador e foi para o `onSubmit` quando o `disabled`
		// virou `aria-disabled`. Sem ela, o botão envia formulário incompleto.
		await page.waitForTimeout(1000);
		await expect(page.getByRole("button", { name: /Processando/ })).toHaveCount(0);
		await expect(botao).toHaveAttribute("aria-disabled", "true");
	});

	test("o foco permanece no botão durante o processamento", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);

		const botao = page.getByRole("button", { name: /Gerar relat/ });
		await botao.focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("button", { name: /Processando/ })).toBeVisible({ timeout: 15_000 });

		const tag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
		expect(tag, "desabilitar o elemento focado joga o foco para o body").toBe("button");
	});

	test("o nome acessível é o rótulo, antes e depois de escolher", async ({ page }) => {
		await inicial(page);

		const nomes = () =>
			page.evaluate(() =>
				Array.from(document.querySelectorAll('input[type="file"]')).map(
					(el) => el.getAttribute("aria-label") || "",
				),
			);

		// T-2118 / ESPEC 030 `D-04` — o teste afirma **o que ele quer**: que todo
		// campo tenha nome, que os dois obrigatórios tenham o seu, e que escolher
		// um arquivo não mude nome nenhum. É isto que `T-423` diz.
		//
		// A lista fechada `["Contrato", "Levantamento"]` afirmava, de quebra, que
		// o formulário tem dois campos — coisa que ela não tinha por que garantir,
		// e que a ESPEC 019 `R-ADT-10` desmentiu ao acrescentar o terceiro.
		const antes = await nomes();

		expect(antes.every((n) => n !== ""), "campo de arquivo sem nome acessível").toBe(true);
		expect(antes).toEqual(expect.arrayContaining(["Contrato", "Levantamento"]));

		await escolherArquivos(page);

		expect(await nomes(), "escolher o arquivo mudou o nome acessível").toEqual(antes);
	});
});

test.describe("T-431 — grid", () => {
	test("todo th de coluna tem scope e toda tabela tem nome", async ({ page }) => {
		await pronto(page);

		const semScope = await page.locator("th:not([scope])").count();
		expect(semScope, "th sem scope: o leitor não associa célula a coluna").toBe(0);

		const semNome = await page.locator("table:not([aria-labelledby]):not([aria-label])").count();
		expect(semNome, "tabelas anônimas são indistinguíveis na lista do leitor").toBe(0);
	});

	test("os títulos de seção são cabeçalhos, sem salto de nível", async ({ page }) => {
		await pronto(page);

		const niveis = await page.evaluate(() =>
			Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) =>
				Number(h.tagName[1]),
			),
		);

		expect(niveis.length).toBeGreaterThan(3);
		for (let i = 1; i < niveis.length; i++) {
			expect(
				niveis[i] - niveis[i - 1],
				`salto de h${niveis[i - 1]} para h${niveis[i]} em ${JSON.stringify(niveis)}`,
			).toBeLessThanOrEqual(1);
		}
	});

	test("toda rolagem horizontal é focável e tem nome", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await pronto(page);

		const roláveis = await page.evaluate(() =>
			Array.from(document.querySelectorAll("div")).
				filter((el) => el.scrollWidth > el.clientWidth + 1).
				map((el) => ({
					tabindex: el.getAttribute("tabindex"),
					papel: el.getAttribute("role"),
					nome: el.getAttribute("aria-labelledby") || el.getAttribute("aria-label"),
				})),
		);

		expect(roláveis.length, "nenhuma região rolável a 390 px — o cenário não foi montado").toBeGreaterThan(0);
		for (const r of roláveis) {
			expect(r.tabindex, `região rolável sem tabIndex: ${JSON.stringify(r)}`).toBe("0");
			expect(r.nome, `região rolável sem nome: ${JSON.stringify(r)}`).toBeTruthy();
		}
	});

	// T-542 — reescrito pela ESPEC 009, não apagado.
	//
	// A pergunta era *"o bloco `#sem-previsao` está antes das seções?"*. Com
	// `R-PAN-07` esse elemento deixou de existir: o item passou para dentro de
	// *Item crítico*, no painel de análise. Mantido o seletor, o teste falharia
	// por `null` — e não por regressão. Apagado, perderia-se a garantia da D-07
	// da ESPEC 008.
	//
	// A pergunta virou *"o item aparece uma vez, e antes do grid?"*, que é o que a
	// D-07 sempre quis assegurar: medir o que não foi contratado é o achado que
	// mais compromete o faturamento, e ele não pode ficar depois da lista inteira.
	//
	// ESPEC 018 `R-REL-05` — o grid deixou de ter seções, e a âncora deixou de ser
	// `[id^="secao-"]`. A pergunta é a mesma; o alvo é a tabela única.
	// **ESPEC 031 — o piloto deixou de produzir o caso, e a pergunta se partiu em
	// duas.** A marca *sem previsão contratual* existia por causa do
	// `14.049.00054.00`, que media 2 por artefato de leitura. Com `0 = 0` ele
	// deixou de ser consumo sem cobertura, e não há mais marca nenhuma na tela.
	//
	// A pergunta original — *"aparece uma vez, e antes do grid?"* — tinha duas
	// metades, e só a primeira dependia daquele item:
	//
	//   1. **quantas marcas**: hoje zero, e é o que este teste afirma;
	//   2. **a ordem**: o achado de maior consequência não pode vir depois da
	//      lista inteira. Essa metade não depende da marca — depende de o painel
	//      de análise preceder o grid —, e continua verificada.
	//
	// Afrouxar para *"zero ou uma"* seria trocar uma asserção por nada.
	test("não há item sem previsão contratual, e a análise precede o grid", async ({
		page,
	}) => {
		await pronto(page);

		const posicao = await page.evaluate(() => {
			const marcas = Array.from(document.querySelectorAll("span")).filter(
				(el) => el.textContent?.trim() === "sem previsão contratual",
			);
			const analise = document.querySelector("#titulo-analise");
			const grid = document.querySelector("#divergencias");
			if (!analise || !grid) return { marcas: marcas.length, ordem: null };

			const ordem =
				analise.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
					? "antes"
					: "depois";
			return { marcas: marcas.length, ordem };
		});

		expect(posicao.marcas, "o piloto não tem mais consumo sem cobertura").toBe(0);
		expect(posicao.ordem, "o achado de maior consequência não pode vir depois").toBe("antes");
	});

	// T-543 — o item, e não a marca. Enquanto o insumo `K-03` não vier, a regra de
	// ouro do TASKS 009 §2.3 é que ele nunca desapareça: por isso a asserção é de
	// contagem, e não de presença.
	//
	// T-2128 / ESPEC 030 `D-06` — de uma para duas ocorrências, **quando o item é
	// crítico**. A `R-PAN-07` exigia uma só, e a razão dela era boa: o item era uma
	// exceção, fora do universo do relatório, e o grid tinha um bloco separado no
	// topo só para ele. A ESPEC 009 tirou aquele bloco e o mandou para *Item
	// crítico*; a ESPEC 018 `R-REL-01` tornou o item linha comum do relatório —
	// linha comum que diverge aparece no grid **e** em *Item crítico*, cada vista
	// contando o universo por conta própria.
	//
	// **ESPEC 031 revoga a premissa para este item do piloto, não a regra das duas
	// vistas.** O `14.049.00054.00` media 2 por artefato de leitura (o bloco bruto,
	// não o descontado); corrigido, mede 0 — igual ao contratado. Sem divergência,
	// ele não é mais crítico: sai de *Item crítico* (T-542 já confere isso) e vira
	// linha comum de "Sem divergência", contada uma vez. A regra das duas vistas
	// segue valendo para todo item que for crítico — só não há, hoje, um item do
	// piloto que a exercite nas duas ao mesmo tempo.
	test("T-543 — 14.049.00054.00 nunca desaparece da tela", async ({ page }) => {
		await pronto(page);

		const ocorrencias = await page.evaluate(
			() =>
				Array.from(document.querySelectorAll("td")).filter(
					(el) => el.textContent?.trim() === "14.049.00054.00",
				).length,
		);

		// Uma vez, na tabela de "Sem divergência" — medido em 2026-09-09, depois da
		// ESPEC 031 (o item deixou de ser crítico; ver comentário acima).
		//
		// A regra de ouro do TASKS 009 §2.3 continua sendo a razão de a asserção ser
		// de contagem: **nenhuma** é o achado perdido, e é isso que ela guarda.
		expect(ocorrencias, "o item sumiu da tela").toBe(1);
	});
});

test.describe("T-427 — nenhum title carrega informação sozinho", () => {
	test("não há title em estado nenhum da tela", async ({ page }) => {
		for (const montar of [inicial, pronto, bloqueado]) {
			await montar(page);
			const comTitle = await page.locator("body [title]").count();
			expect(comTitle, "title não abre por teclado nem existe em toque").toBe(0);
		}
	});
});
