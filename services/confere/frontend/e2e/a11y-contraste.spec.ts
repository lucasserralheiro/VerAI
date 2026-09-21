import { expect, test } from "@playwright/test";

import { ESTADOS } from "./estados";

/**
 * T-403 — Contraste de texto medido no navegador (`R-ACE-01`).
 *
 * Existe apesar de o `axe` ter a regra `color-contrast`, por dois motivos que
 * são exatamente os casos que importam aqui:
 *
 *  1. O `axe` **isenta controle desabilitado**, e a `R-ACE-01` diz que não
 *     isenta — o botão desabilitado é o estado inicial do primário desta tela.
 *  2. Quando não consegue determinar o fundo, o `axe` devolve *incomplete*, não
 *     *violation*. Silêncio vira aprovação.
 */

/** `R-ACE-01` não abre exceção para texto grande: os tokens em questão são todos
 *  de corpo, e uma régua só é mais fácil de defender do que duas. */
const MINIMO = 4.5;

interface Achado {
	texto: string;
	onde: string;
	cor: string;
	fundo: string;
	contraste: number;
	corpo: string;
}

/** O botão tem `transition`, e medir no meio dela devolve uma cor que não existe
 *  em estado nenhum — a primeira execução acusou 2,86:1 num tom a meio caminho
 *  entre desabilitado e ativo. Congelar antes de medir é o que torna o número
 *  reproduzível. */
async function congelar(page: import("@playwright/test").Page) {
	await page.addStyleTag({
		content: `*, *::before, *::after {
			transition: none !important;
			animation: none !important;
		}`,
	});
}

async function medir(page: import("@playwright/test").Page): Promise<Achado[]> {
	return page.evaluate((minimo) => {
		type Cor = { r: number; g: number; b: number; a: number };

		function ler(valor: string): Cor | null {
			const m = valor.match(/rgba?\(([^)]+)\)/);
			if (!m) return null;
			const p = m[1]
				.split(/[,\s/]+/)
				.filter(Boolean)
				.map(Number);
			return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
		}

		function compor(frente: Cor, fundo: Cor): Cor {
			const a = frente.a;
			return {
				r: frente.r * a + fundo.r * (1 - a),
				g: frente.g * a + fundo.g * (1 - a),
				b: frente.b * a + fundo.b * (1 - a),
				a: 1,
			};
		}

		/** O ponto difícil: `bg-teal-50/40` chega como `rgba` com alfa 0,4. Ler o
		 *  `rgba` como cor final dá o número errado, e dá para o lado otimista. */
		function fundoEfetivo(el: Element): Cor {
			const pilha: Cor[] = [];
			let atual: Element | null = el;
			while (atual) {
				const bg = ler(getComputedStyle(atual).backgroundColor);
				if (bg && bg.a > 0) {
					pilha.push(bg);
					if (bg.a === 1) break;
				}
				atual = atual.parentElement;
			}
			let resultado: Cor = { r: 255, g: 255, b: 255, a: 1 };
			for (let i = pilha.length - 1; i >= 0; i--) resultado = compor(pilha[i], resultado);
			return resultado;
		}

		function luminancia({ r, g, b }: Cor): number {
			const c = [r, g, b].map((v) => {
				const n = v / 255;
				return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
			});
			return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
		}

		function contraste(a: Cor, b: Cor): number {
			const la = luminancia(a);
			const lb = luminancia(b);
			return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
		}

		/** A WCAG 1.4.3 isenta "decoração pura", e `aria-hidden` é a declaração
		 *  dessa intenção. São os divisores `·` e `|` das ESPECs 006 e 007, que já
		 *  se justificaram como decorativos (ESPEC 006 §257). */
		function decorativo(el: Element): boolean {
			return el.closest('[aria-hidden="true"]') !== null;
		}

		/** `sr-only` é 1×1 recortado: não é renderizado para o olho e não tem
		 *  contraste a cobrar. */
		function invisivel(el: Element): boolean {
			const s = getComputedStyle(el);
			if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) {
				return true;
			}
			const r = el.getBoundingClientRect();
			return r.width <= 1 || r.height <= 1;
		}

		function onde(el: Element): string {
			const partes: string[] = [];
			let atual: Element | null = el;
			while (atual && partes.length < 4) {
				const tag = atual.tagName.toLowerCase();
				const classe = (atual.getAttribute("class") || "").split(/\s+/).filter(Boolean)[0];
				partes.unshift(classe ? `${tag}.${classe}` : tag);
				atual = atual.parentElement;
			}
			return partes.join(" > ");
		}

		const achados: Achado[] = [];

		for (const el of Array.from(document.body.querySelectorAll("*"))) {
			const proprio = Array.from(el.childNodes)
				.filter((n) => n.nodeType === Node.TEXT_NODE)
				.map((n) => n.textContent || "")
				.join("")
				.trim();
			if (!proprio || invisivel(el) || decorativo(el)) continue;

			const estilo = getComputedStyle(el);
			const cor = ler(estilo.color);
			if (!cor) continue;

			const fundo = fundoEfetivo(el);
			// Texto com alfa também é composto: senão o número sai otimista.
			const frente = cor.a < 1 ? compor(cor, fundo) : cor;
			const razao = contraste(frente, fundo);

			if (razao < minimo) {
				achados.push({
					texto: proprio.slice(0, 60),
					onde: onde(el),
					cor: estilo.color,
					fundo: `rgb(${Math.round(fundo.r)}, ${Math.round(fundo.g)}, ${Math.round(fundo.b)})`,
					contraste: Math.round(razao * 100) / 100,
					corpo: `${estilo.fontSize}/${estilo.fontWeight}`,
				});
			}
		}

		return achados;
	}, MINIMO);
}

function relatar(estado: string, achados: Achado[]): string {
	const linhas = achados.map(
		(a) =>
			`  ${String(a.contraste).padStart(5)}:1  ${a.cor} sobre ${a.fundo}  ${a.corpo}\n` +
			`           "${a.texto}"\n           ${a.onde}`,
	);
	return `\n${estado} — ${achados.length} abaixo de ${MINIMO}:1\n${linhas.join("\n")}\n`;
}

for (const [nome, montar] of Object.entries(ESTADOS)) {
	test(`contraste de texto no estado ${nome}`, async ({ page }) => {
		await montar(page);
		await congelar(page);
		const achados = await medir(page);
		expect(achados, relatar(nome, achados)).toEqual([]);
	});
}
