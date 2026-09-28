"use client";

import { useState } from "react";

import { nomeDaCompetencia, type DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import type { Identificacao } from "../lib/types";
import { BuscaDeContrato, ListaDeContratos } from "./BuscaDeContrato";

interface Props {
	identificacao: Identificacao;
	/** O contrato em uso — achado pela planilha ou escolhido aqui. */
	documentos?: DocumentosDoContrato;
	/** O campo Contrato está com arquivo do computador: a proposta do cadastro
	 *  vira oferta, nunca troca sozinha (desenho §4.3). */
	contratoDoComputador: boolean;
	onEscolherContrato: (contratoId: string) => void;
	onUsarDoCadastro: () => void;
}

const CAIXA_AMBAR = "mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900";

/** A faixa entre os dois cartões e o de aditivos: de qual contrato a planilha
 *  é, o que foi escolhido e por quê — ou, sem contrato, as sugestões e a busca
 *  (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §4.2).
 *
 *  `role="status"` com `id` próprio pelo mesmo motivo do `identidade-aviso`: o
 *  inventário de anúncios da tela resolve por `id`, e dois `status` sem
 *  distinção quebrariam a varredura. */
export function FaixaDoContrato({
	identificacao,
	documentos,
	contratoDoComputador,
	onEscolherContrato,
	onUsarDoCadastro,
}: Props) {
	const [buscando, setBuscando] = useState(false);

	const busca = (
		<BuscaDeContrato
			onEscolher={(contratoId) => {
				setBuscando(false);
				onEscolherContrato(contratoId);
			}}
		/>
	);

	if (identificacao.situacao === "lendo") {
		return (
			<p id="contrato-identificado" role="status" className="mb-4 text-sm text-confere-navy-600">
				Lendo o levantamento e buscando o contrato no cadastro…
			</p>
		);
	}

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
						onClick={() => setBuscando((aberto) => !aberto)}
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
				{buscando && <div className="mt-3">{busca}</div>}
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

	switch (identificacao.situacao) {
		case "ambiguo":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Mais de um contrato com o número {identificacao.leitura.referencia}.</strong> Escolha
						qual:
					</p>
					<ListaDeContratos contratos={identificacao.candidatos} onEscolher={onEscolherContrato} />
				</div>
			);
		case "nao-encontrado":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>O contrato {identificacao.leitura.referencia} não está no cadastro.</strong> Escolha
						um dos contratos sugeridos, busque outro, ou envie a proposta do computador.
					</p>
					{identificacao.sugestoes.length > 0 && (
						<ListaDeContratos contratos={identificacao.sugestoes} onEscolher={onEscolherContrato} />
					)}
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "sem-referencia":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Não achamos o número do contrato neste levantamento.</strong> Busque o contrato ou
						envie a proposta do computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "ilegivel":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>{identificacao.mensagem}.</strong> Escolha o contrato ou envie os arquivos do
						computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		case "falhou":
			return (
				<div id="contrato-identificado" role="status" className={CAIXA_AMBAR}>
					<p>
						<strong>Não foi possível buscar o contrato agora.</strong> Escolha o contrato ou envie os
						arquivos do computador.
					</p>
					<div className="mt-3">{busca}</div>
				</div>
			);
		default:
			return null;
	}
}
