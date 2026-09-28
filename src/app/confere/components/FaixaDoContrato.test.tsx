import { fireEvent, render, screen } from "@testing-library/react";

import type { DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import { FaixaDoContrato } from "./FaixaDoContrato";

const leitura = { referencia: "TC 99/SMIT/2026", competencia: { ano: 2026, mes: 7 } };
const DOCUMENTOS: DocumentosDoContrato = {
	contrato: {
		id: "ct-52",
		clienteId: "cl",
		clienteNome: "SMIT",
		clienteSigla: "SMIT",
		numeroTermo: "TC 52/SMIT/2024",
		descricao: "Sustentação",
		vigenciaFim: null,
		ativo: true,
	},
	competencia: { ano: 2026, mes: 7, lidaDaPlanilha: true },
	base: { arquivoId: "pa", nome: "PA-SMIT.pdf", origem: null },
	aditivos: [],
	alternativas: [],
	decisoes: [],
	avisos: [],
};

function renderizar(props: Partial<Parameters<typeof FaixaDoContrato>[0]> = {}) {
	const onBuscarContrato = jest.fn();
	const { container } = render(
		<FaixaDoContrato
			identificacao={{ situacao: "ociosa" }}
			contratoDoComputador={false}
			onBuscarContrato={onBuscarContrato}
			onUsarDoCadastro={jest.fn()}
			{...props}
		/>,
	);
	return { onBuscarContrato, container };
}

it("nada antes da planilha, nem enquanto lê — quem mostra a busca é o modal", () => {
	expect(renderizar().container).toBeEmptyDOMElement();
	expect(renderizar({ identificacao: { situacao: "lendo" } }).container).toBeEmptyDOMElement();
});

it("contrato achado: o resumo, e trocar contrato abre a busca", () => {
	const { onBuscarContrato } = renderizar({
		identificacao: { situacao: "encontrado", leitura, documentos: DOCUMENTOS },
		documentos: DOCUMENTOS,
	});
	expect(screen.getByText("Contrato TC 52/SMIT/2024")).toBeInTheDocument();
	expect(screen.getByText(/competência julho\/2026/)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "trocar contrato" }));
	expect(onBuscarContrato).toHaveBeenCalledTimes(1);
	// A busca não abre mais dentro da faixa.
	expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});

it("sem contrato achado: uma linha só, que reabre a busca", () => {
	const { onBuscarContrato } = renderizar({
		identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [] },
	});
	expect(screen.getByText("O levantamento não identificou o contrato.")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Buscar no cadastro" }));
	expect(onBuscarContrato).toHaveBeenCalledTimes(1);
});
