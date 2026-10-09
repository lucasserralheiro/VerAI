"use client";

import { useEffect, useMemo, useState } from "react";

import { lerLinhasDoLevantamento, type LinhaDaAba } from "@/lib/confere/levantamento";
import { trechoDoItem, type LinhaDoTrecho } from "@/lib/confere/trecho-levantamento";

import type { FonteDoContrato } from "./ItemNoContrato";

/** A aba é lida uma vez por planilha enquanto a página está aberta: cada item
 *  aberto no modal só recorta o trecho, sem reabrir o .xlsx. */
const LEITURAS = new WeakMap<object, Promise<LinhaDaAba[]>>();
const LEITURAS_POR_URL = new Map<string, Promise<LinhaDaAba[]>>();

function lerPlanilha(fonte: FonteDoContrato): Promise<LinhaDaAba[]> {
	if (fonte.arquivo) {
		let leitura = LEITURAS.get(fonte.arquivo);
		if (!leitura) {
			leitura = fonte.arquivo.arrayBuffer().then(lerLinhasDoLevantamento);
			LEITURAS.set(fonte.arquivo, leitura);
		}
		return leitura;
	}
	const url = fonte.url as string;
	let leitura = LEITURAS_POR_URL.get(url);
	if (!leitura) {
		leitura = fetch(url)
			.then((resposta) => {
				if (!resposta.ok) throw new Error("planilha indisponível");
				return resposta.arrayBuffer();
			})
			.then(lerLinhasDoLevantamento);
		LEITURAS_POR_URL.set(url, leitura);
		// Falha não fica guardada: a próxima abertura tenta de novo.
		leitura.catch(() => LEITURAS_POR_URL.delete(url));
	}
	return leitura;
}

type Estado =
	| { situacao: "lendo" }
	| { situacao: "erro" }
	| { situacao: "pronto"; trechos: LinhaDoTrecho[][] };

const SEM_ACENTO = (texto: string) =>
	texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

/** A quantidade contratada e a medida ficam sempre nas colunas D e E da aba — é
 *  assim que o Confere as lê (`levantamento_reader.py`: COL_CONTRATADA = 3,
 *  COL_MEDIDA = 4), e a tela mostra exatamente essas células. Não se acham pelo
 *  título: ele muda de uma tabela para outra da mesma aba ("Quantidade Contratada"
 *  numa, "Quantidade**" noutra), e quando não casava a célula saía "—" ao lado de
 *  um valor que existe na planilha. */
const COLUNA_CONTRATADA = 3;
const COLUNA_MEDIDA = 4;

interface ColunaDoPdf {
	nome: string;
	/** Como achar a coluna pelo título do cabeçalho da planilha. */
	acha?: (titulo: string) => boolean;
	/** Posição fixa na aba (A = 0), quando o título não é confiável. */
	fixa?: number;
	codigo?: boolean;
}

/** As colunas do PDF, com o nome que ele usa, e como achar cada uma na planilha.
 *  A planilha não traz preço, período nem total: esses campos aparecem como "—",
 *  para quem confere ver que faltam e não achar que a tela quebrou. "Medida" só
 *  existe na planilha. */
const COLUNAS: ColunaDoPdf[] = [
	{ nome: "CÓDIGO", acha: (c) => c.startsWith("codigo"), codigo: true },
	{ nome: "DESCRIÇÃO", acha: (c) => c === "tipo" || c.startsWith("descri") },
	{ nome: "UNIDADE", acha: (c) => c.startsWith("unidade") },
	{ nome: "PREÇO UNITÁRIO (R$)" },
	{ nome: "QTDE", fixa: COLUNA_CONTRATADA },
	{ nome: "PERÍODO (MÊS)" },
	{ nome: "TOTAL (R$)" },
	{ nome: "QTDE MEDIDA", fixa: COLUNA_MEDIDA },
];

/** Em que posição da aba está cada coluna do PDF (-1 = a planilha não tem). */
function posicoes(trecho: LinhaDoTrecho[]): number[] {
	const cabecalho = trecho.find((linha) => linha.tipo === "cabecalho");
	const nomes = (cabecalho?.celulas ?? []).map(SEM_ACENTO);
	return COLUNAS.map((coluna) => {
		if (coluna.fixa !== undefined) return coluna.fixa;
		const acha = coluna.acha;
		return acha ? nomes.findIndex((nome) => nome !== "" && acha(nome)) : -1;
	});
}

/** Célula mesclada no Excel chega repetida em várias colunas ("TOTAL | TOTAL | TOTAL").
 *  Devolve as posições repetidas, para mostrar o texto uma vez só — na descrição, se
 *  ela estiver entre elas, senão na primeira. */
function celulasMescladas(celulas: string[], descricao: number): Set<number> {
	const repetidas = new Set<number>();
	const grupos = new Map<string, number[]>();
	celulas.forEach((celula, posicao) => {
		if (celula === "" || /^[\d.,\s-]+$/.test(celula)) return;
		grupos.set(celula, [...(grupos.get(celula) ?? []), posicao]);
	});
	for (const posicoes of grupos.values()) {
		if (posicoes.length < 2) continue;
		const fica = posicoes.includes(descricao) ? descricao : posicoes[0];
		for (const posicao of posicoes) if (posicao !== fica) repetidas.add(posicao);
	}
	return repetidas;
}

/** Coluna que a planilha não tem (preço, período, total) não ocupa lugar na tela: só
 *  espremia as que importam, e o aviso embaixo da tabela diz que ela não vem. */
const traz = (coluna: ColunaDoPdf) => coluna.acha !== undefined || coluna.fixa !== undefined;

function Trecho({ trecho }: { trecho: LinhaDoTrecho[] }) {
	const onde = posicoes(trecho);
	const total = COLUNAS.filter(traz).length;
	return (
		<div className="overflow-hidden rounded-md border border-confere-line">
			<table className="w-full table-fixed border-collapse text-sm leading-snug">
				<colgroup>
					<col className="w-8" />
					<col className="w-[26%]" />
					<col />
					<col className="w-[15%]" />
					<col className="w-[11%]" />
					<col className="w-[13%]" />
				</colgroup>
				<tbody>
					{trecho.map((linha, posicao) => {
						if (linha.tipo === "lacuna") {
							return (
								<tr key={`lacuna-${posicao}`}>
									<td colSpan={total + 1} className="bg-white px-3 py-1 text-center text-confere-navy-600">
										⋮
									</td>
								</tr>
							);
						}
						const numero = (
							<td className="select-none border-r border-confere-line bg-confere-navy-50 px-1 py-1.5 text-right align-top text-xs tabular-nums text-confere-navy-600">
								{linha.linha}
							</td>
						);
						if (linha.tipo === "titulo") {
							const texto = linha.celulas.find((celula) => celula !== "") ?? "";
							return (
								<tr key={`t-${linha.linha}`} className="bg-confere-navy-50">
									{numero}
									<td
										colSpan={total}
										className="break-words border-t border-confere-line px-2 py-1.5 font-semibold text-confere-navy-800"
									>
										{texto}
									</td>
								</tr>
							);
						}
						const cabecalho = linha.tipo === "cabecalho";
						const alvo = linha.tipo === "alvo";
						const repetidas = cabecalho ? new Set<number>() : celulasMescladas(linha.celulas, onde[1]);
						return (
							<tr
								key={`${linha.tipo}-${linha.linha}`}
								className={alvo ? "bg-amber-100" : cabecalho ? "bg-confere-navy-50" : "bg-white"}
								aria-current={alvo ? "true" : undefined}
							>
								{numero}
								{COLUNAS.map((coluna, i) => {
									if (!traz(coluna)) return null;
									const origem = onde[i];
									const valor = origem >= 0 && !repetidas.has(origem) ? (linha.celulas[origem] ?? "") : "";
									const falta = origem < 0;
									if (!cabecalho && origem >= 0 && repetidas.has(origem)) {
										return <td key={coluna.nome} className="border-t border-confere-line" />;
									}
									const conteudo = cabecalho ? coluna.nome : falta || valor === "" ? "—" : valor;
									return (
										<td
											key={coluna.nome}
											className={`border-t border-confere-line px-1.5 py-1.5 align-top ${
												coluna.acha === undefined || coluna.codigo ? "whitespace-nowrap" : "break-words"
											} ${
												cabecalho
													? "text-[11px] leading-tight font-semibold text-confere-navy-800"
													: falta || valor === ""
														? "text-center text-confere-navy-300"
														: `text-confere-navy-800 tabular-nums ${alvo ? "font-semibold text-confere-navy-800" : ""}`
											} ${coluna.acha === undefined && !cabecalho ? "text-center" : ""} ${coluna.codigo && !cabecalho ? "font-mono text-xs" : ""}`}
										>
											{conteudo}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** O pedaço da planilha de levantamento em que o item está: título da seção,
 *  cabeçalho da tabela, as linhas vizinhas e a linha do item em destaque — para
 *  conferir o medido sem abrir o Excel. */
/** Só o que identifica a linha clicada: o título da seção, o cabeçalho da tabela e a
 *  própria linha. As vizinhas e as reticências ficam de fora. */
function soALinhaDoItem(trechos: LinhaDoTrecho[][]): LinhaDoTrecho[][] {
	return trechos.map((trecho) => trecho.filter((linha) => linha.tipo !== "dado" && linha.tipo !== "lacuna"));
}

const CODIGO_DE_SERVICO = /\d+\.\d{3}\.\d{5}\.\d{2}/;

/** Põe as linhas do trecho na ordem em que os códigos aparecem na página do PDF.
 *  Código que o PDF não traz fica depois, na ordem da planilha. Título, cabeçalho
 *  e reticências não se mexem. */
function naOrdemDoPdf(trecho: LinhaDoTrecho[], ordem: string[]): LinhaDoTrecho[] {
	if (ordem.length === 0) return trecho;
	const posicao = (linha: LinhaDoTrecho) => {
		const achado = linha.celulas.map((c) => c.replace(/\s+/g, "").match(CODIGO_DE_SERVICO)?.[0]).find(Boolean);
		const i = achado ? ordem.indexOf(achado) : -1;
		return i < 0 ? Number.MAX_SAFE_INTEGER : i;
	};
	const ehDado = (linha: LinhaDoTrecho) => linha.tipo === "dado" || linha.tipo === "alvo";
	const dados = trecho.filter(ehDado);
	const ordenados = dados
		.map((linha, i) => ({ linha, i }))
		.sort((a, b) => posicao(a.linha) - posicao(b.linha) || a.i - b.i)
		.map(({ linha }) => linha);
	let proximo = 0;
	return trecho.map((linha) => (ehDado(linha) ? ordenados[proximo++] : linha));
}

export function TrechoDaPlanilha({
	fonte,
	codigo,
	ordem = [],
}: {
	fonte: FonteDoContrato;
	codigo: string;
	/** Códigos na ordem em que o PDF os mostra. */
	ordem?: string[];
}) {
	const [estado, setEstado] = useState<Estado>({ situacao: "lendo" });

	// O objeto `fonte` é refeito a cada render da página: a identidade do arquivo
	// ou da URL é que decide se é outra planilha.
	const { arquivo, url } = fonte;
	useEffect(() => {
		let vivo = true;
		setEstado({ situacao: "lendo" });
		lerPlanilha({ rotulo: "", arquivo, url })
			.then((linhas) => vivo && setEstado({ situacao: "pronto", trechos: soALinhaDoItem(trechoDoItem(linhas, codigo)) }))
			.catch(() => vivo && setEstado({ situacao: "erro" }));
		return () => {
			vivo = false;
		};
	}, [arquivo, url, codigo]);

	const trechos = useMemo(
		() => (estado.situacao === "pronto" ? estado.trechos.map((t) => naOrdemDoPdf(t, ordem)) : []),
		[estado, ordem],
	);

	if (estado.situacao === "lendo") {
		return <p className="text-sm text-confere-navy-600">Lendo a planilha…</p>;
	}
	if (estado.situacao === "erro") {
		return (
			<p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
				Não consegui abrir a planilha para mostrar o trecho.
			</p>
		);
	}
	if (estado.trechos.length === 0) {
		return (
			<p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
				O código <span className="font-mono font-semibold">{codigo}</span> não aparece na aba
				&ldquo;Levantamento&rdquo;.
			</p>
		);
	}
	return (
		<div className="space-y-4">
			{trechos.map((trecho, posicao) => (
				<Trecho key={posicao} trecho={trecho} />
			))}
			<p className="text-sm text-confere-navy-600">
				QTDE e QTDE MEDIDA são as colunas D e E da planilha, as mesmas que o Confere lê. A planilha não
				traz preço unitário, período nem total. &ldquo;—&rdquo; é célula vazia nela.
			</p>
			{estado.trechos.length > 1 && (
				<p className="text-sm text-confere-navy-600">
					O código aparece em {estado.trechos.length} seções da planilha.
				</p>
			)}
		</div>
	);
}
