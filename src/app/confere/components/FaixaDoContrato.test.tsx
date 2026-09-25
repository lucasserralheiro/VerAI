import { fireEvent, render, screen } from "@testing-library/react";

import { FaixaDoContrato } from "./FaixaDoContrato";

const leitura = { referencia: "TC 99/SMIT/2026", competencia: { ano: 2026, mes: 7 } };
const sugestao = {
	id: "ct-52",
	clienteId: "cl",
	clienteNome: "SMIT",
	clienteSigla: "SMIT",
	numeroTermo: "TC 52/SMIT/2024",
	descricao: "Sustentação",
	vigenciaFim: null,
	ativo: true,
};

function renderizar(identificacao: Parameters<typeof FaixaDoContrato>[0]["identificacao"]) {
	const onEscolherContrato = jest.fn();
	render(
		<FaixaDoContrato
			identificacao={identificacao}
			contratoDoComputador={false}
			onEscolherContrato={onEscolherContrato}
			onUsarDoCadastro={jest.fn()}
		/>,
	);
	return { onEscolherContrato };
}

afterEach(() => jest.restoreAllMocks());

it("nada antes da planilha", () => {
	const { container } = render(
		<FaixaDoContrato
			identificacao={{ situacao: "ociosa" }}
			contratoDoComputador={false}
			onEscolherContrato={jest.fn()}
			onUsarDoCadastro={jest.fn()}
		/>,
	);
	expect(container).toBeEmptyDOMElement();
});

it("não encontrado: diz o número lido e oferece as sugestões", () => {
	const { onEscolherContrato } = renderizar({ situacao: "nao-encontrado", leitura, sugestoes: [sugestao] });
	expect(screen.getByText(/O contrato TC 99\/SMIT\/2026 não está no cadastro/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(onEscolherContrato).toHaveBeenCalledWith("ct-52");
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
});

it("empate: lista para escolher", () => {
	const { onEscolherContrato } = renderizar({ situacao: "ambiguo", leitura, candidatos: [sugestao] });
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(onEscolherContrato).toHaveBeenCalledWith("ct-52");
});

it("Enter na busca busca — e cancela o padrão, que submeteria o formulário de fora", () => {
	const espiao = jest.spyOn(global, "fetch").mockResolvedValue(Response.json([]));
	renderizar({ situacao: "sem-referencia", leitura });
	const busca = screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" });
	fireEvent.change(busca, { target: { value: "cgm" } });
	// `fireEvent` devolve `false` quando o handler chamou `preventDefault()`.
	expect(fireEvent.keyDown(busca, { key: "Enter" })).toBe(false);
	expect(String(espiao.mock.calls[0][0])).toContain("/api/confere/contratos?busca=cgm");
});
