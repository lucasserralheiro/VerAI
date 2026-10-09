import {
	dataIsoParaTexto,
	type DocumentoDoCadastro,
	type DocumentosDoContrato,
	type TipoDaLinha,
} from "@/lib/confere/tipos-cadastro";

const ROTULO_DO_TIPO: Record<TipoDaLinha, string> = {
	CONTRATO: "Contrato inicial",
	ADITIVO: "TA",
	PRORROGACAO: "Renovação",
	RESCISAO: "Rescisão",
	PROSPECCAO: "Proposta",
};

function nomeDaPeca(documento: DocumentoDoCadastro): string {
	const { origem } = documento;
	if (!origem) return documento.nome;
	const rotulo = [ROTULO_DO_TIPO[origem.tipo], origem.numero].filter(Boolean).join(" ");
	return origem.inicio ? `${rotulo} (${dataIsoParaTexto(origem.inicio)})` : rotulo;
}

/** Dia seguinte ao fim da competência, "AAAA-MM-DD" — para comparar com `inicio` como texto. */
function fimDaCompetencia(ano: number, mes: number): string {
	const ultimoDia = new Date(ano, mes, 0).getDate();
	return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function mesesEntre(inicioIso: string, fimIso: string): number {
	const [anoI, mesI] = inicioIso.split("-").map(Number);
	const [anoF, mesF] = fimIso.split("-").map(Number);
	return (anoF - anoI) * 12 + (mesF - mesI);
}

/** Avisa, **antes de gerar**, quando a proposta-base parece velha demais para os
 *  aditivos que vão em cima dela.
 *
 *  O caso real: contrato inicial de 2024 com aditivo de 2026. O aditivo altera
 *  códigos que só existem numa renovação intermediária, e o Confere responde com
 *  "total não localizado" ou "código alterado por um aditivo, mas não está no
 *  contrato" — depois de ~30 s de espera. Aqui o aviso sai na hora, só com o que
 *  o cadastro já sabe. Não bloqueia nada: a pessoa pode estar certa.
 *
 *  `null` quando não há motivo para desconfiar.
 */
export function avisoDeBaseDefasada(documentos: DocumentosDoContrato): string | null {
	const base = documentos.base;
	const inicioDaBase = base?.origem?.inicio;
	if (!base || !inicioDaBase) return null;

	const fim = fimDaCompetencia(documentos.competencia.ano, documentos.competencia.mes);
	const emUso = new Set([base.arquivoId, ...documentos.aditivos.map((a) => a.arquivoId)]);

	// 1. Existe, no cadastro, proposta mais nova que a base, já em vigor na
	//    competência, e que não está sendo usada.
	const maisNovas = documentos.alternativas.filter((peca) => {
		const inicio = peca.origem?.inicio;
		return !emUso.has(peca.arquivoId) && !!inicio && inicio > inicioDaBase && inicio <= fim;
	});
	if (maisNovas.length > 0) {
		return (
			`O contrato escolhido é ${nomeDaPeca(base)}, mas o cadastro tem proposta mais recente que não entrou: ` +
			`${maisNovas.map(nomeDaPeca).join("; ")}. Se ela já valia na competência, troque o Contrato em ` +
			`"Procurar nas pastas do cliente" — base antiga com aditivo novo costuma travar a geração.`
		);
	}

	// 2. Base inicial e aditivo bem depois dela: pode faltar uma peça no meio.
	const primeiroAditivo = documentos.aditivos.find((a) => a.origem?.inicio);
	const inicioDoAditivo = primeiroAditivo?.origem?.inicio;
	if (base.origem?.tipo === "CONTRATO" && inicioDoAditivo && mesesEntre(inicioDaBase, inicioDoAditivo) > 12) {
		return (
			`O aditivo ${nomeDaPeca(primeiroAditivo as DocumentoDoCadastro)} é de mais de um ano depois de ` +
			`${nomeDaPeca(base)}. Pode faltar uma renovação no meio — confira nas pastas do cliente antes de gerar.`
		);
	}

	return null;
}
