// ==============================================
// GotMeds — Seed-скрипт (Наполнитель тестовыми данными)
// ==============================================
// Создаёт:
// - 1 город (Гудермес)
// - 3 аптеки (по одной каждого Tier)
// - 16 препаратов (разные категории)
// - Алиасы для нескольких препаратов
// - Записи о наличии (Inventory) для Tier 2 и Tier 3 аптек
// ==============================================

import {
  AdminRole,
  InventoryStatus,
  PharmacyStatus,
  PharmacyTier,
  PrismaClient,
  ProductCategory,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";
import "dotenv/config";

// Инициализация подключения через driver adapter (Prisma 7)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Запуск seed-скрипта...");

  // --- Очистка старых данных (в правильном порядке из-за FK) ---
  await prisma.searchLog.deleteMany();
  await prisma.unmappedString.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.product.deleteMany();
  await prisma.pharmacy.deleteMany();
  await prisma.city.deleteMany();
  await prisma.admin.deleteMany();

  console.log("🗑️  Старые данные очищены.");

  // --- 0. Тестовый администратор ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@gotmeds.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.create({
    data: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: AdminRole.SUPERADMIN,
    },
  });

  console.log(`👤 Создан тестовый администратор: ${adminEmail}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log("   Пароль по умолчанию для локальной проверки: admin12345");
  }

  // --- 1. Город ---
  const gudermes = await prisma.city.create({
    data: {
      name: "Гудермес",
      centerLatitude: 43.3517,
      centerLongitude: 46.1003,
      isActive: true,
    },
  });
  console.log(`🏙️  Создан город: ${gudermes.name}`);

  // --- 2. Аптеки (3 штуки — по одной каждого Tier) ---
  const pharmacies = await Promise.all([
    // Tier 1 — Малый киоск
    prisma.pharmacy.create({
      data: {
        cityId: gudermes.id,
        name: "Аптека у Базара",
        address: "ул. Кадырова, 15",
        latitude: 43.3510,
        longitude: 46.0980,
        tier: PharmacyTier.TIER_1,
        status: PharmacyStatus.ACTIVE,
        phone: "+7 (928) 111-22-33",
        whatsapp: "+79281112233",
        workingHours: {
          mon: "08:00-20:00",
          tue: "08:00-20:00",
          wed: "08:00-20:00",
          thu: "08:00-20:00",
          fri: "08:00-20:00",
          sat: "09:00-18:00",
          sun: "выходной",
        },
        is247: false,
      },
    }),
    // Tier 2 — Крупная частная аптека
    prisma.pharmacy.create({
      data: {
        cityId: gudermes.id,
        name: "Фармация Плюс",
        address: "пр. Исаева, 42",
        latitude: 43.3530,
        longitude: 46.1020,
        tier: PharmacyTier.TIER_2,
        status: PharmacyStatus.ACTIVE,
        phone: "+7 (928) 444-55-66",
        whatsapp: "+79284445566",
        workingHours: {
          mon: "08:00-21:00",
          tue: "08:00-21:00",
          wed: "08:00-21:00",
          thu: "08:00-21:00",
          fri: "08:00-21:00",
          sat: "09:00-20:00",
          sun: "10:00-18:00",
        },
        is247: false,
      },
    }),
    // Tier 3 — Сетевая аптека
    prisma.pharmacy.create({
      data: {
        cityId: gudermes.id,
        name: "Аптека.ру (Гудермес)",
        address: "ул. Грозненская, 7",
        latitude: 43.3525,
        longitude: 46.1050,
        tier: PharmacyTier.TIER_3,
        status: PharmacyStatus.ACTIVE,
        phone: "+7 (800) 777-88-99",
        whatsapp: null,
        workingHours: {
          mon: "00:00-23:59",
          tue: "00:00-23:59",
          wed: "00:00-23:59",
          thu: "00:00-23:59",
          fri: "00:00-23:59",
          sat: "00:00-23:59",
          sun: "00:00-23:59",
        },
        is247: true,
      },
    }),
  ]);

  console.log(`💊 Создано аптек: ${pharmacies.length}`);

  // --- 3. Препараты (16 штук — разные категории) ---
  const products = await Promise.all([
    // Лекарства (medicine)
    prisma.product.create({
      data: {
        name: "Нурофен",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Ибупрофен",
        form: "таблетки",
        dosage: "200мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 250,
        description: "Обезболивающее и жаропонижающее средство на основе ибупрофена.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Аспирин",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Ацетилсалициловая кислота",
        form: "таблетки",
        dosage: "500мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 120,
        description: "Противовоспалительное и жаропонижающее средство.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Амоксициллин",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Амоксициллин",
        form: "капсулы",
        dosage: "500мг",
        isPrescription: true,
        isSocialRisk: false,
        priceEstimate: 180,
        description: "Антибиотик широкого спектра действия из группы пенициллинов.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Парацетамол",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Парацетамол",
        form: "таблетки",
        dosage: "500мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 50,
        description: "Жаропонижающее и обезболивающее средство.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Цитрамон П",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Кофеин + Парацетамол + Ацетилсалициловая кислота",
        form: "таблетки",
        dosage: null,
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 70,
        description: "Комбинированный анальгетик от головной боли.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Лоперамид",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Лоперамид",
        form: "капсулы",
        dosage: "2мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 90,
        description: "Противодиарейное средство.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Омепразол",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Омепразол",
        form: "капсулы",
        dosage: "20мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 110,
        description: "Средство для лечения язвенной болезни и гастрита.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Диазепам",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Диазепам",
        form: "таблетки",
        dosage: "5мг",
        isPrescription: true,
        isSocialRisk: true, // Чёрный список — социально опасный
        priceEstimate: 300,
        description: "Транквилизатор бензодиазепинового ряда (строгий учёт).",
      },
    }),
    prisma.product.create({
      data: {
        name: "Супрастин",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Хлоропирамин",
        form: "таблетки",
        dosage: "25мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 200,
        description: "Антигистаминный препарат от аллергии.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Но-Шпа",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Дротаверин",
        form: "таблетки",
        dosage: "40мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 230,
        description: "Спазмолитическое средство.",
      },
    }),

    // Витамины (vitamins)
    prisma.product.create({
      data: {
        name: "Компливит",
        category: ProductCategory.VITAMINS,
        activeIngredient: null,
        form: "таблетки",
        dosage: null,
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 350,
        description: "Витаминно-минеральный комплекс для ежедневного приёма.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Аквадетрим (Витамин D3)",
        category: ProductCategory.VITAMINS,
        activeIngredient: "Колекальциферол",
        form: "капли",
        dosage: "15000 МЕ/мл",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 220,
        description: "Водный раствор витамина D3 для профилактики рахита.",
      },
    }),

    // Медтехника (equipment)
    prisma.product.create({
      data: {
        name: "Тонометр AND UA-888",
        category: ProductCategory.EQUIPMENT,
        activeIngredient: null,
        form: null,
        dosage: null,
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 2500,
        description: "Автоматический тонометр для измерения артериального давления.",
      },
    }),

    // Мать и дитя (mother_and_baby)
    prisma.product.create({
      data: {
        name: "Нурофен Детский",
        category: ProductCategory.MOTHER_AND_BABY,
        activeIngredient: "Ибупрофен",
        form: "суспензия",
        dosage: "100мг/5мл",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 320,
        description: "Жаропонижающее для детей от 3 месяцев.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Эспумизан Бэби",
        category: ProductCategory.MOTHER_AND_BABY,
        activeIngredient: "Симетикон",
        form: "капли",
        dosage: "100мг/мл",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 550,
        description: "Средство от колик и вздутия у новорождённых.",
      },
    }),
    prisma.product.create({
      data: {
        name: "Дротаверин",
        category: ProductCategory.MEDICINE,
        activeIngredient: "Дротаверин",
        form: "таблетки",
        dosage: "40мг",
        isPrescription: false,
        isSocialRisk: false,
        priceEstimate: 95,
        description: "Спазмолитический препарат с тем же действующим веществом, что и Но-Шпа.",
      },
    }),
  ]);

  console.log(`💊 Создано препаратов: ${products.length}`);

  // --- 4. Алиасы (синонимы из 1С) ---
  const aliases = await Promise.all([
    prisma.productAlias.create({
      data: {
        originalString: "Нуроф таб 200мг",
        productId: products[0].id, // Нурофен
        isIgnored: false,
      },
    }),
    prisma.productAlias.create({
      data: {
        originalString: "НУРОФЕН ТАБ.П/О 200МГ №20",
        productId: products[0].id, // Нурофен
        isIgnored: false,
      },
    }),
    prisma.productAlias.create({
      data: {
        originalString: "Аспирин табл 500",
        productId: products[1].id, // Аспирин
        isIgnored: false,
      },
    }),
    prisma.productAlias.create({
      data: {
        originalString: "Парацетамол тб 500мг",
        productId: products[3].id, // Парацетамол
        isIgnored: false,
      },
    }),
    prisma.productAlias.create({
      data: {
        originalString: "ПАКЕТ ФАСОВОЧНЫЙ",
        productId: null, // Мусорный товар — не лекарство
        isIgnored: true,
      },
    }),
  ]);

  console.log(`🔗 Создано алиасов: ${aliases.length}`);

  // --- 5. Наличие (Inventory) — только для Tier 2 и Tier 3 ---
  const tier2Pharmacy = pharmacies[1]; // Фармация Плюс
  const tier3Pharmacy = pharmacies[2]; // Аптека.ру

  const inventoryData = [];

  // Tier 2 — есть 8 из 15 препаратов
  const tier2ProductIndices = [0, 1, 3, 4, 5, 8, 9, 10];
  for (const idx of tier2ProductIndices) {
    inventoryData.push({
      pharmacyId: tier2Pharmacy.id,
      productId: products[idx].id,
      status: InventoryStatus.IN_STOCK,
      price: products[idx].priceEstimate
        ? products[idx].priceEstimate! * (0.9 + Math.random() * 0.2) // Цена ±10% от эстимейта
        : null,
    });
  }

  // Tier 3 — есть 12 из 15 препаратов (широкий ассортимент)
  const tier3ProductIndices = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
  for (const idx of tier3ProductIndices) {
    inventoryData.push({
      pharmacyId: tier3Pharmacy.id,
      productId: products[idx].id,
      status: InventoryStatus.IN_STOCK,
      price: products[idx].priceEstimate
        ? Math.round(products[idx].priceEstimate! * (0.95 + Math.random() * 0.1)) // Сетевая — цены стабильнее
        : null,
    });
  }

  // Пара товаров со статусом "вероятно в наличии"
  inventoryData.push({
    pharmacyId: tier2Pharmacy.id,
    productId: products[13].id, // Нурофен Детский
    status: InventoryStatus.LIKELY_IN_STOCK,
    price: null,
  });

  inventoryData.push({
    pharmacyId: tier3Pharmacy.id,
    productId: products[14].id, // Эспумизан Бэби
    status: InventoryStatus.LIKELY_IN_STOCK,
    price: 560,
  });

  inventoryData.push({
    pharmacyId: tier2Pharmacy.id,
    productId: products[15].id, // Дротаверин
    status: InventoryStatus.IN_STOCK,
    price: 95,
  });

  inventoryData.push({
    pharmacyId: tier3Pharmacy.id,
    productId: products[15].id, // Дротаверин
    status: InventoryStatus.IN_STOCK,
    price: 100,
  });

  await prisma.inventory.createMany({ data: inventoryData });

  console.log(`📦 Создано записей наличия: ${inventoryData.length}`);

  // --- Итог ---
  console.log("\n✅ Seed-скрипт завершён успешно!");
  console.log("   Для проверки выполните: npx prisma studio");
}

main()
  .catch((e) => {
    console.error("❌ Ошибка seed-скрипта:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
