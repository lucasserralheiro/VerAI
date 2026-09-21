"use client";

import type { Analise, Classificacao, LinhaDoGrid, SituacaoDaAnalise } from "../lib/types";

/**
 * ESPEC 009 — a leitura **por gravidade**, acima do grid.
 *
 * O grid de divergências responde *onde no relatório*; este painel responde
 * *quão grave*. São perguntas diferentes sobre os mesmos dados, e é por isso que
 * os dois convivem.
 *
 * A tabela daqui não reusa a do `DivergenciaGrid` de propósito: aquela tem seis
 * colunas fixas e é o que a captura da T-547 protege pixel a pixel; esta omite o
 * Saldo em *sem divergência* (`R-ANA-11`) e acrescenta a marca de sem previsão
 * contratual. Unificá-las obrigaria a mexer no grid para servir ao painel —
 * exatamente o que `R-PAN-09` proíbe.
 */

/** `D-03`, revisada — **os quatro nascem fechados**.
 *
 *  A redação original abria *crítico* e *maior relevância*, para que o achado
 *  grave não ficasse atrás de um clique. O argumento caiu quando o quadro-resumo
 *  saiu da tela (§17.4): a **contagem passou a viver no cabeçalho do bloco**, e
 *  `1 item` em *Item crítico* já é o achado — aberto ou fechado.
 *
 *  Com os quatro fechados a árvore inteira cabe num relance, e as ~92 linhas de
 *  detalhe deixam de empurrar o grid para fora da primeira tela. Expandir é do
 *  usuário, e continua não sendo filtro: nada some de quem não pediu, e
 *  `<details>` já vem focável, operável por teclado e anunciado com estado
 *  (`R-UI-05`).
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

function ehNegativo(saldo: string): boolean {
	return saldo.trim().startsWith("-");
}

function Marca({ texto, tom }: { texto: string; tom: "perfil" | "critica" }) {
	const estilo =
		tom === "perfil"
			? "bg-amber-100 text-amber-800"
			: "bg-confere-severidade-critico text-white";
	return (
		<span className={`ml-1.5 whitespace-nowrap rounded px-1.5 text-[10px] font-semibold ${estilo}`}>
			{texto}
		</span>
	);
}

function Tabela({
	linhas,
	comSaldo,
	rotuladaPor,
}: {
	linhas: LinhaDoGrid[];
	comSaldo: boolean;
	rotuladaPor: string;
}) {
	const colunas = [
		"Código",
		"Descrição",
		"Unidade",
		"Quantidade Contratada",
		"Quantidade Medida",
		...(comSaldo ? ["Saldo"] : []),
	];

	// `R-ACE-05` — o contêiner que rola é focável e tem nome: a 390 px a tabela
	// transborda, e sem isto as colunas da direita ficam inalcançáveis sem mouse.
	return (
		<div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby={rotuladaPor}>
			<table
				className={`w-full text-sm ${comSaldo ? "min-w-[52rem]" : "min-w-[46rem]"}`}
				aria-labelledby={rotuladaPor}
			>
				<thead>
					<tr className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-confere-navy-300">
						{colunas.map((coluna, indice) => (
							<th
								key={coluna}
								scope="col"
								className={`px-3 py-1.5 ${indice >= 3 ? "text-right" : "text-left"}`}
							>
								{coluna}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{linhas.map((linha) => (
						<tr
							key={`${linha.codigo}-${linha.descricao}`}
							className="border-b border-confere-line last:border-0"
						>
							<td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-confere-navy-600">
								{linha.codigo}
							</td>
							{/* `relative` porque as marcas trazem `sr-only`, que é
							    `position: absolute`: sem ancestral posicionado ele escapa do
							    contêiner que rola e estica o `scrollWidth` da página — o pior
							    defeito da ESPEC 008, e ele não aparece em teste nenhum. */}
							<td className="relative px-3 py-1.5 text-confere-navy-800">
								{linha.descricao}
								{linha.perfil_ou_pacote && <Marca texto="perfil" tom="perfil" />}
								{linha.sem_previsao_contratual && (
									<Marca texto="sem previsão contratual" tom="critica" />
								)}
							</td>
							<td className="whitespace-nowrap px-3 py-1.5 text-confere-navy-300">{linha.unidade}</td>
							<td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-confere-navy-800">
								{linha.contratada}
							</td>
							<td className="whitespace-nowrap bg-confere-teal-50/60 px-3 py-1.5 text-right font-semibold tabular-nums text-confere-navy-800">
								{linha.medida}
							</td>
							{comSaldo && (
								<td
									className={`relative whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums ${
										ehNegativo(linha.saldo)
											? "bg-confere-severidade-critico-fundo text-confere-severidade-critico"
											: "text-confere-navy-600"
									}`}
								>
									{linha.saldo}
									{ehNegativo(linha.saldo) && (
										<span className="sr-only"> — medido acima do contratado</span>
									)}
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Bloco({ situacao }: { situacao: SituacaoDaAnalise }) {
	const id = `situacao-${situacao.classificacao.toLowerCase()}`;
	const comSaldo = situacao.classificacao !== "SEM_DIVERGENCIA";
	const vazia = situacao.quantidade === 0;

	return (
		<details
			className={`overflow-hidden rounded-md border border-l-4 border-confere-line bg-white ${TARJA[situacao.classificacao]}`}
		>
			<summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
				<svg
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
					className="h-3 w-3 shrink-0 text-confere-navy-300 transition-transform motion-reduce:transition-none [details[open]_&]:rotate-90"
				>
					<path d="m4 2 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
				<h3 id={id} className="text-sm font-semibold text-confere-navy-800">
					{situacao.rotulo}
				</h3>
				<span className="text-xs text-confere-navy-300">— {situacao.glosa}</span>
				<span
					className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${SELO[situacao.classificacao]}`}
				>
					{situacao.quantidade === 1 ? "1 item" : `${situacao.quantidade} itens`}
				</span>
			</summary>

			{/* `R-PAN-04` — situação sem itens aparece assim mesmo, e com a contagem
			    no cabeçalho: `0 itens` em *Item crítico* **é** o resultado, e é o que
			    quem confere mais quer ler. A frase por extenso está aqui dentro para
			    quem abrir. */}
			{vazia ? (
				<p className="px-4 pb-3.5 text-sm text-confere-brand-green-ink">
					Nenhum item nesta situação.
				</p>
			) : (
				<>
					{/* `R-PAN-06` — a ressalva que impede a categoria de afirmar mais do
					    que sabe: itens de perfil entram como 1/1 e não podem divergir. */}
					{situacao.classificacao === "SEM_DIVERGENCIA" && situacao.perfis_ou_pacotes > 0 && (
						<p className="px-4 pb-3 text-xs text-confere-navy-300">
							<strong className="font-semibold text-amber-800">
								{situacao.perfis_ou_pacotes} desses itens são de perfil ou pacote
							</strong>{" "}
							— entram sempre como 1/1, então a diferença de perfil não aparece nas
							quantidades. Igualdade aqui não é conferência bem-sucedida.
						</p>
					)}
					<Tabela linhas={situacao.linhas} comSaldo={comSaldo} rotuladaPor={id} />
				</>
			)}
		</details>
	);
}

/** O painel, entre a faixa de resultado e o grid (`R-PAN-01`). */
export function AnaliseMedicaoPanel({ analise }: { analise: Analise }) {
	return (
		<section className="mt-7" aria-labelledby="titulo-analise">
			<h2 id="titulo-analise" className="text-lg font-semibold text-confere-navy-600">
				Análise da medição
			</h2>
			<p className="mb-4 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-confere-navy-300">
				<span>
					Contrato{" "}
					<span className="font-mono font-semibold text-confere-navy-600">
						{analise.contrato_referencia}
					</span>
				</span>
				<span aria-hidden="true">·</span>
				<span>
					Proposta{" "}
					<span className="font-mono font-semibold text-confere-navy-600">
						{analise.proposta_origem}
					</span>
				</span>
				<span aria-hidden="true">·</span>
				<span>Competência {analise.competencia}</span>
				<span aria-hidden="true">·</span>
				{/* O quadro-resumo em tabela saiu da tela: rótulo, glosa e contagem
				    já estavam nos quatro blocos, palavra por palavra, e com eles
				    recolhidos a lista **é** o resumo.

				    O total ficou. Ele não é repetição de nada: é o invariante de
				    `R-ANA-05` — a soma das quatro é o universo — visível para quem
				    lê, e é o primeiro número de uma conferência. A aba `Resumo
				    Executivo` do `.xlsx` continua existindo: lá o arquivo circula
				    sem os blocos (ESPEC 009 §17.4). */}
				<span>
					<strong className="font-semibold tabular-nums text-confere-navy-600">
						{analise.total_itens}
					</strong>{" "}
					itens analisados
				</span>
			</p>

			<div className="flex flex-col gap-3">
				{analise.situacoes.map((situacao) => (
					<Bloco key={situacao.classificacao} situacao={situacao} />
				))}
			</div>
		</section>
	);
}
