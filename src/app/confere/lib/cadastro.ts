import {
	dataIsoParaTexto,
	type OrigemNoCadastro,
	type ResumoDoContrato,
} from "@/lib/confere/tipos-cadastro";

/** De onde veio a proposta, como a tela escreve: "TA 04, renovação desde 01/12/2025". */
export function textoDaOrigem(origem: OrigemNoCadastro | null): string {
	if (!origem) return "proposta do cliente, fora do histórico do contrato";
	const data = origem.inicio ? dataIsoParaTexto(origem.inicio) : null;
	switch (origem.tipo) {
		case "CONTRATO":
			return data ? `contrato inicial, desde ${data}` : "contrato inicial";
		case "PRORROGACAO":
			return `${origem.numero ?? "prorrogação"}, renovação${data ? ` desde ${data}` : ""}`;
		case "ADITIVO":
			return `${origem.numero ?? "aditivo"}, aditivo${data ? ` de ${data}` : ""}`;
		default:
			return origem.numero ?? origem.tipo.toLowerCase();
	}
}

/** "TC 16/CGM/2024 · CGM · Sustentação" — e "encerrado" quando o contrato não está ativo. */
export function textoDoContrato(contrato: ResumoDoContrato): string {
	return [
		contrato.numeroTermo ?? "sem número",
		contrato.clienteSigla ?? contrato.clienteNome,
		contrato.descricao,
		contrato.ativo ? null : "encerrado",
	]
		.filter(Boolean)
		.join(" · ");
}
