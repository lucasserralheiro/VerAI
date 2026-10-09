"use client";

import type { LinhaDoGrid } from "../lib/types";
import { TabelaDeItens } from "./TabelaDeItens";

interface Props {
	divergencias: LinhaDoGrid[];
	demaisItens: LinhaDoGrid[];
	/** Todos os itens, na ordem do relatório. Ausente em backend anterior: a
	 *  visão cai para só as divergências, como era. */
	todosOsItens?: LinhaDoGrid[];
	/** Incluir os itens que conferem. Só vale com `todosOsItens`. */
	comConferem: boolean;
}

const chave = (linha: LinhaDoGrid) => `${linha.codigo}-${linha.descricao}`;

/** A visão **na ordem do documento**.
 *
 *  ESPEC 018 `R-REL-05` — a ordem é a do `.docx`, o que permite conferir cada
 *  linha contra a mesma linha no documento. Com `comConferem` a lista é o
 *  documento inteiro, e a coluna *Situação* separa o que diverge do que confere;
 *  sem ele, são só os itens que divergem.
 *
 *  Título, subtítulo e legenda são de `ItensParaConferir`. `R-DIV-05` segue
 *  intacta: itens sem previsão contratual entram como qualquer linha, com a marca.
 */
export function DivergenciaGrid({ divergencias, demaisItens, todosOsItens, comConferem }: Props) {
	const mostrarTodos = comConferem && todosOsItens !== undefined && todosOsItens.length > 0;
	const linhas = mostrarTodos ? todosOsItens : divergencias;

	// `R-UI-06` — mensagem explícita, nunca uma tabela vazia.
	if (linhas.length === 0) {
		return (
			<p className="rounded-md border border-confere-teal-100 bg-confere-teal-50 p-4 text-base text-confere-teal-700">
				Nenhuma divergência nas linhas do relatório: a quantidade medida é igual à
				contratada em todas.
				{demaisItens.length > 0 &&
					" Os itens que só o levantamento traz estão no fim do documento."}
			</p>
		);
	}

	const quemDiverge = new Set(divergencias.map(chave));

	return (
		<div className="overflow-hidden rounded-md border border-confere-line bg-white">
			<h3 id="divergencias" className="sr-only">
				{mostrarTodos ? "Todos os itens, na ordem do relatório" : "Itens divergentes, na ordem do relatório"}
			</h3>
			<TabelaDeItens
				linhas={linhas}
				rotuladaPor="divergencias"
				divergem={mostrarTodos ? (linha) => quemDiverge.has(chave(linha)) : undefined}
			/>
		</div>
	);
}
