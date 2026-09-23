import { render, screen } from '@testing-library/react'
import ClientesLayout from './layout'

describe('ClientesLayout', () => {
  // A página já estava liberada, mas a chave do layout continuou ligada e
  // escondia tudo — o teste da página não pegava porque não passa pelo layout.
  it('renderiza o conteúdo da seção, não o aviso de "Em desenvolvimento"', () => {
    render(
      <ClientesLayout>
        <p>conteúdo da seção</p>
      </ClientesLayout>,
    )
    expect(screen.getByText('conteúdo da seção')).toBeInTheDocument()
    expect(screen.queryByText('Em desenvolvimento')).not.toBeInTheDocument()
  })
})
