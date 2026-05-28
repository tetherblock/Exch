// prisma/seed.ts — Создание начального администратора
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail    = process.env.ADMIN_EMAIL    || "admin@p2p-exchange.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin1234!";
  const adminUsername = process.env.ADMIN_USERNAME || "admin";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("✅ Администратор уже существует");
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email:        adminEmail,
      username:     adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role:         "ADMIN",
      isVerified:   true,
    },
  });

  console.log(`✅ Администратор создан: ${admin.email}`);
  console.log(`   Пароль: ${adminPassword}`);
  console.log(`   ⚠️  Смените пароль после первого входа!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
