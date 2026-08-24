import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senhaHashAdmin = await bcrypt.hash('123456', 10)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin' },
    update: {},
    create: { nome: 'Administrador', email: 'admin', senhaHash: senhaHashAdmin, role: 'admin' },
  })
  console.log(`Usuário admin pronto: ${admin.email} (senha: 123456)`)

  const senhaHashTeste = await bcrypt.hash('123456', 10)

  const uploaderTeste = await prisma.usuario.upsert({
    where: { email: 'uploader-teste@verai.dev' },
    update: {},
    create: {
      nome: 'Uploader Teste',
      email: 'uploader-teste@verai.dev',
      senhaHash: senhaHashTeste,
      role: 'uploader',
    },
  })
  console.log(`Usuário uploader de teste pronto: ${uploaderTeste.email} (senha: 123456)`)

  const responsavelTeste = await prisma.usuario.upsert({
    where: { email: 'responsavel-teste@verai.dev' },
    update: {},
    create: {
      nome: 'Responsável Teste',
      email: 'responsavel-teste@verai.dev',
      senhaHash: senhaHashTeste,
      role: 'responsavel',
    },
  })
  console.log(`Usuário responsavel de teste pronto: ${responsavelTeste.email} (senha: 123456)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
