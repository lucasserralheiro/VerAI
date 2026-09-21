"use client";

import type { DivergenciaDeFonte as Divergencia } from "../lib/types";

const COLUNAS_BASE = ["Código", "Descrição", "Unidade"];

/** ESPEC 023 `R-FON-03` — o rótulo da coluna do contrato **varia com o estado**.
 *
 *  Chamar de *"contrato"* o número pré-aditivo era o defeito que a §2.4 da espec
 *  aponta: o leitor não tinha como saber qual dos dois estava vendo. Um rótulo
 *  neutro que servisse aos dois teria de ser vago, e a vagueza é o problema.
 */
function rotuloDoContrato(comAditivo: boolean) {
	return comAditivo ? "Contratado vigente" : "Na proposta";
}

/** `R-FON-05` — o valor absoluto vem **antes** do percentual, e os dois ficam
 *  visíveis.
 *
 *  O `+1%` do `10.050.00001.00` é pequeno em proporção e são 554 horas; o
 *  percentual sozinho o faria parecer irrelevante, e o absoluto sozinho não
 *  distinguiria o `+550%` do `+48%`. */
function Diferenca({ divergencia }: { divergencia: Divergencia }) {
	const critico = divergencia.severidade === "CRITICO";
	return (
		<td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">
			<span className={`font-semibold ${critico ? "text-confere-severidade-critico" : "text-confere-severidade-maior"}`}>
				{divergencia.diferenca}
			</span>
			{divergencia.variacao_pct !== null && (
				<span className="ml-2 text-xs text-confere-navy-300">
					{divergencia.variacao_pct > 0 ? "+" : ""}
					{Math.round(divergencia.variacao_pct)}%
				</span>
			)}
		</td>
	);
}

function Linha({ divergencia }: { divergencia: Divergencia }) {
	return (
		<tr className="border-b border-confere-line last:border-0">
			<td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-confere-navy-600">
				{divergencia.codigo}
			</td>
			<td className="px-3 py-1.5 text-confere-navy-800">
				{divergencia.descricao}
				{/* `R-FON-04` / `D-07` — a decomposição é o que prova que a soma foi
				    feita. Sem ela, o contratado vigente é um número que o leitor tem
				    de aceitar. Só aparece onde houve delta. */}
				{divergencia.na_proposta !== null && divergencia.no_aditivo !== null && (
					<div className="pt-0.5 font-mono text-[11px] text-confere-navy-300">
						proposta {divergencia.na_proposta} + aditivo {divergencia.no_aditivo}
					</div>
				)}
			</td>
			<td className="whitespace-nowrap px-3 py-1.5 text-xs text-confere-navy-300">
				{divergencia.unidade}
			</td>
			<td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-confere-navy-800">
				{divergencia.no_contrato}
			</td>
			<td className="whitespace-nowrap px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-confere-navy-800">
				{divergencia.na_planilha}
			</td>
			<Diferenca divergencia={divergencia} />
		</tr>
	);
}

function Cabecalho({ comAditivo }: { comAditivo: boolean }) {
	const colunas = [
		...COLUNAS_BASE,
		rotuloDoContrato(comAditivo),
		"Na planilha",
		comAditivo ? "Diferença" : "Falta no contrato",
	];
	return (
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
	);
}

interface Props {
	divergencias: Divergencia[];
	/** `R-FON-07` — destino do foco da ação. Vem de `page.tsx`, que é quem tem a
	 *  referência ao campo do formulário. */
	/** Ausente quando não há formulário para voltar — é o caso da tela de
	 *  histórico, que reabre um resultado já gerado. Sem ele o botão não é
	 *  renderizado: oferecer "anexar e gerar de novo" onde não há o que
	 *  anexar prometeria uma ação que não existe. */
	onAnexarAditivo?: () => void;
}

/** ESPEC 023 — a divergência de contratado, em dois estados.
 *
 *  Substitui as frases âmbar da `V-REC-01`. A mensagem antiga estava correta e
 *  descrevia o **mecanismo** — *"diverge entre as fontes"* —, porque antes da
 *  ESPEC 022 não havia diagnóstico a dar: o lado do contrato era a proposta sem
 *  os aditivos, e a divergência era ambígua por construção.
 *
 *  Com os deltas somados, o mesmo achado carrega dois diagnósticos opostos, e é
 *  isso que esta tela separa (`R-FON-02`):
 *
 *  * **sem aditivo tocando o código** — provavelmente falta uma peça, e o
 *    sistema sabe exatamente quanto falta. A ação é anexá-la;
 *  * **com aditivo aplicado** — os números não fecham nem com a peça. Falta
 *    outra, ou um dos documentos está errado. É o mais próximo de *dado errado*
 *    que o sistema detecta.
 *
 *  `R-FON-11` — sem divergência, sem seção. O caso normal, com o aditivo
 *  anexado, é não haver nada aqui, e uma seção permanente treina a pessoa a
 *  ignorá-la.
 */
export function DivergenciaDeFonte({ divergencias, onAnexarAditivo }: Props) {
	if (divergencias.length === 0) return null;

	// A severidade é do domínio (`D-01`): reconstituí-la aqui exigiria conhecer
	// os blocos das peças submetidas, que a tela não tem e não deve ter.
	const comAditivo = divergencias.some((d) => d.tem_aditivo_aplicado);
	const critico = divergencias.some((d) => d.severidade === "CRITICO");

	const titulo = comAditivo
		? `Mesmo com o aditivo, ${divergencias.length} ${divergencias.length === 1 ? "item não fecha" : "itens não fecham"}`
		: "Pode faltar um aditivo de contrato";

	return (
		<section className="mt-6" aria-labelledby="titulo-divergencia">
			{/* `R-ACE-02` — a cor é redundância. Quem carrega a gravidade é o título,
			    a frase e o sinal da diferença; a tarja só reforça. O eixo é o da
			    ESPEC 009, sem cor nova (`D-02`). */}
			<div
				className={`rounded-t-md border border-b-0 p-4 ${
					critico
						? "border-confere-severidade-critico/30 bg-confere-severidade-critico-fundo"
						: "border-confere-severidade-maior/30 bg-confere-severidade-maior-fundo"
				}`}
			>
				<h2
					id="titulo-divergencia"
					className={`text-lg font-semibold ${critico ? "text-confere-severidade-critico" : "text-confere-severidade-maior"}`}
				>
					{titulo}
				</h2>

				{/* `R-FON-08` — o que aconteceu e o que fazer, sem sigla de validação e
				    sem vocabulário do sistema. */}
				<p className="mt-1 max-w-3xl text-sm text-confere-navy-800">
					{comAditivo ? (
						<>
							O contratado abaixo <strong className="font-semibold">já considera</strong> a
							proposta e o aditivo enviado. Ainda assim a planilha declara outro número —
							falta uma peça anterior, ou um dos dois documentos está errado.{" "}
							<strong className="font-semibold">Confira antes de encaminhar.</strong>
						</>
					) : (
						<>
							Em {divergencias.length} {divergencias.length === 1 ? "item" : "itens"} a
							planilha declara quantidade contratada diferente da que consta na proposta. Se
							houve aditivo alterando esses itens, anexe-o: as quantidades passam a ser
							somadas e a conferência volta a ser feita item a item.
						</>
					)}
				</p>

				{/* `R-FON-07` / `D-05` — devolve o **foco** ao campo, e não reenvia: a
				    aplicação é sem estado e não guarda os arquivos entre duas chamadas.
				    O rótulo diz as duas etapas justamente por isso.

				    Só no estado A — no B o aditivo já está anexado. */}
				{!comAditivo && onAnexarAditivo && (
					<button
						type="button"
						onClick={onAnexarAditivo}
						className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-confere-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-confere-teal-600"
					>
						Anexar aditivo e gerar de novo →
					</button>
				)}
			</div>

			{/* `R-ACE-05` — o contêiner rola e é focável. A tabela transborda a 390 px,
			    e sem foco as colunas da direita — justamente as quantidades e a
			    diferença — ficam inalcançáveis para quem não usa mouse. */}
			<div className="overflow-hidden rounded-b-md border border-confere-line bg-white">
				<div
					className="overflow-x-auto"
					tabIndex={0}
					role="region"
					aria-labelledby="titulo-divergencia"
				>
					<table className="w-full min-w-[52rem] text-sm" aria-labelledby="titulo-divergencia">
						<thead>
							<Cabecalho comAditivo={comAditivo} />
						</thead>
						<tbody>
							{divergencias.map((divergencia) => (
								<Linha key={divergencia.codigo} divergencia={divergencia} />
							))}
						</tbody>
					</table>
				</div>

				<p className="border-t border-confere-line px-4 py-3 text-xs text-confere-navy-300">
					{comAditivo ? (
						/* `R-FON-12` / `D-07` — o silêncio precisa ser dito. Sem esta frase,
						   uma tabela de uma linha parece relatório incompleto: o leitor não
						   tem como saber que os outros foram conferidos e **fecharam**. */
						<>
							Os demais itens do aditivo <strong className="font-semibold">fecharam</strong> e
							por isso não aparecem aqui.
						</>
					) : (
						<>
							A coluna <strong className="font-semibold">Falta no contrato</strong> é a
							diferença exata que um aditivo traria — procure por esses valores nos blocos de
							aumento e redução da peça. O relatório foi gerado com as quantidades da
							planilha.
						</>
					)}
				</p>
			</div>
		</section>
	);
}
