"use client";

import { useState } from "react";

import type { Analise, LinhaDoGrid } from "../lib/types";
import { DivergenciaGrid } from "./DivergenciaGrid";
import { useAbrirItemNoContrato } from "./ItemNoContrato";
import { ehNegativo } from "./TabelaDeItens";

interface Props {
	analise: Analise;
	divergencias: LinhaDoGrid[];
	demaisItens: LinhaDoGrid[];
	todosOsItens?: LinhaDoGrid[];
}

/** Os itens do relatório **na ordem do documento** (`R-REL-05`), para conferir
 *  linha a linha contra o DOCX.
 *
 *  A leitura por gravidade saiu daqui: os quatro grupos repetiam o que os números
 *  do resumo já dizem, e agora cada número abre os seus itens num modal
 *  (`SituacaoModal`). Esta seção ficou só com o que o modal não faz — a lista
 *  inteira, na ordem do documento, com a coluna *Situação*.
 */
export function ItensParaConferir({ analise, divergencias, demaisItens, todosOsItens }: Props) {
	// Padrão: o documento inteiro. Quem quer só o que diverge desmarca.
	const [comConferem, setComConferem] = useState(true);
	const comPdf = useAbrirItemNoContrato() !== undefined;
	const podeIncluirConferem = todosOsItens !== undefined && todosOsItens.length > 0;

	const temSaldoNegativo =
		divergencias.some((l) => ehNegativo(l.saldo)) ||
		analise.situacoes.some((s) => s.linhas.some((l) => ehNegativo(l.saldo)));

	return (
		<section id="itens" className="mt-8 scroll-mt-4" aria-labelledby="titulo-itens">
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<div>
					<h2 id="titulo-itens" className="text-lg font-semibold text-confere-navy-800">
						Itens do relatório
					</h2>
					<p className="mt-1 text-base text-confere-navy-800">
						{comPdf ? "Clique em uma linha para ver o item no contrato e na planilha." : "Itens do relatório, linha a linha."}
					</p>
				</div>

				{podeIncluirConferem && (
					<label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-confere-navy-800">
						<input
							type="checkbox"
							checked={comConferem}
							onChange={(e) => setComConferem(e.target.checked)}
							className="size-4"
						/>
						Mostrar também os itens sem divergência
					</label>
				)}
			</div>

			{/* O saldo é a coluna que mais gera dúvida: a conta fica numa linha só,
			    junto da tabela, e o aviso do negativo só aparece se houver um. */}
			<p className="mb-4 mt-2 text-sm text-confere-navy-600">
				Mesma ordem do DOCX. <strong className="font-semibold">Saldo</strong> = contratado − medido.
				{temSaldoNegativo && (
					<>
						{" "}
						Em <strong className="font-semibold text-confere-severidade-critico">vermelho</strong>, o medido
						passou do contratado.
					</>
				)}
			</p>

			<DivergenciaGrid
				divergencias={divergencias}
				demaisItens={demaisItens}
				todosOsItens={todosOsItens}
				comConferem={comConferem}
			/>
		</section>
	);
}
