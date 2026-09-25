import { textoDaOrigem, textoDoContrato, textoDoDocumento } from "./cadastro";

describe("textoDaOrigem", () => {
	it.each([
		[{ tipo: "PRORROGACAO", numero: "TA 04", inicio: "2025-12-01" }, "TA 04, renovação desde 01/12/2025"],
		[{ tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" }, "TA 05, aditivo de 30/04/2026"],
		[{ tipo: "CONTRATO", numero: "TC 52/SMIT/2024", inicio: "2024-07-01" }, "contrato inicial, desde 01/07/2024"],
		[{ tipo: "CONTRATO", numero: null, inicio: null }, "contrato inicial"],
		[null, "proposta do cliente, fora do histórico do contrato"],
	] as const)("%j", (origem, texto) => {
		expect(textoDaOrigem(origem)).toBe(texto);
	});
});

describe("textoDoContrato", () => {
	it("número · sigla · descrição, e avisa quando encerrado", () => {
		const base = {
			id: "c",
			clienteId: "cl",
			clienteNome: "Controladoria",
			clienteSigla: "CGM",
			numeroTermo: "TC 16/CGM/2024",
			descricao: "Sustentação",
			vigenciaFim: null,
			ativo: true,
		};
		expect(textoDoContrato(base)).toBe("TC 16/CGM/2024 · CGM · Sustentação");
		expect(textoDoContrato({ ...base, descricao: null, ativo: false })).toBe("TC 16/CGM/2024 · CGM · encerrado");
	});
});

describe("textoDoDocumento", () => {
	it("a origem do histórico quando há; senão a pasta de onde veio", () => {
		const origem = { tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" } as const;
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem })).toBe("TA 05, aditivo de 30/04/2026");
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem: null, pasta: "3) TA 02" })).toBe(
			"pasta 3) TA 02",
		);
		expect(textoDoDocumento({ arquivoId: "a", nome: "a.pdf", origem: null })).toBe(
			"proposta do cliente, fora do histórico do contrato",
		);
	});
});
