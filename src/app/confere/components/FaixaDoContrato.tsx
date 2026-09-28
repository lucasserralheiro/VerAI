"use client";

import { nomeDaCompetencia, type DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
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
		return (
			<div
				id="contrato-identificado"
				role="status"
				className="mb-4 rounded-md border border-confere-teal-100 bg-confere-teal-50/40 p-4 text-sm text-confere-navy-600"
			>
				<p>
					<strong>Contrato {contrato.numeroTermo ?? "sem número"}</strong> · {contrato.clienteNome} ·
					competência {nomeDaCompetencia(competencia)} ·{" "}
					<a
						href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`}
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-confere-teal-600 underline"
					>
						abrir contrato
					</a>{" "}
					·{" "}
					<button
						type="button"
						onClick={onBuscarContrato}
						className="font-semibold text-confere-teal-600 underline"
					>
						trocar contrato
					</button>
				</p>
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
					<ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
						{documentos.avisos.map((aviso) => (
							<li key={aviso.texto}>{aviso.texto}</li>
						))}
					</ul>
				)}
				{documentos.decisoes.length > 0 && (
					<details className="mt-3 text-xs">
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
