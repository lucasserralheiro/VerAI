"use client";

import { useEffect, useRef, useState } from "react";

import { Barra } from "@/app/components/Barra";
import { ConfirmarLimpeza } from "@/app/components/ConfirmarLimpeza";
import { ResultadoPanel } from "@/app/components/ResultadoPanel";
import { UploadForm } from "@/app/components/UploadForm";
import { conferirIdentidade, gerarRelatorio } from "@/lib/api";
import { type Achado, CAMPOS, type Estado, type NomeDoCampo } from "@/lib/types";

/** ESPEC 015 `R-LMP-11` / `D-05` — a liberação dos dois blobs é de
 *  responsabilidade **única**.
 *
 *  A âncora anterior era "no envio", e o comentário que a justificava dizia:
 *  *"qualquer transição para `erro` ou `bloqueado` passa por aqui"*. Estava certo
 *  sobre `erro` e `bloqueado` e omitia o caminho que **não** passa: `selecionar()`
 *  leva `pronto → inicial` sem tocar em `enviar()`, e as duas URLs sumiam do
 *  estado sem nunca terem sido revogadas — ~3,8 MB retidos pela sessão inteira a
 *  cada troca de arquivo (ESPEC 015 §2.2).
 *
 *  São **três** os caminhos que abandonam `pronto`: enviar, trocar de arquivo e
 *  limpar. A guarda mora aqui dentro, e não em cada chamador, porque três cópias
 *  da mesma condição são três lugares de esquecer — e o segundo já foi esquecido
 *  uma vez, por dois incrementos, sem que nada acusasse. Não há asserção de
 *  memória na suíte; o que há é o `e2e/vazamento.spec.ts`, que mede se a URL
 *  ainda resolve.
 */
function descartar(estado: Estado) {
	if (estado.situacao !== "pronto") return;
	URL.revokeObjectURL(estado.urlDocx);
	URL.revokeObjectURL(estado.urlAnalise);
}

/** Shell fino: cuida do estado da tela e delega o resto aos componentes. */
export default function Home() {
	const [arquivos, setArquivos] = useState<Partial<Record<NomeDoCampo, File>>>({});
	// ESPEC 019 `R-ADT-10` — estado próprio, e não uma entrada de `arquivos`:
	// aquele mapa é de campo único e alimenta o `completo` que habilita o botão.
	// Os aditivos são opcionais e são uma lista (`D-10`).
	const [aditivos, setAditivos] = useState<readonly File[]>([]);
	const [estado, setEstado] = useState<Estado>({ situacao: "inicial" });
	// T-2099 / ESPEC 029 `R-IDT-10` — o achado do portão, enquanto ele espera
	// resposta. Estado próprio e **não** uma situação de `Estado`: a pergunta
	// acontece antes de qualquer processamento, vive no formulário e não
	// substitui o resultado anterior na tela.
	const [pergunta, setPergunta] = useState<Achado | undefined>(undefined);
	const [confirmando, setConfirmando] = useState(false);
	const [aviso, setAviso] = useState("");
	// `R-LMP-04` — zerar `arquivos` não zera o `<input type="file">`: o elemento
	// guarda a seleção anterior em `input.value`, e a tela passaria a dizer uma
	// coisa enquanto o formulário contém outra. Trocar a chave destrói os dois
	// campos e cria dois vazios.
	//
	// A chave vai **nos campos**, não no formulário (TASKS 015 §2.2): remontar o
	// formulário inteiro destruiria também o botão e o destino do foco, no exato
	// instante em que o foco está sendo movido.
	const [chave, setChave] = useState(0);

	const limpar = useRef<HTMLButtonElement>(null);
	const primeiroCampo = useRef<HTMLInputElement>(null);
	// ESPEC 023 `R-FON-07` — o campo de aditivos, para onde a ação do aviso de
	// divergência devolve o foco. O input é `sr-only`; o `focus()` funciona e o
	// anel aparece no rótulo por `has-[:focus-visible]`, que já existe.
	const campoDeAditivos = useRef<HTMLInputElement>(null);

	// `R-LMP-09` — confirmada a limpeza, o foco vai para o primeiro campo, que é
	// onde a próxima ação está. É o análogo de `R-ACE-15` no caminho inverso.
	//
	// Precisa ser efeito, e não uma chamada dentro de `confirmarLimpeza`: naquele
	// instante o campo em tela ainda é o **antigo**, que a chave acabou de marcar
	// para destruição. `focus()` num nó fora do documento **não lança erro** —
	// simplesmente não faz nada, e o foco cai no `<body>`. O sintoma é idêntico ao
	// de não ter escrito a linha. O efeito roda depois da remontagem, quando a ref
	// já aponta para o elemento novo.
	useEffect(() => {
		if (chave === 0) return; // primeiro render: nada foi limpo, não roubar o foco
		primeiroCampo.current?.focus();
	}, [chave]);

	function confirmarLimpeza() {
		descartar(estado);
		setArquivos({});
		setAditivos([]);
		setEstado({ situacao: "inicial" });
		setChave((n) => n + 1);
		setConfirmando(false);
		setPergunta(undefined);
		setAviso("Formulário limpo. Envie novos arquivos para gerar outro relatório.");
	}

	function cancelarLimpeza() {
		setConfirmando(false);
		// `R-LMP-09` — cancelado, o foco volta de onde saiu. Aqui o botão continua
		// montado, porque nada foi limpo: a ref é válida.
		limpar.current?.focus();
	}

	function selecionar(campo: NomeDoCampo, arquivo: File | undefined) {
		// **Antes do `setEstado`**, e a ordem importa mais do que parece: escrever
		// depois também funcionaria — em React o `estado` desta closure ainda é o
		// antigo — e funcionaria **por acidente**, com uma linha que parece errada
		// para quem lê. É mais barato escrever na ordem certa do que explicar por
		// que a errada funciona.
		descartar(estado);
		setArquivos((atual) => ({ ...atual, [campo]: arquivo }));
		setEstado({ situacao: "inicial" });
		setAviso("");
		// Trocado o arquivo, a pergunta perde o objeto: ela falava do par
		// anterior. Guardá-la faria a caixa acusar uma divergência que talvez já
		// não exista — e a próxima resposta do portão a repõe se ainda existir.
		setPergunta(undefined);
	}

	/** `R-ADT-10` — a seleção **substitui** a anterior, como em qualquer campo de
	 *  arquivo múltiplo: o `<input>` só conhece a última escolha, e acumular aqui
	 *  faria a tela listar arquivos que o formulário já não carrega. */
	function selecionarAditivos(escolhidos: readonly File[]) {
		descartar(estado);
		setAditivos(escolhidos);
		setEstado({ situacao: "inicial" });
		setAviso("");
		setPergunta(undefined);
	}

	async function enviar(identidadeConfirmada = false) {
		// `D-10` — a exigência continua sendo só a de `CAMPOS`. Os aditivos são
		// opcionais, e o piloto, que não tem nenhum, segue submissível.
		if (!CAMPOS.every((campo) => arquivos[campo.nome])) return;

		// ESPEC 029 `R-IDT-10` — **o portão vem antes do trabalho.** São ~0,9 s
		// contra os ~30 s da geração: perguntar depois custaria os 30 s para
		// fazer a pergunta e mais 30 para refazer tudo ao ouvir *sim* (`D-10`).
		//
		// `null` é falha aberta (`R-IDT-12`), e segue direto: quem barra o par
		// divergente de verdade é a validação de dentro do fluxo.
		if (!identidadeConfirmada) {
			const conferencia = await conferirIdentidade(
				arquivos as Record<NomeDoCampo, File>,
				aditivos,
			);
			if (conferencia && !conferencia.combinam && conferencia.achados[0]) {
				setPergunta(conferencia.achados[0]);
				return;
			}
		}

		setPergunta(undefined);
		descartar(estado);
		setAviso("");
		setEstado({ situacao: "processando" });
		const resultado = await gerarRelatorio(
			arquivos as Record<NomeDoCampo, File>,
			aditivos,
			identidadeConfirmada,
		);

		// ESPEC 029 `R-IDT-10` — o portão pode ter sido pulado: chamada direta à
		// API não passa por ele, e a falha aberta da `R-IDT-12` o dispensa. Nesses
		// casos a pergunta chega **junto com o bloqueio**, e é aqui que ela volta
		// a ter botão.
		//
		// Só há bloqueio confirmável e nada mais? A pergunta é a mensagem inteira,
		// e a tela volta ao formulário — repetir o mesmo texto no painel de
		// bloqueio seriam duas mensagens para uma causa, que é o que as ESPECs 025
		// e 027 passaram duas entregas eliminando.
		if (resultado.situacao === "bloqueado" && resultado.confirmaveis?.length) {
			setPergunta(resultado.confirmaveis[0]);
			if (resultado.bloqueantes.length === 0) {
				setEstado({ situacao: "inicial" });
				return;
			}
		}

		setEstado(resultado);
	}

	// `R-LMP-02` — o controle existe quando há o que limpar, e **nunca** durante o
	// processamento (`D-02`): ali ele seria lido como cancelar, e a ESPEC 012 §10
	// registrou que a geração não é cancelável — a thread termina o trabalho e a
	// réplica fica ocupada até o fim. Sumir é mais honesto que desabilitar:
	// controle desabilitado convida a esperar que habilite.
	//
	// A condição é também o que faz `D-09` funcionar — toda confirmação exibida
	// corresponde a uma perda real, e é isso que a mantém sendo lida.
	const podeLimpar =
		estado.situacao !== "processando" &&
		(CAMPOS.some((campo) => arquivos[campo.nome]) ||
			aditivos.length > 0 ||
			estado.situacao !== "inicial");

	// A barra fica aqui, e não no `layout`, porque depende do estado da tela: o
	// slot de contexto só existe quando há relatório. Subir o estado para um
	// contexto global por causa de uma linha de texto custaria mais do que
	// resolve (ESPEC 007 §7).
	return (
		<>
			<Barra estado={estado} />

			{/* `scroll-mt-20`: a barra é `sticky` e mede 73 px (ESPEC 007 §13). Sem
			    margem de rolagem o link de pulo deposita o topo do formulário
			    debaixo dela — funciona para o foco e falha para o olho. */}
			<main id="conteudo" className="mx-auto w-full max-w-4xl flex-1 scroll-mt-20 px-6 py-10">
				<p className="mb-8 text-sm text-navy-300">
					Envie o contrato e o levantamento da competência. A aplicação compara o
					contratado com o medido e devolve o relatório de comprovação.
				</p>

				<UploadForm
					arquivos={arquivos}
					onSelecionar={selecionar}
					aditivos={aditivos}
					onSelecionarAditivos={selecionarAditivos}
					onEnviar={() => void enviar()}
					processando={estado.situacao === "processando"}
					chave={chave}
					podeLimpar={podeLimpar}
					onLimpar={() => setConfirmando(true)}
					refLimpar={limpar}
					refPrimeiroCampo={primeiroCampo}
					refAditivos={campoDeAditivos}
					perguntaDeIdentidade={pergunta}
					onGerarAssimMesmo={() => void enviar(true)}
					onDescartarPergunta={() => setPergunta(undefined)}
				/>

				{/* `R-LMP-10` / `D-06` — a volta a `inicial` **esvazia** o invólucro
				    `aria-live` do `ResultadoPanel` (o `Conteudo` devolve `null`), e
				    região viva que esvazia é silêncio na maioria dos leitores. O
				    anúncio da limpeza precisa de região própria.

				    Ela é montada desde o primeiro render e fica **fora** da chave que
				    remonta os campos: região que entra na árvore junto com seu
				    conteúdo é inserção, não mutação, e o anúncio não dispara
				    (ESPEC 008 `D-03`) — a mesma armadilha, alcançada por um caminho
				    novo.

				    `role="status"` e não `aria-live="polite"`: o papel implica a região
				    viva sem acrescentar o atributo, e o teste da T-416 conta
				    `[aria-live="polite"]` esperando **um**. */}
				<p role="status" className="sr-only">
					{aviso}
				</p>

				<ResultadoPanel
					estado={estado}
					onAnexarAditivo={() => {
						campoDeAditivos.current?.scrollIntoView({ block: "center", behavior: "smooth" });
						campoDeAditivos.current?.focus();
					}}
				/>
			</main>

			{/* Fora do `<form>` do `UploadForm` — para que o `<form method="dialog">`
			    interno não fique aninhado — e fora da chave da remontagem. */}
			<ConfirmarLimpeza
				aberto={confirmando}
				haRelatorio={estado.situacao === "pronto"}
				onConfirmar={confirmarLimpeza}
				onCancelar={cancelarLimpeza}
			/>
		</>
	);
}
