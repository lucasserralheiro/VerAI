import { fireEvent, render, screen } from "@testing-library/react";

import { useSoltarArquivos } from "./useSoltarArquivos";

function Alvo({
	onSoltar,
	multiplos = false,
	desabilitado = false,
}: {
	onSoltar: (arquivos: File[]) => void;
	multiplos?: boolean;
	desabilitado?: boolean;
}) {
	const soltar = useSoltarArquivos({
		extensao: ".xlsx",
		multiplos,
		desabilitado,
		onSoltar,
		mensagemDeTipoErrado: (arquivo) => `${arquivo.name} não é planilha`,
	});
	return (
		<div data-testid="alvo" {...soltar.alvo}>
			<span>cartão</span>
			{soltar.arrastando && <span>solte aqui</span>}
			{soltar.erro && <p>{soltar.erro}</p>}
		</div>
	);
}

const transferencia = (...arquivos: File[]) => ({ dataTransfer: { files: arquivos, types: ["Files"] } });
const planilha = new File(["x"], "levantamento.xlsx");
const pdf = new File(["x"], "proposta.pdf");

it("destaca enquanto o arquivo está em cima, inclusive passando por um filho", () => {
	render(<Alvo onSoltar={jest.fn()} />);
	const alvo = screen.getByTestId("alvo");
	fireEvent.dragEnter(alvo, transferencia(planilha));
	fireEvent.dragEnter(screen.getByText("cartão"), transferencia(planilha));
	fireEvent.dragLeave(alvo, transferencia(planilha));
	expect(screen.getByText("solte aqui")).toBeInTheDocument();
	fireEvent.dragLeave(screen.getByText("cartão"), transferencia(planilha));
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});

it("solta o tipo certo", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha));
	expect(onSoltar).toHaveBeenCalledWith([planilha]);
});

it("tipo errado: avisa e não solta", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(pdf));
	expect(onSoltar).not.toHaveBeenCalled();
	expect(screen.getByText("proposta.pdf não é planilha")).toBeInTheDocument();
});

it("vários: solta os certos e avisa do resto; sem 'multiplos', só o primeiro", () => {
	const onSoltar = jest.fn();
	const { unmount } = render(<Alvo onSoltar={onSoltar} multiplos />);
	const outra = new File(["x"], "b.xlsx");
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha, pdf, outra));
	expect(onSoltar).toHaveBeenCalledWith([planilha, outra]);
	expect(screen.getByText("proposta.pdf não é planilha")).toBeInTheDocument();
	unmount();

	const umSo = jest.fn();
	render(<Alvo onSoltar={umSo} />);
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha, outra));
	expect(umSo).toHaveBeenCalledWith([planilha]);
});

it("desabilitado (gerando): não destaca nem solta", () => {
	const onSoltar = jest.fn();
	render(<Alvo onSoltar={onSoltar} desabilitado />);
	fireEvent.dragEnter(screen.getByTestId("alvo"), transferencia(planilha));
	fireEvent.drop(screen.getByTestId("alvo"), transferencia(planilha));
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
	expect(onSoltar).not.toHaveBeenCalled();
});

it("arrastar texto (não arquivo) não destaca", () => {
	render(<Alvo onSoltar={jest.fn()} />);
	fireEvent.dragEnter(screen.getByTestId("alvo"), { dataTransfer: { files: [], types: ["text/plain"] } });
	expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});
