"""Leitor dos anexos — implementa ``IAnnexReader`` (ESPEC 004).

Junta as duas metades: a **configuração** diz quais abas entram e como se
apresentam; o **leitor genérico** diz o que há dentro delas. Nem uma nem outro
conhece uma aba específica, e é essa separação que faz um anexo novo ser uma
entrada de JSON.

Uma aba configurada e ausente do arquivo vira anexo vazio, não erro: a planilha
de outra competência pode não trazer todas, e derrubar a geração inteira por uma
aba faltante seria desproporcional (`R-ANX-08` já exclui as que nunca entram).
"""

from __future__ import annotations

from pathlib import Path

from domain.entities.annex import Anexo, ImagemAnexo
from infrastructure.annex.cabecalho import localizar_cabecalho
from infrastructure.annex.configuracao import (
    ConfiguracaoDeAnexo,
    MedidasDoAnexo,
    anexos_configurados,
    medidas_do_grc,
)
from infrastructure.measurement.aba_reader import AbaReader, FormaDaAba
from infrastructure.measurement.figuras import figuras_por_aba
from infrastructure.shared.arquivos import abrir_planilha_com_estilos


class AnexoReader:
    def __init__(self, configuracao: tuple[ConfiguracaoDeAnexo, ...] | None = None) -> None:
        self._configuracao = configuracao if configuracao is not None else anexos_configurados()
        self._medidas = medidas_do_grc()
        self._leitor = AbaReader()

    def ler(self, caminho: Path) -> list[Anexo]:
        # A planilha é aberta **uma vez** para as 19 abas. Abri-la por anexo
        # somaria 19 × 1,7 s só de abertura, mais do que toda a montagem do
        # documento.
        livro = abrir_planilha_com_estilos(caminho, "medição")
        try:
            # As figuras vêm do pacote, não das células — ver `figuras.py`.
            figuras = figuras_por_aba(caminho)
            return [self._anexo(livro, figuras, config) for config in self._configuracao]
        finally:
            livro.close()

    def _anexo(
        self,
        livro: object,
        figuras: dict[str, tuple[ImagemAnexo, ...]],
        config: ConfiguracaoDeAnexo,
    ) -> Anexo:
        medida = self._medidas.get(config.aba, MedidasDoAnexo(largura_total_pt=0.0))
        forma = (
            self._leitor.ler(livro[config.aba])  # type: ignore[index]
            if config.aba in livro.sheetnames  # type: ignore[attr-defined]
            else FormaDaAba(linhas=(), mesclagens=(), proporcoes=())
        )
        # ESPEC 037 `R-CAB-01` — o cabeçalho é localizado pelos **rótulos**, não
        # pelo número. `config.linha_cabecalho` continua no JSON e **não é lido
        # aqui**: ele é a medição do GRC, e serve de oráculo à `R-CAB-06`, que
        # exige que a âncora resolva exatamente nele no piloto (`D-03`).
        #
        # O número era fixo e o preâmbulo não é: ele cresce com o escopo do
        # órgão, e por isso a linha 17 de `Office365` era o cabeçalho no SMIT,
        # uma linha de resumo no PGM e o 4º usuário no FTM.
        #
        # `None` quando a âncora não é encontrada: `Anexo.cortes` fica vazia e
        # a comparação `linha_cabecalho == inicio` fica `False`, então os dois
        # caminhos do renderizador deixam de marcar sem uma linha nova lá
        # (`R-CAB-04`, `D-04`).
        cabecalho = localizar_cabecalho(forma.linhas, config.cabecalho)
        # ESPEC 051 `R-SEG-01` — as âncoras adicionais, para abas com mais de
        # uma tabela empilhada. A que não resolve simplesmente não entra: não
        # é condição de erro, é "esta aba não tem uma segunda tabela conhecida".
        adicionais = tuple(
            indice
            for ancora in config.cabecalhos_adicionais
            if (indice := localizar_cabecalho(forma.linhas, ancora)) is not None
        )

        return Anexo(
            aba=config.aba,
            orientacao=config.orientacao,
            corpo=config.corpo,
            linha_cabecalho=cabecalho,
            linhas_cabecalho_adicionais=adicionais,
            linhas=forma.linhas,
            mesclagens=forma.mesclagens,
            proporcoes=forma.proporcoes,
            larguras_pt=medida.larguras_pt,
            largura_total_pt=medida.largura_total_pt or None,
            altura_linha_pt=medida.altura_linha_pt,
            imagens=self._imagens(figuras.get(config.aba, ()), medida.imagens_pt),
        )

    @staticmethod
    def _imagens(
        figuras: tuple[ImagemAnexo, ...], impressas: tuple[tuple[float, float], ...]
    ) -> tuple[ImagemAnexo, ...]:
        """O tamanho impresso no GRC prevalece sobre o tamanho natural da figura.

        O Excel estica a figura ao colá-la: o PNG de `ServicosEmNuvem` tem 1.238
        pixels de largura, que a 96 dpi dariam 928 pt — mais que o dobro da
        página. O GRC a imprime com 516 pt, e é essa a medida que vale.

        Só se aplica quando as contagens batem. Casar a segunda figura da página
        com a primeira da aba daria um tamanho errado sem nenhum sinal.
        """
        if len(impressas) != len(figuras):
            return figuras
        return tuple(
            ImagemAnexo(
                dados=figura.dados,
                linha=figura.linha,
                largura_pt=largura,
                altura_pt=altura,
            )
            for figura, (largura, altura) in zip(figuras, impressas, strict=True)
        )
