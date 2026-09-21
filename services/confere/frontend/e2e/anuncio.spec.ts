import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

import {
	avisoDeIdentidade,
	avisoDeLevantamento,
	CONTRATO,
	escolherArquivos,
	LEVANTAMENTO,
} from "./estados";
import {
	DO_FRAMEWORK,
	INSERIDAS,
	INVENTARIO,
	MUTADAS,
	type EstadoDeAnuncio,
} from "./inventario-de-anuncios";

/**
 * T-1008 · T-1009 · T-1011 · T-1029 — ESPEC 016, os testes de mecanismo.
 *
 * O que estes testes **não** fazem: verificar que algo é anunciado. Isso só a
 * escuta faz (`D-04` — asserir a árvore de acessibilidade mede o que o navegador
 * expõe, não o que o leitor fala, e a distância entre os dois é onde moram os
 * defeitos que a ESPEC 016 existe para pegar).
 *
 * O que eles fazem é o mecanismo: **mutação × inserção**. Leitores anunciam a
 * mutação de uma região já presente na árvore; uma região que entra na árvore
 * junto com seu conteúdo é inserção, e o anúncio não dispara (ESPEC 008 `D-03`).
 * Isso é identidade de nó, e é distinguível sem leitor nenhum.
 */

/** Resposta real do backend, capturada **uma vez** e reemitida em cada teste que
 *  precisa de `pronto`.
 *
 *  T-1013 — sem isto cada teste pagaria ~30 s de geração real, e a suíte já leva
 *  20,5 min. É o padrão que `estados.ts::situacaoVazia` inaugurou, e pelo mesmo
 *  motivo: o que se testa aqui é a transição da tela, não a geração. */
let respostaPronto: string;

test.beforeAll(async ({ playwright }) => {
	test.setTimeout(180_000);

	// **Chamada direta ao backend, sem navegador.**
	//
	// A primeira versão dirigia a tela — escolher arquivos, clicar, esperar a
	// resposta — só para capturar um corpo de JSON. Estourou de forma
	// intermitente, e o sintoma (`waitForResponse` sem resposta, com o backend
	// respondendo `200` no `/health`) não distingue backend lento de corrida de
	// hidratação: se o `setInputFiles` chega antes de o React se ligar, o arquivo
	// entra no DOM, o `onChange` não dispara, o botão fica `aria-disabled` e a
	// guarda do `onSubmit` barra o clique — **nenhuma requisição sai**.
	//
	// A correção não é esperar melhor: é não passar pela tela. O que este hook
	// precisa é do corpo da resposta, e o corpo vem do backend.
	const api = await playwright.request.newContext({ baseURL: "http://127.0.0.1:8000" });
	const resposta = await api.post("/reports", {
		multipart: {
			contrato: {
				name: "contrato.pdf",
				mimeType: "application/pdf",
				buffer: readFileSync(CONTRATO),
			},
			levantamento: {
				name: "levantamento.xlsx",
				mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				buffer: readFileSync(LEVANTAMENTO),
			},
		},
		timeout: 150_000,
	});
	expect(resposta.status(), "o backend não devolveu a geração de referência").toBe(200);
	respostaPronto = await resposta.text();
	await api.dispose();
});

/** Dublê da resposta de erro. O backend a devolve em ~1 s contra ~30 s de uma
 *  geração real, e o que importa aqui é a **forma** — mesma justificativa que
 *  `estados.ts::bloqueado` já registrou para o 422 sintético. */
const CORPO_ERRO = JSON.stringify({
	detail: "'levantamento' não é um arquivo XLSX válido — a assinatura do arquivo não confere com a extensão",
});

const CORPO_BLOQUEADO = JSON.stringify({
	detalhe: "Processamento bloqueado",
	bloqueantes: [
		{
			validacao: "V-CTR-03",
			severidade: "BLOQUEIA",
			mensagem: "O total do levantamento não confere com a soma dos itens medidos.",
			codigo: "4.1.2",
		},
	],
	avisos: [],
});

/** Leva a tela até o estado da entrada, **sem recarregar a página** depois de
 *  `inicial`: a marcação do nó vive em `window`, e um `goto` a apagaria. */
async function transicionar(page: Page, estado: EstadoDeAnuncio) {
	switch (estado) {
		case "processando":
			await page.route("**/reports", () => new Promise(() => {}));
			await escolherArquivos(page);
			await page.getByRole("button", { name: /Gerar relat/ }).click();
			await page.getByRole("button", { name: /Processando/ }).waitFor({ timeout: 15_000 });
			return;

		case "pronto":
			await page.route("**/reports", (rota) =>
				rota.fulfill({ status: 200, contentType: "application/json", body: respostaPronto }),
			);
			await escolherArquivos(page);
			await page.getByRole("button", { name: /Gerar relat/ }).click();
			await page.getByText("Relatório gerado").waitFor({ timeout: 30_000 });
			return;

		case "erro":
			await page.route("**/reports", (rota) =>
				rota.fulfill({ status: 400, contentType: "application/json", body: CORPO_ERRO }),
			);
			await escolherArquivos(page, CONTRATO);
			await page.getByRole("button", { name: /Gerar relat/ }).click();
			// Escopado ao `<main>`: `getByRole("alert")` casa também com o
			// anunciador de rota do Next, e o modo estrito resolve dois elementos.
			await page.locator('#conteudo [role="alert"]').waitFor({ timeout: 30_000 });
			return;

		case "aviso-de-levantamento":
			// Sem `page.route`: o ponto desta entrada é justamente **não** haver
			// requisição (`T-1907`).
			await avisoDeLevantamento(page);
			return;

		case "aviso-de-identidade":
			// T-2102 / ESPEC 029 — a requisição existe, e é **a barata**: o
			// portão responde em ~0,9 s, antes de qualquer geração.
			await avisoDeIdentidade(page);
			return;

		case "bloqueado":
			await page.route("**/reports", (rota) =>
				rota.fulfill({ status: 422, contentType: "application/json", body: CORPO_BLOQUEADO }),
			);
			await escolherArquivos(page);
			await page.getByRole("button", { name: /Gerar relat/ }).click();
			await page.getByText(/Não foi possível gerar o relatório/i).waitFor({ timeout: 30_000 });
			return;

		case "inicial-apos-limpeza":
			await escolherArquivos(page);
			await page.getByRole("button", { name: "Limpar", exact: true }).click();
			await page.getByRole("button", { name: "Limpar tudo" }).click();
			await page
				.getByRole("button", { name: "Limpar", exact: true })
				.waitFor({ state: "detached" });
			return;
	}
}

async function marcarNo(page: Page, seletor: string) {
	await page.evaluate((s) => {
		(window as { __no?: Element | null }).__no = document.querySelector(s);
	}, seletor);
}

async function compararNo(page: Page, seletor: string) {
	return page.evaluate((s) => {
		const antes = (window as { __no?: Element | null }).__no;
		const agora = document.querySelector(s);
		return {
			existiaAntes: Boolean(antes),
			existeAgora: Boolean(agora),
			mesmo: antes === agora,
			texto: (agora?.textContent ?? "").trim(),
		};
	}, seletor);
}

// ---------------------------------------------------------------------------
// T-1008 — identidade de nó, só para as de espécie `mutada`
// ---------------------------------------------------------------------------

for (const anuncio of MUTADAS) {
	test(`T-1008 · ${anuncio.id} — a região é mutada, não inserida (${anuncio.regra})`, async ({
		page,
	}) => {
		await page.goto("/");
		await page.locator('input[type="file"]').first().waitFor();

		// A região tem de preexistir. Se ela só aparecer com o conteúdo, a
		// transição é inserção — e leitor nenhum anuncia de forma confiável.
		const antes = await page.locator(anuncio.seletor).count();
		expect(
			antes,
			`${anuncio.id}: a região não existe em 'inicial'. Região que entra na árvore junto com seu conteúdo é inserção, não mutação (ESPEC 008 D-03)`,
		).toBe(1);

		await marcarNo(page, anuncio.seletor);
		await transicionar(page, anuncio.estado);

		const depois = await compararNo(page, anuncio.seletor);
		expect(
			depois.mesmo,
			`${anuncio.id}: a região foi RECRIADA na transição. É inserção, e o anúncio não dispara — ${anuncio.regra}`,
		).toBe(true);
		expect(
			depois.texto.length,
			`${anuncio.id}: a região é a mesma mas continua vazia — não houve mutação a anunciar`,
		).toBeGreaterThan(0);
	});
}

// ---------------------------------------------------------------------------
// T-1009 — para as `inserida`, aparecer É o comportamento correto
// ---------------------------------------------------------------------------

for (const anuncio of INSERIDAS) {
	test(`T-1009 · ${anuncio.id} — a região aparece com papel e mensagem (${anuncio.regra})`, async ({
		page,
	}) => {
		// **Não** se aplica identidade de nó aqui. `role="alert"` é região
		// assertiva e atômica cujo padrão de uso é aparecer para interromper;
		// exigir que ela preexista afirmaria o oposto da norma e deixaria a suíte
		// vermelha contra código certo (PLANO 016 §6.1).
		await page.goto("/");
		await page.locator('input[type="file"]').first().waitFor();

		await expect(
			page.locator(anuncio.seletor),
			`${anuncio.id}: um alert não deve existir antes do evento que o justifica`,
		).toHaveCount(0);

		await transicionar(page, anuncio.estado);

		const regiao = page.locator(anuncio.seletor);
		await expect(regiao, `${anuncio.id}: a região não apareceu`).toHaveCount(1);
		await expect(
			regiao,
			`${anuncio.id}: a região apareceu vazia — não há o que anunciar`,
		).not.toBeEmpty();
	});
}

// ---------------------------------------------------------------------------
// T-1011 / T-1029 — o inventário, nos dois sentidos
// ---------------------------------------------------------------------------

const SELETOR_DE_VARREDURA = '[aria-live], [role="status"], [role="alert"]';

test.describe("T-1011 · T-1029 — o inventário confere com a tela", () => {
	for (const anuncio of INVENTARIO) {
		test(`T-1029 · ${anuncio.id} — a entrada tem mecanismo no estado que declara`, async ({
			page,
		}) => {
			// Sentido **inventário → DOM**. É o que ninguém lembra de escrever, e sem
			// ele o inventário apodrece cheio: entradas para mecanismos que já não
			// existem passam despercebidas para sempre.
			await page.goto("/");
			await page.locator('input[type="file"]').first().waitFor();
			await transicionar(page, anuncio.estado);

			await expect(
				page.locator(anuncio.seletor),
				`entrada fantasma: '${anuncio.id}' declara ${anuncio.seletor} no estado '${anuncio.estado}', e não há nada lá. Ou a regra ${anuncio.regra} deixou de ser cumprida, ou a entrada sobrou`,
			).toHaveCount(1);
		});
	}

	// **Por estado, não por entrada.** A varredura pergunta "o que existe nesta
	// tela?", e duas entradas podem compartilhar o mesmo estado — é o caso desde
	// que o anunciador do Next entrou no inventário.
	const ESTADOS_VARRIDOS = Array.from(new Set(INVENTARIO.map((a) => a.estado)));

	for (const estado of ESTADOS_VARRIDOS) {
		test(`T-1011 · ${estado} — todo mecanismo na tela tem entrada`, async ({ page }) => {
			// Sentido **DOM → inventário**.
			await page.goto("/");
			await page.locator('input[type="file"]').first().waitFor();
			await transicionar(page, estado);

			// Quem decide se o elemento está declarado é o **próprio elemento**, por
			// `matches`. A primeira versão reconstruía um seletor a partir dos
			// atributos e o comparava com os do inventário — e quebrou no instante
			// em que os seletores ganharam escopo `#conteudo`, porque comparava
			// texto de seletor em vez de correspondência real.
			const naoDeclarados = await page.evaluate(
				({ varredura, declarados }) =>
					Array.from(document.querySelectorAll(varredura))
						.filter((el) => !declarados.some((d) => el.matches(d)))
						.map((el) => ({
							tag: el.tagName.toLowerCase(),
							id: el.id || null,
							papel: el.getAttribute("role"),
							live: el.getAttribute("aria-live"),
						})),
				{
					varredura: SELETOR_DE_VARREDURA,
					declarados: INVENTARIO.map((a) => a.seletor),
				},
			);

			// A mensagem é onde `R-TA-07` mora: quem acrescentar um anúncio novo
			// esbarra nela sem precisar ter lido a ESPEC 016.
			expect(
				naoDeclarados,
				[
					`Mecanismo de anúncio sem entrada no inventário, no estado '${estado}'.`,
					"",
					"Anúncio que não está no inventário não existe para efeito de verificação (R-TA-01).",
					"Se você acabou de criar este anúncio, acrescente uma entrada em",
					"  e2e/inventario-de-anuncios.ts",
					"declarando a regra que o exige, o estado que o dispara, a espécie",
					"(`mutada` para aria-live/status, `inserida` para alert) e a fala esperada.",
				].join("\n"),
			).toEqual([]);
		});
	}
});

// ---------------------------------------------------------------------------
// O anunciador do framework — achado da primeira execução
// ---------------------------------------------------------------------------

for (const anuncio of DO_FRAMEWORK) {
	test(`${anuncio.id} — existe e permanece calado`, async ({ page }) => {
		// O Next injeta esta região `role="alert" aria-live="assertive"` em toda
		// página. Nenhuma espec deste projeto a declarou; a ESPEC 016 §2.2 contou
		// cinco mecanismos lendo `src/` e são seis.
		//
		// Esta aplicação tem **uma rota só**: o anunciador não tem o que anunciar,
		// e tem de permanecer vazio. Se um dia soar, um leitor de tela ouvirá algo
		// que ninguém escreveu — e é achado, não ruído.
		await page.goto("/");
		await page.locator('input[type="file"]').first().waitFor();

		const regiao = page.locator(anuncio.seletor);
		await expect(regiao, `${anuncio.id}: o Next deixou de injetar o anunciador`).toHaveCount(1);

		await escolherArquivos(page);
		await page.getByRole("button", { name: "Limpar", exact: true }).click();
		await page.getByRole("button", { name: "Limpar tudo" }).click();
		await page.getByRole("button", { name: "Limpar", exact: true }).waitFor({ state: "detached" });

		expect(
			(await regiao.textContent())?.trim() ?? "",
			`${anuncio.id}: o anunciador de rota falou numa aplicação de rota única`,
		).toBe("");
	});
}

void LEVANTAMENTO;
