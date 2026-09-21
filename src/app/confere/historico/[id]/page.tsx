"use client";

import { use, useEffect, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

import { ResultadoPanel } from "../../components/ResultadoPanel";
import type { Estado, RespostaRelatorio } from "../../lib/types";

// O resultado é guardado sem os dois base64 — eles já viraram os arquivos no
// Blob (ver `registrarNoHistorico`). O tipo diz isso, em vez de fingir que a
// resposta inteira está no banco.
type ResultadoGuardado = Omit<RespostaRelatorio, "docx_base64" | "analise_xlsx_base64">;

interface Execucao {
	id: string;
	nomeContrato: string;
	nomeLevantamento: string;
	nomesAditivos: string[];
	/** `null` nas execuções gravadas antes da migração `20260921190000`. */
	resultado: ResultadoGuardado | null;
	createdAt: string;
}

/**
 * Um resultado do histórico, reaberto.
 *
 * **Reusa o `ResultadoPanel` inteiro, e essa é a decisão que importa.** O grid
 * de divergências, os blocos de derivadas, as divergências de fonte e os
 * avisos têm regras de apresentação que custaram várias especs; reescrever uma
 * versão "só de leitura" criaria uma segunda tela para manter em sincronia com
 * a primeira, e ela divergiria no primeiro ajuste que alguém esquecesse de
 * espelhar. O que muda entre as duas é só de onde vêm os arquivos: ali, blobs
 * de memória recém-criados; aqui, as rotas do histórico.
 */
export default function ExecucaoDoHistoricoPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [execucao, setExecucao] = useState<Execucao | null>(null);
	const [carregando, setCarregando] = useState(true);
	const [erro, setErro] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/confere/execucoes/${id}`)
			.then(async (resposta) => {
				if (!resposta.ok) {
					const corpo = await resposta.json().catch(() => null);
					throw new Error(corpo?.error ?? "não foi possível carregar esta conferência");
				}
				return resposta.json();
			})
			.then(setExecucao)
			.catch((e: Error) => setErro(e.message))
			.finally(() => setCarregando(false));
	}, [id]);

	const urlDocx = `/api/confere/execucoes/${id}/arquivo?tipo=docx`;
	const urlXlsx = `/api/confere/execucoes/${id}/arquivo?tipo=xlsx`;

	// Os dois campos de base64 entram vazios: o painel não os lê — ele baixa
	// pelas URLs acima. É a diferença entre reconstituir o estado e reconstituir
	// os megabytes.
	const estado: Estado | null = execucao?.resultado
		? {
				situacao: "pronto",
				relatorio: { ...execucao.resultado, docx_base64: "", analise_xlsx_base64: "" },
				urlDocx,
				urlAnalise: urlXlsx,
			}
		: null;

	return (
		<main id="conteudo" className="mx-auto w-full max-w-4xl flex-1 scroll-mt-4 px-6 py-8">

			{/* Sem link de voltar: o caminho de volta é o "Histórico" do menu
			    lateral, que fica destacado enquanto esta página está aberta. Um
			    segundo controle para o mesmo destino, logo acima do título, só
			    empurrava o conteúdo para baixo. */}
			{carregando && <p className="mt-6 text-sm text-confere-navy-300">Carregando…</p>}

			{erro && (
				<p className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
					{erro}
				</p>
			)}

			{execucao && (
				<>
					<div>
						<span className="text-xs font-semibold tracking-wide text-orange uppercase">
							ConfereAI
						</span>
						<h1 className="mt-1 text-2xl font-bold text-confere-brand-navy">
							{execucao.nomeContrato}
						</h1>
						{/* Os arquivos que produziram este resultado. É a única coisa que
						    o histórico sabe da entrada — os PDFs e a planilha não são
						    guardados —, e é o que permite reproduzir a geração. */}
						<dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
							<dt className="font-medium text-confere-navy-600">Levantamento</dt>
							<dd className="text-confere-navy-300">{execucao.nomeLevantamento}</dd>
							<dt className="font-medium text-confere-navy-600">Aditivos</dt>
							<dd className="text-confere-navy-300">
								{execucao.nomesAditivos.length === 0
									? "nenhum"
									: execucao.nomesAditivos.join(", ")}
							</dd>
							<dt className="font-medium text-confere-navy-600">Gerado em</dt>
							<dd className="text-confere-navy-300">
								{new Date(execucao.createdAt).toLocaleString("pt-BR")}
							</dd>
						</dl>
					</div>

					{estado ? (
						<ResultadoPanel estado={estado} />
					) : (
						// Execução anterior ao campo `resultado`. Os arquivos continuam
						// lá, e é isso que a tela oferece — dizer o que falta e por quê
						// é melhor que uma tela vazia sem explicação.
						<div className="mt-6 rounded-md border border-confere-line bg-white p-5">
							<p className="text-sm text-confere-navy-600">
								Esta conferência foi gerada antes de o detalhamento passar a ser
								guardado, então o grid de divergências não está disponível. Os dois
								relatórios continuam íntegros.
							</p>
							<div className="mt-4 flex flex-wrap gap-2.5">
								<a
									href={urlDocx}
									className="inline-flex items-center gap-1.5 rounded-md bg-confere-teal-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-confere-teal-600"
								>
									<FileText className="size-4" strokeWidth={2} />
									Baixar DOCX
								</a>
								<a
									href={urlXlsx}
									className="inline-flex items-center gap-1.5 rounded-md border border-confere-teal-300 bg-white px-5 py-2.5 text-sm font-semibold text-confere-teal-700 transition hover:bg-confere-teal-50"
								>
									<FileSpreadsheet className="size-4" strokeWidth={2} />
									Baixar análise (XLSX)
								</a>
							</div>
						</div>
					)}
				</>
			)}
		</main>
	);
}
