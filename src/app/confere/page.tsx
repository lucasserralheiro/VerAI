"use client";

import { useEffect, useRef, useState } from "react";

import type { DocumentoDoCadastro, DocumentosDoContrato } from "@/lib/confere/tipos-cadastro";
import { BuscaDoContratoModal } from "./components/BuscaDoContratoModal";
import { ConfirmarLimpeza } from "./components/ConfirmarLimpeza";
import { EntradaDoLevantamento } from "./components/EntradaDoLevantamento";
import { FaixaDoContrato } from "./components/FaixaDoContrato";
import type { FonteDoContrato } from "./components/ItemNoContrato";
import { JanelaDePastas } from "./components/JanelaDePastas";
import { ProgressoDaGeracao } from "./components/ProgressoDaGeracao";
import { ResultadoPanel } from "./components/ResultadoPanel";
import { UploadForm } from "./components/UploadForm";
import {
	aquecerServico,
	conferirIdentidade,
	documentosDoContrato,
	gerarRelatorio,
	identificarLevantamento,
} from "./lib/api";
import {
	type Achado,
	CAMPOS,
	type Estado,
	type Identificacao,
	type NomeDoCampo,
	nomeDaPeca,
	type Peca,
} from "./lib/types";

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

/** A busca do contrato em modal (desenho de 28/09/2026 §3.2): a da planilha,
 *  que pergunta quando não acha, ou a do "trocar contrato". */
type Busca = { aberto: boolean; motivo: "planilha" | "trocar" };
const BUSCA_FECHADA: Busca = { aberto: false, motivo: "planilha" };

/** Shell fino: cuida do estado da tela e delega o resto aos componentes. */
export default function ConferePage() {
	const [arquivos, setArquivos] = useState<Partial<Record<NomeDoCampo, File>>>({});
	// ESPEC 019 `R-ADT-10` — estado próprio, e não uma entrada de `arquivos`:
	// aquele mapa é de campo único e alimenta o `completo` que habilita o botão.
	// Os aditivos são opcionais e são uma lista (`D-10`) — que mistura propostas
	// do cadastro e arquivos do computador (desenho de 25/09/2026 §4.2).
	const [aditivos, setAditivos] = useState<readonly Peca[]>([]);
	// O campo Contrato vindo do cadastro. Fica à parte de `arquivos` porque o
	// arquivo do computador **prevalece** — a escolha manual nunca é trocada
	// sozinha (§4.3) — e a proposta do cadastro continua à mão para "Usar a
	// proposta do cadastro".
	const [contratoDoCadastro, setContratoDoCadastro] = useState<DocumentoDoCadastro | undefined>(
		undefined,
	);
	const [identificacao, setIdentificacao] = useState<Identificacao>({ situacao: "ociosa" });
	const [documentos, setDocumentos] = useState<DocumentosDoContrato | undefined>(undefined);
	const [chaveContrato, setChaveContrato] = useState(0);
	const [chaveAditivos, setChaveAditivos] = useState(0);
	const [chaveLevantamento, setChaveLevantamento] = useState(0);
	// "Preencher à mão": o formulário inteiro sem a planilha ter achado o
	// contrato (desenho de 28/09/2026 §3).
	const [manual, setManual] = useState(false);
	const [busca, setBusca] = useState<Busca>(BUSCA_FECHADA);
	const [carregandoContrato, setCarregandoContrato] = useState(false);
	// Numera os pedidos de identificação: a resposta de uma planilha já trocada
	// não pode preencher os campos da nova.
	const pedidoDeIdentificacao = useRef(0);
	// Numera as entradas do formulário: cada troca de arquivo, de contrato ou de aditivo
	// avança o número. A geração leva ~30 s, e a pessoa pode trocar a planilha nesse
	// meio-tempo — sem esta guarda, o relatório do par antigo chegava e aparecia ao lado
	// da planilha nova (verificado na tela em 08/10/2026: relatório da FTM sobre a
	// planilha da SMIT). Resposta de uma geração que ficou para trás é descartada.
	const geracaoAtual = useRef(0);
	// A janela "Pastas do cliente" e para qual campo ela escolhe (desenho de
	// 25/09/2026, tarde, §3.5).
	const [janela, setJanela] = useState<{ aberto: boolean; finalidade: "contrato" | "aditivos" }>({
		aberto: false,
		finalidade: "contrato",
	});

	// Arquivo solto fora dos cartões não pode abrir no navegador — a pessoa
	// perderia tudo o que já preencheu. Os cartões tratam o que cai neles; aqui
	// só o resto (desenho de 25/09/2026, tarde, §3.4).
	useEffect(() => {
		function segurar(evento: DragEvent) {
			if (Array.from(evento.dataTransfer?.types ?? []).includes("Files")) evento.preventDefault();
		}
		window.addEventListener("dragover", segurar);
		window.addEventListener("drop", segurar);
		return () => {
			window.removeEventListener("dragover", segurar);
			window.removeEventListener("drop", segurar);
		};
	}, []);

	const contrato: Peca | undefined = arquivos.contrato
		? { tipo: "arquivo", arquivo: arquivos.contrato }
		: contratoDoCadastro
			? { tipo: "cadastro", documento: contratoDoCadastro }
			: undefined;
	const [estado, setEstado] = useState<Estado>({ situacao: "inicial" });
	// T-2099 / ESPEC 029 `R-IDT-10` — o achado do portão, enquanto ele espera
	// resposta. Estado próprio e **não** uma situação de `Estado`: a pergunta
	// acontece antes de qualquer processamento, vive no formulário e não
	// substitui o resultado anterior na tela.
	const [pergunta, setPergunta] = useState<Achado | undefined>(undefined);
	const [confirmando, setConfirmando] = useState(false);
	// Relatório pronto recolhe o formulário (`UploadForm.recolhido`); "Alterar
	// documentos" o reabre sem descartar o resultado.
	const [editando, setEditando] = useState(false);
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
	// O "Escolher planilha" do início: depois de Limpar a tela sempre volta ao
	// início, e é ali que a próxima ação está.
	const primeiroCampo = useRef<HTMLButtonElement>(null);
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
		geracaoAtual.current += 1;
		descartar(estado);
		setArquivos({});
		setAditivos([]);
		// A busca em andamento, se houver, chega depois da limpeza: o número novo
		// a descarta.
		pedidoDeIdentificacao.current += 1;
		setIdentificacao({ situacao: "ociosa" });
		setDocumentos(undefined);
		setContratoDoCadastro(undefined);
		setEstado({ situacao: "inicial" });
		setManual(false);
		setBusca(BUSCA_FECHADA);
		setCarregandoContrato(false);
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
		geracaoAtual.current += 1;
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
		// A planilha diz de qual contrato e competência ela é: escolhê-la busca o
		// contrato no cadastro e preenche Contrato e Aditivos (desenho de
		// 25/09/2026 §4.2).
		if (campo === "levantamento") {
			if (arquivo) setBusca({ aberto: true, motivo: "planilha" });
			void identificar(arquivo);
		}
	}

	/** Qualquer outra mudança nas entradas invalida o resultado anterior — a
	 *  mesma sequência de `selecionar`, na mesma ordem (ver o comentário de lá). */
	function entradaMudou() {
		geracaoAtual.current += 1;
		descartar(estado);
		setEstado({ situacao: "inicial" });
		setAviso("");
		setPergunta(undefined);
	}

	/** Os documentos do contrato em uso. Os aditivos do cadastro são refeitos; os
	 *  enviados do computador ficam, no fim da lista (§4.3). */
	function aplicarDocumentos(novos: DocumentosDoContrato) {
		setDocumentos(novos);
		setContratoDoCadastro(novos.base ?? undefined);
		setAditivos((atual) => [
			...novos.aditivos.map((documento): Peca => ({ tipo: "cadastro", documento })),
			...atual.filter((peca) => peca.tipo === "arquivo"),
		]);
	}

	/** Planilha trocada por outra sem contrato achado: o que veio do cadastro era
	 *  do contrato anterior e sai; o que veio do computador fica. */
	function limparDoCadastro() {
		setDocumentos(undefined);
		setContratoDoCadastro(undefined);
		setAditivos((atual) => atual.filter((peca) => peca.tipo === "arquivo"));
	}

	async function identificar(arquivo: File | undefined) {
		const pedido = ++pedidoDeIdentificacao.current;
		if (!arquivo) {
			setIdentificacao({ situacao: "ociosa" });
			limparDoCadastro();
			return;
		}
		setIdentificacao({ situacao: "lendo" });
		const resposta = await identificarLevantamento(arquivo);
		if (pedido !== pedidoDeIdentificacao.current) return;
		if (!resposta) {
			setIdentificacao({ situacao: "falhou" });
			limparDoCadastro();
			return;
		}
		setIdentificacao(resposta);
		if (resposta.situacao === "encontrado") {
			aplicarDocumentos(resposta.documentos);
			// Achou: o modal fecha sozinho (depois do tempo mínimo) e a tela mostra
			// os documentos. Não achou: o modal continua e pergunta.
			setBusca(BUSCA_FECHADA);
		} else limparDoCadastro();
	}

	/** Contrato escolhido à mão — empate, sugestão, busca ou "trocar contrato" —,
	 *  na competência que a planilha disse. O modal mostra a espera. */
	async function escolherContrato(contratoId: string) {
		// O mesmo contador da planilha: Cancelar descarta esta resposta também.
		const pedido = ++pedidoDeIdentificacao.current;
		const competencia = "leitura" in identificacao ? identificacao.leitura.competencia : null;
		setCarregandoContrato(true);
		const novos = await documentosDoContrato(contratoId, competencia);
		if (pedido !== pedidoDeIdentificacao.current) return;
		setCarregandoContrato(false);
		if (!novos) {
			setIdentificacao({ situacao: "falhou" });
			setBusca({ aberto: true, motivo: "planilha" });
			return;
		}
		entradaMudou();
		aplicarDocumentos(novos);
		setBusca(BUSCA_FECHADA);
	}

	/** Cancelar e `Esc` no modal da busca (desenho de 28/09/2026 §3.2). */
	function cancelarBusca() {
		// A resposta que chegar depois é de uma busca que a pessoa desistiu.
		pedidoDeIdentificacao.current += 1;
		if (carregandoContrato) {
			// Desistiu do contrato escolhido: o modal volta à pergunta (ou à busca).
			setCarregandoContrato(false);
			return;
		}
		setBusca(BUSCA_FECHADA);
		if (busca.motivo === "trocar") return;
		// Desistiu da planilha: ela sai, e com ela o que o cadastro tinha posto. O
		// que veio do computador fica — e segura a tela no preenchimento à mão.
		geracaoAtual.current += 1;
		setArquivos((atual) => ({ ...atual, levantamento: undefined }));
		setChaveLevantamento((n) => n + 1);
		setIdentificacao({ situacao: "ociosa" });
		limparDoCadastro();
	}

	/** Da pergunta do modal: segue à mão, com a planilha. */
	function enviarDoComputador() {
		setBusca(BUSCA_FECHADA);
		setManual(true);
	}

	/** "trocar contrato" (com contrato) ou "Buscar no cadastro" (sem): reabre o modal. */
	function buscarContrato() {
		setBusca({ aberto: true, motivo: documentos ? "trocar" : "planilha" });
	}

	/** "Trocar": outra proposta do cadastro no campo Contrato — inclusive no
	 *  lugar de um arquivo do computador, que a pessoa acabou de dispensar. */
	function trocarContrato(documento: DocumentoDoCadastro) {
		entradaMudou();
		setContratoDoCadastro(documento);
		setArquivos((atual) => ({ ...atual, contrato: undefined }));
		setChaveContrato((n) => n + 1);
	}

	/** "Usar a proposta do cadastro": o arquivo do computador sai do campo. */
	function usarDoCadastro() {
		entradaMudou();
		setContratoDoCadastro(documentos?.base ?? undefined);
		setArquivos((atual) => ({ ...atual, contrato: undefined }));
		setChaveContrato((n) => n + 1);
	}

	/** `R-ADT-10`, revisto (desenho de 25/09/2026 §4.2) — a lista deixou de ser a
	 *  do `<input>`: mistura propostas do cadastro e arquivos do computador. A
	 *  seleção **acrescenta** no fim, e a chave zera o `<input>` para que escolher
	 *  o mesmo arquivo de novo volte a disparar. */
	function selecionarAditivos(escolhidos: readonly File[]) {
		if (escolhidos.length === 0) return;
		entradaMudou();
		aquecer();
		setAditivos((atual) => [
			...atual,
			...escolhidos.map((arquivo): Peca => ({ tipo: "arquivo", arquivo })),
		]);
		setChaveAditivos((n) => n + 1);
	}

	function removerAditivo(posicao: number) {
		entradaMudou();
		setAditivos((atual) => atual.filter((_, indice) => indice !== posicao));
	}

	/** O que a pessoa escolheu na janela "Pastas do cliente". Quando o arquivo é
	 *  uma das propostas do histórico do contrato, leva a origem de sempre ("TA
	 *  02, renovação desde…"); senão, a pasta de onde veio. */
	function aoEscolherDasPastas(escolhidos: DocumentoDoCadastro[]) {
		const comOrigem = escolhidos.map(
			(documento) =>
				documentos?.alternativas.find(
					(alternativa) => alternativa.arquivoId === documento.arquivoId,
				) ?? documento,
		);
		if (janela.finalidade === "contrato") {
			if (comOrigem[0]) trocarContrato(comOrigem[0]);
			return;
		}
		entradaMudou();
		setAditivos((atual) => [
			...atual,
			...comOrigem.map((documento): Peca => ({ tipo: "cadastro", documento })),
		]);
	}

	async function enviar(identidadeConfirmada = false) {
		const levantamento = arquivos.levantamento;
		// `D-10` — a exigência continua sendo contrato e levantamento. Os aditivos
		// são opcionais, e o piloto, que não tem nenhum, segue submissível.
		if (!contrato || !levantamento) return;
		const geracao = geracaoAtual.current;

		// ESPEC 029 `R-IDT-10` — **o portão vem antes do trabalho.** São ~0,9 s
		// contra os ~30 s da geração: perguntar depois custaria os 30 s para
		// fazer a pergunta e mais 30 para refazer tudo ao ouvir *sim* (`D-10`).
		//
		// `null` é falha aberta (`R-IDT-12`), e segue direto: quem barra o par
		// divergente de verdade é a validação de dentro do fluxo.
		//
		// Só no envio todo do computador: com proposta do cadastro o par já foi
		// casado pelo número do contrato — e o portão, hoje, dá 404 no VerAI.
		const tudoDoComputador = aditivos.every((peca) => peca.tipo === "arquivo");
		if (!identidadeConfirmada && contrato.tipo === "arquivo" && tudoDoComputador) {
			const conferencia = await conferirIdentidade(
				{ contrato: contrato.arquivo, levantamento } as Record<NomeDoCampo, File>,
				aditivos.flatMap((peca) => (peca.tipo === "arquivo" ? [peca.arquivo] : [])),
			);
			// Os arquivos mudaram durante a pergunta: ela falava do par anterior.
			if (geracao !== geracaoAtual.current) return;
			if (conferencia && !conferencia.combinam && conferencia.achados[0]) {
				setPergunta(conferencia.achados[0]);
				return;
			}
		}

		setPergunta(undefined);
		setEditando(false);
		descartar(estado);
		setAviso("");
		setEstado({ situacao: "processando" });
		const resultado = await gerarRelatorio(
			{ levantamento, contrato, aditivos, contratoId: documentos?.contrato.id ?? null },
			identidadeConfirmada,
		);

		// Os arquivos mudaram enquanto o relatório era gerado: ele é do par antigo e
		// não pode aparecer ao lado da planilha nova. As URLs de um `pronto` descartado
		// são liberadas aqui (`R-LMP-11`).
		if (geracao !== geracaoAtual.current) {
			descartar(resultado);
			return;
		}

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
			contratoDoCadastro !== undefined ||
			aditivos.length > 0 ||
			identificacao.situacao !== "ociosa" ||
			estado.situacao !== "inicial");

	// O que falta para gerar (desenho de 25/09/2026, tarde, §3.2) — some quando
	// nada falta.
	const dica = !arquivos.levantamento
		? contrato
			? "Falta o levantamento."
			: "Escolha o levantamento para começar."
		: !contrato
			? identificacao.situacao === "lendo"
				? "Buscando o contrato no cadastro…"
				: "Falta o contrato: procure nas pastas do cliente ou envie do computador."
			: null;

	// Os PDFs de entrada, na ordem em que o Confere os aplica: a proposta-base e
	// depois os aditivos. Cada linha do resultado abre o item neles.
	const fontesDoContrato: FonteDoContrato[] = [
		...(contrato ? [{ peca: contrato, prefixo: "Contrato" }] : []),
		...aditivos.map((peca, posicao) => ({ peca, prefixo: `Aditivo ${posicao + 1}` })),
	].map(({ peca, prefixo }) => ({
		rotulo: `${prefixo} · ${nomeDaPeca(peca)}`,
		...(peca.tipo === "arquivo"
			? { arquivo: peca.arquivo }
			: { url: `/api/arquivos/${peca.documento.arquivoId}?modo=inline` }),
	}));

	// A fase da tela (desenho de 28/09/2026 §3): o início é só o levantamento;
	// com o contrato achado, conferir; o que veio do computador, ou "Preencher à
	// mão", segura o formulário inteiro.
	const temDoComputador =
		arquivos.contrato !== undefined || aditivos.some((peca) => peca.tipo === "arquivo");
	const fase: "inicio" | "manual" | "conferir" = documentos
		? "conferir"
		: manual || temDoComputador
			? "manual"
			: "inicio";

	// Com o relatório pronto, o formulário dos documentos sai da página e vai para a
	// janela "Documentos usados" do resumo: a página fica só com o resultado e as
	// ações. Antes de gerar (e enquanto gera) ele continua no topo.
	const documentosNaJanela = estado.situacao === "pronto";
	const formulario = (
		<>
			{fase === "inicio" ? (
				<EntradaDoLevantamento
					key={`${chave}-${chaveLevantamento}`}
					onEscolher={(arquivo) => selecionar("levantamento", arquivo)}
					onPreencherAMao={() => setManual(true)}
					refBotao={primeiroCampo}
				/>
			) : (
				<UploadForm
					levantamento={arquivos.levantamento}
					contrato={contrato}
					onSelecionar={selecionar}
					aditivos={aditivos}
					onSelecionarAditivos={selecionarAditivos}
					onRemoverAditivo={removerAditivo}
					semAditivos={documentos ? "Nenhum aditivo depois da proposta-base" : "Nenhum aditivo"}
					onProcurarContrato={() => setJanela({ aberto: true, finalidade: "contrato" })}
					onProcurarAditivos={() => setJanela({ aberto: true, finalidade: "aditivos" })}
					dica={dica}
					faixa={
						<FaixaDoContrato
							identificacao={identificacao}
							documentos={documentos}
							contratoDoComputador={arquivos.contrato !== undefined}
							onBuscarContrato={buscarContrato}
							onUsarDoCadastro={usarDoCadastro}
						/>
					}
					onEnviar={() => void enviar()}
					processando={estado.situacao === "processando"}
					chave={chave}
					chaveLevantamento={chaveLevantamento}
					chaveContrato={chaveContrato}
					chaveAditivos={chaveAditivos}
					podeLimpar={podeLimpar}
					onLimpar={() => setConfirmando(true)}
					refLimpar={limpar}
					refAditivos={campoDeAditivos}
					recolhido={estado.situacao === "pronto" && !editando}
					onEditar={() => setEditando(true)}
					perguntaDeIdentidade={pergunta}
					onGerarAssimMesmo={() => void enviar(true)}
					onDescartarPergunta={() => setPergunta(undefined)}
				/>
			)}

		</>
	);

	// Título e frase de apoio na mesma linha (quebram sozinhos em tela estreita).
	// Com o relatório pronto, a página é só o resumo e as ações; os documentos
	// usados e as seções do relatório abrem em janela (`ResultadoPanel`).
	const cabecalho = documentosNaJanela ? (
		<>
			<h1 className="text-2xl font-bold text-confere-brand-navy">ConfereAI</h1>
			<div className="mb-5" />
		</>
	) : (
		<div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
			<h1 className="text-2xl font-bold text-confere-brand-navy">ConfereAI</h1>
			{/* A frase de apoio só no início (09/10/2026): com a planilha já escolhida, os
			    passos são as próprias linhas de Documentos — repetir o tutorial era ruído. */}
			{fase === "inicio" && (
				<p className="max-w-4xl text-base text-confere-navy-600">
					Escolha o levantamento — o contrato e os aditivos vêm do cadastro do cliente — e gere o relatório de comprovação.
				</p>
			)}
		</div>
	);

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
			<main id="conteudo" className="mx-auto w-full max-w-[96rem] flex-1 scroll-mt-4 px-6 pb-4 pt-4 lg:px-8">
				{/* No início o tutorial mora dentro da própria entrada; nas outras fases ele
				    fica ao lado, começando no topo da página (junto do título), para não
				    somar altura ao formulário. */}
				<>
					{cabecalho}
					{!documentosNaJanela && formulario}
				</>

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
					documentosUsados={documentosNaJanela ? formulario : undefined}
					fontesDoContrato={fontesDoContrato}
					planilhaDoLevantamento={
						arquivos.levantamento
							? { rotulo: arquivos.levantamento.name, arquivo: arquivos.levantamento }
							: undefined
					}
					onAnexarAditivo={() => {
						// O formulário está recolhido com o relatório pronto: abre
						// primeiro e só então leva o foco ao campo.
						setEditando(true);
						requestAnimationFrame(() => {
							campoDeAditivos.current?.scrollIntoView({ block: "center", behavior: "smooth" });
							campoDeAditivos.current?.focus();
						});
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

			{/* Fora do `<form>` do `UploadForm`, como os outros diálogos. Abre na
			    pasta do contrato da proposta que está no campo Contrato. */}
			<JanelaDePastas
				aberto={janela.aberto}
				clienteId={documentos?.contrato.clienteId}
				finalidade={janela.finalidade}
				arquivoInicial={contratoDoCadastro?.arquivoId ?? documentos?.base?.arquivoId}
				emUso={[
					...(contratoDoCadastro && !arquivos.contrato ? [contratoDoCadastro.arquivoId] : []),
					...aditivos.flatMap((peca) => (peca.tipo === "cadastro" ? [peca.documento.arquivoId] : [])),
				]}
				jaNaLista={aditivos.flatMap((peca) =>
					peca.tipo === "cadastro" ? [peca.documento.arquivoId] : [],
				)}
				onEscolher={aoEscolherDasPastas}
				onFechar={() => setJanela((atual) => ({ ...atual, aberto: false }))}
			/>

			{/* A busca do contrato, fora do `<form>` como os outros diálogos. */}
			<BuscaDoContratoModal
				aberto={busca.aberto}
				motivo={busca.motivo}
				nomeDaPlanilha={arquivos.levantamento?.name}
				identificacao={identificacao}
				carregandoContrato={carregandoContrato}
				onEscolherContrato={(contratoId) => void escolherContrato(contratoId)}
				onCancelar={cancelarBusca}
				onEnviarDoComputador={enviarDoComputador}
				onTrocarPlanilha={(arquivo) => selecionar("levantamento", arquivo)}
			/>
		</>
	);
}
