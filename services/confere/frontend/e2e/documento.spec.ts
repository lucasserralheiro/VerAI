import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { avisoDeLevantamento, CONTRATO, LEVANTAMENTO } from "./estados";

/**
 * T-1907 · T-1908 — ESPEC 025 `R-DOC-08`, o aviso que chega antes dos 16,6 s.
 *
 * O que estes testes medem é **quando** o aviso aparece, não se o texto está
 * bonito: um aviso que surgisse depois do POST não economizaria nada, e é essa
 * economia que justifica deixar a regra em TypeScript (`D-07`).
 *
 * ---
 *
 * ## T-1903 — inventário de *"Processamento bloqueado"*
 *
 * A ESPEC 025 §9.1 troca o cabeçalho da tela de bloqueio. A cadeia antiga vive
 * em **seis pontos, de quatro arquivos**, e a `T-1931` tem de visitar todos:
 *
 *   1. `frontend/src/app/components/ResultadoPanel.tsx:125`  — o componente
 *   2. `frontend/e2e/estados.ts:56`   — `detalhe` do dublê de 422
 *   3. `frontend/e2e/estados.ts:79`   — o `waitFor` que monta o estado
 *   4. `frontend/e2e/anuncio.spec.ts:80`  — `detalhe` do `CORPO_BLOQUEADO`
 *   5. `frontend/e2e/anuncio.spec.ts:129` — o `waitFor` da transição
 *   6. `frontend/e2e/inventario-de-anuncios.ts:136` — a `fala` esperada
 *
 * O sexto é o que a suíte de acessibilidade compara: mudar o componente e
 * esquecer o inventário deixa a `a11y` vermelha **por texto**, e o tempo se
 * perde procurando defeito onde não há.
 */

const NOME_DE_LEVANTAMENTO = "SMIT_SUSTENTACAO_Levantamento_05969_V2.0___GRC.pdf";

test("T-1907 · o aviso aparece sem nenhuma requisição ao backend", async ({ page }) => {
	await page.goto("/");
	await page.locator('input[type="file"]').first().waitFor();

	// A rota é registrada **antes** da escolha, e conta. Asserir sobre a ausência
	// de requisição é o teste inteiro: o aviso existe para poupar a viagem.
	let chamadas = 0;
	await page.route("**/reports", (rota) => {
		chamadas += 1;
		return rota.abort();
	});

	await page.locator('input[type="file"]').nth(0).setInputFiles({
		name: NOME_DE_LEVANTAMENTO,
		mimeType: "application/pdf",
		buffer: readFileSync(CONTRATO),
	});

	await expect(page.locator("#contrato-aviso")).toContainText(
		/parece ser um levantamento/i,
	);
	expect(chamadas, "o aviso não pode custar uma requisição").toBe(0);
});

test("T-1908 · o aviso não impede: *Usar assim mesmo* dispensa e o botão segue", async ({
	page,
}) => {
	await avisoDeLevantamento(page);

	const gerar = page.getByRole("button", { name: /Gerar relat/ });
	// O botão nunca é desabilitado pelo aviso. Ele está `aria-disabled` aqui
	// apenas porque falta o levantamento — que é a regra de sempre (`D-10`).
	await expect(gerar).toBeVisible();

	await page.getByRole("button", { name: "Usar assim mesmo" }).click();
	await expect(page.locator("#contrato-aviso")).toHaveCount(0);

	// O campo **não** é limpo: dispensar o aviso não desfaz a escolha.
	await expect(page.locator("#contrato-estado")).toContainText(NOME_DE_LEVANTAMENTO);
});

test("T-1908 · trocar por uma proposta faz o aviso sumir sozinho", async ({ page }) => {
	await avisoDeLevantamento(page);

	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);

	await expect(page.locator("#contrato-aviso")).toHaveCount(0);
});

/** ESPEC 025 §9 — a tela de bloqueio, com um achado estruturado e um antigo.
 *
 *  O achado antigo está aqui de propósito (`T-1932`): onze validações continuam
 *  mandando só `mensagem`, e um cartão que exigisse as quatro partes as faria
 *  sumir da tela — regressão que nenhum teste de backend pegaria. */
const CORPO_COM_CARTAO = JSON.stringify({
	detalhe: "processamento bloqueado por validação",
	bloqueantes: [
		{
			validacao: "V-DOC-01",
			severidade: "BLOQUEIA",
			mensagem: "concatenação das três primeiras partes",
			codigo: null,
			titulo: "O arquivo enviado no campo Contrato não é uma proposta comercial (SMIT_SUSTENTACAO_Levantamento_05969_GRC.pdf).",
			causa: 'As 3 tabelas de sete colunas deste PDF não trazem códigos de serviço, e a primeira página não traz "Proposta Comercial" nem "Proposta de Aditivo:".',
			acao: "Envie no campo Contrato o PDF da proposta comercial — o documento com a tabela de itens, com códigos de serviço e preços. Este PDF cita as propostas PA-SMIT-250220-15, PA-SMIT-260319-739, PC-SMIT-240402-53. Envie uma delas.",
			detalhe: "41 páginas, 40 com borda desenhada, 41 com texto, no máximo 23 divisórias verticais numa página",
		},
		{
			validacao: "V-CTR-03",
			severidade: "BLOQUEIA",
			mensagem: "O total do levantamento não confere com a soma dos itens medidos.",
			codigo: "4.1.2",
		},
	],
	avisos: [],
});

async function telaBloqueada(page: import("@playwright/test").Page) {
	await page.route("**/reports", (rota) =>
		rota.fulfill({ status: 422, contentType: "application/json", body: CORPO_COM_CARTAO }),
	);
	await page.goto("/");
	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
	await page.locator('input[type="file"]').nth(1).setInputFiles(LEVANTAMENTO);
	await page.getByRole("button", { name: /Gerar relat/ }).click();
	await page.getByText(/Não foi possível gerar o relatório/i).waitFor({ timeout: 30_000 });
}

test("T-1933 · o cartão empilha título, causa, ação e detalhes", async ({ page }) => {
	await telaBloqueada(page);

	await expect(page.getByText(/não é uma proposta comercial/)).toBeVisible();
	await expect(page.getByText(/não trazem códigos de serviço/)).toBeVisible();
	await expect(page.getByText(/Envie no campo Contrato o PDF da proposta comercial/)).toBeVisible();
	await expect(page.getByText(/PA-SMIT-260319-739/)).toBeVisible();

	// O colchete de diagnóstico saiu do corpo da frase e passou a viver
	// recolhido: existe no DOM, e não na leitura.
	const detalhes = page.getByText(/Detalhes técnicos \(para o suporte\)/);
	await expect(detalhes).toBeVisible();
	await expect(page.getByText(/divisórias verticais numa página/)).toBeHidden();

	await detalhes.click();
	await expect(page.getByText(/divisórias verticais numa página/)).toBeVisible();
});

test("T-1932 · achado sem as partes novas continua na tela", async ({ page }) => {
	await telaBloqueada(page);

	await expect(
		page.getByText(/O total do levantamento não confere/),
		"onze validações ainda mandam só `mensagem` — o cartão não pode exigir as quatro partes",
	).toBeVisible();
	await expect(page.getByText("V-CTR-03")).toBeVisible();
});

test("T-1931 · o subtítulo conta os pontos a corrigir", async ({ page }) => {
	await telaBloqueada(page);

	await expect(page.getByText("Corrija os 2 pontos abaixo e envie novamente.")).toBeVisible();
});
