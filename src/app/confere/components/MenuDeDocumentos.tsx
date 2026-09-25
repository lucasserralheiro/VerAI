"use client";

import { useRef } from "react";

import type { DocumentoDoCadastro } from "@/lib/confere/tipos-cadastro";
import { textoDaOrigem } from "../lib/cadastro";

interface Props {
	rotulo: string;
	documentos: readonly DocumentoDoCadastro[];
	onEscolher: (documento: DocumentoDoCadastro) => void;
	/** Quando existe, o menu termina com "Enviar do computador…". */
	onEnviarDoComputador?: () => void;
}

/** "Trocar" e "+ Adicionar do cadastro": as propostas do cadastro e, se couber,
 *  o envio pelo computador (desenho de 25/09/2026 §4.2).
 *
 *  `<details>` e não um popover próprio: abre, fecha e anda pelo teclado sem
 *  código. Mora dentro do `<form>` do `UploadForm`, então todo botão aqui é
 *  `type="button"` — o padrão do HTML dentro de formulário é `submit`, e
 *  escolher uma proposta geraria o relatório (`R-LMP-03`). */
export function MenuDeDocumentos({ rotulo, documentos, onEscolher, onEnviarDoComputador }: Props) {
	const menu = useRef<HTMLDetailsElement>(null);

	function fechar() {
		if (menu.current) menu.current.open = false;
	}

	return (
		<details ref={menu} className="relative">
			<summary className="cursor-pointer font-semibold text-confere-teal-600 underline">{rotulo}</summary>
			<ul className="absolute left-0 z-10 mt-1 w-max max-w-md space-y-0.5 rounded-md border border-confere-line bg-white p-1 shadow-sm">
				{documentos.map((documento) => (
					<li key={documento.arquivoId}>
						<button
							type="button"
							onClick={() => {
								fechar();
								onEscolher(documento);
							}}
							className="w-full rounded px-2 py-1 text-left text-confere-navy-600 hover:bg-confere-navy-50"
						>
							{documento.nome}
							<span className="text-confere-navy-300"> · {textoDaOrigem(documento.origem)}</span>
						</button>
					</li>
				))}
				{onEnviarDoComputador && (
					<li>
						<button
							type="button"
							onClick={() => {
								fechar();
								onEnviarDoComputador();
							}}
							className="w-full rounded px-2 py-1 text-left font-semibold text-confere-teal-600 hover:bg-confere-navy-50"
						>
							Enviar do computador…
						</button>
					</li>
				)}
			</ul>
		</details>
	);
}
