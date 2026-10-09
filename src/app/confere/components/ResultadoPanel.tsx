"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DivergenciaDeFonte } from "./DivergenciaDeFonte";
import { type FonteDoContrato, ItemNoContratoProvider } from "./ItemNoContrato";
import { ItensParaConferir } from "./ItensParaConferir";
import { JanelaDaSecao } from "./JanelaDaSecao";
import { SituacaoModal } from "./SituacaoModal";
import { LinhasDerivadas } from "./LinhasDerivadas";
import type { Achado, Classificacao, Estado, LinhaDoGrid, RespostaRelatorio } from "../lib/types";

/** `R-ACE-19` — o nome fixo fazia doze competências virarem `(1)`…`(11)` na
 *  pasta de Downloads. `dd/mm/aaaa` vira `aaaa-mm`, que ordena sozinho.
 *
 *  A referência do contrato é higienizada porque vai para nome de arquivo. */
function nomeDoArquivo(relatorio: RespostaRelatorio, tipo: "docx" | "xlsx"): string {
	const referencia = relatorio.contrato_referencia
		.replace(/[^\w-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const periodo = relatorio.data_levantamento?.split("/").slice(1).reverse().join("-");
	// Os dois documentos da mesma competência caem na mesma pasta de Downloads.
	// `analise` no nome é o que os distingue sem depender da extensão.
	const prefixo = tipo === "docx" ? "confere" : "confere-analise";
	return `${[prefixo, referencia, periodo].filter(Boolean).join("-")}.${tipo}`;
}

/** Todos os itens do relatório: os que divergem e os que conferem. O Confere não
 *  manda a lista pronta, então ela é montada das quatro situações da análise. */
function todosOsItens(relatorio: RespostaRelatorio): LinhaDoGrid[] {
	const conferem =
		relatorio.analise.situacoes.find((s) => s.classificacao === "SEM_DIVERGENCIA")?.linhas ?? [];
	return [...relatorio.divergencias, ...conferem];
}

/** A frase que diz o que fazer **agora**. Sem ela o usuário recebia números e
 *  tinha de deduzir por onde começar — o "estou perdido" da tela anterior. */
function orientacao(relatorio: RespostaRelatorio): string {
	const quantidade = (classificacao: string) =>
		relatorio.analise.situacoes.find((s) => s.classificacao === classificacao)?.quantidade ?? 0;
	const criticos = quantidade("CRITICO");

	if (criticos > 0) {
		return criticos === 1
			? "Há 1 item crítico. Comece por ele."
			: `Há ${criticos} itens críticos. Comece por eles.`;
	}
	if (relatorio.total_divergencias > 0) {
		return "Confira os itens divergentes abaixo antes de encaminhar.";
	}
	return "A quantidade medida é igual à contratada em todos os itens.";
}

/** ESPEC 025 `D-05` — **um cartão por peça, não por validação.**
 *
 *  A unidade da tela deixou de ser a validação. Três achados para uma causa —
 *  `V-ADT-01`, `V-CTR-01` e `V-CAP-01` sobre o mesmo PDF — treinavam o olho a
 *  pular o bloco, e nenhum deles dizia qual arquivo trocar.
 *
 *  Achado sem as partes novas cai no caminho de sempre (`T-1932`): onze
 *  validações ainda mandam só `mensagem`, e sumir com elas seria uma regressão
 *  que nenhum teste de backend pegaria.
 */
function CartaoDeAchado({ achado, tom }: { achado: Achado; tom: "bloqueio" | "aviso" }) {
	const estilos =
		tom === "bloqueio"
			? "border-red-200 bg-red-50 text-red-900"
			: "border-amber-200 bg-amber-50 text-amber-900";

	// O Confere manda só a frase curta, sem dizer de qual PDF nem o que fazer. A
	// explicação mora aqui, no VerAI: não toca no que o Confere recebe nem devolve.
	if (!achado.titulo && achado.validacao === "V-CTR-03" && achado.mensagem.includes("não localizado")) {
		return (
			<li className={`rounded-md border p-4 text-sm ${estilos}`}>
				<p className="font-semibold">Não encontramos o total de um dos PDFs</p>
				<p className="mt-2">
					O Confere confere cada PDF somando os itens da tabela e comparando com o total que o próprio
					documento declara. Esse total não foi localizado, então não dá para garantir que nenhum item
					ficou de fora — e por isso o relatório não é gerado.
				</p>
				<p className="mt-3 font-medium">O que fazer, nesta ordem:</p>
				<ol className="mt-1 list-decimal space-y-1 pl-5">
					<li>
						Veja se o contrato escolhido é o vigente na competência (abra &ldquo;Como os documentos
						foram escolhidos&rdquo;). Se houver renovação mais recente, troque em &ldquo;Procurar nas
						pastas do cliente&rdquo;. Contrato inicial com aditivo posterior costuma indicar que falta
						uma peça no meio.
					</li>
					<li>
						Para descobrir qual PDF é o problema, gere sem o aditivo. Se o bloqueio sumir, é o PDF do
						aditivo; se continuar, é o do contrato.
					</li>
					<li>
						Abra o PDF e veja se a tabela termina com uma linha de total. Se o total estiver fora da
						tabela, em imagem ou com outro formato, envie o arquivo ao suporte do Confere (PRODAM): o
						ajuste é na leitura.
					</li>
				</ol>
				<details className="mt-3">
					<summary className="cursor-pointer text-xs opacity-80">
						Detalhes técnicos (para o suporte) · {achado.validacao}
					</summary>
					<p className="mt-1 select-all font-mono text-xs opacity-90">{achado.mensagem}</p>
				</details>
			</li>
		);
	}

	if (!achado.titulo) {
		return (
			<li className={`rounded-md border p-4 text-sm ${estilos}`}>
				<span className="font-mono text-xs font-semibold">{achado.validacao}</span>{" "}
				{achado.mensagem}
			</li>
		);
	}

	return (
		<li className={`rounded-md border p-4 text-sm ${estilos}`}>
			<p className="font-semibold">{achado.titulo}</p>
			{achado.causa && <p className="mt-2">{achado.causa}</p>}
			{achado.acao && <p className="mt-2 font-medium">{achado.acao}</p>}
			{achado.detalhe && (
				// O colchete de diagnóstico que ficava no meio da frase. Não se
				// perde: muda de altura. `<details>` fechado é o que deixa a
				// informação disponível ao suporte sem custar a leitura de quem
				// confere (`R-GRD-07`, com outro destino).
				<details className="mt-3">
					<summary className="cursor-pointer text-xs opacity-80">
						Detalhes técnicos (para o suporte) · {achado.validacao}
					</summary>
					<p className="mt-1 select-all font-mono text-xs opacity-90">
						{achado.detalhe}
					</p>
				</details>
			)}
		</li>
	);
}

/** ESPEC 027 `R-LEV-08` — vários achados de `V-CTR-05`, num cartão só.
 *
 *  O modelo continua sendo **um achado por código**: é o `codigo` que o grid
 *  consome (`R-LEV-08`), e agregar aqui não o toca. Singular não passa por
 *  aqui — com um só, o `ListaDeAchados` deixa o `CartaoDeAchado` de sempre
 *  cuidar dele, que já lê `mensagem`.
 */
function CartaoAgregado({ achados, tom }: { achados: Achado[]; tom: "bloqueio" | "aviso" }) {
	const estilos =
		tom === "bloqueio"
			? "border-red-200 bg-red-50 text-red-900"
			: "border-amber-200 bg-amber-50 text-amber-900";

	const codigos = achados.map((achado) => achado.codigo).filter((c): c is string => c !== null);

	return (
		<li className={`rounded-md border p-4 text-sm ${estilos}`}>
			<p className="font-semibold">
				{achados.length} itens do contrato não estão na planilha de levantamento
			</p>
			<p className="mt-2">
				Ficam fora do relatório. Se algum deles deveria ter sido medido, confira se a planilha é da
				competência certa.
			</p>
			<p className="mt-3 flex flex-wrap gap-2">
				{codigos.map((codigo) => (
					<span
						key={codigo}
						className="select-all rounded border border-amber-200 bg-white/70 px-2 py-0.5 font-mono text-[13px]"
					>
						{codigo}
					</span>
				))}
			</p>
		</li>
	);
}

/** ESPEC 027 `D-05` — agrupa por `validacao`, preservando a posição da
 *  primeira ocorrência de cada uma. Não é ordenação: `V-CTR-05` aparece onde
 *  o primeiro achado dela apareceria, e as demais validações não se movem
 *  entre si. */
function agruparPorValidacao(achados: Achado[]): Achado[][] {
	const ordem: string[] = [];
	const grupos = new Map<string, Achado[]>();
	for (const achado of achados) {
		const lista = grupos.get(achado.validacao);
		if (lista) {
			lista.push(achado);
		} else {
			ordem.push(achado.validacao);
			grupos.set(achado.validacao, [achado]);
		}
	}
	return ordem.map((validacao) => grupos.get(validacao) as Achado[]);
}

function ListaDeAchados({ achados, tom }: { achados: Achado[]; tom: "bloqueio" | "aviso" }) {
	if (achados.length === 0) return null;

	return (
		<ul className="space-y-3">
			{agruparPorValidacao(achados).flatMap((grupo) => {
				// A agregação é só para `V-CTR-05`: generalizá-la aplicaria o texto
				// de "códigos do contrato" a achados de outra origem (`R-LEV-08`).
				if (grupo.length > 1 && grupo[0].validacao === "V-CTR-05") {
					return [<CartaoAgregado key={grupo[0].validacao} achados={grupo} tom={tom} />];
				}
				return grupo.map((achado, indice) => (
					<CartaoDeAchado
						key={`${achado.validacao}-${achado.codigo}-${indice}`}
						achado={achado}
						tom={tom}
					/>
				));
			})}
		</ul>
	);
}

/** Avisos que não pedem nada de quem confere: dizem o que o sistema decidiu ou
 *  verificou sozinho. Ficam recolhidos — sete cartões do mesmo peso escondiam os
 *  dois que pedem conferência. */
const AVISOS_INFORMATIVOS = new Set(["V-CTR-08", "V-CAP-01"]);

function ehInformativo(achado: Achado): boolean {
	return (
		AVISOS_INFORMATIVOS.has(achado.validacao) ||
		(achado.acao ?? "").toLowerCase().startsWith("não é preciso fazer nada")
	);
}

/** `V-CTR-07` manda uma frase por item: `O item 14.049.00039.00 (página 4) tem o
 *  período escrito como texto: "2 meses e 16 dias".` Vira uma linha de tabela. */
function lerPeriodoEmTexto(achado: Achado): { codigo: string; pagina: string; texto: string } | null {
	const partes = /^O item (\S+) \(página (\d+)\) tem o período escrito como texto: "(.*)"\.?$/.exec(
		achado.causa ?? "",
	);
	return partes ? { codigo: partes[1], pagina: partes[2], texto: partes[3] } : null;
}

function CartaoDePeriodos({ achados }: { achados: Achado[] }) {
	const linhas = achados.map((achado) => ({ achado, leitura: lerPeriodoEmTexto(achado) }));
	return (
		<li className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<p className="font-semibold">
				{achados.length === 1
					? "1 item com período escrito por extenso no contrato"
					: `${achados.length} itens com período escrito por extenso no contrato`}
			</p>
			<p className="mt-2">
				O relatório precisa do período em meses. Confira se a conversão feita para estas linhas está certa.
			</p>
			<table className="mt-3 w-full max-w-2xl bg-white/60 text-left">
				<thead>
					<tr className="text-xs font-semibold uppercase tracking-wide">
						<th scope="col" className="px-3 py-1.5">Código</th>
						<th scope="col" className="px-3 py-1.5">Página</th>
						<th scope="col" className="px-3 py-1.5">No contrato</th>
					</tr>
				</thead>
				<tbody>
					{linhas.map(({ achado, leitura }, indice) => (
						<tr key={`${achado.codigo}-${indice}`} className="border-t border-amber-200">
							<td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px]">
								{leitura?.codigo ?? achado.codigo ?? "—"}
							</td>
							<td className="px-3 py-1.5 tabular-nums">{leitura?.pagina ?? "—"}</td>
							<td className="px-3 py-1.5">{leitura ? `“${leitura.texto}”` : achado.causa}</td>
						</tr>
					))}
				</tbody>
			</table>
		</li>
	);
}

/** Uma frase por aviso informativo. `V-CTR-08` repete por página: junta as
 *  páginas numa frase só. */
function frasesInformativas(achados: Achado[]): string[] {
	const frases: string[] = [];
	const ordem = achados.filter((a) => a.validacao === "V-CTR-08");
	if (ordem.length > 0) {
		const paginas = ordem
			.map((a) => /página (\d+)/.exec(a.causa ?? "")?.[1])
			.filter((p): p is string => !!p);
		frases.push(
			paginas.length > 0
				? `A tabela de itens tem colunas numa ordem diferente da habitual (a partir das páginas ${paginas.join(", ")}). A extração foi conferida pela soma dos totais.`
				: "A tabela de itens tem colunas numa ordem diferente da habitual. A extração foi conferida pela soma dos totais.",
		);
	}
	for (const achado of achados) {
		if (achado.validacao === "V-CTR-08") continue;
		if (achado.validacao === "V-CAP-01") {
			frases.push(
				"O nome do órgão não foi identificado na proposta. A capa do relatório usa o nome do título da planilha de levantamento.",
			);
			continue;
		}
		frases.push([achado.titulo, achado.acao].filter(Boolean).join(" ") || achado.mensagem);
	}
	return frases;
}

/** Os avisos do relatório já gerado, separados pelo que pedem de quem confere:
 *  primeiro o que **precisa de olho**, e recolhido o que é só informação.
 *
 *  Antes eram sete cartões iguais, cada um com título, causa e ação, e os dois
 *  que importavam (o período em texto) se perdiam entre os que diziam "não é
 *  preciso fazer nada". */
function AvisosDoRelatorio({ avisos }: { avisos: Achado[] }) {
	const informativos = avisos.filter(ehInformativo);
	const paraConferir = avisos.filter((achado) => !ehInformativo(achado));
	const periodos = paraConferir.filter((a) => a.validacao === "V-CTR-07");
	const demais = paraConferir.filter((a) => a.validacao !== "V-CTR-07");
	const pontos = pontosParaConferir(avisos);

	// Só avisos informativos ("não precisa fazer nada"): não há o que conferir, então
	// o bloco não aparece. Aviso que não pede nada só atrapalhava a leitura.
	if (pontos === 0) return null;

	return (
		<section id="avisos" className="mt-8 scroll-mt-4" aria-labelledby="titulo-avisos">
			<h2 id="titulo-avisos" className="mb-3 text-lg font-semibold text-confere-navy-800">
				{pontos === 1 ? "Confira 1 ponto antes de faturar" : `Confira ${pontos} pontos antes de faturar`}
			</h2>
			{/* Sem subtítulo: o cartão "Relatório gerado", logo acima, já diz que está pronto. */}

			{pontos > 0 && (
				<ul className="space-y-3">
					{periodos.length > 0 && <CartaoDePeriodos achados={periodos} />}
					{agruparPorValidacao(demais).flatMap((grupo) =>
						grupo.length > 1 && grupo[0].validacao === "V-CTR-05"
							? [<CartaoAgregado key={grupo[0].validacao} achados={grupo} tom="aviso" />]
							: grupo.map((achado, indice) => (
									<CartaoDeAchado
										key={`${achado.validacao}-${achado.codigo}-${indice}`}
										achado={achado}
										tom="aviso"
									/>
								)),
					)}
				</ul>
			)}

			{informativos.length > 0 && (
				<details className="mt-3 rounded-md border border-confere-line bg-white p-4 text-sm text-confere-navy-800">
					<summary className="cursor-pointer font-semibold text-confere-navy-600">
						{informativos.length === 1
							? "1 aviso informativo — sem ação necessária"
							: `${informativos.length} avisos informativos — sem ação necessária`}
					</summary>
					<ul className="mt-3 list-disc space-y-2 pl-5">
						{frasesInformativas(informativos).map((frase) => (
							<li key={frase}>{frase}</li>
						))}
					</ul>
				</details>
			)}
		</section>
	);
}

/** Quantos pontos o bloco de avisos pede de quem confere: os períodos em texto
 *  contam como um cartão só, e cada validação restante como outro. É a mesma conta
 *  do título de `AvisosDoRelatorio`, que passa a usar esta função. */
function pontosParaConferir(avisos: Achado[]): number {
	const paraConferir = avisos.filter((achado) => !ehInformativo(achado));
	const temPeriodos = paraConferir.some((a) => a.validacao === "V-CTR-07");
	const demais = paraConferir.filter((a) => a.validacao !== "V-CTR-07");
	return (temPeriodos ? 1 : 0) + agruparPorValidacao(demais).length;
}

/** A cor do número diz a gravidade; o rótulo ao lado é quem carrega o sentido. */
const COR_DO_NUMERO: Record<string, string> = {
	CRITICO: "text-confere-severidade-critico",
	MAIOR_RELEVANCIA: "text-confere-severidade-maior",
	DIVERGENTE: "text-confere-navy-800",
	SEM_DIVERGENCIA: "text-confere-brand-green-ink",
};

/** As seções do relatório que abrem em janela a partir do resumo. */
type Secao = "avisos" | "derivadas" | "divergencia" | "documentos";

interface Destino {
	secao: Secao;
	rotulo: string;
}

/** O topo do resultado, em três faixas que se leem de cima para baixo:
 *
 *  1. **o que aconteceu** — a frase, o que fazer agora e a contagem das quatro
 *     situações (o leitor sabe o que há lá embaixo sem abrir nada);
 *  2. **o que levar** — os dois downloads empilhados, cada um com a sua legenda
 *     embaixo, e o DOCX, que é o entregável, como o único botão cheio;
 *  3. **para onde ir** — contrato/proposta/competência e os atalhos para as
 *     seções que de fato existem neste relatório.
 *
 */
function ResumoDoRelatorio({
	relatorio,
	urlDocx,
	urlAnalise,
	titulo,
	semIdentificacao,
	onAbrirSecao,
	comDocumentos,
}: {
	relatorio: RespostaRelatorio;
	urlDocx: string;
	urlAnalise: string;
	titulo: React.RefObject<HTMLHeadingElement | null>;
	semIdentificacao?: boolean;
	onAbrirSecao: (secao: Secao) => void;
	comDocumentos: boolean;
}) {
	const situacoes = relatorio.analise.situacoes;
	const [aberta, setAberta] = useState<Classificacao | null>(null);
	const pontos = pontosParaConferir(relatorio.avisos);
	const derivadas = relatorio.linhas_derivadas.length;
	const destinos = [
		pontos > 0 && {
			secao: "avisos" as const,
			rotulo: `Pontos a conferir (${pontos})`,
		},
		derivadas > 0 && {
			secao: "derivadas" as const,
			rotulo: derivadas === 1 ? "1 linha de perfil ou pacote" : `${derivadas} linhas de perfil ou pacote`,
		},
		relatorio.divergencias_de_fonte.length > 0 && {
			secao: "divergencia" as const,
			rotulo: "Divergência de contratado",
		},
		// Só na tela de geração: é lá que estão os documentos usados.
		comDocumentos && { secao: "documentos" as const, rotulo: "Documentos usados" },
	].filter((destino): destino is Destino => destino !== false);

	const botao = "block rounded-md px-5 py-2.5 text-center text-sm font-semibold transition";

	return (
		<div className="rounded-md border border-confere-line bg-white">
			<div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="min-w-0">
<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2
						ref={titulo}
						tabIndex={-1}
						className="text-sm font-semibold text-confere-navy-600 outline-none"
					>
						Relatório gerado
					</h2>
						{!semIdentificacao && (
							<p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-confere-navy-600">
								<span>
									Contrato{" "}
									<span className="font-mono font-semibold text-confere-brand-navy">
										{relatorio.contrato_referencia}
									</span>
								</span>
								{relatorio.analise.proposta_origem && (
									<span>
										Proposta{" "}
										<span className="font-mono font-semibold text-confere-brand-navy">
											{relatorio.analise.proposta_origem}
										</span>
									</span>
								)}
								<span>
									Competência{" "}
									<span className="font-semibold text-confere-brand-navy">{relatorio.analise.competencia}</span>
								</span>
							</p>
						)}
					</div>
					<p className="mt-1 text-2xl font-semibold text-confere-navy-800">
						<span className="tabular-nums">{relatorio.total_divergencias}</span> de{" "}
						<span className="tabular-nums">{relatorio.total_linhas}</span> itens com divergência
					</p>
					<p className="mt-1 text-base text-confere-navy-800">{orientacao(relatorio)}</p>

					<ul
						aria-label="Itens por situação"
						className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-confere-line bg-confere-line sm:grid-cols-4"
					>
						{situacoes.map((situacao) => (
							<li key={situacao.classificacao} className="bg-white">
								{/* Cada número abre os itens daquela situação num modal. */}
								<button
									type="button"
									disabled={situacao.quantidade === 0}
									onClick={() => setAberta(situacao.classificacao)}
									className="group block h-full w-full px-4 py-3 text-left transition enabled:hover:bg-confere-navy-50 disabled:cursor-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-confere-teal-500"
								>
									<span
										className={`block text-2xl font-semibold tabular-nums ${
											situacao.quantidade === 0
												? "text-confere-navy-600"
												: (COR_DO_NUMERO[situacao.classificacao] ?? "text-confere-navy-800")
										}`}
									>
										{situacao.quantidade}
									</span>
									<span className="block text-sm text-confere-navy-600">{situacao.rotulo}</span>
									{situacao.quantidade > 0 && (
										<span className="mt-1 block text-sm font-semibold text-confere-teal-600 group-hover:underline">
											Ver {situacao.quantidade === 1 ? "o item" : "os itens"} →
										</span>
									)}
								</button>
							</li>
						))}
					</ul>
				</div>

				{/* O `.docx` é o entregável formal; a análise é papel de trabalho.
					A legenda fica colada em cada botão: lida à parte, uma frase só
					para os dois obrigava a ligar "DOCX" e "XLSX" de cabeça. */}
				<div className="lg:border-l lg:border-confere-line lg:pl-6">
					<p className="text-sm font-semibold text-confere-navy-600">Baixar</p>
					<a
						href={urlDocx}
						download={nomeDoArquivo(relatorio, "docx")}
						className={`${botao} mt-2 bg-confere-brand-navy text-white hover:opacity-90`}
					>
						Baixar DOCX
					</a>
					<p className="mt-1.5 text-sm text-confere-navy-600">Documento para encaminhar.</p>
					<a
						href={urlAnalise}
						download={nomeDoArquivo(relatorio, "xlsx")}
						className={`${botao} mt-4 bg-[#1D6F42] text-white hover:bg-[#185c37]`}
					>
						Baixar análise (XLSX)
					</a>
					<p className="mt-1.5 text-sm text-confere-navy-600">
						Planilha de apoio, com a análise item a item.
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-confere-line bg-neutral-50 px-5 py-3 text-sm text-confere-navy-600">
				<nav aria-label="Seções deste relatório" className="flex flex-wrap items-center gap-2">
					<span className="mr-1">Abrir:</span>
					{destinos.map((destino) => (
						<button
							key={destino.secao}
							type="button"
							onClick={() => onAbrirSecao(destino.secao)}
							className={
								destino.secao === "avisos"
									? "inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 font-semibold text-amber-900 transition hover:bg-amber-100"
									: "rounded-md border border-confere-brand-navy bg-white px-3 py-1.5 font-semibold text-confere-brand-navy transition hover:bg-confere-navy-50"
							}
						>
							{destino.secao === "avisos" && <AlertTriangle className="size-4 shrink-0 text-amber-500" strokeWidth={2.25} aria-hidden />}
							{destino.rotulo}
						</button>
					))}
				</nav>
			</div>

			<SituacaoModal
				situacao={situacoes.find((s) => s.classificacao === aberta) ?? null}
				onFechar={() => setAberta(null)}
			/>
		</div>
	);
}

/** Separa visualmente o que bloqueia do que apenas avisa.
 *
 *  Havendo bloqueio não há download: gerar um relatório com número
 *  possivelmente errado seria pior que não gerar — ele instrui faturamento.
 */
interface Props {
	estado: Estado;
	/** ESPEC 023 `R-FON-07` — decidido em `page.tsx`, que tem a referência ao
	 *  campo do formulário. **Opcional**: a tela de histórico reabre um
	 *  resultado já gerado e não tem formulário para onde voltar. */
	onAnexarAditivo?: () => void;
	/** O histórico já leva contrato e competência no título da página; repeti-los
	 *  no cartão de resumo era a primeira repetição da tela. */
	semIdentificacao?: boolean;
	/** Os PDFs de entrada, para abrir o item no contrato ao clicar na linha. Ausente
	 *  no histórico: os arquivos de entrada não são guardados. */
	fontesDoContrato?: FonteDoContrato[];
	planilhaDoLevantamento?: FonteDoContrato;
	/** O formulário dos documentos usados, para abrir numa janela a partir do resumo.
	 *  Ausente no histórico. */
	documentosUsados?: React.ReactNode;
}

export function ResultadoPanel({ estado, onAnexarAditivo, semIdentificacao, fontesDoContrato, planilhaDoLevantamento, documentosUsados }: Props) {
	const titulo = useRef<HTMLHeadingElement>(null);

	// `R-ACE-15` — sem isto o foco fica no botão, ou se perde quando ele é
	// desabilitado, e quem não vê a tela não tem como saber que a espera acabou.
	// O alvo é título, não controle: nada é acionado, e o foco pousa no topo do
	// que acabou de surgir.
	useEffect(() => {
		if (estado.situacao === "pronto" || estado.situacao === "bloqueado") {
			titulo.current?.focus();
		}
	}, [estado.situacao]);

	// `R-ACE-13` — a região viva é montada **sempre**, desde o primeiro render,
	// mesmo vazia.
	//
	// Envolver o conteúdo por dentro do `return null` produziria marcação correta
	// e comportamento nulo: leitores anunciam a **mutação** de uma região já
	// presente na árvore, não a inserção de uma região nova. O sintoma seria
	// silêncio, e nada automatizado o detecta — daí o teste da T-416 verificar a
	// montagem no estado inicial, e não o atributo (ESPEC 008 D-03).
	return (
		<div aria-live="polite" aria-atomic="false">
			<Conteudo
				estado={estado}
				titulo={titulo}
				onAnexarAditivo={onAnexarAditivo}
				semIdentificacao={semIdentificacao}
				fontesDoContrato={fontesDoContrato}
				planilhaDoLevantamento={planilhaDoLevantamento}
				documentosUsados={documentosUsados}
			/>
		</div>
	);
}

function Conteudo({
	estado,
	titulo,
	onAnexarAditivo,
	semIdentificacao,
	fontesDoContrato,
	planilhaDoLevantamento,
	documentosUsados,
}: {
	estado: Estado;
	titulo: React.RefObject<HTMLHeadingElement | null>;
	onAnexarAditivo?: () => void;
	semIdentificacao?: boolean;
	fontesDoContrato?: FonteDoContrato[];
	planilhaDoLevantamento?: FonteDoContrato;
	documentosUsados?: React.ReactNode;
}) {
	if (estado.situacao === "inicial") return null;

	if (estado.situacao === "processando") {
		// O aviso visível fica no formulário, junto do botão (`R-ACE-16`). Aqui só
		// o que o leitor de tela precisa ouvir para não confundir espera com
		// travamento — a geração pode passar de um minuto.
		return <p className="sr-only">Processando o relatório. Pode levar até um minuto.</p>;
	}

	if (estado.situacao === "erro") {
		return (
			<section
				role="alert"
				className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
			>
				{estado.mensagem}
			</section>
		);
	}

	if (estado.situacao === "bloqueado") {
		return (
			<section role="alert" className="mt-6 space-y-4">
				{/* `text-lg` como o título do grid: o cabeçalho da situação mais grave
				    era o menor da tela (`R-ACE-12`). */}
				{/* ESPEC 025 §9.1 — *processamento* é vocabulário do sistema, e
				    *nenhum relatório foi gerado* repetia no título o que a tela
				    inteira já dizia. O subtítulo passa a contar quantos pontos há e
				    a mandar reenviar, que é o passo seguinte. */}
				<h2
					ref={titulo}
					tabIndex={-1}
					className="text-lg font-semibold text-confere-navy-600 outline-none"
				>
					Não foi possível gerar o relatório
				</h2>
				<p className="text-sm text-confere-navy-600">
					{estado.bloqueantes.length === 1
						? "Corrija o ponto abaixo e envie novamente."
						: `Corrija os ${estado.bloqueantes.length} pontos abaixo e envie novamente.`}
				</p>
				<ListaDeAchados achados={estado.bloqueantes} tom="bloqueio" />
				<ListaDeAchados achados={estado.avisos} tom="aviso" />
			</section>
		);
	}

	return (
		<RelatorioPronto
			estado={estado}
			titulo={titulo}
			onAnexarAditivo={onAnexarAditivo}
			semIdentificacao={semIdentificacao}
			fontesDoContrato={fontesDoContrato}
			planilhaDoLevantamento={planilhaDoLevantamento}
			documentosUsados={documentosUsados}
		/>
	);
}

/** O resultado pronto: o resumo na página e cada seção na sua janela. A página fica
 *  só com o que se faz de imediato (baixar, ver os números); o resto abre pelos
 *  botões "Abrir:". É um componente à parte porque guarda qual janela está aberta,
 *  e `Conteudo` tem retornos antecipados antes de qualquer hook. */
function RelatorioPronto({
	estado,
	titulo,
	onAnexarAditivo,
	semIdentificacao,
	fontesDoContrato,
	planilhaDoLevantamento,
	documentosUsados,
}: {
	estado: Extract<Estado, { situacao: "pronto" }>;
	titulo: React.RefObject<HTMLHeadingElement | null>;
	onAnexarAditivo?: () => void;
	semIdentificacao?: boolean;
	fontesDoContrato?: FonteDoContrato[];
	planilhaDoLevantamento?: FonteDoContrato;
	documentosUsados?: React.ReactNode;
}) {
	const [secao, setSecao] = useState<Secao | null>(null);
	const fechar = () => setSecao(null);
	const { relatorio } = estado;

	// "Anexar aditivo" (no aviso de divergência de contratado) leva ao campo de aditivos,
	// que mora na janela dos documentos: abre a janela e só então pede o foco.
	const anexarAditivo = onAnexarAditivo
		? () => {
				if (documentosUsados) {
					setSecao("documentos");
					setTimeout(onAnexarAditivo, 80);
				} else {
					onAnexarAditivo();
				}
			}
		: undefined;

	return (
		<ItemNoContratoProvider
			fontes={fontesDoContrato ?? []}
			planilha={planilhaDoLevantamento}
			zeradas={relatorio.linhas_zeradas}
		>
			<section className="mt-6">
				{relatorio.historico_salvo === false && (
					<p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
						<strong className="font-semibold">Este relatório não ficou salvo no histórico.</strong>{" "}
						Baixe o DOCX e a análise agora: depois de sair desta tela não há como recuperá-los.
					</p>
				)}
				<ResumoDoRelatorio
					relatorio={relatorio}
					urlDocx={estado.urlDocx}
					urlAnalise={estado.urlAnalise}
					titulo={titulo}
					semIdentificacao={semIdentificacao}
					onAbrirSecao={setSecao}
					comDocumentos={documentosUsados !== undefined}
				/>

				{/* A lista de itens é o trabalho da tela: fica na página. */}
				<ItensParaConferir
					analise={relatorio.analise}
					divergencias={relatorio.divergencias}
					demaisItens={relatorio.demais_itens}
					todosOsItens={todosOsItens(relatorio)}
				/>

				{/* As demais seções abrem em janela, uma de cada vez. */}
				{relatorio.avisos.length > 0 && (
					<JanelaDaSecao aberto={secao === "avisos"} onFechar={fechar}>
						<AvisosDoRelatorio avisos={relatorio.avisos} />
					</JanelaDaSecao>
				)}

				<JanelaDaSecao aberto={secao === "derivadas"} onFechar={fechar}>
					<LinhasDerivadas linhas={relatorio.linhas_derivadas} />
				</JanelaDaSecao>

				<JanelaDaSecao aberto={secao === "divergencia"} onFechar={fechar}>
					<DivergenciaDeFonte
						divergencias={relatorio.divergencias_de_fonte}
						onAnexarAditivo={anexarAditivo}
					/>
				</JanelaDaSecao>

				{documentosUsados !== undefined && (
					<JanelaDaSecao aberto={secao === "documentos"} titulo="Documentos usados" onFechar={fechar} montarSempre>
						{documentosUsados}
					</JanelaDaSecao>
				)}
			</section>
		</ItemNoContratoProvider>
	);
}
