"use client";

import type { LinhaDoGrid } from "@/lib/types";

const COLUNAS = [
	"Código",
	"Descrição",
	"Unidade",
	"Quantidade Contratada",
	"Quantidade Medida",
	"Saldo",
];

/** Saldo negativo significa consumo **acima** do contratado — o achado de maior
 *  consequência numa conferência. Não pode se confundir com os demais números. */
function ehNegativo(saldo: string): boolean {
	return saldo.trim().startsWith("-");
}

/** Marca os itens que nunca divergem por construção.
 *
 *  A explicação saiu do `title` e foi para a legenda: `title` não abre por
 *  teclado, não existe em toque e é lido de forma inconsistente — e esta é a
 *  ressalva que impede concluir "confere" quando o perfil contratado não é o
 *  medido (`R-DIV-04`, ESPEC 008 D-05).
 */
function MarcaPerfil() {
	return (
		<span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
			perfil
			<span className="sr-only">: ver legenda abaixo do título do grid</span>
		</span>
	);
}

function Linhas({ linhas }: { linhas: LinhaDoGrid[] }) {
	return (
		<>
			{linhas.map((linha) => (
				<tr key={`${linha.codigo}-${linha.descricao}`} className="border-b border-line last:border-0">
					<td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-navy-600">
						{linha.codigo}
					</td>
					{/* `relative` por causa do `sr-only` de `MarcaPerfil`: `sr-only` é
					    `position: absolute`, e sem ancestral posicionado ele se ancora
					    no bloco inicial — escapando do contêiner que rola e esticando o
					    `scrollWidth` da página para 845 px a 390 px de largura. */}
					<td className="relative px-3 py-1.5 text-navy-800">
						{linha.descricao}
						{linha.perfil_ou_pacote && <MarcaPerfil />}
					</td>
					<td className="whitespace-nowrap px-3 py-1.5 text-navy-300">{linha.unidade}</td>
					<td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-navy-800">
						{linha.contratada}
					</td>
					<td className="whitespace-nowrap bg-teal-50/60 px-3 py-1.5 text-right font-semibold tabular-nums text-navy-800">
						{linha.medida}
					</td>
					<td
						className={`relative whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums ${
							ehNegativo(linha.saldo) ? "bg-red-50 text-red-700" : "text-navy-600"
						}`}
					>
						{linha.saldo}
						{/* O fundo vermelho era a única marca do achado de maior
						    consequência, e cor sozinha reprova WCAG 1.4.1 (`R-ACE-02`).
						    `sr-only` é absolutamente posicionado: não desloca a célula. */}
						{ehNegativo(linha.saldo) && (
							<span className="sr-only"> — medido acima do contratado</span>
						)}
					</td>
				</tr>
			))}
		</>
	);
}

function Cabecalho() {
	return (
		<tr className="bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-navy-300">
			{COLUNAS.map((coluna, indice) => (
				<th
					key={coluna}
					scope="col"
					className={`px-3 py-1.5 ${indice >= 3 ? "text-right" : "text-left"}`}
				>
					{coluna}
				</th>
			))}
		</tr>
	);
}

/** A tabela dentro do contêiner que rola.
 *
 *  `tabIndex` no contêiner porque a 390 px a tabela mede 832 px e transborda:
 *  sem foco, as colunas **Quantidade Medida** e **Saldo** ficam inalcançáveis
 *  para quem não usa mouse (`R-ACE-05`). O custo é uma parada de tabulação por
 *  seção, e é o preço da WCAG 2.1.1.
 */
function Tabela({ linhas, rotuladaPor }: { linhas: LinhaDoGrid[]; rotuladaPor: string }) {
	return (
		<div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby={rotuladaPor}>
			<table className="w-full min-w-[52rem] text-sm" aria-labelledby={rotuladaPor}>
				<thead>
					<Cabecalho />
				</thead>
				<tbody>
					<Linhas linhas={linhas} />
				</tbody>
			</table>
		</div>
	);
}

/** As marcas do grid, explicadas uma vez e por escrito — só a que ocorre neste
 *  relatório. Uma legenda fixa com as duas entradas, quando só uma delas tem
 *  linha correspondente na tela, lê como se o outro caso também existisse: quem
 *  confere lendo "-1 Saldo negativo" procura uma linha negativa que não está
 *  ali. */
function Legenda({
	temPerfil,
	temSaldoNegativo,
}: {
	temPerfil: boolean;
	temSaldoNegativo: boolean;
}) {
	if (!temPerfil && !temSaldoNegativo) {
		return null;
	}

	return (
		<dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-navy-300">
			{temPerfil && (
				<div className="flex items-center gap-1.5">
					<dt className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
						perfil
					</dt>
					<dd>
						Item de perfil ou pacote: entra sempre como 1/1, então a diferença de perfil
						não aparece nas quantidades.
					</dd>
				</div>
			)}
			{temSaldoNegativo && (
				<div className="flex items-center gap-1.5">
					<dt className="rounded bg-red-50 px-1 font-semibold tabular-nums text-red-700">
						-1
					</dt>
					<dd>Saldo negativo: medido acima do contratado.</dd>
				</div>
			)}
		</dl>
	);
}

interface Props {
	divergencias: LinhaDoGrid[];
	demaisItens: LinhaDoGrid[];
	totalDivergencias: number;
	/** Itens de perfil ou pacote nunca divergem (`R-DIV-04`) e por isso nunca
	 *  aparecem em `divergencias`: quem sabe se algum existe no relatório é a
	 *  classificação da ESPEC 009, não este grid. */
	temItensDePerfil: boolean;
}

/** Título do grid. Sem ele a tabela flutua na tela sem dizer o que é — e o que
 *  ela é não é óbvio: são só os itens que não bateram, não o relatório inteiro. */
function Titulo({ total }: { total: number }) {
	return (
		<div className="mb-3">
			{/* `R-PAN-08` — com o painel de análise acima, dois títulos "Divergências"
			    na mesma tela designariam recortes diferentes (16 itens contra 36) com
			    a mesma palavra. Este grid sempre foi o da ordem do relatório; agora
			    o título diz isso. */}
			<h2 className="text-lg font-semibold text-navy-600">
				Divergências, na ordem do relatório
			</h2>
			<p className="text-sm text-navy-300">
				{total === 1
					? "1 item em que a quantidade medida difere da contratada"
					: `${total} itens em que a quantidade medida difere da contratada`}
			</p>
		</div>
	);
}

/** Grid com a mesma ordem do relatório, só com os itens que divergem.
 *
 *  ESPEC 018 `R-REL-05` — era agrupado por seção, o que permitia conferir cada
 *  linha contra a mesma linha no documento. O documento perdeu o agrupamento e
 *  passou a seguir a ordem do contrato; o grid segue a mesma ordem, que é o que
 *  mantém a correspondência linha a linha.
 */
export function DivergenciaGrid({
	divergencias,
	demaisItens,
	totalDivergencias,
	temItensDePerfil,
}: Props) {
	const temSaldoNegativo = divergencias.some((linha) => ehNegativo(linha.saldo));

	if (divergencias.length === 0) {
		return (
			<div className="mt-6">
				<h2 className="text-lg font-semibold text-navy-600">
					Divergências, na ordem do relatório
				</h2>
				{/* `R-UI-06` — mensagem explícita, nunca um grid vazio. A ressalva
				    existe porque o bloco de sem previsão contratual saiu daqui
				    (`R-PAN-07`): sem ela, a tela afirmaria que "em todos os itens" as
				    quantidades batem tendo um item medido sem cobertura logo acima. */}
				<p className="mt-2 rounded-md border border-teal-100 bg-teal-50 p-4 text-sm text-teal-700">
					Nenhuma divergência nas linhas do relatório: a quantidade medida é igual à
					contratada em todas.
					{demaisItens.length > 0 &&
						" Os itens que só o levantamento traz estão no fim do documento."}
				</p>
			</div>
		);
	}

	return (
		<div className="mt-6 space-y-4">
			<Titulo total={totalDivergencias} />
			<Legenda temPerfil={temItensDePerfil} temSaldoNegativo={temSaldoNegativo} />

			{/* O bloco de itens sem previsão contratual **saiu daqui** (`R-PAN-07`,
			    ESPEC 009): a marca que o distingue de um excesso sobre item que ao
			    menos tem cobertura contratual vive dentro de *Item crítico*, no
			    painel de análise acima.

			    `R-DIV-05` segue intacta: a coleta continua, o dado continua na
			    resposta da API (`sem_previsao_contratual`), o critério de entrada é o
			    mesmo. Muda a **posição**, como a ESPEC 008 D-07 já mudou uma vez —
			    naquela ela veio do fim do grid para o topo, nesta vai para a categoria
			    que a nomeia.

			    A `R-PAN-07` foi revista pela ESPEC 030 `D-06`: a ESPEC 018 tornou esse
			    item linha comum do relatório, não mais exceção, então ele **pode e
			    deve** aparecer nas duas vistas — no grid, se divergir como qualquer
			    outra linha, e em *Item crítico* — cada uma contando o universo
			    inteiro por conta própria. O que a regra ainda proíbe é a duplicação
			    dentro da mesma vista. */}

			<div className="overflow-hidden rounded-md border border-line bg-white">
				<h3 id="divergencias" className="sr-only">
					Itens divergentes, na ordem do relatório
				</h3>
				<Tabela linhas={divergencias} rotuladaPor="divergencias" />
			</div>
		</div>
	);
}
