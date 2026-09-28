import { fireEvent, render, screen, within } from "@testing-library/react";

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
			arquivoId: "ata",
			nome: "Ata.docx",
			extensao: "docx",
			categoria: "OUTRO",
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

let espiao: jest.SpyInstance;

beforeEach(() => {
	espiao = jest.spyOn(global, "fetch").mockImplementation(async (entrada) => {
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

it("Voltar sobe uma pasta e, na raiz, fica indisponível", async () => {
	abrir();
	await screen.findByRole("button", { name: /3\) TA 02/ });
	const voltar = screen.getByRole("button", { name: "Voltar" });
	fireEvent.click(voltar);
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
	expect(voltar).toHaveAttribute("aria-disabled", "true");
	fireEvent.click(voltar);
	expect(screen.getByRole("button", { name: /TC 12-CGM-2023/ })).toBeInTheDocument();
});

it("Outro cliente e depois Voltar para CGM: o mesmo cliente, na mesma pasta, sem buscar de novo", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.click(screen.getByRole("button", { name: "Outro cliente" }));
	fireEvent.click(await screen.findByRole("button", { name: "Voltar para CGM" }));
	expect(await screen.findByRole("radio", { name: /PA-CGM- 250912-127/ })).toBeInTheDocument();
	const buscasDasPastas = espiao.mock.calls.filter(([url]) => String(url).endsWith("/pastas"));
	expect(buscasDasPastas).toHaveLength(1);
});

it("clicar em qualquer parte da linha seleciona, e o rodapé diz o quê", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	expect(screen.getByText("Nenhum arquivo selecionado")).toBeInTheDocument();
	fireEvent.click(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(screen.getByRole("radio", { name: /PA-CGM- 250912-127/ })).toBeChecked();
	expect(screen.getByText("Selecionado: PA-CGM- 250912-127 v4.0.pdf")).toBeInTheDocument();
});

it("duplo clique no PDF usa na hora", async () => {
	const { onEscolher, onFechar } = abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	fireEvent.doubleClick(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-02"]);
	expect(onFechar).toHaveBeenCalled();
});

it("duplo clique nos aditivos leva junto os já marcados, na ordem", async () => {
	const { onEscolher } = abrir({ finalidade: "aditivos" });
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "PA-CGM" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ }));
	fireEvent.doubleClick(screen.getByText("PA-CGM- 250912-127 v4.0.pdf"));
	expect(onEscolher.mock.calls[0][0].map((d: { arquivoId: string }) => d.arquivoId)).toEqual(["pa-01", "pa-02"]);
});

it("em uso: no arquivo e na pasta que o contém", async () => {
	abrir({ emUso: ["pa-02"] });
	const pasta = await screen.findByRole("button", { name: /3\) TA 02/ });
	expect(within(pasta).getByText("em uso")).toBeInTheDocument();
	expect(
		within(screen.getByRole("button", { name: /1\) Contrato Inicial/ })).queryByText("em uso"),
	).not.toBeInTheDocument();
	fireEvent.click(pasta);
	expect(screen.getByRole("radio", { name: /PA-CGM- 250912-127.*em uso/ })).toBeInTheDocument();
});

it("aditivo que já está na lista aparece marcado e não pode ser escolhido de novo", async () => {
	abrir({ finalidade: "aditivos", jaNaLista: ["pa-01"] });
	fireEvent.click(await screen.findByRole("button", { name: /2\) TA 01/ }));
	const caixa = screen.getByRole("checkbox", { name: /PA-CGM-250403-035/ });
	expect(caixa).toBeDisabled();
	expect(caixa).toBeChecked();
	expect(screen.getByText("já na lista")).toBeInTheDocument();
});

it("cada pasta diz quantos arquivos tem, contando as de dentro", async () => {
	abrir();
	expect(await screen.findByRole("button", { name: /3\) TA 02.*3 arquivos/ })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /1\) Contrato Inicial.*1 arquivo/ })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "CGM" }));
	expect(screen.getByRole("button", { name: /TC 16-CGM-2024.*5 arquivos/ })).toBeInTheDocument();
});

it("PDFs antes dos outros arquivos", async () => {
	abrir();
	fireEvent.click(await screen.findByRole("button", { name: /3\) TA 02/ }));
	// `textContent` do rótulo inclui o texto do ícone ("PDF"/"···"); por isso
	// `toContain`, não `^`.
	const nomes = screen.getAllByRole("radio").map((radio) => radio.closest("label")?.textContent ?? "");
	expect(nomes[0]).toContain("PA-CGM- 250912-127");
	expect(nomes.slice(1).every((nome) => /só PDF/.test(nome))).toBe(true);
});

it("a busca mostra a pasta de cada arquivo, numa segunda linha", async () => {
	abrir();
	fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar arquivo nas pastas" }), {
		target: { value: "230726" },
	});
	expect(screen.getByText("CGM › TC 12-CGM-2023 › 1) Contrato Inicial")).toBeInTheDocument();
});
