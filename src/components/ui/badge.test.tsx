import { badgeVariants } from './badge'

describe('badgeVariants', () => {
  it('usa formato pill e peso médio', () => {
    const classes = badgeVariants({ variant: 'neutral' })
    expect(classes).toContain('rounded-full')
    expect(classes).toContain('font-medium')
    expect(classes).not.toContain('font-semibold')
    expect(classes).not.toContain('rounded-md')
  })
})
