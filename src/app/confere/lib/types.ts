/** Contratos da API — espelham `backend/src/api/schemas.py`. */

export interface Achado {
	validacao: string;
	severidade: "BLOQUEIA" | "AVISA";
	mensagem: string;
	codigo: string | null;
	/** ESPEC 025 `R-DOC-05` — o achado em quatro partes.
	 *
	 *  **Opcionais**: onze validações continuam mandando só `mensagem`, e o
	 *  cartão as renderiza como sempre. Exigir as quatro partes faria essas onze
	 *  sumirem da tela, e o teste que pegaria isso é o da `V-CTR-03`, que
	 *  ninguém lembraria de rodar contra a interface. */
	titulo?: string;
	causa?: string;
	acao?: string;
	detalhe?: string;
}

export interface RespostaBloqueada {
	detalhe: string;
	bloqueantes: Achado[];
	avisos: Achado[];
	/** ESPEC 029 `R-IDT-10` — os achados que **uma resposta destrava**, separados
	 *  dos que exigem outro arquivo. Opcionais: o backend anterior a esta espec
	 *  não os manda, e a tela continua funcionando sem eles. */
	confirmaveis?: Achado[];
	pode_prosseguir?: boolean;
}

/** ESPEC 029 `R-IDT-10` — a resposta do portão, antes dos ~30 s de geração.
 *
 *  `combinam` inclui o caso em que algum lado não declara identidade: ausência
 *  de sinal é ausência de evidência, nunca acusação (`R-IDT-06`). */
export interface RespostaDaConferencia {
	combinam: boolean;
	contrato: string | null;
	levantamento: string | null;
	achados: Achado[];
}

/** As cinco colunas do relatório. As quantidades já vêm formatadas do backend:
 *  precisam sair idênticas às do PDF, e duplicar a regra de formatação em
 *  TypeScript seria manter a mesma decisão em dois lugares. */
export interface LinhaDoGrid {
	codigo: string;
	descricao: string;
	unidade: string;
	contratada: string;
	medida: string;
	/** Contratada menos medida. Negativo indica consumo acima do contratado. */
	saldo: string;
	perfil_ou_pacote: boolean;
	/** Medido sem contrapartida no contrato (ESPEC 002 `R-DIV-05`). Campo aditivo
	 *  da ESPEC 009: a mesma linha serve ao grid e às quatro situações. */
	sem_previsao_contratual: boolean;
}

/** ESPEC 021 — uma linha que saiu `1 / 1` por derivação (`R-REL-08`).
 *
 *  `contratada` e `medida` são o texto **da célula**, como o leitor o entrega:
 *  `-`, `F`, `PACOTE` e `2` chegam assim e são exibidos assim (`R-PER-02`). Não
 *  os trate — normalizar aqui repetiria na tela o apagamento que esta tabela
 *  existe para desfazer.
 *
 *  `saiu` vem pronto do backend, pelo mesmo motivo que as quantidades do grid:
 *  `R-REL-08` é regra de domínio, e montá-la aqui a colocaria em duas
 *  linguagens. */
export interface LinhaDerivada {
	/** Número da linha na aba `Levantamento` — o endereço da célula. */
	linha: number;
	codigo: string;
	/** A descrição **da aba**, não a contratual que o documento usa (`D-01`). */
	descricao: string;
	contratada: string;
	medida: string;
	/** O que o documento recebeu: `1 / 1`. */
	saiu: string;
}

/** ESPEC 031 `R-APU-08` — uma linha que saiu `0` porque a apuração descontada
 *  da seção não a repete.
 *
 *  Irmã de `LinhaDerivada`: um número que o sistema inferiu chega a quem confere
 *  com o que a planilha trazia ao lado. A diferença é a natureza da inferência —
 *  ali uma célula não numérica, aqui uma **linha ausente**, indistinguível de
 *  esquecimento sem os dois blocos nomeados.
 */
export interface LinhaZerada {
	/** Número da linha na aba `Levantamento` — o endereço da célula. */
	linha: number;
	codigo: string;
	/** A descrição **da aba**, não a contratual. */
	descricao: string;
	/** Onde a linha está. */
	bloco_bruto: string;
	/** Onde ela **não** está — o que autoriza o zero. */
	bloco_descontado: string;
	/** Texto da célula no bloco cheio, intacto: o número que o zero substituiu. */
	medida: string;
	/** O que o documento recebeu: `contratada / 0`. */
	saiu: string;
}

/** ESPEC 023 — o contratado do contrato diverge do da planilha.
 *
 *  Substitui as frases âmbar da `V-REC-01`. As quantidades já vêm formatadas do
 *  backend, como em `LinhaDoGrid` e pelo mesmo motivo.
 *
 *  `tem_aditivo_aplicado` é o que separa os **dois estados** (`R-FON-02`): sem
 *  aditivo tocando o código, o diagnóstico provável é *falta uma peça*; com ele,
 *  os números não fecham nem com a peça, e isso é mais grave. A decisão vive no
 *  domínio e não aqui — reconstituí-la na tela exigiria conhecer os blocos das
 *  peças submetidas (`D-01`).
 */
export interface DivergenciaDeFonte {
	codigo: string;
	descricao: string;
	unidade: string;
	no_contrato: string;
	na_planilha: string;
	/** O delta do aditivo. Ausente quando nenhum tocou o código. */
	no_aditivo: string | null;
	/** O contratado **antes** do aditivo. Com `no_aditivo`, forma a decomposição
	 *  que prova ao leitor que a soma foi feita (`R-FON-04`). */
	na_proposta: string | null;
	/** Com sinal explícito — `+1.100,00`, `−80,00`. O sinal é a informação. */
	diferenca: string;
	/** Nulo quando o contratado é zero e a proporção não existe. */
	variacao_pct: number | null;
	tem_aditivo_aplicado: boolean;
	severidade: "CRITICO" | "MAIOR_RELEVANCIA";
}

/** ESPEC 009 — as quatro situações da análise, na ordem de gravidade. */
export type Classificacao =
	| "CRITICO"
	| "MAIOR_RELEVANCIA"
	| "DIVERGENTE"
	| "SEM_DIVERGENCIA";

export interface SituacaoDaAnalise {
	classificacao: Classificacao;
	/** Vem do backend, não daqui: tela e arquivo têm de dizer a mesma coisa. */
	rotulo: string;
	glosa: string;
	quantidade: number;
	/** Itens que entram como 1/1 por `R-REC-04` e nunca poderiam divergir. */
	perfis_ou_pacotes: number;
	linhas: LinhaDoGrid[];
}

export interface Analise {
	contrato_referencia: string;
	proposta_origem: string;
	competencia: string;
	total_itens: number;
	/** Sempre as quatro, inclusive vazias (`R-API-01`). */
	situacoes: SituacaoDaAnalise[];
}

export interface RespostaRelatorio {
	titulo: string;
	data_levantamento: string | null;
	contrato_referencia: string;
	total_linhas: number;
	total_divergencias: number;
	/** ESPEC 018 `R-REL-05` — era `secoes`. O documento perdeu o agrupamento, e
	 *  o grid o acompanha: lista única, na ordem do relatório. */
	divergencias: LinhaDoGrid[];
	/** `D-06` — o que a aba `Levantamento` traz e o contrato não conhece. Deixou
	 *  de ser omitido do documento: agora sai no bloco final dele.
	 *
	 *  **A lista aqui é maior que a do documento** (ESPEC 028 `R-ZER-05`): o
	 *  `.docx` não desenha a linha que zera as duas quantidades, e o grid
	 *  continua com todas — quem confere precisa ver que o item existe na aba. */
	demais_itens: LinhaDoGrid[];
	analise: Analise;
	/** ESPEC 021 — as linhas `1 / 1` por derivação, na ordem da aba. Ausente da
	 *  `RespostaBloqueada`: o caminho bloqueado não deriva linha nenhuma. */
	linhas_derivadas: LinhaDerivada[];
	/** ESPEC 031 — as linhas que a apuração descontada não repete. Opcional:
	 *  campo aditivo, e resposta sem zeradas é a esmagadora maioria.
	 *
	 *  **A tela deixou de mostrá-las (ESPEC 031 v1.2, `R-APU-08` revogada), e o
	 *  campo fica.** Removê-lo destruiria a informação; mantê-lo a deixa
	 *  disponível para quem consome a API e para uma tela futura, ao custo de
	 *  alguns bytes na resposta. */
	linhas_zeradas?: LinhaZerada[];
	avisos: Achado[];
	/** ESPEC 023 — as divergências de contratado, na ordem de `R-FON-06`. */
	divergencias_de_fonte: DivergenciaDeFonte[];
	docx_base64: string;
	analise_xlsx_base64: string;
}

export type Estado =
	| { situacao: "inicial" }
	| { situacao: "processando" }
	// Duas URLs desde a ESPEC 009. `url` virou `urlDocx`/`urlAnalise` de
	// propósito: com dois blobs, "a url" é ambígua — e a ambiguidade aqui custa
	// um `revokeObjectURL` esquecido, que é exatamente o defeito que `R-ACE-18`
	// existe para impedir.
	| {
			situacao: "pronto";
			relatorio: RespostaRelatorio;
			urlDocx: string;
			urlAnalise: string;
	  }
	| {
			situacao: "bloqueado";
			bloqueantes: Achado[];
			avisos: Achado[];
			/** ESPEC 029 `R-IDT-10` — os achados que **uma resposta destrava**.
			 *  Chegam aqui só quando o portão não foi consultado antes. */
			confirmaveis?: Achado[];
	  }
	| { situacao: "erro"; mensagem: string };

/** Os dois arquivos que o usuário tem em mãos.
 *
 *  O catálogo — que define seções, ordem e apresentação — vem embutido na
 *  aplicação e reproduz o relatório de comprovação atual. A API ainda aceita um
 *  catálogo por upload, para um contrato com apresentação diferente, mas isso
 *  não pertence à tela do dia a dia.
 */
export const CAMPOS = [
	{
		nome: "contrato",
		rotulo: "Contrato",
		descricao: "Proposta comercial em PDF, com a tabela de itens",
		aceita: ".pdf",
	},
	{
		nome: "levantamento",
		rotulo: "Levantamento",
		descricao: "Planilha de medição da competência, em XLSX",
		aceita: ".xlsx",
	},
] as const;

export type NomeDoCampo = (typeof CAMPOS)[number]["nome"];

/** ESPEC 019 `R-ADT-10` — o terceiro campo: aditivos da proposta, **opcionais**
 *  e em qualquer número.
 *
 *  Fora de `CAMPOS` de propósito. `CAMPOS` é a lista do que o botão *Gerar
 *  relatório* exige, e incluir o aditivo aqui tornaria insubmissível todo
 *  contrato que não tenha nenhum — o piloto do SMIT, por exemplo (`D-10`).
 *
 *  A ordem de envio é a ordem de aplicação (`R-ADT-07`, `D-11`): um código
 *  incluído por um aditivo pode ser excluído por outro posterior, e nada no
 *  documento permite ordená-los sozinho. */
export const CAMPO_ADITIVOS = {
	nome: "aditivos",
	rotulo: "Aditivos da proposta",
	descricao:
		"Opcional. Um ou mais PDFs; aplicados na ordem em que forem selecionados",
	aceita: ".pdf",
} as const;
