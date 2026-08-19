import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Documento, Analise } from '@prisma/client'

const AZUL_MARINHO = '#002A4A'
const LARANJA = '#F5691E'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#1a1a1a' },
  capa: { marginBottom: 24, borderBottom: `2px solid ${AZUL_MARINHO}`, paddingBottom: 16 },
  tituloApp: { fontSize: 20, color: AZUL_MARINHO, fontWeight: 700, marginBottom: 4 },
  nomeArquivo: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
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
  tabelaLabel: { width: '40%', fontWeight: 700 },
  tabelaValor: { width: '60%' },
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
  documento: Documento & { uploadedBy: { nome: string } }
  analise: Analise
}

export function RelatorioDocument({ documento, analise }: Props) {
  const pontosCriticos = analise.pontosCriticos as Array<{ texto: string; severidade: string }>
  const pontosPositivos = analise.pontosPositivos as Array<{ texto: string }>
  const metricasChave = (analise.metricasChave as Array<{ label: string; valor: string }> | null) ?? []
  const recomendacoes = (analise.recomendacoes as string[] | null) ?? []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.capa}>
          <Text style={styles.tituloApp}>VerAI</Text>
          <Text style={styles.nomeArquivo}>{documento.nomeArquivo}</Text>
          <Text style={styles.meta}>Enviado por {documento.uploadedBy.nome}</Text>
          <Text style={styles.meta}>{new Date(documento.createdAt).toLocaleString('pt-BR')}</Text>
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

        {metricasChave.length > 0 && (
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Métricas-chave</Text>
            {metricasChave.map((metrica, i) => (
              <View key={i} style={styles.tabelaLinha}>
                <Text style={styles.tabelaLabel}>{metrica.label}</Text>
                <Text style={styles.tabelaValor}>{metrica.valor}</Text>
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
