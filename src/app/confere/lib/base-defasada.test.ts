import type { DocumentoDoCadastro, DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";

import { avisoDeBaseDefasada } from "./base-defasada";

function peca(
	arquivoId: string,
	tipo: "CONTRATO" | "ADITIVO" | "PRORROGACAO",
	numero: string | null,
	inicio: string | null,
): DocumentoDoCadastro {
	return { arquivoId, nome: `${arquivoId}.pdf`, origem: { tipo, numero, inicio } };
}

function documentos(parcial: Partial<DocumentosDoContrato>): DocumentosDoContrato {
	return {
		contrato: {} as DocumentosDoContrato["contrato"],
		competencia: { ano: 2026, mes: 8, lidaDaPlanilha: true },
		base: null,
		aditivos: [],
		alternativas: [],
		decisoes: [],
		avisos: [],
		...parcial,
	};
}

describe("avisoDeBaseDefasada", () => {
	const inicial = peca("a", "CONTRATO", null, "2024-10-11");
	const aditivo = peca("b", "ADITIVO", "590-2025", "2026-03-23");

	it("avisa quando há proposta mais nova no cadastro que não foi usada", () => {
		const renovacao = peca("c", "PRORROGACAO", "02", "2025-10-11");
		const aviso = avisoDeBaseDefasada(
			documentos({ base: inicial, aditivos: [aditivo], alternativas: [inicial, renovacao, aditivo] }),
		);
		expect(aviso).toContain("Renovação 02");
	});

	it("ignora proposta que começa depois da competência", () => {
		const futura = peca("c", "PRORROGACAO", "03", "2026-10-11");
		expect(
			avisoDeBaseDefasada(documentos({ base: inicial, alternativas: [inicial, futura] })),
		).toBeNull();
	});

	it("avisa quando o aditivo é mais de um ano depois do contrato inicial", () => {
		const aviso = avisoDeBaseDefasada(documentos({ base: inicial, aditivos: [aditivo], alternativas: [inicial] }));
		expect(aviso).toContain("mais de um ano");
	});

	it("não avisa quando a base e o aditivo são próximos", () => {
		const perto = peca("b", "ADITIVO", "01", "2025-03-01");
		expect(avisoDeBaseDefasada(documentos({ base: inicial, aditivos: [perto], alternativas: [inicial] }))).toBeNull();
	});

	it("não avisa sem base ou sem data", () => {
		expect(avisoDeBaseDefasada(documentos({ base: null }))).toBeNull();
		expect(avisoDeBaseDefasada(documentos({ base: peca("a", "CONTRATO", null, null) }))).toBeNull();
	});
});
