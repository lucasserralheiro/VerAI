"use client";

import { useState } from "react";

import type { ResumoDoContrato } from "@/lib/confere/tipos-cadastro";
import { buscarContratos } from "../lib/api";
import { textoDoContrato } from "../lib/cadastro";

/** Lista de contratos para escolher — sugestões, empate e resultado da busca. */
export function ListaDeContratos({
	contratos,
	onEscolher,
}: {
	contratos: readonly ResumoDoContrato[];
	onEscolher: (contratoId: string) => void;
}) {
	return (
		<ul className="mt-2 grid gap-1">
			{contratos.map((contrato) => (
				<li key={contrato.id}>
					<button
						type="button"
						onClick={() => onEscolher(contrato.id)}
						className="w-full rounded border border-confere-line bg-white px-3 py-1.5 text-left text-xs text-confere-navy-600 transition hover:border-confere-teal-400"
					>
						{textoDoContrato(contrato)}
					</button>
				</li>
			))}
		</ul>
	);
}

/** Busca livre de contrato no cadastro — por número, órgão ou nome do cliente.
 *
 *  Mora dentro do `<form>` do `UploadForm`, e Enter num campo de texto submete o
 *  formulário de fora — o que aqui **geraria o relatório**. O `keyDown` segura o
 *  Enter e busca. */
export function BuscaDeContrato({ onEscolher }: { onEscolher: (contratoId: string) => void }) {
	const [texto, setTexto] = useState("");
	const [resultados, setResultados] = useState<ResumoDoContrato[] | null>(null);
	const [buscando, setBuscando] = useState(false);

	async function buscar() {
		if (!texto.trim()) return;
		setBuscando(true);
		setResultados(await buscarContratos(texto));
		setBuscando(false);
	}

	return (
		<div className="text-xs">
			<div className="flex gap-2">
				<input
					type="search"
					value={texto}
					onChange={(evento) => setTexto(evento.target.value)}
					onKeyDown={(evento) => {
						if (evento.key !== "Enter") return;
						evento.preventDefault();
						void buscar();
					}}
					placeholder="Número do contrato, órgão ou cliente"
					aria-label="Buscar contrato no cadastro"
					className="h-8 flex-1 rounded border border-confere-line bg-white px-2 text-confere-navy-600"
				/>
				<button
					type="button"
					onClick={() => void buscar()}
					className="rounded-md border border-confere-line bg-white px-3 font-semibold text-confere-navy-600 transition hover:bg-confere-navy-50"
				>
					{buscando ? "Buscando…" : "Buscar"}
				</button>
			</div>
			{resultados !== null &&
				(resultados.length === 0 ? (
					<p className="mt-2">Nenhum contrato encontrado.</p>
				) : (
					<ListaDeContratos contratos={resultados} onEscolher={onEscolher} />
				))}
		</div>
	);
}
