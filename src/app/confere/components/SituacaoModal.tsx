"use client";

import { useEffect, useRef } from "react";

import type { SituacaoDaAnalise } from "../lib/types";
import { useAbrirItemNoContrato } from "./ItemNoContrato";
import { TabelaDeItens } from "./TabelaDeItens";

interface Props {
	/** A situação aberta; `null` com o diálogo fechado. */
	situacao: SituacaoDaAnalise | null;
	onFechar: () => void;
}

/** Os itens de uma situação, em um modal aberto pelos números do resumo.
 *
 *  Substitui os quatro grupos que ficavam empilhados abaixo do resumo e
 *  repetiam o que os números já diziam. `<dialog>` nativo com `showModal()`, como
 *  `ConfirmarLimpeza`: foco preso, `Esc` e fundo inerte sem ARIA escrito à mão.
 *  Quem rola é o próprio diálogo — uma rolagem só, sem rolagem dentro de
 *  rolagem.
 */
export function SituacaoModal({ situacao, onFechar }: Props) {
	const dialogo = useRef<HTMLDialogElement>(null);
	const aberto = situacao !== null;

	useEffect(() => {
		const el = dialogo.current;
		if (!el) return;
		if (aberto && !el.open) el.showModal();
		else if (!aberto && el.open) el.close();
	}, [aberto]);

	const comPdf = useAbrirItemNoContrato() !== undefined;
	const semDivergencia = situacao?.classificacao === "SEM_DIVERGENCIA";

	return (
		<dialog
			ref={dialogo}
			onClose={onFechar}
			// Clique no fundo escurecido: o alvo é o próprio `<dialog>`.
			onClick={(evento) => {
				if (evento.target === dialogo.current) onFechar();
			}}
			aria-labelledby="situacao-modal-titulo"
			className="w-[min(72rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-lg border border-confere-line bg-white p-0 shadow-lg backdrop:bg-black/40"
		>
			{situacao && (
				<div>
					<div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-confere-line bg-white px-6 py-4">
						<div className="min-w-0">
							<h2 id="situacao-modal-titulo" className="text-lg font-semibold text-confere-navy-800">
								{situacao.rotulo}
								<span className="ml-3 text-base font-semibold tabular-nums text-confere-navy-600">
									{situacao.quantidade === 1 ? "1 item" : `${situacao.quantidade} itens`}
								</span>
							</h2>
							<p className="mt-0.5 text-sm text-confere-navy-600">{situacao.glosa}</p>
						</div>
						<button
							type="button"
							onClick={onFechar}
							className="shrink-0 rounded-md border border-confere-brand-navy bg-white px-5 py-2.5 text-sm font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
						>
							Fechar
						</button>
					</div>

					{situacao.quantidade === 0 ? (
						<p className="px-6 py-5 text-base text-confere-navy-800">Nenhum item nesta situação.</p>
					) : (
						<>
							{!semDivergencia && (
								<p className="px-6 pt-4 text-sm text-confere-navy-600">
									<strong className="font-semibold">Saldo</strong> = contratado − medido. Saldo{" "}
									<strong className="font-semibold text-confere-severidade-critico">negativo</strong>{" "}
									(em vermelho) quer dizer que o medido passou do contratado.
								</p>
							)}
							{/* `R-PAN-06` — a ressalva que impede a categoria de afirmar mais do
							    que sabe: itens de perfil entram como 1/1 e não podem divergir. */}
							{semDivergencia && situacao.perfis_ou_pacotes > 0 && (
								<p className="px-6 pt-4 text-sm text-confere-navy-600">
									<strong className="font-semibold text-amber-900">
										{situacao.perfis_ou_pacotes} desses itens são de perfil ou pacote
									</strong>{" "}
									— entram sempre como 1/1, então a diferença de perfil não aparece nas
									quantidades. Igualdade aqui não é conferência bem-sucedida.
								</p>
							)}
							{comPdf && (
								<p className="px-6 pt-2 text-sm text-confere-navy-600">
									Clique em uma linha para conferir o item com o PDF do contrato.
								</p>
							)}
							<div className="mt-4 border-t border-confere-line">
								<TabelaDeItens
									linhas={situacao.linhas}
									comSaldo={!semDivergencia}
									rotuladaPor="situacao-modal-titulo"
									situacaoFixa={situacao.rotulo}
								/>
							</div>
						</>
					)}
				</div>
			)}
		</dialog>
	);
}
