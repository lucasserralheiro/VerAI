"use client";

import Image from "next/image";

import type { Estado } from "@/lib/types";

/** O selo de conferido da assinatura — o mesmo do logo, em traço. */
function Selo({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			aria-hidden="true"
			className={className}
		>
			<circle cx="10" cy="10" r="8" />
			<path d="M6.4 10.4 8.9 12.9 13.6 7.4" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/** `dd/mm/aaaa` vira `mm/aaaa`: na barra o dia não acrescenta nada — a medição
 *  é da competência, não do dia. */
function competencia(data: string | null): string | null {
	if (!data) return null;
	const partes = data.split("/");
	return partes.length === 3 ? `${partes[1]}/${partes[2]}` : data;
}

/**
 * ESPEC 007 — barra de aplicação.
 *
 * O slot de contexto só existe quando há relatório (`R-CAB-05`) e só mostra dado
 * real vindo da API (`R-CAB-06`): a referência do contrato, a competência e o
 * placar. Nos demais estados o lado direito **não é renderizado** — nada de
 * "aguardando arquivos" nem indicador de progresso falso.
 */
export function Barra({ estado }: { estado: Estado }) {
	const relatorio = estado.situacao === "pronto" ? estado.relatorio : null;
	const periodo = relatorio ? competencia(relatorio.data_levantamento) : null;

	return (
		<header className="sticky top-0 z-20 border-b border-line bg-white">
			<div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
				{/* Logo e assinatura empilhados: as duas frases **são** parte da
				    marca, não um texto que a acompanha. Lado a lado elas liam como
				    legenda; embaixo, alinhadas à esquerda do logo, liam como o que
				    são. */}
				<div className="flex min-w-0 flex-col items-start gap-1">
					{/* O `alt` é o nome acessível do h1: quem usa leitor de tela ouve
					    "Confere", não "imagem" (ESPEC 005 `R-MRC-05`). */}
					<h1 className="shrink-0">
						<Image
							src="/logo-confere.png"
							alt="Confere"
							width={1313}
							height={337}
							priority
							className="h-7 w-auto"
						/>
					</h1>
					{/* Quebra em duas linhas em vez de sumir na tela estreita: o que
					    antes era corte aceitável — a assinatura ao lado do logo
					    engordava a faixa — deixa de ser, agora que ela pertence à
					    marca (`R-CAB-04`). */}
					<p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-navy-600">
						<span className="inline-flex items-center gap-1.5">
							<Selo className="h-4 w-4 shrink-0 text-brand-navy" />
							<span>
								<strong className="font-semibold text-brand-navy">Confere</strong> o
								contratado.
							</span>
						</span>
						{/* O divisor separa as duas frases quando cabem na mesma linha.
						    Quando quebram, ele sobraria pendurado no fim da primeira —
						    e a quebra já separa. */}
						<span aria-hidden="true" className="hidden h-3.5 w-px bg-line sm:block" />
						<span className="inline-flex items-center gap-1.5">
							<Selo className="h-4 w-4 shrink-0 text-brand-green" />
							<span>
								<strong className="font-semibold text-brand-green-ink">Confere</strong> o
								utilizado.
							</span>
						</span>
					</p>
				</div>

				{relatorio && (
					<div className="flex min-w-0 items-center gap-2 text-xs tabular-nums text-navy-600">
						{/* A referência do contrato é a última coisa a ceder: entre saber
						    quanto diverge e saber de quê, a segunda não pode faltar. */}
						<span className="truncate font-mono font-semibold text-brand-navy">
							{relatorio.contrato_referencia}
						</span>
						{periodo && (
							<>
								<span aria-hidden="true" className="text-navy-100">
									·
								</span>
								<span className="hidden sm:inline">{periodo}</span>
							</>
						)}
						<span className="hidden shrink-0 rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 lg:inline">
							{relatorio.total_divergencias} de {relatorio.total_linhas} divergem
						</span>
					</div>
				)}
			</div>
		</header>
	);
}
