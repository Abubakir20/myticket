// Demo ma'lumotlar bilan bazani to'ldirish.
//
//   pnpm build && pnpm seed          — bo'sh bazaga demo tadbirlarni qo'shadi
//   pnpm seed:reset                  — avvalgi demo ma'lumotlarni o'chirib, qaytadan yaratadi
//
// Faqat seed o'zi yaratgan yozuvlarga tegadi (organizer@chipta.uz va uning tadbirlari/zallari).
// Afishalar Pexels'dan yuklanadi (internet bo'lmasa — sharp bilan generatsiya qilinadi),
// uploads/events/seed-*.webp ga yoziladi.

import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import Redis from 'ioredis';
import sharp from 'sharp';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { env } from '../config';
import { Crypt } from '../infrastructure/lib/Crypt';
import { EVENT_CACHE_PATTERN } from '../common/helper/redis-keys';
import { POSTER_HEIGHT, POSTER_WIDTH, posterSvg } from './posters';
import {
  DEMO_CUSTOMER,
  EVENTS,
  ORGANIZER,
  SeedCategory,
  SeedEvent,
  VENUES,
} from './data';

const UPLOADS_EVENTS = join(process.cwd(), 'uploads', 'events');
const TASHKENT_OFFSET_HOURS = 5;

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DB_URI }),
});

function log(message: string) {
  console.log(`[seed] ${message}`);
}

// Deterministik tasodif: seed qayta ishga tushirilsa ham bir xil "sotilgan" joylar chiqadi
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hashOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[ʻʼ'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

// "Bugundan N kun keyin, soat HH:MM (Toshkent)" → UTC Date
function sessionStart(daysFromNow: number, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const local = new Date(now.getTime() + TASHKENT_OFFSET_HOURS * 3_600_000);
  const date = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + daysFromNow,
    hours - TASHKENT_OFFSET_HOURS,
    minutes,
  );
  return new Date(date);
}

const stats = { photos: 0, generated: 0 };

// Pexels'dan surat yuklash (Pexels litsenziyasi: bepul, ruxsat va muallif ko'rsatish shart emas)
async function downloadPhoto(photoId: number) {
  const url = `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (myticket demo seed)' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`rasm emas: ${type}`);
  return Buffer.from(await response.arrayBuffer());
}

async function writePoster(event: SeedEvent, index: number) {
  const fileName = `seed-${slugify(event.title)}-${index}.webp`;
  const target = join(UPLOADS_EVENTS, fileName);
  const photoId = event.photos?.[index];

  if (photoId) {
    try {
      const photo = await downloadPhoto(photoId);
      await sharp(photo)
        .resize(POSTER_WIDTH, POSTER_HEIGHT, {
          fit: 'cover',
          position: 'attention',
        })
        .webp({ quality: 82 })
        .toFile(target);
      stats.photos++;
      return `/uploads/events/${fileName}`;
    } catch (error) {
      log(
        `surat yuklanmadi (pexels ${photoId}: ${(error as Error).message}) — generatsiya qilingan afisha qo'yiladi`,
      );
    }
  }

  const seed = hashOf(event.title) + index * 7919;
  await sharp(Buffer.from(posterSvg(event.theme, seed)))
    .resize(POSTER_WIDTH, POSTER_HEIGHT)
    .webp({ quality: 82 })
    .toFile(target);
  stats.generated++;
  return `/uploads/events/${fileName}`;
}

async function removeSeedPosters() {
  if (!existsSync(UPLOADS_EVENTS)) return;
  const files = await readdir(UPLOADS_EVENTS);
  await Promise.all(
    files
      .filter((file) => file.startsWith('seed-'))
      .map((file) => unlink(join(UPLOADS_EVENTS, file)).catch(() => undefined)),
  );
}

async function resetSeedData(organizerId: string) {
  const sessionWhere = { event: { organizerId } };
  await db.ticket.deleteMany({ where: { session: sessionWhere } });
  await db.order.deleteMany({ where: { session: sessionWhere } }); // items + payment — cascade
  await db.session.deleteMany({ where: sessionWhere }); // ticket categories — cascade
  await db.event.deleteMany({ where: { organizerId } }); // images — cascade
  await db.venue.deleteMany({ where: { createdById: organizerId } }); // sectors/rows/seats — cascade
  await removeSeedPosters();
  log("avvalgi demo ma'lumotlar o'chirildi");
}

async function ensureUser(
  email: string,
  fullName: string,
  role: 'ORGANIZER' | 'CUSTOMER',
  phone?: string,
) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  // Demo akkauntlar — kirish uchun mo'ljallanmagan, parol tasodifiy
  const hashedPassword = (await Crypt.hash(randomUUID())) as string;
  return db.user.create({
    data: {
      email,
      fullName,
      phone,
      role,
      status: 'ACTIVE',
      isVerified: true,
      hashedPassword,
    },
  });
}

// Ketma-ket joylar guruhlarini "sotilgan" qilib belgilash — haqiqiy zalga o'xshab
function pickSoldSeats(
  rows: { seats: { id: string }[] }[],
  share: number,
  random: () => number,
) {
  const total = rows.reduce((sum, row) => sum + row.seats.length, 0);
  const target = Math.round(total * share);
  const sold = new Set<string>();
  let guard = 0;
  while (sold.size < target && guard++ < 5000) {
    const row = rows[Math.floor(random() * rows.length)];
    const groupSize = 1 + Math.floor(random() * 4);
    const start = Math.floor(random() * row.seats.length);
    for (let i = 0; i < groupSize && sold.size < target; i++) {
      const seat = row.seats[start + i];
      if (seat) sold.add(seat.id);
    }
  }
  return [...sold];
}

async function main() {
  const reset = process.argv.includes('--reset');
  const superadmin = await db.user.findFirst({ where: { role: 'SUPERADMIN' } });

  const existingOrganizer = await db.user.findUnique({
    where: { email: ORGANIZER.email },
  });
  if (existingOrganizer) {
    const count = await db.event.count({
      where: { organizerId: existingOrganizer.id },
    });
    if (count > 0 && !reset) {
      log(
        `demo ma'lumotlar allaqachon bor (${count} ta tadbir). Qaytadan yaratish uchun: pnpm seed:reset`,
      );
      return;
    }
    if (reset) await resetSeedData(existingOrganizer.id);
  }

  const organizer = await ensureUser(
    ORGANIZER.email,
    ORGANIZER.fullName,
    'ORGANIZER',
    ORGANIZER.phone,
  );
  const buyer = await ensureUser(
    DEMO_CUSTOMER.email,
    DEMO_CUSTOMER.fullName,
    'CUSTOMER',
  );

  // ---------- Zallar ----------
  const venueIds = new Map<string, string>();
  const sectorIds = new Map<string, Map<string, string>>();
  for (const venue of VENUES) {
    const created = await db.venue.create({
      data: {
        name: venue.name,
        address: venue.address,
        description: venue.description,
        createdById: organizer.id,
        sectors: {
          create: venue.sectors.map((sector) => ({
            name: sector.name,
            rows: {
              create: Array.from({ length: sector.rows }, (_, r) => ({
                number: r + 1,
                seats: {
                  createMany: {
                    data: Array.from(
                      { length: sector.seatsPerRow },
                      (_, s) => ({
                        number: s + 1,
                      }),
                    ),
                  },
                },
              })),
            },
          })),
        },
      },
      include: { sectors: { select: { id: true, name: true } } },
    });
    venueIds.set(venue.key, created.id);
    sectorIds.set(
      venue.key,
      new Map(created.sectors.map((sector) => [sector.name, sector.id])),
    );
  }
  log(`${VENUES.length} ta zal yaratildi`);

  // ---------- Afishalar ----------
  await mkdir(UPLOADS_EVENTS, { recursive: true });

  let sessionsCount = 0;
  let ticketsCount = 0;
  // Bosh sahifa createdAt bo'yicha (yangisi birinchi) saralaydi — eng yaqin tadbir oxirida yaratiladi,
  // shunda ro'yxat sanalar tartibida chiqadi
  const firstDay = (event: SeedEvent) =>
    Math.min(...event.sessions.map((session) => session.daysFromNow));
  const ordered = [...EVENTS].sort((a, b) => firstDay(b) - firstDay(a));

  for (const event of ordered) {
    const posterUrl = await writePoster(event, 0);
    const gallery: string[] = [];
    for (let i = 1; i <= event.gallery; i++) {
      gallery.push(await writePoster(event, i));
    }

    const created = await db.event.create({
      data: {
        organizerId: organizer.id,
        title: event.title,
        description: event.description,
        ageLimit: event.ageLimit,
        duration: event.duration,
        posterUrl,
        status: 'APPROVED',
        reviewedById: superadmin?.id ?? null,
        images: { create: gallery.map((url) => ({ url })) },
      },
    });

    for (const [index, session] of event.sessions.entries()) {
      const venueId = venueIds.get(session.venue);
      if (!venueId) throw new Error(`Zal topilmadi: ${session.venue}`);
      const sectors = sectorIds.get(session.venue)!;

      const createdSession = await db.session.create({
        data: {
          eventId: created.id,
          venueId,
          startTime: sessionStart(session.daysFromNow, session.time),
          seatingType: event.seatingType,
          ticketCategories: {
            create: session.categories.map((category: SeedCategory) =>
              event.seatingType === 'SEATED'
                ? {
                    name: category.name,
                    price: category.price,
                    sectorId: sectors.get(category.sector ?? '') ?? null,
                  }
                : {
                    name: category.name,
                    price: category.price,
                    quantity: category.quantity ?? 100,
                    soldCount: Math.round(
                      (category.quantity ?? 100) * (category.soldShare ?? 0),
                    ),
                  },
            ),
          },
        },
        include: { ticketCategories: true },
      });
      sessionsCount++;

      if (event.seatingType === 'SEATED') {
        ticketsCount += await sellDemoSeats(
          createdSession.id,
          buyer.id,
          createdSession.ticketCategories,
          session.categories,
          hashOf(`${event.title}#${index}`),
        );
      }
    }
  }
  log(`${EVENTS.length} ta tadbir, ${sessionsCount} ta seans yaratildi`);
  log(
    `rasmlar: ${stats.photos} ta internetdan, ${stats.generated} ta generatsiya qilingan`,
  );
  log(`${ticketsCount} ta o'rindiq "sotilgan" deb belgilandi`);

  await clearEventCache();
  log('tayyor ✅');
}

// SEATED seanslarda zal bo'm-bo'sh ko'rinmasligi uchun demo xaridor nomiga to'langan buyurtma
async function sellDemoSeats(
  sessionId: string,
  buyerId: string,
  categories: {
    id: string;
    sectorId: string | null;
    price: unknown;
    name: string;
  }[],
  seed: SeedCategory[],
  randomSeed: number,
) {
  const random = rng(randomSeed);
  const orderId = randomUUID();
  const items: {
    id: string;
    orderId: string;
    ticketCategoryId: string;
    seatId: string;
    price: string;
  }[] = [];

  for (const category of categories) {
    const share = seed.find((c) => c.name === category.name)?.soldShare ?? 0;
    if (!category.sectorId || share <= 0) continue;
    const rows = await db.row.findMany({
      where: { sectorId: category.sectorId },
      orderBy: { number: 'asc' },
      select: { seats: { orderBy: { number: 'asc' }, select: { id: true } } },
    });
    for (const seatId of pickSoldSeats(rows, share, random)) {
      items.push({
        id: randomUUID(),
        orderId,
        ticketCategoryId: category.id,
        seatId,
        price: String(category.price),
      });
    }
  }
  if (!items.length) return 0;

  await db.$transaction([
    db.order.create({
      data: {
        id: orderId,
        userId: buyerId,
        sessionId,
        status: 'PAID',
        expiresAt: new Date(),
      },
    }),
    db.orderItem.createMany({ data: items }),
    db.payment.create({
      data: {
        orderId,
        status: 'SUCCESS',
        transactionId: `seed-${randomUUID()}`,
        paidAt: new Date(),
      },
    }),
    db.ticket.createMany({
      data: items.map((item) => ({
        orderItemId: item.id,
        sessionId,
        seatId: item.seatId,
        qrCode: randomUUID(),
      })),
    }),
  ]);
  return items.length;
}

async function clearEventCache() {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        EVENT_CACHE_PATTERN,
        'COUNT',
        100,
      );
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
    log('tadbirlar keshi tozalandi');
  } catch (error) {
    log(
      `keshni tozalab bo'lmadi (60 soniyada o'zi yangilanadi): ${(error as Error).message}`,
    );
  } finally {
    redis.disconnect();
  }
}

main()
  .catch((error) => {
    console.error('[seed] xato:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
