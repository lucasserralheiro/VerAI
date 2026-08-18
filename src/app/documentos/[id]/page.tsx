export default async function DocumentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Documento {id}</h1>
      <p className="text-sm text-muted-foreground">Visualização em construção.</p>
    </main>
  )
}
