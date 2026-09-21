import type { Metadata } from "next";

import { Rodape } from "@/app/components/Rodape";

import "./globals.css";

export const metadata: Metadata = {
	title: "Confere",
	description:
		"Confere o contratado. Confere o utilizado. Compara o que foi contratado com o que foi medido e gera o relatório de comprovação.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			{/* Coluna flex para o rodapé encostar na base quando o conteúdo é curto,
			    sem recorrer a `position: fixed`, que cobriria o grid em telas
			    baixas (ESPEC 006 D-04). */}
			<body className="flex min-h-screen flex-col antialiased">
				{/* Primeiro focável do documento (`R-ACE-08`), por isso antes de
				    `{children}`. Invisível até receber foco. */}
				<a
					href="#conteudo"
					className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-teal-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
				>
					Pular para o conteúdo
				</a>
				{children}
				<Rodape />
			</body>
		</html>
	);
}
