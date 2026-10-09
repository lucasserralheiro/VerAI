interface Passo {
	titulo: string;
	texto: string;
}

/** O começo da tela: a planilha entra e o resto vem do cadastro. O texto de cada passo vem do
 *  que a tela faz de verdade (lê o cabeçalho, busca a proposta e os aditivos, gera DOCX e XLSX). */
export const PASSOS_DO_INICIO: readonly Passo[] = [
	{
		titulo: "Escolha o levantamento",
		texto: "A planilha de medição da competência, em XLSX.",
	},
	{
		titulo: "Confira o contrato encontrado",
		texto:
			"Lemos o contrato e a data no cabeçalho da planilha e buscamos a proposta e os aditivos no cadastro do cliente.",
	},
	{
		titulo: "Gere o relatório",
		texto: "O relatório de comprovação sai em DOCX e XLSX. A geração pode levar alguns minutos.",
	},
];

/** A tela dos documentos (contrato não achado, ou "Preencher à mão"). */
export const PASSOS_DOS_DOCUMENTOS: readonly Passo[] = [
	{
		titulo: "Escolha o levantamento",
		texto: "A planilha de medição da competência, em XLSX. É por ela que o contrato é procurado.",
	},
	{
		titulo: "Informe o contrato",
		texto:
			"Procure a proposta nas pastas do cliente ou envie o PDF do computador. É a proposta com a tabela de itens.",
	},
	{
		titulo: "Adicione os aditivos, se houver",
		texto: "Opcional. Escolha os PDFs na ordem em que se aplicam: o primeiro da lista é aplicado primeiro.",
	},
	{
		titulo: "Gere o relatório",
		texto:
			"O Confere compara o contratado com o medido. Mantenha esta página aberta — pode levar alguns minutos.",
	},
];

interface Props {
	passos: readonly Passo[];
	/** O passo em andamento (1, 2…): os de antes ganham visto, o dele fica em destaque. */
	atual?: number;
}

/** O tutorial da tela: o que a pessoa vai fazer, em ordem, e o que ela recebe no fim. */
export function ComoFunciona({ passos, atual }: Props) {
	return (
		<aside
			aria-labelledby="como-funciona"
			className="rounded-lg border border-confere-line bg-white p-4 lg:sticky lg:top-4"
		>
			<h2
				id="como-funciona"
				className="text-sm font-semibold uppercase tracking-wide text-confere-navy-300"
			>
				Como funciona
			</h2>
			<ol className="mt-2 space-y-0">
				{passos.map((passo, posicao) => {
					const numero = posicao + 1;
					const feito = atual !== undefined && numero < atual;
					const emAndamento = numero === atual;
					return (
						<li
							key={passo.titulo}
							aria-current={emAndamento ? "step" : undefined}
							className={`-mx-3 flex gap-3 rounded-md px-3 py-1.5 ${emAndamento ? "bg-confere-navy-50" : ""}`}
						>
							<span
								aria-hidden="true"
								className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
									feito
										? "bg-confere-brand-green text-white"
										: emAndamento
											? "bg-confere-brand-navy text-white"
											: "bg-confere-navy-50 text-confere-navy-600"
								}`}
							>
								{feito ? (
									<svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
										<path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
								) : (
									numero
								)}
							</span>
							<div>
								<p className="text-[15px] font-semibold text-confere-navy-800">
									{passo.titulo}
									{feito && <span className="sr-only"> (feito)</span>}
									{emAndamento && <span className="sr-only"> (passo atual)</span>}
								</p>
								<p className="mt-0.5 text-[15px] leading-snug text-confere-navy-600">{passo.texto}</p>
							</div>
						</li>
					);
				})}
			</ol>
			<div className="mt-2 border-t border-confere-line pt-2.5">
				<p className="text-sm font-semibold uppercase tracking-wide text-confere-navy-300">Você recebe</p>
				<p className="mt-1 text-[15px] leading-snug text-confere-navy-600">
					O relatório de comprovação em DOCX e a planilha de conferência em XLSX, prontos para baixar.
				</p>
			</div>
		</aside>
	);
}
