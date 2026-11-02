// Chipta tekshiruvchi (CONTROLLER) akkauntini yaratish va demo tadbirlarga biriktirish.
//
//   pnpm seed:controller --password 'Parol123!'                 — kontroller@chipta.uz
//   pnpm seed:controller --email a@b.uz --password 'Parol123!' --name 'Ali Valiyev'
//
// Akkaunt allaqachon bo'lsa — parol va ism yangilanadi. organizer@chipta.uz ning barcha
// tadbirlariga biriktiriladi (avval `pnpm seed` ishlagan bo'lishi kerak).

import { randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { env } from '../config';
import { Crypt } from '../infrastructure/lib/Crypt';
import { ORGANIZER } from './data';

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DB_URI }),
});

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

// Frontend va backend (IsStrongPassword) bilan bir xil qoida — aks holda login sahifasi parolni qabul qilmaydi
function passwordProblem(value: string) {
  if (value.length < 8) return "kamida 8 belgi bo'lishi kerak";
  const missing: string[] = [];
  if (!/[a-z]/.test(value)) missing.push('kichik harf');
  if (!/[A-Z]/.test(value)) missing.push('katta harf');
  if (!/\d/.test(value)) missing.push('raqam');
  if (!/[^A-Za-z0-9]/.test(value)) missing.push('maxsus belgi');
  return missing.length ? `parolda ${missing.join(', ')} bo'lishi kerak` : null;
}

function generatePassword() {
  return `Ch${randomBytes(4).toString('hex')}!7`;
}

async function main() {
  const email = (arg('email') ?? 'kontroller@chipta.uz').trim().toLowerCase();
  const fullName = arg('name') ?? 'Chipta kontrolleri';
  const password = arg('password') ?? generatePassword();

  const problem = passwordProblem(password);
  if (problem) {
    throw new Error(`Parol yaroqsiz: ${problem}`);
  }

  const organizer = await db.user.findUnique({
    where: { email: ORGANIZER.email },
  });
  if (!organizer) {
    throw new Error(
      'Demo tashkilotchi topilmadi — avval `pnpm seed` ni ishga tushiring',
    );
  }

  const hashedPassword = (await Crypt.hash(password)) as string;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'CONTROLLER') {
    throw new Error(
      `${email} allaqachon ${existing.role} sifatida ro'yxatdan o'tgan — boshqa email tanlang`,
    );
  }

  const controller = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { hashedPassword, fullName, status: 'ACTIVE', isVerified: true },
      })
    : await db.user.create({
        data: {
          email,
          fullName,
          hashedPassword,
          role: 'CONTROLLER',
          status: 'ACTIVE',
          isVerified: true,
          createdById: organizer.id,
        },
      });

  const events = await db.event.findMany({
    where: { organizerId: organizer.id, status: 'APPROVED' },
    select: { id: true },
  });
  await db.controllerEvent.createMany({
    data: events.map((event) => ({
      controllerId: controller.id,
      eventId: event.id,
    })),
    skipDuplicates: true,
  });

  console.log(`
[kontroller] ${existing ? 'yangilandi' : 'yaratildi'} ✅
  Email:  ${email}
  Parol:  ${password}
  Tadbirlar: ${events.length} ta tadbirga biriktirildi
`);
}

main()
  .catch((error: Error) => {
    console.error(`[kontroller] xato: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
