"use client";

import type { LinhaDerivada } from "@/lib/types";

const COLUNAS = [
	"Linha",
	"Código",
	"Descrição",
	"Quantidade Contratada",
	"Quantidade Medida",
	"Saiu no relatório",
];

/** As duas colunas de célula crua saem em fonte monoespaçada.
 *
 *  É o que faz `-` e `PACOTE` lerem como **conteúdo de célula** e não como
 *  falha de renderização — o `-` do `14.046.00003.00` é um traço que alguém
 *  digitou na planilha, e a leitura natural de quem não sabe disso é "quebrou".
 *
 *  A distinção não depende só da fonte (`R-ACE-02`): o cabeçalho nomeia a
 *  coluna e a frase acima da tabela explica o que aconteceu.
 */
function Celula({ texto }: { texto: string }) {
	return (
		<td className="whitespace-nowrap px-3 py-1.5 text-center font-mono text-xs text-navy-800">
			{texto}
		</td>
	);
}

function Linhas({ linhas }: { linhas: LinhaDerivada[] }) {
	return (
		<>
			{linhas.map((linha) => (
				<tr key={`${linha.linha}-${linha.codigo}`} className="border-b border-line last:border-0">
					<td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-navy-300">
						{linha.linha}
					</td>
					<td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-navy-600">
						{linha.codigo}
					</td>
					<td className="px-3 py-1.5 text-navy-800">{linha.descricao}</td>
					<Celula texto={linha.contratada} />
					<Celula texto={linha.medida} />
					{/* `D-06` — vem pronto do backend. Montar `1 / 1` aqui repetiria a
					    `R-REL-08` numa segunda linguagem, e a tela passaria a mentir no
					    dia em que a regra mudasse. */}
					<td className="whitespace-nowrap bg-amber-50 px-3 py-1.5 text-center font-semibold tabular-nums text-navy-800">
						{linha.saiu}
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
					className={`px-3 py-1.5 ${indice === 0 ? "text-right" : indice >= 3 ? "text-center" : "text-left"}`}
				>
					{coluna}
				</th>
			))}
		</tr>
	);
}

/** ESPEC 021 — as linhas cuja célula de medida não trouxe número.
 *
 *  Substitui as frases amarelas do `V-REC-02`. Aquela mensagem estava correta e
 *  foi escrita para quem conhece o sistema: dizia o código e o conteúdo da
 *  célula, e não dizia **qual** célula, em que linha, ao lado de quê.
 *
 *  A tabela mostra o que a planilha trazia ao lado do que o sistema emitiu, para
 *  que a dedução fique exposta ao julgamento de quem confere. É o que faz
 *  aparecer, pela primeira vez no produto, o `14.048.00008.00` do piloto —
 *  contratado no perfil `D` e medido no `C` — que a ESPEC 001 §9.3 declarou
 *  como perda de informação aceita e que nunca esteve na tela.
 *
 *  `R-PER-10` — sem linha derivada, sem tabela. O caso normal é não haver nada
 *  a mostrar, e uma seção permanente treina a pessoa a ignorá-la.
 */
export function LinhasDerivadas({ linhas }: { linhas: LinhaDerivada[] }) {
	if (linhas.length === 0) return null;

	return (
		<section className="mt-6" aria-labelledby="titulo-derivadas">
			<h2 id="titulo-derivadas" className="text-lg font-semibold text-navy-600">
				Linhas que saíram como perfil ou pacote
			</h2>

			{/* `R-PER-07` — o que aconteceu e o que fazer, sem sigla de validação e
			    sem o vocabulário do sistema. Quem lê isto vai abrir a planilha em
			    seguida, e o número da linha é o endereço.

			    **Não pode conter a cadeia "relatório gerado"**: `getByText` casa por
			    substring, e sete suítes esperam esse texto (ESPEC 015 §14.4). */}
			<p className="mt-1 max-w-3xl text-sm text-navy-300">
				Nestas linhas a planilha não trouxe um número na coluna{" "}
				<strong className="font-semibold text-navy-600">Quantidade Medida</strong>. O sistema
				entendeu que são itens de perfil ou pacote e lançou 1 contratado e 1 medido.{" "}
				<strong className="font-semibold text-amber-800">
					Confira as células indicadas na aba Levantamento antes de encaminhar.
				</strong>
			</p>

			{/* `R-ACE-05` — o contêiner rola e é focável. A tabela transborda a 390 px,
			    e sem foco as colunas da direita — justamente as duas quantidades —
			    ficam inalcançáveis para quem não usa mouse. */}
			<div className="mt-3 overflow-hidden rounded-md border border-line bg-white">
				<div
					className="overflow-x-auto"
					tabIndex={0}
					role="region"
					aria-labelledby="titulo-derivadas"
				>
					<table className="w-full min-w-[52rem] text-sm" aria-labelledby="titulo-derivadas">
						<thead>
							<Cabecalho />
						</thead>
						<tbody>
							<Linhas linhas={linhas} />
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}
