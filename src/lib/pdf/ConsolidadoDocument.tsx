import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AnaliseConsolidada, Cliente, Documento } from '@prisma/client'

const AZUL_MARINHO = '#002A4A'
const LARANJA = '#F5691E'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#1a1a1a' },
  capa: { marginBottom: 24, borderBottom: `2px solid ${AZUL_MARINHO}`, paddingBottom: 16 },
  tituloApp: { fontSize: 20, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 4 },
  nomeCliente: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  meta: { fontSize: 10, color: '#555' },
  secao: { marginBottom: 16 },
  tituloSecao: { fontSize: 13, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 6 },
  item: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  badge: { fontSize: 8, color: '#fff', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginRight: 6 },
  badgeAlto: { backgroundColor: '#c0392b' },
  badgeMedio: { backgroundColor: LARANJA },
  badgeBaixo: { backgroundColor: '#7f8c8d' },
  badgePositivo: { backgroundColor: '#27ae60' },
  tabelaLinha: { flexDirection: 'row', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  tabelaLabel: { width: '30%', fontWeight: 700 },
  tabelaValores: { width: '50%' },
  tabelaDivergencia: { width: '20%', fontSize: 9, color: '#c0392b' },
  bullet: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  bulletMarca: { color: LARANJA, marginRight: 6, fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
})

const BADGE_SEVERIDADE: Record<string, typeof styles.badgeAlto> = {
  alto: styles.badgeAlto,
  medio: styles.badgeMedio,
  baixo: styles.badgeBaixo,
}

interface Props {
  cliente: Pick<Cliente, 'nome'>
  documentos: Array<Pick<Documento, 'nomeArquivo'>>
  analise: AnaliseConsolidada
}

export function ConsolidadoDocument({ cliente, documentos, analise }: Props) {
  const pontosCriticos = analise.pontosCriticos as Array<{ texto: string; severidade: string }>
  const pontosPositivos = analise.pontosPositivos as Array<{ texto: string }>
  const recomendacoes = (analise.recomendacoes as string[] | null) ?? []
  const metricasComparadas = analise.metricasComparadas as Array<{
    label: string
    valores: Array<{ nomeArquivo: string; valorExibicao: string }>
    divergencia: { diferencaPercentual: number | null } | null
  }>

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.capa}>
          <Text style={styles.tituloApp}>VerAI — Análise consolidada</Text>
          <Text style={styles.nomeCliente}>
            {cliente.nome} — {String(analise.competenciaMes).padStart(2, '0')}/{analise.competenciaAno}
          </Text>
          <Text style={styles.meta}>{documentos.length} documento(s) consolidado(s)</Text>
          <Text style={styles.meta}>{documentos.map((d) => d.nomeArquivo).join(', ')}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Resumo executivo</Text>
          <Text>{analise.resumo}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos críticos</Text>
          {pontosCriticos.map((ponto, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.badge, BADGE_SEVERIDADE[ponto.severidade] ?? styles.badgeBaixo]}>
                {ponto.severidade}
              </Text>
              <Text>{ponto.texto}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos positivos</Text>
          {pontosPositivos.map((ponto, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.badge, styles.badgePositivo]}>✓</Text>
              <Text>{ponto.texto}</Text>
            </View>
          ))}
        </View>

        {metricasComparadas.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Métricas comparadas entre documentos</Text>
            {metricasComparadas.map((metrica, i) => (
              <View key={i} style={styles.tabelaLinha}>
                <Text style={styles.tabelaLabel}>{metrica.label}</Text>
                <Text style={styles.tabelaValores}>
                  {metrica.valores.map((v) => `${v.nomeArquivo}: ${v.valorExibicao}`).join('  |  ')}
                </Text>
                <Text style={styles.tabelaDivergencia}>
                  {metrica.divergencia?.diferencaPercentual != null
                    ? `⚠ ${(metrica.divergencia.diferencaPercentual * 100).toFixed(1)}%`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {recomendacoes.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Recomendações</Text>
            {recomendacoes.map((recomendacao, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletMarca}>•</Text>
                <Text>{recomendacao}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.rodape}>Gerado automaticamente pelo VerAI</Text>
      </Page>
    </Document>
  )
}
