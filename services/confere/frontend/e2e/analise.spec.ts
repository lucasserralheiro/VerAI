import { expect, test } from "@playwright/test";

import { pronto, situacaoVazia } from "./estados";

/**
 * ESPEC 009 — o painel de análise na tela.
 *
 * O que estes testes protegem não é a aparência: é a **ordem de leitura** e as
 * ressalvas. Um painel que classifica sem dizer que cinco das dezenove linhas
 * conformes nunca poderiam divergir afirma mais do que sabe.
 */

/** T-2122 / ESPEC 030 `R-SUI-06` — **de onde vêm os números deste arquivo.**
 *
 *  Do backend, e não da tela. A âncora é `test_anchor_analise.py`, que os guarda
 *  e documenta a mudança na mesma linha:
 *
 *      test_a_contagem_do_piloto:  "1 / 20 / 16 / 21, somando 58 depois da
 *                                   ESPEC 018 (eram 56)."
 *      test_os_quatro_perfis…:     "4 das 21 linhas conformes… eram cinco: o
 *                                   14.025.00011.00 contava duas vezes."
 *
 *  Donos: ESPEC 018 `R-REL-01`, que fez o universo do relatório ser a aba
 *  `Levantamento` — 56 → 58, e os dois que entraram são conformes (19 → 21) —, e
 *  ESPEC 018 `D-01`, que consolidou o `14.025.00011.00` numa linha por código
 *  (5 → 4 perfis).
 *
 *  **O backend foi reancorado quando isso mudou; este arquivo, não.** Era a única
 *  suíte do projeto sem disciplina de reancoragem escrita, e é o que a ESPEC 030
 *  corrige. Número novo aqui volta a sair da âncora do backend — nunca de colar o
 *  que a tela imprime.
 */
test.describe("T-532 · o painel, entre a faixa e o grid", () => {
	// O quadro-resumo em tabela saiu da tela: rótulo, glosa e contagem já estavam
	// nos quatro blocos, palavra por palavra. O que ele tinha de próprio — o total
	// — ficou, porque é o invariante de `R-ANA-05` visível para quem lê.
	test("as quatro situações aparecem com o rótulo, o critério e a contagem", async ({
		page,
	}) => {
		await pronto(page);

		const situacoes = await page.evaluate(() =>
			Array.from(document.querySelectorAll("details")).map((d) => ({
				rotulo: d.querySelector("h3")?.textContent?.trim(),
				glosa: d.querySelector("h3 + span")?.textContent?.trim(),
				contagem: d.querySelector("summary span:last-of-type")?.textContent?.trim(),
			})),
		);

		expect(situacoes).toEqual([
			// ESPEC 031 — `0 itens`, e o bloco sai assim mesmo (`R-PAN-04`). É a
			// primeira vez que o piloto exercita a situação vazia.
			{ rotulo: "Item crítico", glosa: "— medido acima do contratado", contagem: "0 itens" },
			{
				rotulo: "Divergente de maior relevância",
				glosa: "— contratado sem medição no período",
				contagem: "20 itens",
			},
			{ rotulo: "Divergente", glosa: "— medido abaixo do contratado", contagem: "16 itens" },
			{
				rotulo: "Sem divergência",
				glosa: "— medido igual ao contratado",
				contagem: "22 itens",
			},
		]);
	});

	test("R-RES-02 — o total dos itens analisados fica visível", async ({ page }) => {
		await pronto(page);

		// A soma das quatro é o universo (`R-ANA-05`). Sem o total na tela, o
		// invariante só existe no teste — e é o primeiro número de uma conferência.
		await expect(page.getByText("58 itens analisados")).toBeVisible();
	});

	test("o quadro-resumo em tabela não existe mais na tela", async ({ page }) => {
		await pronto(page);

		// Ele dizia exatamente o que os quatro blocos já dizem. A aba `Resumo
		// Executivo` do `.xlsx` continua existindo: lá o arquivo circula sem eles.
		await expect(page.getByText("Total de itens analisados")).toHaveCount(0);
	});

	test("R-PAN-01 — a análise vem antes do grid de divergências", async ({ page }) => {
		await pronto(page);

		const ordem = await page.evaluate(() => {
			const analise = document.getElementById("titulo-analise");
			const grid = Array.from(document.querySelectorAll("h2")).find((h) =>
				h.textContent?.startsWith("Divergências, na ordem"),
			);
			if (!analise || !grid) return null;
			return analise.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
				? "antes"
				: "depois";
		});

		expect(ordem, "quem confere pergunta o que é grave antes de onde está").toBe("antes");
	});

	test("R-PAN-08 — só um título usa a palavra Divergências", async ({ page }) => {
		await pronto(page);

		// O rótulo da categoria e o título do grid designam recortes diferentes —
		// 16 itens contra 36. Dois `h2` iguais na mesma tela seria a mesma palavra
		// para duas coisas.
		await expect(page.getByRole("heading", { name: "Divergências", exact: true })).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Divergências, na ordem do relatório" }),
		).toHaveCount(1);
	});
});

test.describe("T-533 · os blocos recolhíveis", () => {
	// `D-03` revisada: os quatro nascem fechados. O que abria os dois primeiros
	// era o achado grave não ficar atrás de um clique — e a contagem no cabeçalho
	// já o mostra. Fechados, a árvore inteira cabe num relance e o grid não é
	// empurrado para fora da primeira tela por ~92 linhas de detalhe.
	test("os quatro nascem fechados", async ({ page }) => {
		await pronto(page);

		const abertos = await page.evaluate(() =>
			Array.from(document.querySelectorAll("details")).map((d) => ({
				titulo: d.querySelector("h3")?.textContent?.trim(),
				aberto: d.open,
			})),
		);

		expect(abertos).toEqual([
			{ titulo: "Item crítico", aberto: false },
			{ titulo: "Divergente de maior relevância", aberto: false },
			{ titulo: "Divergente", aberto: false },
			{ titulo: "Sem divergência", aberto: false },
		]);
	});

	test("fechado, o cabeçalho ainda diz o que foi achado", async ({ page }) => {
		await pronto(page);

		// É o que permite fechar tudo sem esconder o resultado: a contagem vive no
		// cabeçalho.
		//
		// **ESPEC 031 — e o achado passou a ser `0 itens`.** O argumento não muda:
		// quem fecha tudo continua lendo o resultado no cabeçalho, e *"nenhum item
		// crítico"* é o resultado que mais interessa a quem confere. Nunca houve
		// tabela aqui para esconder, e agora não há nem linha.
		const critico = page.locator("details").first();
		await expect(critico).not.toHaveAttribute("open", "");
		await expect(critico.getByRole("heading", { name: "Item crítico" })).toBeVisible();
		await expect(critico.getByText("0 itens")).toBeVisible();
		await expect(critico.locator("table")).toBeHidden();
	});

	test("abre e fecha por teclado, e o resumo não muda", async ({ page }) => {
		await pronto(page);

		const bloco = page.locator("details").nth(3);
		const total = page.getByText("58 itens analisados");
		await expect(total).toBeVisible();
		await expect(bloco).not.toHaveAttribute("open", "");

		await bloco.locator("summary").focus();
		await page.keyboard.press("Enter");
		await expect(bloco).toHaveAttribute("open", "");

		// `R-PAN-10` — recolher é do usuário e não altera contagem nenhuma.
		await expect(total).toBeVisible();
		await expect(bloco.locator("summary span:last-of-type")).toHaveText("22 itens");
	});
});

test.describe("T-535 · as ressalvas que impedem a leitura errada", () => {
	test("R-PAN-06 — sem divergência declara quantos itens são de perfil", async ({ page }) => {
		await pronto(page);

		const bloco = page.locator("details").nth(3);
		await bloco.locator("summary").click();

		await expect(bloco.getByText("4 desses itens são de perfil ou pacote")).toBeVisible();
		await expect(bloco.getByText(/Igualdade aqui não é conferência bem-sucedida/)).toBeVisible();
	});

	test("R-PAN-04 — o bloco crítico do piloto abre vazio, e diz isso", async ({ page }) => {
		await pronto(page);

		// **Era `R-PAN-05`, e o item que a exercitava desapareceu.** O
		// `14.049.00054.00` saía `0 / 2` com a marca *sem previsão contratual* e
		// saldo `-2`; a ESPEC 031 mostrou que aquele `2` vinha do bloco bruto de
		// `E1.1`, e com `0 = 0` ele deixou de ser crítico.
		//
		// **A `R-PAN-05` não foi afrouxada — perdeu o caso real.** A marca continua
		// no componente e continua verificada por cenário construído em
		// `T-556`/`R-PAN-04`. O que este teste passa a afirmar é o que o piloto de
		// fato produz, e é o mais valioso da tela: expandir a situação mais grave e
		// ler que não há nada nela.
		const critico = page.locator("details").first();
		await critico.locator("summary").click();

		await expect(critico.getByText("Nenhum item nesta situação.")).toBeVisible();
		await expect(critico.locator("table")).toHaveCount(0);
		await expect(critico.getByText("14.049.00054.00")).toHaveCount(0);
	});
});

test.describe("T-556 · a situação vazia, que o piloto não produz", () => {
	test("R-PAN-04 — bloco vazio aparece com contagem zero e sem tabela", async ({ page }) => {
		// Estado sintético: com o universo de `D-01` as quatro situações do piloto
		// têm itens, então este caminho não existe nos arquivos reais. É, no
		// entanto, o estado em que o artefato de referência entrega `Itens
		// Críticos` — e a regra existe para que "nenhum item crítico" seja lido
		// como resultado, não como ausência de resultado.
		await situacaoVazia(page);

		const critico = page.locator("details").first();
		await expect(critico.getByRole("heading", { name: "Item crítico" })).toBeVisible();
		// Fechado como os demais, a contagem no cabeçalho **é** o resultado.
		await expect(critico.getByText("0 itens")).toBeVisible();
		await expect(critico.locator("table")).toHaveCount(0);

		// Aberto, a frase por extenso — para quem quiser a confirmação escrita.
		await critico.locator("summary").click();
		await expect(critico.getByText("Nenhum item nesta situação.")).toBeVisible();
	});
});

test.describe("T-536 · o segundo download", () => {
	test("o nome do arquivo identifica contrato e competência", async ({ page }) => {
		await pronto(page);

		const [arquivo] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("link", { name: "Baixar análise (XLSX)" }).click(),
		]);

		expect(arquivo.suggestedFilename()).toMatch(/^confere-analise-.+\.xlsx$/);
	});

	test("o DOCX continua sendo o entregável formal, e continua baixando", async ({ page }) => {
		await pronto(page);

		const [arquivo] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("link", { name: "Baixar DOCX" }).click(),
		]);

		expect(arquivo.suggestedFilename()).toMatch(/^confere-.+\.docx$/);
	});
});
