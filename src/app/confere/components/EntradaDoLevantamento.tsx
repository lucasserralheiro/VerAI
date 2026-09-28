"use client";

import { useRef } from "react";

import { useSoltarArquivos } from "./useSoltarArquivos";

interface Props {
	onEscolher: (arquivo: File) => void;
	onPreencherAMao: () => void;
	/** O botão "Escolher planilha" — destino do foco depois de Limpar (`R-LMP-09`). */
	refBotao: React.RefObject<HTMLButtonElement | null>;
}

function IconeDePlanilha() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-10 w-10 text-confere-teal-500">
			<path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
			<path d="M14 3v4h4M9 11h6M9 14h6M9 17h6M12 11v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
		</svg>
	);
}

/** O começo da tela (docs/superpowers/specs/2026-09-28-confere-levantamento-primeiro-design.md
 *  §3.1): só o levantamento — o contrato e os aditivos vêm do cadastro pela planilha.
 *
 *  Borda tracejada **no repouso**, ao contrário das linhas do formulário: aqui o cartão inteiro
 *  aceita a planilha solta, então o tracejado diz a verdade (`R-ACE-17`). */
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
		<>
			<section
				{...soltar.alvo}
				aria-labelledby="entrada-titulo"
				className={`relative rounded-lg border-2 border-dashed px-6 py-14 text-center shadow-sm transition ${
					soltar.arrastando
						? "border-confere-teal-500 bg-confere-teal-50"
						: "border-confere-teal-400 bg-white hover:border-confere-teal-500"
				}`}
			>
				<IconeDePlanilha />
				<h2 id="entrada-titulo" className="mt-4 text-lg font-semibold text-confere-navy-600">
					Arraste a planilha de levantamento aqui
				</h2>
				<p id="entrada-descricao" className="mt-1 text-sm text-confere-navy-300">
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
					onChange={(evento) => {
						soltar.limparErro();
						const arquivo = evento.target.files?.[0];
						if (arquivo) onEscolher(arquivo);
					}}
				/>
				<button
					ref={refBotao}
					type="button"
					onClick={() => campo.current?.click()}
					className="mt-6 rounded-md bg-confere-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-confere-teal-600"
				>
					Escolher planilha
				</button>
				{soltar.erro && (
					<p className="mx-auto mt-4 max-w-md rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
						{soltar.erro}
					</p>
				)}
				{soltar.arrastando && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-confere-teal-50/95 text-base font-semibold text-confere-teal-600"
					>
						Solte a planilha aqui
					</div>
				)}
			</section>
			<p className="mt-4 text-sm text-confere-navy-600">
				Prefere enviar o contrato do computador?{" "}
				<button
					type="button"
					onClick={onPreencherAMao}
					className="font-semibold text-confere-teal-600 underline"
				>
					Preencher à mão
				</button>
			</p>
		</>
	);
}
