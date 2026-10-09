"use client";

import { nomeDaCompetencia, type DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import { avisoDeBaseDefasada } from "../lib/base-defasada";
import type { Identificacao } from "../lib/types";

interface Props {
	identificacao: Identificacao;
	/** O contrato em uso — achado pela planilha ou escolhido na busca. */
	documentos?: DocumentosDoContrato;
	/** O campo Contrato está com arquivo do computador: a proposta do cadastro
	 *  vira oferta, nunca troca sozinha. */
	contratoDoComputador: boolean;
	/** "trocar contrato" e "Buscar no cadastro": abrem o modal da busca. */
	onBuscarContrato: () => void;
	onUsarDoCadastro: () => void;
}

/** A planilha foi lida e o contrato não saiu dela — a pergunta foi feita no
 *  modal, e a pessoa seguiu à mão. */
const SEM_CONTRATO: ReadonlySet<Identificacao["situacao"]> = new Set([
	"ambiguo",
	"nao-encontrado",
	"sem-referencia",
	"ilegivel",
	"falhou",
]);

/** O resumo em cima dos documentos: de qual contrato a planilha é, o que foi
 *  escolhido e por quê. Buscar e escolher contrato moram no modal
 *  (`BuscaDoContratoModal`, desenho de 28/09/2026 §3.2) — aqui só o resultado.
 *
 *  `role="status"` com `id` próprio: o inventário de anúncios da tela resolve
 *  por `id`, e dois `status` sem distinção quebrariam a varredura. */
export function FaixaDoContrato({
	identificacao,
	documentos,
	contratoDoComputador,
	onBuscarContrato,
	onUsarDoCadastro,
}: Props) {
	if (documentos) {
		const { contrato, competencia } = documentos;
		const avisoDaBase = avisoDeBaseDefasada(documentos);
		// O que a planilha escreveu em "conforme contrato", ao lado do que foi achado:
		// quem confere vê de onde veio a escolha e não precisa abrir o Excel.
		const lida = "leitura" in identificacao ? identificacao.leitura.referencia : null;
		// Igual ao contrato achado, a referência só repetia a frase ao lado: aparece quando difere.
		const soAlfanumerico = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]/g, "");
		const referenciaLida =
			lida && contrato.numeroTermo && soAlfanumerico(lida) === soAlfanumerico(contrato.numeroTermo) ? null : lida;
		// O aviso é da escolha que o sistema fez. Contrato trocado à mão é decisão da
		// pessoa: a referência continua à vista, mas o alerta sairia fora de hora.
		const avisoDeOrgao =
			identificacao.situacao === "encontrado" &&
			identificacao.documentos.contrato.id === contrato.id
				? identificacao.avisoDeOrgao
				: undefined;
		return (
			<div
				id="contrato-identificado"
				role="status"
				className="mb-2.5 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 px-3.5 py-2.5 text-sm text-confere-navy-600"
			>
				{/* Identificação à esquerda, as duas ações à direita: uma linha só em vez de um
				    parágrafo que quebrava no meio do "trocar contrato". */}
				<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
					<p className="min-w-0 flex-1 basis-80">
						<strong>Contrato {contrato.numeroTermo ?? "sem número"}</strong> · {contrato.clienteNome} ·
						competência {nomeDaCompetencia(competencia)}
						{referenciaLida && (
							<span className="mt-0.5 block text-confere-navy-300 lg:ml-3 lg:mt-0 lg:inline">
								A planilha diz: <strong className="text-confere-navy-600">{referenciaLida}</strong>
							</span>
						)}
					</p>
					<div className="flex shrink-0 items-center gap-2">
						<a
							href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`}
							target="_blank"
							rel="noreferrer"
							className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-confere-navy-600 underline-offset-2 transition hover:bg-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-prodam-orange"
						>
							abrir contrato
						</a>
						<button
							type="button"
							onClick={onBuscarContrato}
							className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-confere-navy-600 underline-offset-2 transition hover:bg-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-confere-prodam-orange"
						>
							trocar contrato
						</button>
					</div>
				</div>
				{avisoDeOrgao && (
					<p
						role="note"
						className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
					>
						<strong>Confira o órgão.</strong> {avisoDeOrgao}
					</p>
				)}
				{!competencia.lidaDaPlanilha && (
					<p className="mt-1 text-xs">
						Competência não lida na planilha — usamos o mês atual para escolher os aditivos.
					</p>
				)}
				{contratoDoComputador && documentos.base && (
					<p className="mt-2 text-xs">
						O campo Contrato está com o arquivo enviado do computador.{" "}
						<button
							type="button"
							onClick={onUsarDoCadastro}
							className="font-semibold text-confere-teal-600 underline"
						>
							Usar a proposta do cadastro ({documentos.base.nome})
						</button>
					</p>
				)}
				{documentos.avisos.length > 0 && (
					<ul className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
						{documentos.avisos.map((aviso) => (
							<li key={aviso.texto}>{aviso.texto}</li>
						))}
					</ul>
				)}
				{avisoDaBase && (
					<p
						role="note"
						className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
					>
						<strong>Confira a proposta-base.</strong> {avisoDaBase}
					</p>
				)}
				{documentos.decisoes.length > 0 && (
					<details className="mt-1.5 text-sm">
						<summary className="cursor-pointer">Como os documentos foram escolhidos</summary>
						<ul className="mt-2 space-y-0.5">
							{documentos.decisoes.map((decisao, indice) => (
								<li key={`${decisao.rotulo}-${indice}`}>
									<strong>{decisao.rotulo}</strong>:{" "}
									{decisao.papel === "base"
										? "proposta-base (campo Contrato)"
										: decisao.papel === "aditivo"
											? "aplicado como aditivo"
											: decisao.motivo}
								</li>
							))}
						</ul>
					</details>
				)}
			</div>
		);
	}

	if (SEM_CONTRATO.has(identificacao.situacao)) {
		return (
			<p
				id="contrato-identificado"
				role="status"
				className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
			>
				<strong>O levantamento não identificou o contrato.</strong>{" "}
				<button type="button" onClick={onBuscarContrato} className="font-semibold underline">
					Buscar no cadastro
				</button>
			</p>
		);
	}

	return null;
}
