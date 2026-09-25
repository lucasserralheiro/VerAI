"use client";

import { type DragEvent, useRef, useState } from "react";

interface Opcoes {
	/** ".pdf" ou ".xlsx" — o tipo é conferido pela extensão do nome, como o
	 *  `accept` do campo. */
	extensao: string;
	multiplos: boolean;
	/** Durante a geração nada é aceito, como os campos, que ficam desabilitados. */
	desabilitado: boolean;
	onSoltar: (arquivos: File[]) => void;
	/** O aviso do cartão quando chega arquivo de outro tipo. */
	mensagemDeTipoErrado: (arquivo: File) => string;
}

/** Arrastar e soltar num cartão do formulário
 *  (docs/superpowers/specs/2026-09-25-confere-ux-pastas-design.md §3.4).
 *
 *  A profundidade conta os `dragenter`/`dragleave` dos filhos: passar o arquivo
 *  por cima do título do cartão dispara um `dragleave` no cartão, e sem a conta
 *  o destaque piscaria. */
export function useSoltarArquivos({
	extensao,
	multiplos,
	desabilitado,
	onSoltar,
	mensagemDeTipoErrado,
}: Opcoes) {
	const [arrastando, setArrastando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const profundidade = useRef(0);

	function temArquivos(evento: DragEvent) {
		return Array.from(evento.dataTransfer?.types ?? []).includes("Files");
	}

	function doTipo(arquivo: File) {
		return arquivo.name.toLowerCase().endsWith(extensao);
	}

	return {
		arrastando,
		erro,
		limparErro: () => setErro(null),
		alvo: {
			onDragEnter(evento: DragEvent) {
				if (desabilitado || !temArquivos(evento)) return;
				evento.preventDefault();
				profundidade.current += 1;
				setArrastando(true);
			},
			onDragOver(evento: DragEvent) {
				if (desabilitado || !temArquivos(evento)) return;
				evento.preventDefault();
				if (evento.dataTransfer) evento.dataTransfer.dropEffect = "copy";
			},
			onDragLeave() {
				profundidade.current = Math.max(0, profundidade.current - 1);
				if (profundidade.current === 0) setArrastando(false);
			},
			onDrop(evento: DragEvent) {
				evento.preventDefault();
				profundidade.current = 0;
				setArrastando(false);
				if (desabilitado) return;
				const arquivos = Array.from(evento.dataTransfer?.files ?? []);
				const certos = arquivos.filter(doTipo);
				const errado = arquivos.find((arquivo) => !doTipo(arquivo));
				setErro(errado ? mensagemDeTipoErrado(errado) : null);
				if (certos.length > 0) onSoltar(multiplos ? certos : certos.slice(0, 1));
			},
		},
	};
}
