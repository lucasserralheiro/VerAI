import type { Config } from "tailwindcss";

// Paleta do design system TRIADE — teal primário, navy secundário.
const config: Config = {
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				teal: {
					50: "#E0F2F1",
					100: "#B2DFDB",
					300: "#74AEA2",
					400: "#449089",
					500: "#1B616D",
					600: "#155460",
					700: "#0E3D47",
				},
				navy: {
					50: "#EFF4F8",
					100: "#C8D9E6",
					// Contraste sobre os três fundos em que este token é renderizado:
					//   `surface` #F4F7F8   4,73:1
					//   branco              5,09:1
					//   `teal-50/40`        4,83:1
					// O valor anterior, #628A93, dava 3,50 / 3,77 / 3,55 — reprovava AA
					// em corpo de texto nos três, inclusive no cabeçalho da tabela a
					// 11 px. Os 8 usos do token são todos `text-`: nenhum é borda, nenhum
					// é fundo, e por isso escurecê-lo não pede token companheiro
					// (ESPEC 008 D-02).
					300: "#4E747E",
					600: "#17416B",
					800: "#0B2235",
				},
				surface: "#F4F7F8",
				line: "#DDE6E9",
				// ESPEC 009 `T-538` — o eixo de severidade das quatro situações da
				// análise. O projeto não tinha um: tinha teal, navy, `brand`,
				// `prodam`, mais o vermelho do saldo negativo e o âmbar da marca de
				// perfil, ambos pontuais da ESPEC 002.
				//
				// Contraste sobre branco, pela fórmula WCAG 2.1:
				//   critico     #B91C1C   6,44:1  ✅ texto
				//   maior       #B45309   4,89:1  ✅ texto
				//   divergente  navy-600  10,47:1 ✅ texto (token existente)
				//   conforme    #006E52   5,80:1  ✅ texto (`brand.green-ink`)
				//
				// `brand.green` #00805F dá 4,6:1 e o próprio comentário de `brand` o
				// declara **só para ícone e traço**. Ele aparece aqui como tarja —
				// elemento de interface, exigência de 3:1 — e nunca como texto.
				//
				// `R-ACE-02`: a cor é redundância. Quem carrega a informação é o
				// rótulo da situação, que vem escrito do domínio.
				severidade: {
					critico: "#B91C1C",
					"critico-fundo": "#FEF2F2",
					maior: "#B45309",
					"maior-fundo": "#FFFBEB",
					"conforme-fundo": "#E6F4EF",
				},
				// Cores da marca, amostradas do próprio logo.
				//   navy      13,8:1 sobre o fundo — serve a texto sem ressalva.
				//   green      4,6:1 — só ícone e traço. Como elemento de interface
				//              a exigência é 3:1, e aí sobra folga.
				//   green-ink  5,8:1 — o mesmo verde aprofundado, para texto. Existe
				//              porque `green` em corpo de texto passaria AA por 0,09.
				brand: {
					navy: "#00255B",
					green: "#00805F",
					"green-ink": "#006E52",
				},
				// Cores institucionais da PRODAM, amostradas do rodapé do modelo
				// (ESPEC 006 §3). Branco sobre `navy` dá 11,2:1.
				prodam: {
					navy: "#0E3E5E",
					orange: "#FF671D",
				},
			},
		},
	},
	plugins: [],
};
export default config;
