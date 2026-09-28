import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
const CONTRATO = {
	id: "ct-pgm",
	clienteId: "cl-pgm",
	clienteNome: "Procuradoria Geral do Município",
	clienteSigla: "PGM",
	numeroTermo: "TC 015/PGM/2024",
	descricao: null,
	vigenciaFim: "2025-11-30",
	ativo: true,
};
const DOCUMENTOS = {
	contrato: CONTRATO,
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
const LEITURA = { referencia: "TC 015/PGM/2024", competencia: { ano: 2026, mes: 7 } };
const ENCONTRADO = { situacao: "encontrado", leitura: LEITURA, documentos: DOCUMENTOS };

const PASTAS_PGM = {
	cliente: { id: "cl-pgm", nome: "Procuradoria Geral do Município", sigla: "PGM" },
	arquivos: [
		{
			arquivoId: "pc",
			nome: "PC-PGM-240715-100 v7.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_COMERCIAL",
			pasta: ["TC 015-PGM-2024", "1) Contrato Inicial"],
		},
		{
			arquivoId: "pa-04",
			nome: "PA-PGM-251015-159 v5.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 015-PGM-2024", "5) TA 04 - Prorrogação"],
		},
		{
			arquivoId: "pa-05",
			nome: "PA-PGM-260304-715.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 015-PGM-2024", "6) TA 05"],
		},
	],
};

let espiao: jest.SpyInstance;
/** A resposta de `/levantamento` — cada teste pode trocar. */
let respostaDoLevantamento: () => Response | Promise<Response>;

beforeEach(() => {
	respostaDoLevantamento = () => Response.json(ENCONTRADO);
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/health")) return Response.json({ dormindo: false });
		if (url.endsWith("/levantamento")) return respostaDoLevantamento();
		if (url.includes("/api/confere/contratos/ct-pgm/documentos")) return Response.json(DOCUMENTOS);
		if (url.endsWith("/api/confere/clientes/cl-pgm/pastas")) return Response.json(PASTAS_PGM);
		return Response.json({ detail: "falha simulada" }, { status: 502 });
	});
});

afterEach(() => jest.restoreAllMocks());

function escolher(rotulo: string, ...arquivos: File[]) {
	fireEvent.change(screen.getByLabelText(rotulo), { target: { files: arquivos } });
}

function soltar(alvo: HTMLElement, ...arquivos: File[]) {
	const dataTransfer = { files: arquivos, types: ["Files"] };
	fireEvent.dragEnter(alvo, { dataTransfer });
	fireEvent.drop(alvo, { dataTransfer });
}

/** Uma resposta que só chega quando o teste mandar. */
function adiada() {
	let responder: (resposta: Response) => void = () => {};
	const promessa = new Promise<Response>((resolver) => {
		responder = resolver;
	});
	return { promessa, responder: (corpo: unknown) => responder(Response.json(corpo)) };
}

function corpoDaGeracao(): FormData {
	const chamada = espiao.mock.calls.find(([url]) => String(url).endsWith("/reports"));
	return chamada?.[1]?.body as FormData;
}

const PLANILHA = () => new File(["x"], "PGM_Levantamento.xlsx");

it("o início mostra só o levantamento", () => {
	render(<ConferePage />);
	expect(
		screen.getByRole("heading", { name: "Arraste a planilha de levantamento aqui" }),
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();
	expect(screen.queryByLabelText("Contrato")).not.toBeInTheDocument();
	expect(screen.queryByRole("button", { name: "Gerar relatório" })).not.toBeInTheDocument();
});

it("escolher a planilha abre o modal enquanto busca; achou, a tela mostra os documentos", async () => {
	const resposta = adiada();
	respostaDoLevantamento = () => resposta.promessa;
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	expect(
		await screen.findByRole("dialog", { name: "Buscando os documentos do contrato" }),
	).toBeInTheDocument();
	expect(screen.getByText(/Lendo a planilha e procurando o contrato/)).toBeInTheDocument();

	await act(async () => resposta.responder(ENCONTRADO));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(screen.getByText(/Do cadastro · TA 04, renovação desde 01\/12\/2025/)).toBeInTheDocument();
	expect(screen.getByText(/^1\. PA-PGM-260304-715\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/Contrato TC 015\/PGM\/2024/)).toBeInTheDocument();
	expect(screen.getByText(/fim de vigência cadastrado/)).toBeInTheDocument();
	await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("não achou: o modal pergunta, e a sugestão preenche", async () => {
	respostaDoLevantamento = () =>
		Response.json({ situacao: "nao-encontrado", leitura: LEITURA, sugestoes: [CONTRATO] });
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	expect(
		await screen.findByRole("dialog", { name: "O contrato TC 015/PGM/2024 não está no cadastro" }),
	).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /TC 015\/PGM\/2024 · PGM/ }));

	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
	expect(
		espiao.mock.calls.some(([url]) =>
			String(url).includes("/contratos/ct-pgm/documentos?competencia=2026-07"),
		),
	).toBe(true);
});

it("Cancelar a busca volta ao início e ignora a resposta que chegar depois", async () => {
	const resposta = adiada();
	respostaDoLevantamento = () => resposta.promessa;
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();

	await act(async () => resposta.responder(ENCONTRADO));
	expect(screen.queryByText("PA-PGM-251015-159 v5.0.pdf")).not.toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Escolher planilha" })).toBeInTheDocument();
});

it("sem número na planilha: Enviar o contrato do computador leva ao preenchimento à mão, com a planilha", async () => {
	respostaDoLevantamento = () =>
		Response.json({ situacao: "sem-referencia", leitura: { referencia: null, competencia: null } });
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());

	fireEvent.click(await screen.findByRole("button", { name: "Enviar o contrato do computador" }));
	expect(screen.getByLabelText("Contrato")).toBeInTheDocument();
	expect(screen.getByText("PGM_Levantamento.xlsx")).toBeInTheDocument();
	expect(screen.getByText("O levantamento não identificou o contrato.")).toBeInTheDocument();

	fireEvent.click(screen.getByRole("button", { name: "Buscar no cadastro" }));
	expect(
		await screen.findByRole("dialog", { name: "Não achamos o número do contrato neste levantamento" }),
	).toBeInTheDocument();
});

it("Preencher à mão mostra os três documentos e o que falta", () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	expect(screen.getByLabelText("Levantamento")).toBeInTheDocument();
	expect(screen.getByLabelText("Contrato")).toBeInTheDocument();
	expect(screen.getByLabelText("Aditivos da proposta")).toBeInTheDocument();
	expect(screen.getByText("comece aqui")).toBeInTheDocument();
	expect(screen.getByText("Escolha o levantamento para começar.")).toBeInTheDocument();
});

it("proposta enviada do computador não é trocada pela do cadastro", async () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	escolher("Contrato", new File(["%PDF"], "minha-proposta.pdf"));
	escolher("Levantamento", PLANILHA());

	expect(await screen.findByRole("button", { name: /Usar a proposta do cadastro/ })).toBeInTheDocument();
	expect(screen.getByText("minha-proposta.pdf")).toBeInTheDocument();
});

it("gera mandando as propostas do cadastro por referência", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().get("contrato_arquivo_id")).toBe("pa-04");
	expect(corpoDaGeracao().getAll("aditivos")).toEqual(["cadastro:pa-05"]);
	expect(corpoDaGeracao().get("contrato_id")).toBe("ct-pgm");
});

it("remover o aditivo tira ele do envio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Remover PA-PGM-260304-715.pdf" }));
	fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));

	await waitFor(() => expect(corpoDaGeracao()).toBeDefined());
	expect(corpoDaGeracao().getAll("aditivos")).toEqual([]);
});

it("Procurar nas pastas põe outra proposta do contrato no campo Contrato", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	fireEvent.click(screen.getByRole("button", { name: "Procurar nas pastas do cliente" }));
	// A proposta em uso aparece marcada na pasta do termo.
	expect(await screen.findByRole("button", { name: /5\) TA 04 - Prorrogação.*em uso/ })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /1\) Contrato Inicial/ }));
	fireEvent.click(screen.getByRole("radio", { name: /PC-PGM-240715-100 v7\.0\.pdf/ }));
	fireEvent.click(screen.getByRole("button", { name: "Usar este arquivo" }));

	expect(screen.getByText("PC-PGM-240715-100 v7.0.pdf")).toBeInTheDocument();
	// É uma das propostas do histórico: leva a origem de sempre, não a pasta.
	expect(screen.getByText(/Do cadastro · contrato inicial, desde 01\/12\/2024/)).toBeInTheDocument();
});

it("os documentos em linhas: o levantamento primeiro, cada um com o arquivo e de onde veio", async () => {
	render(<ConferePage />);
	escolher("Levantamento", PLANILHA());
	await screen.findByText("PA-PGM-251015-159 v5.0.pdf");

	const linhas = Array.from(screen.getByRole("list", { name: "Documentos" }).children);
	expect(linhas.map((linha) => linha.querySelector("p")?.textContent)).toEqual([
		"Levantamento",
		"Contrato",
		"Aditivos da proposta",
	]);
	expect(linhas[0]).toHaveTextContent("PGM_Levantamento.xlsx");
	expect(linhas[0]).toHaveTextContent("Do computador");
	expect(linhas[1]).toHaveTextContent("Do cadastro · TA 04, renovação desde 01/12/2025");
});

it("Enviar do computador, no Contrato, abre o seletor do campo Contrato", () => {
	const clique = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	fireEvent.click(screen.getByRole("button", { name: "Enviar do computador" }));
	expect(clique.mock.contexts[0]).toBe(screen.getByLabelText("Contrato"));
});

it("aditivos vazios numa linha só", () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	expect(screen.getByText("Nenhum aditivo")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Procurar nas pastas" })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "+ Enviar do computador" })).toBeInTheDocument();
});

it("soltar a planilha no início busca o contrato", async () => {
	render(<ConferePage />);
	soltar(screen.getByText("Planilha de medição da competência, em XLSX"), new File(["x"], "PGM.xlsx"));
	expect(await screen.findByText("PA-PGM-251015-159 v5.0.pdf")).toBeInTheDocument();
});

it("PDF solto no levantamento avisa e não busca nada", () => {
	render(<ConferePage />);
	soltar(screen.getByText("Planilha de medição da competência, em XLSX"), new File(["%PDF"], "proposta.pdf"));
	expect(screen.getByText("O levantamento é a planilha .xlsx — proposta.pdf não é.")).toBeInTheDocument();
	expect(espiao.mock.calls.some(([url]) => String(url).endsWith("/levantamento"))).toBe(false);
});

it("PDFs soltos nos aditivos entram na lista, na ordem", () => {
	render(<ConferePage />);
	fireEvent.click(screen.getByRole("button", { name: "Preencher à mão" }));
	soltar(
		screen.getByText("Opcional. Um ou mais PDFs, aplicados na ordem da lista"),
		new File(["%PDF"], "a.pdf"),
		new File(["%PDF"], "b.pdf"),
	);
	expect(screen.getByText(/^1\. a\.pdf/)).toBeInTheDocument();
	expect(screen.getByText(/^2\. b\.pdf/)).toBeInTheDocument();
});
