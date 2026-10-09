"use client";

import type { LinhaDoGrid } from "../lib/types";
import { useAbrirItemNoContrato } from "./ItemNoContrato";

/** Saldo negativo significa consumo **acima** do contratado — o achado de maior
 *  consequência numa conferência. Não pode se confundir com os demais números. */
export function ehNegativo(saldo: string): boolean {
	return saldo.trim().startsWith("-");
}

/** A marca é texto, não só cor (`R-ACE-02`). 12 px: a de 10 px era ilegível para
 *  quem tem baixa visão. */
function Marca({ texto, tom }: { texto: string; tom: "perfil" | "critica" }) {
	const estilo =
		tom === "perfil"
			? "bg-amber-100 text-amber-900"
			: "bg-confere-severidade-critico text-white";
	return (
		<span
			className={`ml-2 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${estilo}`}
		>
			{texto}
		</span>
	);
}

interface Props {
	linhas: LinhaDoGrid[];
	/** *Sem divergência* não mostra saldo (`R-ANA-11`): seria sempre zero. */
	comSaldo?: boolean;
	/** `id` do título que nomeia a tabela. */
	rotuladaPor: string;
	/** Quando a lista mistura itens que divergem e que conferem, diz qual é qual
	 *  — sem isso o usuário teria de comparar as quantidades de cabeça. */
	divergem?: (linha: LinhaDoGrid) => boolean;
	/** A situação de todas as linhas, quando a lista é de uma situação só (o modal
	 *  de cada número do resumo). Aparece no painel de conferência do item. */
	situacaoFixa?: string;
}

/** A **única** tabela de itens da tela de resultado.
 *
 *  Antes havia duas, quase iguais — uma no painel por gravidade, outra no grid na
 *  ordem do relatório — e a diferença entre elas (cabeçalho, tamanho de fonte,
 *  marcas) só confundia quem conferia. Agora as duas visões desenham a mesma
 *  tabela.
 *
 *  `R-ACE-05` — o contêiner que rola é focável e tem nome: a 390 px a tabela
 *  transborda, e sem isso as colunas da direita ficam inalcançáveis sem mouse.
 */
export function TabelaDeItens({ linhas, comSaldo = true, rotuladaPor, divergem, situacaoFixa }: Props) {
	// Com PDF do contrato à mão, a linha abre o item no PDF.
	const abrirNoContrato = useAbrirItemNoContrato();
	const situacaoDa = (linha: LinhaDoGrid) =>
		divergem ? (divergem(linha) ? "Diverge" : "Confere") : situacaoFixa;
	const larguraMinima = comSaldo ? "min-w-[46rem]" : "min-w-[40rem]";
	const colunas = [
		"Código",
		"Descrição",
		"Unidade",
		"Qtd. contratada",
		"Qtd. medida",
		...(comSaldo ? ["Saldo"] : []),
		...(divergem ? ["Situação"] : []),
	];

	return (
		<div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby={rotuladaPor}>
			<table
				className={`w-full table-fixed text-[15px] ${larguraMinima}`}
				aria-labelledby={rotuladaPor}
			>
				{/* Larguras fixas: com `auto`, cada grupo calculava as suas colunas pelo
				    próprio conteúdo e Código, Unidade e Saldo não se alinhavam de um
				    grupo para o outro — o olho tinha de reaprender a tabela a cada bloco. */}
				<colgroup>
					<col className="w-40" />
					<col />
					<col className="w-44" />
					<col className="w-36" />
					<col className="w-28" />
					{comSaldo && <col className="w-28" />}
					{divergem && <col className="w-28" />}
				</colgroup>
				<thead>
					<tr className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-confere-navy-600">
						{colunas.map((coluna, indice) => (
							<th
								key={coluna}
								scope="col"
								className={`px-3 py-2.5 ${
									indice >= 3 && coluna !== "Situação" ? "text-right" : "text-left"
								}`}
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
							// O clique na linha é conveniência de mouse; quem usa
							// teclado ou leitor de tela tem o botão do código.
							onClick={abrirNoContrato ? () => abrirNoContrato(linha, situacaoDa(linha)) : undefined}
							className={`border-t border-confere-line ${
								abrirNoContrato ? "cursor-pointer hover:bg-confere-navy-50" : ""
							}`}
						>
							<td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm text-confere-navy-600">
								{abrirNoContrato ? (
									<button
										type="button"
										onClick={(evento) => {
											evento.stopPropagation();
											abrirNoContrato(linha, situacaoDa(linha));
										}}
										title="Conferir este item no PDF do contrato"
										aria-label={`Ver o item ${linha.codigo} no PDF do contrato`}
										className="font-mono font-semibold text-confere-teal-600 underline"
									>
										{linha.codigo}
									</button>
								) : (
									linha.codigo
								)}
							</td>
							{/* `relative` porque o `sr-only` do saldo é `position: absolute`:
							    sem ancestral posicionado ele escapa do contêiner que rola e
							    estica o `scrollWidth` da página (ESPEC 008). */}
							<td className="relative px-3 py-2.5 text-confere-navy-800">
								{linha.descricao}
								{linha.perfil_ou_pacote && <Marca texto="perfil" tom="perfil" />}
								{linha.sem_previsao_contratual && (
									<Marca texto="sem previsão contratual" tom="critica" />
								)}
							</td>
							<td className="px-3 py-2.5 text-confere-navy-600">
								{linha.unidade}
							</td>
							<td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-confere-navy-800">
								{linha.contratada}
							</td>
							<td className="whitespace-nowrap bg-confere-teal-50/60 px-3 py-2.5 text-right font-semibold tabular-nums text-confere-navy-800">
								{linha.medida}
							</td>
							{comSaldo && (
								<td
									className={`relative whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${
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
							{divergem && (
								<td className="whitespace-nowrap px-3 py-2.5">
									{divergem(linha) ? (
										<span className="font-semibold text-confere-navy-800">Diverge</span>
									) : (
										<span className="text-confere-brand-green-ink">Confere</span>
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
