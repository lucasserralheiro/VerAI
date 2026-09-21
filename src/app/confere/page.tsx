"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmarLimpeza } from "./components/ConfirmarLimpeza";
import { ProgressoDaGeracao } from "./components/ProgressoDaGeracao";
import { ResultadoPanel } from "./components/ResultadoPanel";
import { UploadForm } from "./components/UploadForm";
import { aquecerServico, conferirIdentidade, gerarRelatorio } from "./lib/api";
import { type Achado, CAMPOS, type Estado, type NomeDoCampo } from "./lib/types";

// Página portada de services/confere/frontend/src/app/page.tsx (o frontend
// próprio do Confere, hospedado à parte) — ver
// docs/superpowers/specs/2026-09-21-integracao-confere-design.md §3.7 pra o
// porquê. Fica igual ao original: mesma tela, mesmo comportamento, só troca
// pra onde ele fala (./lib/api aponta pra /api/confere/reports, rota própria
// do VerAI que injeta o segredo do Confere no servidor).
//
// Comentários abaixo são os do arquivo original (ESPEC/TASKS citam o
// repositório do Confere, não o do VerAI) — preservados porque documentam
// decisões de acessibilidade e de gerenciamento de estado que continuam
// valendo aqui.

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
export default function ConferePage() {
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
	// O Confere hiberna no plano free do Render: o primeiro envio depois de uma
	// pausa paga ~1min de despertar **antes** dos ~25s de geração. Acordá-lo na
	// primeira seleção de arquivo faz esse minuto correr enquanto a pessoa
	// escolhe o resto — tempo que já era dela.
	//
	// `useRef` e não estado: uma vez por montagem da tela, e trocar de arquivo
	// não deve disparar de novo. Não entra em `useEffect` de montagem porque
	// quem só passa pela tela não precisa acordar serviço nenhum.
	const jaAqueceu = useRef(false);
	const [servicoDormindo, setServicoDormindo] = useState(false);

	function aquecer() {
		if (jaAqueceu.current) return;
		jaAqueceu.current = true;
		// Sem `await`: nada na tela espera por isto. O resultado só decide se o
		// painel de progresso conta o despertar como etapa.
		void aquecerServico().then(({ dormindo }) => setServicoDormindo(dormindo));
	}
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
		if (arquivo) aquecer();
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
		if (escolhidos.length > 0) aquecer();
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

	// A barra de aplicação da ESPEC 007 (logo + assinatura de marca + slot de
	// contexto) foi removida: dentro do VerAI a marca já está na barra lateral,
	// e uma segunda faixa de marca no topo da página era ruído — além de o
	// `/logo-confere.png` não existir neste deploy e render caixa de imagem
	// quebrada. O que ela tinha de informação real (referência do contrato e
	// competência) passou para o cartão "Relatório gerado" do `ResultadoPanel`,
	// que é onde o dado nasce.
	return (
		<>
			{/* `scroll-mt-4`: sem barra `sticky` o link de pulo não precisa mais de
			    73 px de folga — só do respiro que impede o título de colar no topo
			    da janela. */}
			<main id="conteudo" className="mx-auto w-full max-w-4xl flex-1 scroll-mt-4 px-6 py-10">
				<h1 className="text-2xl font-bold text-confere-brand-navy">ConfereAI</h1>
				<p className="mt-2 mb-8 text-sm text-confere-navy-600">
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

			{/* O progresso da geração, em modal: o fundo escurece e fica inerte
			    enquanto o servidor trabalha. Fora do `<form>` do `UploadForm` pelo
			    mesmo motivo do diálogo abaixo, e **sempre montado** — é o que
			    permite ao componente zerar o cronômetro a cada abertura em vez de
			    depender de uma remontagem. */}
			<ProgressoDaGeracao
				aberto={estado.situacao === "processando"}
				temAditivos={aditivos.length > 0}
				servicoDormindo={servicoDormindo}
			/>

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
