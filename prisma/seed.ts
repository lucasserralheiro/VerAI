import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@verai.local'
  const senha = 'admin123'
  const senhaHash = await bcrypt.hash(senha, 10)

  const admin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { nome: 'Administrador', email, senhaHash, role: 'admin' },
  })

  console.log(`Usuário admin pronto: ${admin.email} (senha: ${senha})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
