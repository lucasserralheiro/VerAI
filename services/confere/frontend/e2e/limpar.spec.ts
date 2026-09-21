import { expect, type Page, test } from "@playwright/test";

import { escolherArquivos, inicial, pronto } from "./estados";

/**
 * T-921 — ESPEC 015 §8.1. O botão *Limpar* e a confirmação.
 *
 * A maioria dos casos monta o estado **sem gerar relatório**: basta escolher os
 * dois arquivos para `R-LMP-02` acender o botão. Só os três que falam do
 * relatório pagam os ~25 s de uma geração real.
 */

const limpar = (page: Page) => page.getByRole("button", { name: "Limpar", exact: true });
const confirmar = (page: Page) => page.getByRole("button", { name: "Limpar tudo" });
const cancelar = (page: Page) => page.getByRole("button", { name: "Cancelar" });

async function valoresDosCampos(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).map(
			(el) => el.value,
		),
	);
}

/** T-2117 / ESPEC 030 `D-04` — os campos que **este teste preenche**.
 *
 *  `valoresDosCampos` varre todo `input[type="file"]` da página, e desde a
 *  ESPEC 019 `R-ADT-10` são **três**: os dois obrigatórios e o de aditivos, que
 *  é opcional e que `escolherArquivos` não preenche.
 *
 *  A correção não é trocar dois por três: é a asserção passar a nomear o que
 *  quer. Um quarto campo, no dia em que existir, não deve quebrar um teste que
 *  fala dos dois primeiros — foi assim que estes dois envelheceram.
 *
 *  Os `aria-label` são os rótulos declarados em `CAMPOS` (`UploadForm.tsx`). */
const OBRIGATORIOS = ["Contrato", "Levantamento"] as const;

async function valoresDosObrigatorios(page: Page): Promise<string[]> {
	return Promise.all(
		OBRIGATORIOS.map((rotulo) => page.getByLabel(rotulo, { exact: true }).inputValue()),
	);
}

/** `R-LMP-04` — **nenhum** campo guarda arquivo, seja qual for a quantidade deles. */
async function todosVazios(page: Page): Promise<boolean> {
	return (await valoresDosCampos(page)).every((v) => v === "");
}

/** Espera a limpeza **terminar** antes de qualquer leitura de `input.value`.
 *
 *  `page.evaluate` lê uma vez e não repete. Sem este sinal, a leitura acontece
 *  antes de o React ter descartado e recriado os campos, e o teste acusa
 *  `C:\fakepath\contrato.pdf` onde a limpeza está correta — foi assim que a
 *  `R-LMP-04` reprovou na suíte completa e passou isolada.
 *
 *  O sinal é o próprio botão se retirar: sem arquivo e em `inicial`, `R-LMP-02`
 *  o remove. É estado observável da aplicação, não um `waitForTimeout`. */
async function limpezaConcluida(page: Page) {
	await expect(limpar(page)).toHaveCount(0);
}

async function focoAtivo(page: Page) {
	return page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return null;
		return {
			tag: el.tagName.toLowerCase(),
			tipo: el.getAttribute("type"),
			texto: (el.textContent || "").trim(),
		};
	});
}

test.describe("R-LMP-02 — quando o controle existe", () => {
	test("não existe no estado inicial, sem arquivo escolhido", async ({ page }) => {
		await inicial(page);
		await expect(
			limpar(page),
			"sem nada a limpar, confirmar um efeito nulo ensina a confirmar sem ler (D-09)",
		).toHaveCount(0);
	});

	test("existe assim que um arquivo é escolhido", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);
		await expect(limpar(page)).toBeVisible();
	});

	test("some durante o processamento", async ({ page }) => {
		// Segurar a resposta é a única forma de capturar o estado transitório.
		await page.route("**/reports", () => new Promise(() => {}));
		await inicial(page);
		await escolherArquivos(page);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await page.getByRole("button", { name: /Processando/ }).waitFor({ timeout: 15_000 });

		await expect(
			limpar(page),
			"presente durante a geração, o botão é lido como cancelar — e a ESPEC 012 §10 diz que não é cancelável",
		).toHaveCount(0);
	});
});

test("R-LMP-03 — clicar em Limpar não gera relatório", async ({ page }) => {
	// O defeito de uma palavra: dentro do `<form>` de `R-ACE-07`, um `<button>`
	// sem `type` é `submit` por omissão do HTML.
	const pedidos: string[] = [];
	page.on("request", (r) => {
		if (r.url().endsWith("/reports")) pedidos.push(r.method());
	});

	await inicial(page);
	await escolherArquivos(page);
	await limpar(page).click();
	await expect(confirmar(page)).toBeVisible();
	await page.waitForTimeout(500);

	expect(pedidos, "Limpar disparou requisição: o botão está submetendo o formulário").toEqual([]);
});

test("R-LMP-04 — a limpeza zera o elemento, não só o rótulo", async ({ page }) => {
	await inicial(page);
	await escolherArquivos(page);
	// Os dois que `escolherArquivos` preenche — o de aditivos fica vazio por ser
	// opcional, e sempre ficou; o que mudou foi ele passar a existir.
	expect((await valoresDosObrigatorios(page)).every((v) => v !== "")).toBe(true);

	await limpar(page).click();
	await confirmar(page).click();
	await limpezaConcluida(page);

	// Avaliado **no elemento**. O rótulo lê de `arquivos` e voltaria a
	// "escolher arquivo…" mesmo com o defeito presente — asserir o rótulo
	// aprovaria o beco que `R-LMP-04` existe para evitar.
	//
	// `expect.poll` e não `expect(await …)`: a segunda forma lê uma vez só, e uma
	// leitura única sobre estado que acabou de mudar é corrida, não asserção.
	await expect
		.poll(() => todosVazios(page), {
			message: "input.value sobreviveu à limpeza: a tela diz vazio e o formulário não está",
		})
		.toBe(true);
	// Os **obrigatórios** voltaram ao rótulo vazio. A contagem vem de
	// `OBRIGATORIOS`, e não de quantos `input[type="file"]` a página tem: o campo
	// de aditivos tem rótulo próprio e nunca disse "escolher arquivo…".
	//
	// Derivar do número de inputs seria contar de novo, só que dinamicamente — e
	// foi o que a primeira tentativa desta tarefa fez, reprovando por 3 ≠ 2.
	await expect(page.getByText("escolher arquivo…")).toHaveCount(OBRIGATORIOS.length);
});

test.describe("R-LMP-05 — só o controle de confirmação limpa", () => {
	test("Cancelar deixa a tela intacta", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);
		const antes = await valoresDosCampos(page);

		await limpar(page).click();
		await cancelar(page).click();

		await expect(confirmar(page)).toBeHidden();
		expect(await valoresDosCampos(page)).toEqual(antes);
	});

	test("Esc deixa a tela intacta", async ({ page }) => {
		// `Esc` percorre outro caminho no `<dialog>` — evento `cancel` antes do
		// `close` — e uma implementação que trate só o clique o deixa cair no
		// caminho de sucesso. O modo de falha é o pior possível: limpa sem
		// confirmar.
		await inicial(page);
		await escolherArquivos(page);
		const antes = await valoresDosCampos(page);

		await limpar(page).click();
		await expect(confirmar(page)).toBeVisible();
		await page.keyboard.press("Escape");

		await expect(confirmar(page)).toBeHidden();
		expect(await valoresDosCampos(page), "Esc limpou sem confirmação").toEqual(antes);
	});

	test("Esc depois de uma confirmação anterior não limpa", async ({ page }) => {
		// `returnValue` sobrevive entre aberturas do mesmo `<dialog>`. Sem zerá-lo
		// na abertura, este `Esc` chegaria valendo `"limpar"`.
		await inicial(page);
		await escolherArquivos(page);
		await limpar(page).click();
		await confirmar(page).click();
		// Sem esperar, o `setInputFiles` seguinte pode mirar os campos que a
		// remontagem está prestes a destruir.
		await limpezaConcluida(page);

		await escolherArquivos(page);
		const antes = await valoresDosCampos(page);
		await limpar(page).click();
		await page.keyboard.press("Escape");

		expect(
			await valoresDosCampos(page),
			"returnValue de uma confirmação anterior vazou para este Esc",
		).toEqual(antes);
	});
});

test.describe("R-LMP-08 · R-LMP-09 — o foco", () => {
	test("abre no controle não destrutivo", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);
		await limpar(page).click();

		const ativo = await focoAtivo(page);
		expect(ativo?.tag, `o foco abriu em ${JSON.stringify(ativo)}`).toBe("button");
		expect(ativo?.texto, "confirmação de descarte não pré-seleciona o descarte").toBe("Cancelar");
	});

	test("cancelado, volta ao botão Limpar", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);
		await limpar(page).click();
		await cancelar(page).click();

		const ativo = await focoAtivo(page);
		expect(ativo, "o foco caiu no body ao fechar o diálogo").not.toBeNull();
		expect(ativo?.texto).toBe("Limpar");
	});

	test("confirmado, vai para o primeiro campo — que é um elemento novo", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);
		await limpar(page).click();
		await confirmar(page).click();

		const ativo = await focoAtivo(page);
		expect(
			ativo,
			"o foco caiu no body: a ref apontava para o campo destruído pela remontagem, e focus() num nó fora do documento não lança erro",
		).not.toBeNull();
		expect(ativo?.tipo).toBe("file");
	});

	test("nenhum caminho de fechamento termina no body", async ({ page }) => {
		await inicial(page);
		await escolherArquivos(page);

		for (const fechar of ["cancelar", "esc"] as const) {
			await limpar(page).click();
			if (fechar === "esc") await page.keyboard.press("Escape");
			else await cancelar(page).click();
			expect(await focoAtivo(page), `o caminho "${fechar}" perdeu o foco`).not.toBeNull();
		}
	});
});

test("R-LMP-10 — a volta ao início é anunciada", async ({ page }) => {
	await inicial(page);

	// A região nasce montada, antes de qualquer limpeza. Região que entra na
	// árvore junto com seu conteúdo é inserção, não mutação, e o anúncio não
	// dispara (ESPEC 008 `D-03`).
	await expect(page.locator('[role="status"]')).toHaveCount(1);

	await escolherArquivos(page);
	await limpar(page).click();
	await confirmar(page).click();

	await expect(page.locator('[role="status"]')).toContainText(/limpo/i);
});

test("R-LMP-13 — o invólucro aria-live continua sendo um só", async ({ page }) => {
	// `role="status"` implica região viva sem acrescentar o atributo. Se alguém
	// "corrigir" para `aria-live="polite"`, a T-416 quebra — e este teste diz por
	// quê antes de ela quebrar.
	await inicial(page);
	await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
});

test.describe("com relatório na tela", () => {
	test("R-LMP-01 — confirmar descarta o relatório inteiro", async ({ page }) => {
		await pronto(page);
		await limpar(page).click();
		await confirmar(page).click();

		// Não há mais o que limpar: o botão se retira sozinho.
		await limpezaConcluida(page);

		await expect(page.getByText("Relatório gerado")).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Baixar DOCX" })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Análise da medição" })).toHaveCount(0);
		// `R-LMP-01` fala do formulário **inteiro**, e não de dois campos: a
		// limpeza descarta tudo, inclusive o campo opcional.
		await expect.poll(() => todosVazios(page)).toBe(true);
	});

	test("R-LMP-05 — cancelar não descarta o relatório", async ({ page }) => {
		await pronto(page);
		await limpar(page).click();
		await cancelar(page).click();

		await expect(page.getByText("Relatório gerado")).toBeVisible();
		await expect(page.getByRole("link", { name: "Baixar DOCX" })).toBeVisible();
	});

	test("R-LMP-06 — havendo relatório, o texto nomeia a perda", async ({ page }) => {
		await pronto(page);
		await limpar(page).click();
		await expect(page.getByRole("dialog")).toContainText(/não há como recuperá-lo/i);
		await cancelar(page).click();
	});
});

test("R-LMP-06 — sem relatório, o texto não fala em descartar relatório", async ({ page }) => {
	await inicial(page);
	await escolherArquivos(page);
	await limpar(page).click();

	// Um aviso que exagera no caso leve ensina a confirmar sem ler — e aí a pessoa
	// confirma sem ler no caso grave, que é o único que importa (`D-04`).
	await expect(page.getByRole("dialog")).not.toContainText(/não há como recuperá-lo/i);
	await expect(page.getByRole("dialog")).toContainText(/arquivos escolhidos/i);
});