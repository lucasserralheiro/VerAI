// Mesmo desenho da entrada do ConfereAI (src/app/confere/components/EntradaDoLevantamento.tsx):
// uma planilha de verdade, só ilustração.
const COLUNAS = ["A", "B", "C", "D", "E"] as const;
/** Largura de cada coluna do desenho; a primeira é a do texto, as outras são números. */
const LARGURAS = [64, 42, 42, 42, 42] as const;
/** Quanto da célula a barra de "conteúdo" ocupa, por linha (texto) e por coluna (número). */
const TEXTO = [0.8, 0.6, 0.72, 0.5, 0.66] as const;
const NUMERO = [0.7, 0.55, 0.8, 0.6] as const;

/** Uma planilha de verdade, desenhada: janela, abas, letras de coluna, números de linha,
 *  cabeçalho verde, linhas de dados e a célula selecionada. É só ilustração (`aria-hidden`),
 *  sem marca de terceiros — o selo ".xlsx" diz o formato que a tela espera. */
export function IlustracaoDePlanilha() {
  const X0 = 20; // largura da coluna dos números de linha
  const Y0 = 34; // barra de abas + letras das colunas
  const LINHA = 16;
  const inicios = LARGURAS.reduce<number[]>((acc, largura, i) => {
    acc.push(i === 0 ? X0 : acc[i - 1] + LARGURAS[i - 1]);
    return acc;
  }, []);
  const largura = X0 + LARGURAS.reduce((soma, v) => soma + v, 0);
  const linhas = 6;
  const altura = Y0 + linhas * LINHA;

  return (
    <svg
      viewBox={`0 0 ${largura + 24} ${altura + 14}`}
      aria-hidden="true"
      className="mx-auto h-auto w-80 max-w-full"
    >
      <g transform="translate(0 4)">
        {/* sombra e janela */}
        <rect x="3" y="4" width={largura} height={altura} rx="6" fill="#0B2235" opacity="0.08" />
        <rect x="0.5" y="0.5" width={largura} height={altura} rx="6" fill="#fff" stroke="#C8D9E6" />
        {/* barra de abas */}
        <path d={`M0.5 6.5a6 6 0 0 1 6-6h${largura - 12}a6 6 0 0 1 6 6V18H0.5z`} fill="#F4F7F8" />
        <circle cx="11" cy="9" r="2" fill="#C8D9E6" />
        <circle cx="18" cy="9" r="2" fill="#C8D9E6" />
        <circle cx="25" cy="9" r="2" fill="#C8D9E6" />
        <rect x="40" y="3" width="52" height="15" rx="3" fill="#fff" />
        <rect x="40" y="16" width="52" height="2" fill="#1D6F42" />
        <text x="66" y="13" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#0B2235">
          Planilha1
        </text>
        {/* letras das colunas */}
        <rect x="0.5" y="18" width={largura} height="16" fill="#EFF4F8" />
        {COLUNAS.map((letra, i) => (
          <text
            key={letra}
            x={inicios[i] + LARGURAS[i] / 2}
            y="29"
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="600"
            fill="#4E747E"
          >
            {letra}
          </text>
        ))}
        {/* linhas de dados */}
        {Array.from({ length: linhas }, (_, r) => {
          const y = Y0 + r * LINHA;
          const cabecalho = r === 0;
          return (
            <g key={r}>
              <rect x="0.5" y={y} width={X0} height={LINHA} fill="#EFF4F8" />
              <text x={X0 / 2} y={y + 11} textAnchor="middle" fontSize="7" fill="#4E747E">
                {r + 1}
              </text>
              {cabecalho && <rect x={X0} y={y} width={largura - X0} height={LINHA} fill="#1D6F42" />}
              {COLUNAS.map((letra, c) => {
                const cheia = LARGURAS[c] - 12;
                const barra = cabecalho
                  ? cheia * (c === 0 ? 0.7 : 0.55)
                  : c === 0
                    ? cheia * TEXTO[(r - 1) % TEXTO.length]
                    : cheia * NUMERO[(r + c) % NUMERO.length];
                return (
                  <rect
                    key={letra}
                    x={c === 0 ? inicios[c] + 6 : inicios[c] + LARGURAS[c] - 6 - barra}
                    y={y + 6}
                    width={barra}
                    height="4"
                    rx="2"
                    fill={cabecalho ? "#fff" : "#C8D9E6"}
                    opacity={cabecalho ? 0.9 : 1}
                  />
                );
              })}
            </g>
          );
        })}
        {/* grade */}
        {Array.from({ length: linhas }, (_, r) => (
          <line key={`h${r}`} x1="0.5" x2={largura + 0.5} y1={Y0 + (r + 1) * LINHA} y2={Y0 + (r + 1) * LINHA} stroke="#DDE6E9" />
        ))}
        {[X0, ...inicios.slice(1)].map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1="18" y2={altura} stroke="#DDE6E9" />
        ))}
        {/* célula selecionada */}
        <rect x={inicios[2]} y={Y0 + 3 * LINHA} width={LARGURAS[2]} height={LINHA} fill="#1D6F42" fillOpacity="0.08" stroke="#1D6F42" strokeWidth="1.5" />
        <rect x={inicios[2] + LARGURAS[2] - 3} y={Y0 + 4 * LINHA - 3} width="5" height="5" fill="#1D6F42" stroke="#fff" />
        {/* selo do formato */}
        <g transform={`translate(${largura - 30} ${altura - 10})`}>
          <rect width="48" height="22" rx="5" fill="#1D6F42" stroke="#fff" strokeWidth="2" />
          <text x="24" y="15" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            .xlsx
          </text>
        </g>
      </g>
    </svg>
  );
}
