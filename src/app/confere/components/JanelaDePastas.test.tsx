import { fireEvent, render, screen } from "@testing-library/react";

import { JanelaDePastas } from "./JanelaDePastas";

const PASTAS = {
	cliente: { id: "cl-cgm", nome: "Controladoria Geral do Município", sigla: "CGM" },
	arquivos: [
		{
			arquivoId: "pc",
			nome: "PC-CGM-240603-82 v3.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_COMERCIAL",
			pasta: ["TC 16-CGM-2024", "1) Contrato Inicial"],
		},
		{
			arquivoId: "pa-01",
			nome: "PA-CGM-250403-035 v1.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 16-CGM-2024", "2) TA 01"],
		},
		{
			arquivoId: "pa-02",
			nome: "PA-CGM- 250912-127 v4.0.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_ADITIVO",
			pasta: ["TC 16-CGM-2024", "3) TA 02"],
		},
		{
			arquivoId: "xlsx",
			nome: "Planilha.xlsx",
			extensao: "xlsx",
			categoria: "PLANILHA",
			pasta: ["TC 16-CGM-2024", "3) TA 02"],
		},
		{
			arquivoId: "pc-12",
			nome: "PC-CGM-230726-82 v3.3.pdf",
			extensao: "pdf",
			categoria: "PROPOSTA_COMERCIAL",
			pasta: ["TC 12-CGM-2023", "1) Contrato Inicial"],
		},
	],
};

beforeEach(() => {
	jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
		const url = String(entrada);
		if (url.endsWith("/api/confere/clientes/cl-cgm/pastas")) return Response.json(PASTAS);
		if (url.endsWith("/api/clientes")) {
			return Response.json([{ id: "cl-cgm", nome: "Controladoria Geral do Município", siglaLegado: "CGM" }]);
		}
		return new Response(null, { status: 404 });
	});
});

afterEach(() => jest.restoreAllMocks());

function abrir(props: Partial<Parameters<typeof JanelaDePastas>[0]> = {}) {
	const onEscolher = jest.fn();
	const onFechar = jest.fn();
	render(
		<JanelaDePastas
			aberto
			clienteId="cl-cgm"
			finalidade="contrato"
			arquivoInicial="pa-02"
			onEscolher={onEscolher}
			onFechar={onFechar}
			{...props}
		/>,
	);
	return { onEscolher, onFechar };
}

it("abre na pasta do contrato da proposta atual", async () => {
	abrir();
	expect(await screen.findByRole("button", { name: /3\) TA 02/ })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /1\) Contrato Inicial/ })).toBeInTheDocument();
	expect(screen.queryByRole("button", { name: /TC 12-CGM-2023/ })).not.toBeInTheDocument();
});

it("entra na pasta, escolhe o PDF e usa", async () => {
	const { onEscolher, onFechar } = abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.click(screen.getByRole("radio", { name: /PA-CGM- 250912-127 v4\.0\.pdf/ }));
	fireEvent.click(screen.getByRole("button", { name: "Usar este arquivo" }));
	expect(onEscolher).toHaveBeenCalledWith([
		{ arquivoId: "pa-02", nome: "PA-CGM- 250912-127 v4.0.pdf", origem: null, pasta: "3) TA 02" },
	]);
	expect(onFechar).toHaveBeenCalled();
});

it("arquivo que não é PDF aparece mas não pode ser escolhido", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	expect(screen.getByRole("radio", { name: /Planilha\.xlsx/ })).toBeDisabled();
});

it("o caminho é clicável e volta à raiz do cliente", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	fireEvent.click(screen.getByRole("button", { name: "CGM" }));
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
});

it("busca por nome em todas as pastas", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	fireEvent.change(screen.getByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "230726" },
	});
	expect(screen.getByRole("radio", { name: /PC-CGM-230726-82 v3\.3\.pdf/ })).toBeInTheDocument();
	expect(screen.queryByRole("radio", { name: /PC-CGM-240603/ })).not.toBeInTheDocument();
});

it("aditivos: vários, na ordem dos cliques", async () => {
	const { onEscolher } = abrir({ finalidade: "aditivos" });
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "PA-CGM" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM- 250912-127/ }));
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ }));
	fireEvent.click(screen.getByRole("button", { name: "Adicionar 2 aditivos" }));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-02", "pa-01"]);
});

it("sem cliente: pede o cliente primeiro", async () => {
	abrir({ clienteId: undefined, arquivoInicial: undefined });
	fireEvent.click(await screen.findByRole("button", { name: /CGM · Controladoria/ }));
	expect(await screen.findByRole("button", { name: /TC 16-CGM-2024/ })).toBeInTheDocument();
});
