"use client";

import { useEffect, useRef } from "react";

interface Props {
	aberto: boolean;
	/** Título da barra do topo. Sem ele, a barra só tem o "Fechar" — para seções que
	 *  já abrem com o próprio título. */
	titulo?: string;
	onFechar: () => void;
	/** Mantém o conteúdo montado com a janela fechada. Só para o que guarda estado
	 *  (o formulário dos documentos); o resto monta ao abrir. */
	montarSempre?: boolean;
	children: React.ReactNode;
}

/** Uma seção do relatório numa janela, no lugar de ficar na página. A página do
 *  resultado é só o resumo e as ações; cada "Ir para" abre a seção aqui.
 *
 *  `<dialog>` nativo com `showModal()`, como os outros diálogos do Confere (foco
 *  preso, Esc e fundo inerte de graça). Altura fixa e uma rolagem só — a do corpo. */
export function JanelaDaSecao({ aberto, titulo, onFechar, montarSempre, children }: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;
		if (aberto && !el.open) el.showModal();
		else if (!aberto && el.open) el.close();
	}, [aberto]);

	return (
		<dialog
			ref={dialogo}
			onClose={onFechar}
			onClick={(evento) => {
				if (evento.target === dialogo.current) onFechar();
			}}
			aria-label={titulo ?? "Seção do relatório"}
			className="h-[90vh] w-[min(96rem,calc(100vw-2rem))] max-w-none flex-col rounded-lg border border-confere-line bg-white p-0 shadow-lg backdrop:bg-black/40 open:flex"
		>
			<div className="flex shrink-0 items-center justify-between gap-4 border-b border-confere-line px-6 py-3">
				<h2 className="text-lg font-semibold text-confere-navy-800">{titulo ?? ""}</h2>
				<button
					type="button"
					onClick={onFechar}
					className="shrink-0 rounded-md border border-confere-brand-navy bg-white px-5 py-2.5 text-sm font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
				>
					Fechar
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-6 [&_section:first-child]:mt-0 [&>section]:mt-0">
				{(aberto || montarSempre) && children}
			</div>
		</dialog>
	);
}
