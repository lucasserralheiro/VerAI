import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AnaliseEvolucao, Cliente } from '@prisma/client'

const AZUL_MARINHO = '#002A4A'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#1a1a1a' },
  capa: { marginBottom: 24, borderBottom: `2px solid ${AZUL_MARINHO}`, paddingBottom: 16 },
  tituloApp: { fontSize: 20, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 4 },
  nomeCliente: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  meta: { fontSize: 10, color: '#555' },
  secao: { marginBottom: 16 },
  tituloSecao: { fontSize: 13, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 6 },
  tabelaCabecalho: { flexDirection: 'row', borderBottom: '2px solid #333', paddingVertical: 4, fontWeight: 700 },
  tabelaLinha: { flexDirection: 'row', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  colLabel: { width: '34%' },
  colValor: { width: '18%' },
  colVariacao: { width: '16%' },
  colStatus: { width: '14%' },
  bullet: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-start' },
  bulletMarcaAtencao: { color: '#c0392b', marginRight: 6, fontWeight: 700 },
  bulletMarcaMelhoria: { color: '#27ae60', marginRight: 6, fontWeight: 700 },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
})

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo',
  removido: 'Removido',
  estavel: 'Estável',
  alta: 'Alta',
  baixa: 'Baixa',
}

interface Props {
  cliente: Pick<Cliente, 'nome'>
  analise: AnaliseEvolucao
}

export function EvolucaoDocument({ cliente, analise }: Props) {
  const pontosAtencao = analise.pontosAtencao as Array<{ texto: string }>
  const melhorias = analise.melhorias as Array<{ texto: string }>
  const metricas = analise.metricasComparadas as Array<{
    label: string
    valorAtual: number | null
    valorAnterior: number | null
    deltaPercentual: number | null
    status: string
  }>

  const competenciaAtual = `${String(analise.competenciaAtualMes).padStart(2, '0')}/${analise.competenciaAtualAno}`
  const competenciaAnterior = `${String(analise.competenciaAnteriorMes).padStart(2, '0')}/${analise.competenciaAnteriorAno}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.capa}>
          <Text style={styles.tituloApp}>VerAI — Evolução mês a mês</Text>
          <Text style={styles.nomeCliente}>{cliente.nome}</Text>
          <Text style={styles.meta}>
            {competenciaAnterior} → {competenciaAtual}
          </Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Resumo</Text>
          <Text>{analise.resumo}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Métricas comparadas</Text>
          <View style={styles.tabelaCabecalho}>
            <Text style={styles.colLabel}>Métrica</Text>
            <Text style={styles.colValor}>{competenciaAnterior}</Text>
            <Text style={styles.colValor}>{competenciaAtual}</Text>
            <Text style={styles.colVariacao}>Variação</Text>
            <Text style={styles.colStatus}>Status</Text>
          </View>
          {metricas.map((m, i) => (
            <View key={i} style={styles.tabelaLinha}>
              <Text style={styles.colLabel}>{m.label}</Text>
              <Text style={styles.colValor}>{m.valorAnterior ?? '—'}</Text>
              <Text style={styles.colValor}>{m.valorAtual ?? '—'}</Text>
              <Text style={styles.colVariacao}>
                {m.deltaPercentual != null ? `${(m.deltaPercentual * 100).toFixed(1)}%` : '—'}
              </Text>
              <Text style={styles.colStatus}>{STATUS_LABEL[m.status] ?? m.status}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Pontos de atenção</Text>
          {pontosAtencao.map((p, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarcaAtencao}>▲</Text>
              <Text>{p.texto}</Text>
            </View>
          ))}
        </View>

        <View style={styles.secao}>
          <Text style={styles.tituloSecao}>Melhorias</Text>
          {melhorias.map((p, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMarcaMelhoria}>▼</Text>
              <Text>{p.texto}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.rodape}>Gerado automaticamente pelo VerAI</Text>
      </Page>
    </Document>
  )
}
