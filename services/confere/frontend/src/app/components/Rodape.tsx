import Image from "next/image";

/**
 * ESPEC 006 — rodapé institucional.
 *
 * Reproduz a composição do rodapé do modelo PRODAM (páginas 2+): faixa escura de
 * borda a borda, marca à esquerda, identificação ao centro, endereço e redes à
 * direita. O que se reproduz é a **composição**, não a imagem — no modelo o
 * rodapé é um PNG de 1190×126 e, numa janela estreita, o endereço sairia com
 * menos de 4 px de altura (`R-ROD-02`).
 */

function Instagram({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className={className}>
			<rect x="3" y="3" width="18" height="18" rx="5" />
			<circle cx="12" cy="12" r="4" />
			<circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
		</svg>
	);
}

function LinkedIn({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
			<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
		</svg>
	);
}

export function Rodape() {
	return (
		<footer className="mt-16 bg-prodam-navy text-white">
			{/* `py-5` e não `py-7`: o rodapé é enxuto — em 1366×768 cada 16 px que
			    ele devolve vão para o grid de divergências (ESPEC 006 D-06). A
			    marca e os dois ícones sociais são link, em nova aba (ESPEC 056); o
			    resto do rodapé continua sem navegação nem ação. */}
			<div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
				<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
					<a
						href="https://portal.prodam.sp.gov.br/"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="Prodam — abrir o portal institucional em nova aba"
						className="shrink-0 transition-opacity hover:opacity-80"
					>
						<Image
							src="/prodam-branca.svg"
							alt="Prodam govtech sp"
							width={1630}
							height={428}
							className="h-9 w-auto sm:h-10"
						/>
					</a>
					<span aria-hidden="true" className="hidden h-11 w-px shrink-0 bg-white/25 sm:block" />
					{/* A quebra manual é a do modelo, desenhada para uma faixa de 21 cm.
					    Abaixo de `sm` ela produziria linha órfã, então só vale a partir
					    daí — no estreito o texto flui. */}
					<p className="text-xs font-semibold leading-snug">
						Prodam — Empresa de Tecnologia da Informação
						<br className="hidden sm:inline" /> e Comunicação do Município de São Paulo
					</p>
				</div>

				<div className="text-xs sm:text-right">
					{/* Caixa alta pela apresentação, não pelo texto: preserva a leitura
					    por software e a cópia (`R-ROD-04`). */}
					<address className="font-semibold uppercase not-italic leading-snug tracking-wide">
						Rua Líbero Badaró, 425 - Centro
						<br />
						CEP: 01009-905 - São Paulo - SP
					</address>
					<p className="mt-2.5 flex items-center gap-2 sm:justify-end">
						<a
							href="https://www.instagram.com/prodamsp/"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Instagram da Prodam — abre em nova aba"
							className="transition-opacity hover:opacity-80"
						>
							<Instagram className="h-[1.1rem] w-[1.1rem] text-prodam-orange" />
						</a>
						<a
							href="https://br.linkedin.com/company/prodamsp"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="LinkedIn da Prodam — abre em nova aba"
							className="transition-opacity hover:opacity-80"
						>
							<LinkedIn className="h-[1.05rem] w-[1.05rem] text-prodam-orange" />
						</a>
						<span className="font-medium">/prodamsp</span>
					</p>
				</div>
			</div>
		</footer>
	);
}
