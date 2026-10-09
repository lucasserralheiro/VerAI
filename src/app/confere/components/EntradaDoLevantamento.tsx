"use client";

import { useRef } from "react";

import { ComoFunciona, PASSOS_DO_INICIO } from "./ComoFunciona";
import { useSoltarArquivos } from "./useSoltarArquivos";

interface Props {
	onEscolher: (arquivo: File) => void;
	onPreencherAMao: () => void;
	/** O botão "Escolher planilha" — destino do foco depois de Limpar (`R-LMP-09`). */
	refBotao: React.RefObject<HTMLButtonElement | null>;
}

const COLUNAS = ["A", "B", "C", "D", "E"] as const;
/** Largura de cada coluna do desenho; a primeira é a do texto, as outras são números. */
const LARGURAS = [64, 42, 42, 42, 42] as const;
/** Quanto da célula a barra de "conteúdo" ocupa, por linha (texto) e por coluna (número). */
const TEXTO = [0.8, 0.6, 0.72, 0.5, 0.66] as const;
const NUMERO = [0.7, 0.55, 0.8, 0.6] as const;

/** Uma planilha de verdade, desenhada: janela, abas, letras de coluna, números de linha,
 *  cabeçalho verde, linhas de dados e a célula selecionada. É só ilustração (`aria-hidden`),
 *  sem marca de terceiros — o selo ".xlsx" diz o formato que a tela espera. */
function IlustracaoDePlanilha() {
	const X0 = 20; // largura da coluna dos números de linha
	const Y0 = 34; // barra de abas + letras das colunas
	const LINHA = 16;
	const inicios = LARGURAS.reduce<number[]>((acc, largura, i) => {
		acc.push(i === 0 ? X0 : acc[i - 1] + LARGURAS[i - 1]);
		return acc;
	}, []);
	const largura = X0 + LARGURAS.reduce((soma, v) => soma + v, 0);
	const linhas = 6;
	const altura = Y0 + linhas * LINHA;

	return (
		<svg
			viewBox={`0 0 ${largura + 24} ${altura + 14}`}
			aria-hidden="true"
			className="mx-auto h-auto w-72 max-w-full"
		>
			<g transform="translate(0 4)">
				{/* sombra e janela */}
				<rect x="3" y="4" width={largura} height={altura} rx="6" fill="#0B2235" opacity="0.08" />
				<rect x="0.5" y="0.5" width={largura} height={altura} rx="6" fill="#fff" stroke="#C8D9E6" />
				{/* barra de abas */}
				<path d={`M0.5 6.5a6 6 0 0 1 6-6h${largura - 12}a6 6 0 0 1 6 6V18H0.5z`} fill="#F4F7F8" />
				<circle cx="11" cy="9" r="2" fill="#C8D9E6" />
				<circle cx="18" cy="9" r="2" fill="#C8D9E6" />
				<circle cx="25" cy="9" r="2" fill="#C8D9E6" />
				<rect x="40" y="3" width="52" height="15" rx="3" fill="#fff" />
				<rect x="40" y="16" width="52" height="2" fill="#1D6F42" />
				<text x="66" y="13" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#0B2235">
					Planilha1
				</text>
				{/* letras das colunas */}
				<rect x="0.5" y="18" width={largura} height="16" fill="#EFF4F8" />
				{COLUNAS.map((letra, i) => (
					<text
						key={letra}
						x={inicios[i] + LARGURAS[i] / 2}
						y="29"
						textAnchor="middle"
						fontSize="7.5"
						fontWeight="600"
						fill="#4E747E"
					>
						{letra}
					</text>
				))}
				{/* linhas de dados */}
				{Array.from({ length: linhas }, (_, r) => {
					const y = Y0 + r * LINHA;
					const cabecalho = r === 0;
					return (
						<g key={r}>
							<rect x="0.5" y={y} width={X0} height={LINHA} fill="#EFF4F8" />
							<text x={X0 / 2} y={y + 11} textAnchor="middle" fontSize="7" fill="#4E747E">
								{r + 1}
							</text>
							{cabecalho && <rect x={X0} y={y} width={largura - X0} height={LINHA} fill="#1D6F42" />}
							{COLUNAS.map((letra, c) => {
								const cheia = LARGURAS[c] - 12;
								const barra = cabecalho
									? cheia * (c === 0 ? 0.7 : 0.55)
									: c === 0
										? cheia * TEXTO[(r - 1) % TEXTO.length]
										: cheia * NUMERO[(r + c) % NUMERO.length];
								return (
									<rect
										key={letra}
										x={c === 0 ? inicios[c] + 6 : inicios[c] + LARGURAS[c] - 6 - barra}
										y={y + 6}
										width={barra}
										height="4"
										rx="2"
										fill={cabecalho ? "#fff" : "#C8D9E6"}
										opacity={cabecalho ? 0.9 : 1}
									/>
								);
							})}
						</g>
					);
				})}
				{/* grade */}
				{Array.from({ length: linhas }, (_, r) => (
					<line key={`h${r}`} x1="0.5" x2={largura + 0.5} y1={Y0 + (r + 1) * LINHA} y2={Y0 + (r + 1) * LINHA} stroke="#DDE6E9" />
				))}
				{[X0, ...inicios.slice(1)].map((x) => (
					<line key={`v${x}`} x1={x} x2={x} y1="18" y2={altura} stroke="#DDE6E9" />
				))}
				{/* célula selecionada */}
				<rect x={inicios[2]} y={Y0 + 3 * LINHA} width={LARGURAS[2]} height={LINHA} fill="#1D6F42" fillOpacity="0.08" stroke="#1D6F42" strokeWidth="1.5" />
				<rect x={inicios[2] + LARGURAS[2] - 3} y={Y0 + 4 * LINHA - 3} width="5" height="5" fill="#1D6F42" stroke="#fff" />
				{/* selo do formato */}
				<g transform={`translate(${largura - 30} ${altura - 10})`}>
					<rect width="48" height="22" rx="5" fill="#1D6F42" stroke="#fff" strokeWidth="2" />
					<text x="24" y="15" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
						.xlsx
					</text>
				</g>
			</g>
		</svg>
	);
}

/** O começo da tela (docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md
 *  §3.1): só o levantamento — o contrato e os aditivos vêm do cadastro pela planilha.
 *
 *  Borda tracejada **no repouso**, ao contrário das linhas do formulário: aqui o cartão inteiro
 *  aceita a planilha solta, então o tracejado diz a verdade (`R-ACE-17`). O cartão inteiro também
 *  abre o seletor ao clicar; o botão continua sendo o único foco de teclado. */
export function EntradaDoLevantamento({ onEscolher, onPreencherAMao, refBotao }: Props) {
	const campo = useRef<HTMLInputElement>(null);
	const soltar = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos: false,
		desabilitado: false,
		onSoltar: ([arquivo]) => onEscolher(arquivo),
		mensagemDeTipoErrado: (arquivo) => `O levantamento é a planilha .xlsx — ${arquivo.name} não é.`,
	});

	return (
		<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<div>
				{/* O clique no cartão é conveniência de mouse; teclado e leitor de tela usam o botão. */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: o botão "Escolher planilha" é o equivalente de teclado */}
				<section
					{...soltar.alvo}
					aria-labelledby="entrada-titulo"
					onClick={() => campo.current?.click()}
					className={`relative cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition focus-within:ring-2 focus-within:ring-confere-teal-400 focus-within:ring-offset-2 ${
						soltar.arrastando
							? "border-confere-teal-500 bg-confere-teal-50"
							: "border-confere-teal-300 bg-white hover:border-confere-teal-500 hover:bg-confere-navy-50/60"
					}`}
				>
					<IlustracaoDePlanilha />
					<h2 id="entrada-titulo" className="mt-5 text-xl font-semibold text-confere-navy-600">
						Arraste a planilha de levantamento aqui
					</h2>
					<p id="entrada-descricao" className="mt-1.5 text-base text-confere-navy-300">
						Planilha de medição da competência, em XLSX
					</p>
					{/* Fora do Tab: o foco mora no botão que o aciona. */}
					<input
						ref={campo}
						type="file"
						accept=".xlsx"
						tabIndex={-1}
						className="sr-only"
						aria-label="Levantamento"
						aria-describedby="entrada-descricao"
						onClick={(evento) => evento.stopPropagation()}
						onChange={(evento) => {
							soltar.limparErro();
							const arquivo = evento.target.files?.[0];
							// Permite escolher de novo a mesma planilha depois de um Limpar.
							evento.target.value = "";
							if (arquivo) onEscolher(arquivo);
						}}
					/>
					<div className="mt-6 flex items-center justify-center gap-3 text-confere-navy-300">
						<span aria-hidden="true" className="h-px w-12 bg-confere-line" />
						<span className="text-sm">ou</span>
						<span aria-hidden="true" className="h-px w-12 bg-confere-line" />
					</div>
					<button
						ref={refBotao}
						type="button"
						className="mt-4 rounded-md bg-confere-brand-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-confere-navy-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-prodam-orange focus-visible:ring-offset-2"
					>
						Escolher planilha
					</button>
					{soltar.erro && (
						<p
							role="alert"
							className="mx-auto mt-5 max-w-md rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
						>
							{soltar.erro}
						</p>
					)}
					{soltar.arrastando && (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-confere-teal-50/95 text-lg font-semibold text-confere-teal-600"
						>
							Solte a planilha aqui
						</div>
					)}
				</section>

				<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-confere-navy-600">
					<span>O contrato não está no cadastro do cliente?</span>
					<button
						type="button"
						onClick={onPreencherAMao}
						className="rounded-md border border-confere-navy-100 bg-white px-4 py-2 text-sm font-semibold text-confere-navy-600 transition hover:border-confere-teal-400 hover:bg-confere-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-teal-400 focus-visible:ring-offset-2"
					>
						Preencher à mão
					</button>
				</div>
			</div>

			<ComoFunciona passos={PASSOS_DO_INICIO} />
		</div>
	);
}
