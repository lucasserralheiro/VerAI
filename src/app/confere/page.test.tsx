import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ConferePage from "./page";

const PA_04 = {
	arquivoId: "pa-04",
	nome: "PA-PGM-251015-159 v5.0.pdf",
	origem: { tipo: "PRORROGACAO", numero: "TA 04", inicio: "2025-12-01" },
};
const PA_05 = {
	arquivoId: "pa-05",
	nome: "PA-PGM-260304-715.pdf",
	origem: { tipo: "ADITIVO", numero: "TA 05", inicio: "2026-04-30" },
};
const PC = {
	arquivoId: "pc",
	nome: "PC-PGM-240715-100 v7.0.pdf",
	origem: { tipo: "CONTRATO", numero: "TC 015/PGM/2024", inicio: "2024-12-01" },
};
const DOCUMENTOS = {
	contrato: {
		id: "ct-pgm",
		clienteId: "cl-pgm",
		clienteNome: "Procuradoria Geral do Município",
		clienteSigla: "PGM",
		numeroTermo: "TC 015/PGM/2024",
		descricao: null,
		vigenciaFim: "2025-11-30",
		ativo: true,
	},
	competencia: { ano: 2026, mes: 7, lidaDaPlanilha: true },
	base: PA_04,
	aditivos: [PA_05],
	alternativas: [PC, PA_04, PA_05],
	decisoes: [
		{ rotulo: "Contrato inicial", papel: "fora", motivo: "já está dentro da renovação TA 04" },
		{ rotulo: "TA 04", papel: "base", motivo: null },
		{ rotulo: "TA 05", papel: "aditivo", motivo: null },
	],
	avisos: [
		{
			codigo: "fora-da-vigencia",
			texto: "Julho/2026 está depois do fim de vigência cadastrado (30/11/2025). Confira.",
		},
	],
};

let espiao: jest.SpyInstance;

beforeEach(() => {
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/health")) return Response.json({ dormindo: false });
		if (url.endsWith("/levantamento")) {
			return Response.json({
				situacao: "encontrado",
				leitura: { referencia: "TC 015/PGM/2024", competencia: { ano: 2026, mes: 7 } },
				documentos: DOCUMENTOS,
			});
		}
		return Response.json({ detail: "falha simulada" }, { status: 502 });
	});
});

afterEach(() => jest.restoreAllMocks());

function escolher(rotulo: string, ...arquivos: File[]) {
	fireEvent.change(screen.getByLabelText(rotulo), { target: { files: arquivos } });
}

function corpoDaGeracao(): FormData {
	const chamada = espiao.mock.calls.find(([url]) => String(url).endsWith("/reports"));
	return chamada?.[1]?.body as FormData;
}

it("escolher o levantamento preenche Contrato e Aditivos com as propostas do cadastro", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · TA 04, renovação desde 01\/12\/2025/)).toBeInTheDocument();
	// O item da lista de aditivos — o mesmo nome aparece também no menu "Trocar".
	expect(screen.getByText(/^1\. PA-PGM-260304-715\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/Contrato TC 015\/PGM\/2024/)).toBeInTheDocument();
	expect(screen.getByText(/fim de vigência cadastrado/)).toBeInTheDocument();
});

it("proposta enviada do computador não é trocada pela do cadastro", async () => {
	render(<ConferePage />);
	escolher("Contrato", new File(["%PDF"], "minha-proposta.pdf"));
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));

	expect(await screen.findByRole("button", { name: /Usar a proposta do cadastro/ })).toBeInTheDocument();
	expect(screen.getByText("minha-proposta.pdf")).toBeInTheDocument();
});

it("gera mandando as propostas do cadastro por referência", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().get("contrato_arquivo_id")).toBe("pa-04");
	expect(corpoDaGeracao().getAll("aditivos")).toEqual(["cadastro:pa-05"]);
	expect(corpoDaGeracao().get("contrato_id")).toBe("ct-pgm");
});

it("remover o aditivo tira ele do envio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Remover PA-PGM-260304-715.pdf" }));
	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().getAll("aditivos")).toEqual([]);
});

it("Trocar põe outra proposta do contrato no campo Contrato", async () => {
	render(<ConferePage />);
	escolher("Levantamento", new File(["x"], "PGM_Levantamento.xlsx"));
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	// A PC aparece também em "+ Adicionar do cadastro": escolher dentro do "Trocar".
	const trocar = screen.getByText("Trocar").closest("details") as HTMLElement;
	fireEvent.click(within(trocar).getByRole("button", { name: /PC-PGM-240715-100 v7\.0\.pdf/ }));

	expect(screen.getByText("PC-PGM-240715-100 v7.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · contrato inicial, desde 01\/12\/2024/)).toBeInTheDocument();
});
