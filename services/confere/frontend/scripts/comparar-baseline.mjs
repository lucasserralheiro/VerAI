/**
 * T-438 — Diferença de captura entre duas execuções.
 *
 * A ESPEC 008 §3 proíbe alteração de layout; a TASKS 008 §1.1 enumera as quatro
 * mudanças de aparência sancionadas. Este script responde à única pergunta que
 * fecha o portão P3: **existe uma quinta?**
 *
 *   node scripts/comparar-baseline.mjs referencia depois
 *
 * Compara pixel a pixel e, quando há diferença, informa a **faixa vertical** em
 * que ela ocorre — é o que permite dizer se a mudança é a legenda do grid ou
 * outra coisa. Altura diferente já é reflui, e é relatada como tal.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../test-results/a11y-baseline");

const [A, B] = process.argv.slice(2);
if (!A || !B) {
	console.error("uso: node scripts/comparar-baseline.mjs <antes> <depois>");
	process.exit(1);
}

async function bruto(arquivo) {
	const { data, info } = await sharp(arquivo)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, largura: info.width, altura: info.height };
}

/** Faixas contíguas de linhas que diferem. Um diff que só diz "N pixels" não
 *  distingue "a legenda entrou" de "tudo desceu 8 px". */
function faixas(linhasComDiferenca) {
	const blocos = [];
	let inicio = null;
	let anterior = null;
	for (const y of linhasComDiferenca) {
		if (inicio === null) inicio = y;
		else if (y !== anterior + 1) {
			blocos.push([inicio, anterior]);
			inicio = y;
		}
		anterior = y;
	}
	if (inicio !== null) blocos.push([inicio, anterior]);
	return blocos;
}

const arquivos = (await readdir(path.join(RAIZ, A))).filter((f) => f.endsWith(".png"));
let comDiferenca = 0;

for (const nome of arquivos.sort()) {
	const a = await bruto(path.join(RAIZ, A, nome));
	const b = await bruto(path.join(RAIZ, B, nome));

	if (a.largura !== b.largura || a.altura !== b.altura) {
		comDiferenca++;
		console.log(
			`\n⚠ ${nome}  ${a.largura}×${a.altura} → ${b.largura}×${b.altura}  ` +
				`(${b.altura - a.altura > 0 ? "+" : ""}${b.altura - a.altura} px de altura — reflui)`,
		);
		continue;
	}

	const linhas = new Set();
	let pixels = 0;
	for (let i = 0; i < a.data.length; i += 4) {
		// Tolerância de 2 por canal: antialiasing de fonte não é mudança de layout.
		if (
			Math.abs(a.data[i] - b.data[i]) > 2 ||
			Math.abs(a.data[i + 1] - b.data[i + 1]) > 2 ||
			Math.abs(a.data[i + 2] - b.data[i + 2]) > 2
		) {
			pixels++;
			linhas.add(Math.floor(i / 4 / a.largura));
		}
	}

	if (pixels === 0) {
		console.log(`✓ ${nome}  idêntico`);
		continue;
	}

	comDiferenca++;
	const blocos = faixas([...linhas].sort((x, y) => x - y));
	const resumo = blocos.map(([i, f]) => `y ${i}–${f}`).join(", ");
	const porcento = ((pixels / (a.largura * a.altura)) * 100).toFixed(2);
	console.log(`⚠ ${nome}  ${pixels} px (${porcento}%) em ${blocos.length} faixa(s): ${resumo}`);
}

console.log(
	`\n${arquivos.length - comDiferenca} de ${arquivos.length} idênticas · ` +
		`${comDiferenca} com diferença`,
);
