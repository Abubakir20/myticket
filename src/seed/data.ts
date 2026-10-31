// Demo ma'lumotlar: zallar, tadbirlar, seanslar va chipta toifalari.
// Barcha ijrochilar va jamoalar o'ylab topilgan — real shaxslar nomi ishlatilmagan.

import { PosterTheme } from './posters';

export type SeedSector = { name: string; rows: number; seatsPerRow: number };

export type SeedVenue = {
  key: string;
  name: string;
  address: string;
  description: string;
  sectors: SeedSector[];
};

export type SeedCategory = {
  name: string;
  price: number;
  sector?: string; // SEATED: sektor nomi
  quantity?: number; // GENERAL: umumiy soni
  soldShare?: number; // demo uchun sotilgan ulush (0..1)
};

export type SeedSession = {
  venue: string;
  daysFromNow: number;
  time: string; // "19:00" (Toshkent vaqti)
  categories: SeedCategory[];
};

export type SeedEvent = {
  title: string;
  theme: PosterTheme;
  description: string;
  ageLimit: number | null;
  duration: number;
  gallery: number; // qo'shimcha rasmlar soni
  // Pexels surat ID'lari (bepul litsenziya): [afisha, galereya...]. Yuklanmasa — generatsiya qilingan afisha
  photos?: number[];
  seatingType: 'SEATED' | 'GENERAL';
  sessions: SeedSession[];
};

export const ORGANIZER = {
  email: 'organizer@chipta.uz',
  fullName: 'Chipta Events',
  phone: '+998901112233',
};

export const DEMO_CUSTOMER = {
  email: 'demo-buyer@chipta.uz',
  fullName: 'Demo xaridor',
};

export const VENUES: SeedVenue[] = [
  {
    key: 'arena',
    name: 'Sharq Arena',
    address: "Toshkent, Yunusobod tumani, Amir Temur ko'chasi",
    description: "Katta konsertlar va shoular uchun 600 o'rinli zamonaviy zal.",
    sectors: [
      { name: 'VIP', rows: 3, seatsPerRow: 12 },
      { name: 'Parter', rows: 8, seatsPerRow: 18 },
      { name: 'Amfiteatr', rows: 6, seatsPerRow: 20 },
    ],
  },
  {
    key: 'hall',
    name: "Ko'k Saroy konsert zali",
    address: 'Toshkent, Mirobod tumani, Mustaqillik maydoni yaqinida',
    description: 'Akustikasi bilan mashhur klassik konsert zali.',
    sectors: [
      { name: 'Parter', rows: 7, seatsPerRow: 16 },
      { name: 'Beletaj', rows: 4, seatsPerRow: 14 },
      { name: 'Loja', rows: 2, seatsPerRow: 8 },
    ],
  },
  {
    key: 'theatre',
    name: 'Mehrob teatri',
    address: "Toshkent, Shayxontohur tumani, Navoiy ko'chasi",
    description: 'Drama va bolalar spektakllari sahnasi.',
    sectors: [
      { name: 'Parter', rows: 8, seatsPerRow: 14 },
      { name: 'Amfiteatr', rows: 5, seatsPerRow: 16 },
      { name: 'Balkon', rows: 3, seatsPerRow: 12 },
    ],
  },
  {
    key: 'club',
    name: "Ko'k soat jazz klubi",
    address: "Toshkent, Chilonzor tumani, Bunyodkor shoh ko'chasi",
    description: 'Jonli musiqa va stand-up uchun kichik klub.',
    sectors: [],
  },
  {
    key: 'park',
    name: "Bog'i Eram ochiq sahnasi",
    address: "Toshkent, Olmazor tumani, Bog'i Eram bog'i",
    description: 'Festivallar va katta ochiq havodagi tadbirlar uchun maydon.',
    sectors: [],
  },
];

export const EVENTS: SeedEvent[] = [
  {
    title: 'Shahar chiroqlari: simfonik kecha',
    theme: 'orchestra',
    photos: [5182979, 5933199, 2372945],
    description:
      "Toshkent kamer orkestri yangi mavsumni katta simfonik kecha bilan ochadi. Dasturda klassik asarlar, kino musiqasidan syuitalar va o'zbek bastakorlarining orkestr uchun qayta ishlangan kuylari bor.\n\nKonsert ikki bo'limdan iborat, oraliqda 20 daqiqalik tanaffus. Zalga kirish konsert boshlanishidan 45 daqiqa oldin ochiladi.",
    ageLimit: 6,
    duration: 120,
    gallery: 2,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'hall',
        daysFromNow: 6,
        time: '19:00',
        categories: [
          { name: 'Loja', price: 450000, sector: 'Loja', soldShare: 0.5 },
          { name: 'Parter', price: 280000, sector: 'Parter', soldShare: 0.35 },
          { name: 'Beletaj', price: 180000, sector: 'Beletaj', soldShare: 0.2 },
        ],
      },
      {
        venue: 'hall',
        daysFromNow: 13,
        time: '19:00',
        categories: [
          { name: 'Loja', price: 450000, sector: 'Loja', soldShare: 0.15 },
          { name: 'Parter', price: 280000, sector: 'Parter', soldShare: 0.1 },
          {
            name: 'Beletaj',
            price: 180000,
            sector: 'Beletaj',
            soldShare: 0.05,
          },
        ],
      },
    ],
  },
  {
    title: "Ko'k soat: jazz kechasi",
    theme: 'jazz',
    photos: [1358816, 13112779],
    description:
      '"Tungi tramvay" kvarteti jazz standartlari va o\'zbek kuylarining jazz talqinini ijro etadi. Kichik zal, sham yorug\'i va jonli improvizatsiya.\n\nStollar oldindan band qilinmaydi — joylar kelish tartibida egallanadi. Klubda ichimliklar va yengil taomlar bor.',
    ageLimit: 16,
    duration: 100,
    gallery: 1,
    seatingType: 'GENERAL',
    sessions: [
      {
        venue: 'club',
        daysFromNow: 3,
        time: '20:00',
        categories: [
          { name: 'Stol yonida', price: 220000, quantity: 40, soldShare: 0.7 },
          { name: 'Bar oldida', price: 150000, quantity: 60, soldShare: 0.45 },
        ],
      },
      {
        venue: 'club',
        daysFromNow: 10,
        time: '20:00',
        categories: [
          { name: 'Stol yonida', price: 220000, quantity: 40, soldShare: 0.2 },
          { name: 'Bar oldida', price: 150000, quantity: 60, soldShare: 0.1 },
        ],
      },
    ],
  },
  {
    title: 'Hamlet',
    theme: 'theatre',
    photos: [12471750, 391535, 14719432],
    description:
      "Shekspirning mashhur tragediyasi Mehrob teatri sahnasida yangi talqinda. Daniya shahzodasi haqiqat va qasos orasida qolar ekan, har bir qaror butun saroy taqdirini o'zgartiradi.\n\nSpektakl o'zbek tilida, ikki pardali. Rejissyor talqini zamonaviy sahna dizayni va jonli musiqa bilan boyitilgan.",
    ageLimit: 12,
    duration: 150,
    gallery: 2,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'theatre',
        daysFromNow: 4,
        time: '18:30',
        categories: [
          { name: 'Parter', price: 160000, sector: 'Parter', soldShare: 0.55 },
          {
            name: 'Amfiteatr',
            price: 110000,
            sector: 'Amfiteatr',
            soldShare: 0.4,
          },
          { name: 'Balkon', price: 70000, sector: 'Balkon', soldShare: 0.3 },
        ],
      },
      {
        venue: 'theatre',
        daysFromNow: 18,
        time: '18:30',
        categories: [
          { name: 'Parter', price: 160000, sector: 'Parter', soldShare: 0.1 },
          {
            name: 'Amfiteatr',
            price: 110000,
            sector: 'Amfiteatr',
            soldShare: 0.05,
          },
          { name: 'Balkon', price: 70000, sector: 'Balkon', soldShare: 0 },
        ],
      },
    ],
  },
  {
    title: 'Kulgu kechasi: Stand-up Open Mic',
    theme: 'standup',
    photos: [1550469],
    description:
      "Shaharning eng yorqin yosh komiklari bir sahnada. Har bir ijrochiga 10 daqiqa va bitta mikrofon — qolgani tomoshabinlarga bog'liq.\n\nDasturda kundalik hayot, ish va oila haqidagi hazillar bor. Tadbir faqat kattalar uchun.",
    ageLimit: 18,
    duration: 90,
    gallery: 0,
    seatingType: 'GENERAL',
    sessions: [
      {
        venue: 'club',
        daysFromNow: 5,
        time: '21:00',
        categories: [
          {
            name: 'Birinchi qatorlar',
            price: 180000,
            quantity: 30,
            soldShare: 0.9,
          },
          { name: 'Umumiy zal', price: 120000, quantity: 80, soldShare: 0.6 },
        ],
      },
    ],
  },
  {
    title: "Navro'z ohanglari: folklor festivali",
    theme: 'folk',
    description:
      "Butun mamlakat bo'ylab folklor ansambllari Bog'i Eram ochiq sahnasida jam bo'ladi. Lapar, yalla, doston va milliy raqslar, hunarmandlar yarmarkasi va milliy taomlar.\n\nFestival kun bo'yi davom etadi. Bolalar uchun alohida o'yin maydonchasi va mahorat darslari tashkil etiladi.",
    ageLimit: 0,
    duration: 300,
    gallery: 2,
    seatingType: 'GENERAL',
    sessions: [
      {
        venue: 'park',
        daysFromNow: 20,
        time: '11:00',
        categories: [
          {
            name: 'Oilaviy (4 kishi)',
            price: 200000,
            quantity: 150,
            soldShare: 0.3,
          },
          { name: 'Kattalar', price: 60000, quantity: 600, soldShare: 0.25 },
          {
            name: 'Bolalar (12 yoshgacha)',
            price: 30000,
            quantity: 400,
            soldShare: 0.2,
          },
        ],
      },
    ],
  },
  {
    title: 'Neon Pulse: elektron tun',
    theme: 'neon',
    photos: [1190298, 8448549],
    description:
      "Uch nafar DJ, kuchli ovoz tizimi va to'liq lazer shou. Synthwave, house va techno — tong otguncha raqs.\n\nKirishda yoshni tasdiqlovchi hujjat so'raladi. Tadbir ochiq havoda o'tadi, ob-havoga mos kiyining.",
    ageLimit: 18,
    duration: 360,
    gallery: 1,
    seatingType: 'GENERAL',
    sessions: [
      {
        venue: 'park',
        daysFromNow: 12,
        time: '22:00',
        categories: [
          { name: 'VIP zona', price: 650000, quantity: 80, soldShare: 0.4 },
          {
            name: 'Raqs maydoni',
            price: 250000,
            quantity: 900,
            soldShare: 0.35,
          },
        ],
      },
    ],
  },
  {
    title: 'Zumrad va Qimmat',
    theme: 'kids',
    description:
      "Mehnatsevar Zumrad va erka Qimmat haqidagi sevimli xalq ertagi qo'shiqlar, raqslar va yorqin kostyumlar bilan sahnalashtirilgan.\n\nSpektakl 4 yoshdan katta bolalar uchun. Tomosha so'ngida ertak qahramonlari bilan suratga tushish mumkin.",
    ageLimit: 4,
    duration: 70,
    gallery: 1,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'theatre',
        daysFromNow: 7,
        time: '11:00',
        categories: [
          { name: 'Parter', price: 80000, sector: 'Parter', soldShare: 0.45 },
          {
            name: 'Amfiteatr',
            price: 60000,
            sector: 'Amfiteatr',
            soldShare: 0.3,
          },
          { name: 'Balkon', price: 40000, sector: 'Balkon', soldShare: 0.2 },
        ],
      },
      {
        venue: 'theatre',
        daysFromNow: 14,
        time: '11:00',
        categories: [
          { name: 'Parter', price: 80000, sector: 'Parter', soldShare: 0.2 },
          {
            name: 'Amfiteatr',
            price: 60000,
            sector: 'Amfiteatr',
            soldShare: 0.1,
          },
          { name: 'Balkon', price: 40000, sector: 'Balkon', soldShare: 0 },
        ],
      },
    ],
  },
  {
    title: "Tog' shamoli: rok kechasi",
    theme: 'rock',
    photos: [736355, 2990830, 7626763],
    description:
      '"Qoya" va "Shamol yo\'li" guruhlari bir sahnada. Kuchli gitara rifflari, hammaga tanish xitlar va yangi albomdan premyera qo\'shiqlar.\n\nKonsert Sharq Arenada o\'tadi. VIP chipta egalariga sahna yaqinidagi alohida kirish va esdalik sovg\'asi beriladi.',
    ageLimit: 12,
    duration: 140,
    gallery: 2,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'arena',
        daysFromNow: 9,
        time: '19:30',
        categories: [
          { name: 'VIP', price: 600000, sector: 'VIP', soldShare: 0.6 },
          { name: 'Parter', price: 350000, sector: 'Parter', soldShare: 0.45 },
          {
            name: 'Amfiteatr',
            price: 200000,
            sector: 'Amfiteatr',
            soldShare: 0.3,
          },
        ],
      },
    ],
  },
  {
    title: 'Shashmaqom kechasi',
    theme: 'maqom',
    description:
      "Maqom ansambli Shashmaqomning asosiy turkumlaridan namunalar ijro etadi. Tanbur, dutor, sato va doira jo'rligida mumtoz g'azallar yangraydi.\n\nKonsert oldidan musiqashunos maqom an'anasi haqida qisqa so'zlab beradi.",
    ageLimit: 0,
    duration: 110,
    gallery: 1,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'hall',
        daysFromNow: 16,
        time: '18:00',
        categories: [
          { name: 'Loja', price: 250000, sector: 'Loja', soldShare: 0.25 },
          { name: 'Parter', price: 150000, sector: 'Parter', soldShare: 0.2 },
          { name: 'Beletaj', price: 90000, sector: 'Beletaj', soldShare: 0.1 },
        ],
      },
    ],
  },
  {
    title: 'Sehrgarlar shousi',
    theme: 'magic',
    description:
      "Illyuzionistlar jamoasi g'oyib bo'ladigan buyumlar, havoda suzayotgan stullar va tomoshabinlar bilan interaktiv fokuslar ko'rsatadi.\n\nShou butun oila uchun mo'ljallangan. Sahnaga chiqib fokusda ishtirok etish istagidagilar uchun maxsus lotereya o'tkaziladi.",
    ageLimit: 6,
    duration: 90,
    gallery: 1,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'arena',
        daysFromNow: 22,
        time: '17:00',
        categories: [
          { name: 'VIP', price: 300000, sector: 'VIP', soldShare: 0.3 },
          { name: 'Parter', price: 180000, sector: 'Parter', soldShare: 0.2 },
          {
            name: 'Amfiteatr',
            price: 110000,
            sector: 'Amfiteatr',
            soldShare: 0.15,
          },
        ],
      },
    ],
  },
  {
    title: "Oqqush ko'li",
    theme: 'ballet',
    description:
      "Chaykovskiy musiqasi asosidagi klassik balet. Malika Odetta va shahzoda Zigfrid sevgisi haqidagi afsona to'rt pardada.\n\nBalet jonli orkestr jo'rligida ijro etiladi. Kech qolgan tomoshabinlar faqat tanaffusda zalga kiritiladi.",
    ageLimit: 6,
    duration: 160,
    gallery: 2,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'theatre',
        daysFromNow: 25,
        time: '19:00',
        categories: [
          { name: 'Parter', price: 240000, sector: 'Parter', soldShare: 0.3 },
          {
            name: 'Amfiteatr',
            price: 170000,
            sector: 'Amfiteatr',
            soldShare: 0.2,
          },
          { name: 'Balkon', price: 110000, sector: 'Balkon', soldShare: 0.1 },
        ],
      },
    ],
  },
  {
    title: 'Kino-konsert: katta ekran musiqasi',
    theme: 'cinema',
    photos: [14746411, 7991231],
    description:
      "Mashhur filmlar uchun yozilgan musiqa simfonik orkestr ijrosida, katta ekrandagi kadrlar bilan uyg'un holda. Sarguzasht, fantastika va drama janrlaridan eng yaxshi mavzular.\n\nKonsert davomida ekranda filmlar haqidagi qiziqarli faktlar namoyish etiladi.",
    ageLimit: 6,
    duration: 120,
    gallery: 1,
    seatingType: 'SEATED',
    sessions: [
      {
        venue: 'arena',
        daysFromNow: 29,
        time: '19:00',
        categories: [
          { name: 'VIP', price: 420000, sector: 'VIP', soldShare: 0.2 },
          { name: 'Parter', price: 260000, sector: 'Parter', soldShare: 0.15 },
          {
            name: 'Amfiteatr',
            price: 160000,
            sector: 'Amfiteatr',
            soldShare: 0.1,
          },
        ],
      },
    ],
  },
];
