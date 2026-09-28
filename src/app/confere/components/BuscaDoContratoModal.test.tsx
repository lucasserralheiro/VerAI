import { act, fireEvent, render, screen } from "@testing-library/react";

import type { Identificacao } from "../lib/types";
import { BuscaDoContratoModal, TEMPO_MINIMO_DA_BUSCA } from "./BuscaDoContratoModal";

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

type Props = Parameters<typeof BuscaDoContratoModal>[0];

function props(mais: Partial<Props> = {}): Props {
	return {
		aberto: true,
		motivo: "planilha",
		nomeDaPlanilha: "SMIT_Levantamento.xlsx",
		identificacao: { situacao: "lendo" },
		carregandoContrato: false,
		onEscolherContrato: jest.fn(),
		onCancelar: jest.fn(),
		onEnviarDoComputador: jest.fn(),
		onTrocarPlanilha: jest.fn(),
		...mais,
	};
}

function dialogo(): HTMLDialogElement {
	return document.querySelector("dialog") as HTMLDialogElement;
}

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

it("buscando: diz o que está fazendo e de qual planilha", () => {
	render(<BuscaDoContratoModal {...props()} />);
	expect(screen.getByRole("dialog", { name: "Buscando os documentos do contrato" })).toBeInTheDocument();
	expect(screen.getByText("SMIT_Levantamento.xlsx")).toBeInTheDocument();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Lendo a planilha e procurando o contrato, a proposta e os aditivos da competência…",
	);
});

it("fechado, não deixa texto na página", () => {
	render(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(screen.queryByText(/Buscando/)).not.toBeInTheDocument();
});

it("resposta rápida: fica aberto até o tempo mínimo — o fundo não pisca", () => {
	jest.useFakeTimers();
	const { rerender } = render(<BuscaDoContratoModal {...props()} />);
	rerender(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(dialogo().open).toBe(true);
	expect(screen.getByRole("status")).toHaveTextContent(/Lendo a planilha/);
	act(() => jest.advanceTimersByTime(TEMPO_MINIMO_DA_BUSCA));
	expect(dialogo().open).toBe(false);
});

it("passado o tempo mínimo, fecha na hora", () => {
	jest.useFakeTimers();
	const { rerender } = render(<BuscaDoContratoModal {...props()} />);
	act(() => jest.advanceTimersByTime(TEMPO_MINIMO_DA_BUSCA + 100));
	rerender(<BuscaDoContratoModal {...props({ aberto: false })} />);
	expect(dialogo().open).toBe(false);
});

it("Cancelar fecha na hora e avisa", () => {
	const p = props();
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Cancelar enquanto chegam os documentos do contrato escolhido: avisa e o modal fica", () => {
	const p = props({ carregandoContrato: true });
	render(<BuscaDoContratoModal {...p} />);
	expect(screen.getByRole("status")).toHaveTextContent("Buscando a proposta e os aditivos do contrato…");
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(true);
});

it.each<[string, Identificacao, string]>([
	["não encontrado", { situacao: "nao-encontrado", leitura, sugestoes: [sugestao] }, "O contrato TC 99/SMIT/2026 não está no cadastro"],
	["empate", { situacao: "ambiguo", leitura, candidatos: [sugestao] }, "Mais de um contrato com o número TC 99/SMIT/2026"],
	["sem número", { situacao: "sem-referencia", leitura }, "Não achamos o número do contrato neste levantamento"],
	["ilegível", { situacao: "ilegivel", mensagem: "A planilha não abriu" }, "A planilha não abriu"],
	["falha", { situacao: "falhou" }, "Não foi possível buscar o contrato agora"],
])("pergunta (%s): título, enviar do computador e trocar planilha", (_caso, identificacao, titulo) => {
	render(<BuscaDoContratoModal {...props({ identificacao })} />);
	expect(screen.getByRole("dialog", { name: titulo })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Enviar o contrato do computador" })).toBeInTheDocument();
	expect(screen.getByLabelText("Trocar planilha")).toBeInTheDocument();
});

it("empate não tem busca livre; não encontrado tem", () => {
	const { rerender } = render(
		<BuscaDoContratoModal {...props({ identificacao: { situacao: "ambiguo", leitura, candidatos: [sugestao] } })} />,
	);
	expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
	rerender(
		<BuscaDoContratoModal {...props({ identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [] } })} />,
	);
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
});

it("escolher a sugestão chama o contrato", () => {
	const p = props({ identificacao: { situacao: "nao-encontrado", leitura, sugestoes: [sugestao] } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: /TC 52\/SMIT\/2024/ }));
	expect(p.onEscolherContrato).toHaveBeenCalledWith("ct-52");
});

it("Enviar o contrato do computador fecha na hora e avisa", () => {
	const p = props({ identificacao: { situacao: "sem-referencia", leitura } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent.click(screen.getByRole("button", { name: "Enviar o contrato do computador" }));
	expect(p.onEnviarDoComputador).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Esc na pergunta faz o mesmo que Enviar do computador: a planilha fica", () => {
	const p = props({ identificacao: { situacao: "sem-referencia", leitura } });
	render(<BuscaDoContratoModal {...p} />);
	fireEvent(dialogo(), new Event("cancel", { cancelable: true }));
	expect(p.onEnviarDoComputador).toHaveBeenCalledTimes(1);
	expect(p.onCancelar).not.toHaveBeenCalled();
	expect(dialogo().open).toBe(false);
});

it("Esc enquanto busca é Cancelar", () => {
	const p = props();
	render(<BuscaDoContratoModal {...p} />);
	fireEvent(dialogo(), new Event("cancel", { cancelable: true }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
});

it("Trocar planilha entrega o arquivo novo", () => {
	const p = props({ identificacao: { situacao: "falhou" } });
	render(<BuscaDoContratoModal {...p} />);
	const arquivo = new File(["x"], "outra.xlsx");
	fireEvent.change(screen.getByLabelText("Trocar planilha"), { target: { files: [arquivo] } });
	expect(p.onTrocarPlanilha).toHaveBeenCalledWith(arquivo);
});

it("trocar contrato: só a busca, e Cancelar só fecha", () => {
	const p = props({ motivo: "trocar", identificacao: { situacao: "ociosa" } });
	render(<BuscaDoContratoModal {...p} />);
	expect(screen.getByRole("dialog", { name: "Escolha outro contrato" })).toBeInTheDocument();
	expect(screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
	expect(p.onCancelar).toHaveBeenCalledTimes(1);
	expect(dialogo().open).toBe(false);
});

it("Enter na busca busca — e cancela o padrão", () => {
	const espiao = jest.spyOn(global, "fetch").mockResolvedValue(Response.json([]));
	render(<BuscaDoContratoModal {...props({ identificacao: { situacao: "sem-referencia", leitura } })} />);
	const busca = screen.getByRole("searchbox", { name: "Buscar contrato no cadastro" });
	fireEvent.change(busca, { target: { value: "cgm" } });
	// `fireEvent` devolve `false` quando o handler chamou `preventDefault()`.
	expect(fireEvent.keyDown(busca, { key: "Enter" })).toBe(false);
	expect(String(espiao.mock.calls[0][0])).toContain("/api/confere/contratos?busca=cgm");
});
