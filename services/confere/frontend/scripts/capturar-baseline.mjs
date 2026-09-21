/**
 * T-401 / T-411 / T-438 — Captura de referência do layout.
 *
 * Quatro estados em duas larguras. A comparação entre duas execuções é o que
 * prova a ESPEC 008 §3: nenhuma tarefa move posição ou tamanho, fora das quatro
 * exceções da TASKS 008 §1.1.
 *
 * Não versionado: renderização de fonte varia entre máquinas e o repositório não
 * tem CI. A pergunta que isto responde é "mudou o layout **nesta** máquina?",
 * e para ela antes-contra-depois basta (PLANO 008 §9).
 *
 *   node scripts/capturar-baseline.mjs <pasta>
 *
 * Exige o backend em 127.0.0.1:8000 e o frontend em localhost:3000.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(AQUI, "../../backend/tests/fixtures");
const CONTRATO = path.join(FIXTURES, "contrato.pdf");
const LEVANTAMENTO = path.join(FIXTURES, "levantamento.xlsx");

const BASE = "http://localhost:3000";
const PASTA = process.argv[2];

if (!PASTA) {
	console.error("uso: node scripts/capturar-baseline.mjs <pasta>");
	process.exit(1);
}

const DESTINO = path.resolve(AQUI, "../test-results/a11y-baseline", PASTA);

/** As duas larguras da ESPEC 006 §5 e da ESPEC 007 §8. */
const LARGURAS = [
	{ nome: "1366", viewport: { width: 1366, height: 768 } },
	{ nome: "390", viewport: { width: 390, height: 844 } },
];

/** Sempre as mesmas duas fixtures: o nome do arquivo aparece no cartão, e uma
 *  fixture diferente viraria diferença falsa na T-438. */
async function escolherArquivos(page, levantamento = LEVANTAMENTO) {
	await page.locator('input[type="file"]').nth(0).setInputFiles(CONTRATO);
	await page.locator('input[type="file"]').nth(1).setInputFiles(levantamento);
}

async function capturar(page, estado, largura) {
	// O indicador de atividade da T-421 gira, e cada captura o pega num ângulo
	// diferente: no `processando` a comparação acusava 143 px numa caixa de
	// 16 × 16 — exatamente o tamanho do ícone — como se fosse mudança de layout.
	//
	// O script de contraste (T-403) já congelava `transition` e `animation` pelo
	// mesmo motivo: medir no meio do movimento devolve um estado que não existe.
	// Aqui a lição chegou depois, com a ESPEC 009: vale das capturas seguintes em
	// diante, porque a linha de base anterior foi tirada sem isto.
	await page.addStyleTag({
		content: `*, *::before, *::after {
			transition: none !important;
			animation: none !important;
		}`,
	});
	await page.screenshot({
		path: path.join(DESTINO, `${estado}-${largura}.png`),
		fullPage: true,
	});
}

const ESTADOS = {
	async inicial(page) {
		await page.goto(BASE);
		await page.locator('input[type="file"]').first().waitFor();
	},

	/** Transitório: sem segurar a resposta não há o que capturar.
	 *
	 *  A chamada é abortada no fim, não retomada: gerar o relatório de verdade
	 *  levaria a tela para `pronto`, que já tem captura própria. */
	async processando(page) {
		let soltar;
		const preso = new Promise((resolve) => (soltar = resolve));
		await page.route("**/reports", async (rota) => {
			await preso;
			await rota.abort().catch(() => {});
		});

		await page.goto(BASE);
		await escolherArquivos(page);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await page.getByRole("button", { name: /Processando/ }).waitFor({ timeout: 15_000 });

		return async () => {
			soltar();
			await page.waitForTimeout(100);
		};
	},

	async pronto(page) {
		await page.goto(BASE);
		await escolherArquivos(page);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await page.getByText("Relatório gerado").waitFor({ timeout: 120_000 });
	},

	/** O contrato é um PDF válido, mas não é planilha de medição — mesma manobra
	 *  do teste de fumaça. Produz `erro`, não `bloqueado`: a recusa vem da
	 *  assinatura do arquivo, antes de qualquer validação de conteúdo. */
	async erro(page) {
		await page.goto(BASE);
		await escolherArquivos(page, CONTRATO);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await page.getByText(/não é um arquivo XLSX válido/i).waitFor({ timeout: 120_000 });
	},

	/** Nenhuma combinação das fixtures do repositório produz achado bloqueante:
	 *  entrada malformada é recusada antes, e entrada bem formada passa. O estado
	 *  é montado com um 422 sintético no formato de `RespostaBloqueada`
	 *  (`lib/types.ts`) — é layout de tela, e o que importa é a forma da resposta. */
	async bloqueado(page) {
		await page.route("**/reports", (rota) =>
			rota.fulfill({
				status: 422,
				contentType: "application/json",
				body: JSON.stringify({
					detalhe: "Processamento bloqueado",
					bloqueantes: [
						{
							validacao: "V-CTR-03",
							severidade: "BLOQUEIA",
							mensagem:
								"O total do levantamento não confere com a soma dos itens medidos.",
							codigo: "4.1.2",
						},
					],
					avisos: [
						{
							validacao: "V-MED-07",
							severidade: "AVISA",
							mensagem: "Item medido sem unidade declarada na planilha.",
							codigo: "2.3.1",
						},
					],
				}),
			}),
		);

		await page.goto(BASE);
		await escolherArquivos(page);
		await page.getByRole("button", { name: /Gerar relat/ }).click();
		await page.getByText(/Processamento bloqueado/i).waitFor({ timeout: 30_000 });
	},

	/** ESPEC 015 `R-LMP-13` — o modal de confirmação aberto.
	 *
	 *  Espelha `e2e/estados.ts::confirmacaoDeLimpeza`. As duas montagens são
	 *  separadas de propósito — este é script de Node puro, fora do runtime de
	 *  TypeScript do Playwright — e **se divergirem, a captura e as varreduras
	 *  deixam de falar do mesmo estado**. */
	async confirmacaoDeLimpeza(page) {
		await page.goto(BASE);
		await escolherArquivos(page);
		await page.getByRole("button", { name: "Limpar", exact: true }).click();
		await page.getByRole("button", { name: "Limpar tudo" }).waitFor();
	},
};

const navegador = await chromium.launch();

await mkdir(DESTINO, { recursive: true });

for (const { nome, viewport } of LARGURAS) {
	for (const [estado, montar] of Object.entries(ESTADOS)) {
		const contexto = await navegador.newContext({ viewport });
		const page = await contexto.newPage();

		const limpar = await montar(page);
		// A rolagem do `fullPage` recompõe a barra `sticky` faixa a faixa. Levar ao
		// topo antes de disparar mantém a captura comparável entre execuções.
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(300);
		await capturar(page, estado, nome);
		if (limpar) await limpar();

		await contexto.close();
		console.log(`  ${estado}-${nome}.png`);
	}
}

await navegador.close();

const total = LARGURAS.length * Object.keys(ESTADOS).length;
console.log(`\n${total} capturas em test-results/a11y-baseline/${PASTA}/`);
