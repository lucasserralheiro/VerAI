"use client";

import type { Analise, Classificacao, SituacaoDaAnalise } from "../lib/types";
import { TabelaDeItens } from "./TabelaDeItens";

/**
 * A visão **por gravidade** dos itens (ESPEC 009).
 *
 * Responde *quão grave*; a visão "na ordem do relatório" (`DivergenciaGrid`)
 * responde *onde no documento*. São duas leituras dos mesmos itens, e por isso
 * **não aparecem juntas**: `ItensParaConferir` mostra uma de cada vez. Quando
 * apareciam empilhadas, as mesmas divergências eram listadas duas vezes na tela
 * e quem conferia não sabia qual lista valia.
 *
 * Contrato, proposta, competência e total de itens também saíram daqui: já estão
 * no cartão de resumo, no topo.
 *
 * **Revisão da `D-03`** (08/10/2026): os grupos *com itens* nascem **abertos**.
 * A decisão original os fechava para a árvore caber num relance, mas o resultado
 * era uma tela de quatro linhas que escondia justamente o que o usuário veio
 * ver, e ele não entendia que precisava clicar. Aberto só o que exige conferência;
 * *sem divergência* continua fechado — é o que não pede ação. Grupo vazio vira
 * uma linha sem chevron: não há o que expandir.
 */

/** A tarja é redundância; quem carrega o sentido é o rótulo (`R-ACE-02`). */
const TARJA: Record<Classificacao, string> = {
	CRITICO: "border-l-confere-severidade-critico",
	MAIOR_RELEVANCIA: "border-l-confere-severidade-maior",
	DIVERGENTE: "border-l-confere-navy-600",
	SEM_DIVERGENCIA: "border-l-confere-brand-green",
};

const SELO: Record<Classificacao, string> = {
	CRITICO: "bg-confere-severidade-critico text-white",
	MAIOR_RELEVANCIA: "bg-confere-severidade-maior-fundo text-confere-severidade-maior",
	DIVERGENTE: "bg-confere-navy-50 text-confere-navy-600",
	SEM_DIVERGENCIA: "bg-confere-severidade-conforme-fundo text-confere-brand-green-ink",
};

function Selo({ situacao }: { situacao: SituacaoDaAnalise }) {
	const estilo =
		situacao.quantidade === 0
			? "bg-neutral-100 text-confere-navy-600"
			: SELO[situacao.classificacao];
	return (
		<span
			className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${estilo}`}
		>
			{situacao.quantidade === 1 ? "1 item" : `${situacao.quantidade} itens`}
		</span>
	);
}

function Titulo({ situacao, id }: { situacao: SituacaoDaAnalise; id: string }) {
	return (
		<div className="min-w-0">
			<h3 id={id} className="text-base font-semibold text-confere-navy-800">
				{situacao.rotulo}
			</h3>
			<p className="text-sm text-confere-navy-600">{situacao.glosa}</p>
		</div>
	);
}

function Bloco({ situacao }: { situacao: SituacaoDaAnalise }) {
	const id = `situacao-${situacao.classificacao.toLowerCase()}`;
	const semDivergencia = situacao.classificacao === "SEM_DIVERGENCIA";
	const moldura = `overflow-hidden rounded-md border border-l-4 border-confere-line bg-white ${TARJA[situacao.classificacao]}`;

	// `R-PAN-04` — situação sem itens aparece mesmo assim: `0 itens` em *Item
	// crítico* **é** o resultado, e é o que quem confere mais quer ler.
	if (situacao.quantidade === 0) {
		return (
			<div className={`${moldura} flex items-center gap-3 bg-neutral-50 px-4 py-3`}>
				<Titulo situacao={situacao} id={id} />
				<Selo situacao={situacao} />
				<span className="sr-only">Nenhum item nesta situação.</span>
			</div>
		);
	}

	return (
		<details open={!semDivergencia} className={moldura}>
			<summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
				<svg
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
					className="h-3.5 w-3.5 shrink-0 text-confere-navy-600 transition-transform motion-reduce:transition-none [details[open]_&]:rotate-90"
				>
					<path d="m4 2 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
				<Titulo situacao={situacao} id={id} />
				<Selo situacao={situacao} />
			</summary>

			{/* `R-PAN-06` — a ressalva que impede a categoria de afirmar mais do que
			    sabe: itens de perfil entram como 1/1 e não podem divergir. */}
			{semDivergencia && situacao.perfis_ou_pacotes > 0 && (
				<p className="border-t border-confere-line px-4 py-3 text-sm text-confere-navy-600">
					<strong className="font-semibold text-amber-900">
						{situacao.perfis_ou_pacotes} desses itens são de perfil ou pacote
					</strong>{" "}
					— entram sempre como 1/1, então a diferença de perfil não aparece nas
					quantidades. Igualdade aqui não é conferência bem-sucedida.
				</p>
			)}
			<div className="border-t border-confere-line">
				<TabelaDeItens linhas={situacao.linhas} comSaldo={!semDivergencia} rotuladaPor={id} />
			</div>
		</details>
	);
}

/** Os quatro grupos, na ordem de gravidade (`R-PAN-01`). */
export function AnaliseMedicaoPanel({ analise }: { analise: Analise }) {
	return (
		<div className="flex flex-col gap-3">
			{analise.situacoes.map((situacao) => (
				<Bloco key={situacao.classificacao} situacao={situacao} />
			))}
		</div>
	);
}
