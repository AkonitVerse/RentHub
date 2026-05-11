/**
 * Seed-скрипт демо-инвентаря.
 *
 * Создаёт минимальный набор для презентации витрины и админки:
 *   - 3 ценовых тира (1-3 дн / 4-7 дн / 8+ дн с прогрессивной скидкой)
 *   - 3 родительских категории + 6 подкатегорий (двухуровневая иерархия)
 *   - 12 карточек оборудования с фото-плейсхолдерами и характеристиками
 *   - 30+ физических единиц инвентаря с инв. номерами
 *
 * Идемпотентный: повторный запуск не создаёт дубликатов
 * (используется upsert по уникальным полям: slug, rank, sku, inventoryNumber).
 *
 * Не трогает: пользователей, OrgSettings, заказы, клиентов, шаблоны писем.
 *
 * Запуск:
 *   npx tsx apps/api/prisma/seed-demo-inventory.ts
 */
import 'dotenv/config';
import { PrismaClient, WarehouseItemStatus } from '@prisma/client';

const prisma = new PrismaClient();

// =====================
// Утилиты
// =====================

function genCategorySlug(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'cat_';
  for (let i = 0; i < 8; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// =====================
// Структура: тиры
// =====================

interface TierSeed {
  rank: number;
  minDays: number;
  maxDays: number | null;
  note: string;
  /** Скидка относительно базовой цены, % */
  discount: number;
}

const TIERS: TierSeed[] = [
  { rank: 1, minDays: 1, maxDays: 3, note: 'Базовый тариф (1–3 дня)', discount: 0 },
  { rank: 2, minDays: 4, maxDays: 7, note: 'Недельный тариф (4–7 дней)', discount: 15 },
  { rank: 3, minDays: 8, maxDays: null, note: 'Длительный тариф (8+ дней)', discount: 30 },
];

function tierPrice(basePrice: number, discount: number): number {
  return Math.round((basePrice * (100 - discount)) / 100);
}

// =====================
// Структура: категории
// =====================

interface CategorySeed {
  name: string;
  description?: string;
  icon?: string;
  children?: CategorySeed[];
}

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Звуковая аппаратура',
    description: 'Профессиональный звук для мероприятий любого масштаба',
    icon: 'mic',
    children: [
      { name: 'Микрофоны', description: 'Динамические и конденсаторные модели' },
      { name: 'Акустические системы', description: 'Активные колонки и сабвуферы' },
    ],
  },
  {
    name: 'Видеооборудование',
    description: 'Камеры, объективы и видеосвет для фото- и видеосъёмки',
    icon: 'camera',
    children: [
      { name: 'Камеры', description: 'Беззеркальные и зеркальные камеры' },
      { name: 'Объективы', description: 'Универсальные и портретные объективы' },
    ],
  },
  {
    name: 'Световое оборудование',
    description: 'Постоянный и импульсный свет для съёмки и сцены',
    icon: 'sun',
    children: [
      { name: 'LED-панели', description: 'Постоянный свет для видео и фото' },
      { name: 'Сценические прожекторы', description: 'Свет для концертов и шоу' },
    ],
  },
];

// =====================
// Структура: карточки оборудования
// =====================

interface EquipmentSeed {
  /** Категория-листочек, в которую помещается карточка (сравнение по name) */
  categoryName: string;
  sku: string;
  name: string;
  description: string;
  fullDesc?: string;
  basePrice: number; // цена в рублях для тира 1 (1–3 дня)
  deposit: number;
  isFeatured?: boolean;
  specs: Record<string, string>;
  /** Сколько физических единиц завести на склад */
  unitsCount: number;
}

const EQUIPMENT: EquipmentSeed[] = [
  // ===== Микрофоны =====
  {
    categoryName: 'Микрофоны',
    sku: 'MIC-SM58',
    name: 'Shure SM58',
    description: 'Легендарный вокальный динамический микрофон',
    fullDesc:
      'Стандарт индустрии для живого вокала. Кардиоидная диаграмма направленности, прочный металлический корпус, встроенный поп-фильтр.',
    basePrice: 800,
    deposit: 5000,
    isFeatured: true,
    specs: {
      Тип: 'Динамический',
      Диаграмма: 'Кардиоида',
      'Диапазон частот': '50 Hz — 15 kHz',
      Разъём: 'XLR',
    },
    unitsCount: 4,
  },
  {
    categoryName: 'Микрофоны',
    sku: 'MIC-RODE-NT1',
    name: 'Rode NT1',
    description: 'Студийный конденсаторный микрофон',
    fullDesc:
      'Один из самых тихих конденсаторных микрофонов в мире. Идеален для записи вокала, акустических инструментов, подкастов.',
    basePrice: 1500,
    deposit: 12000,
    specs: {
      Тип: 'Конденсаторный',
      Диаграмма: 'Кардиоида',
      'Уровень шумов': '4 dBA',
      Питание: 'Phantom +48V',
    },
    unitsCount: 2,
  },

  // ===== Колонки =====
  {
    categoryName: 'Акустические системы',
    sku: 'SPK-JBL-EON615',
    name: 'JBL EON615',
    description: 'Активная акустическая система 1000 Вт',
    fullDesc:
      'Универсальная активная колонка для сцены и мониторинга. Bluetooth, встроенный микшер на 2 канала, лёгкий корпус.',
    basePrice: 2500,
    deposit: 25000,
    isFeatured: true,
    specs: {
      Мощность: '1000 Вт (пик)',
      'НЧ-динамик': '15"',
      'Макс. SPL': '127 dB',
      Вес: '17 кг',
    },
    unitsCount: 4,
  },
  {
    categoryName: 'Акустические системы',
    sku: 'SPK-BOSE-L1C',
    name: 'Bose L1 Compact',
    description: 'Компактная вертикальная система',
    fullDesc:
      'Портативная колонна-система для соло-выступлений и небольших площадок. Звук распространяется на 180°.',
    basePrice: 3000,
    deposit: 30000,
    specs: {
      Мощность: '300 Вт',
      Динамики: '6× 2"',
      'Покрытие звука': '180°',
      Вес: '13 кг',
    },
    unitsCount: 2,
  },

  // ===== Камеры =====
  {
    categoryName: 'Камеры',
    sku: 'CAM-SONY-A7III',
    name: 'Sony A7 III',
    description: 'Полнокадровая беззеркальная камера 24 МП',
    fullDesc:
      'Универсальная полнокадровая камера для фото и видео 4K. Двойной слот SD-карт, отличная стабилизация, 693 точки автофокуса.',
    basePrice: 3500,
    deposit: 80000,
    isFeatured: true,
    specs: {
      Сенсор: 'Full-frame 24 МП',
      Видео: '4K 30p, FHD 120p',
      Стабилизация: '5-осевая, 5 ступеней',
      Аккумулятор: '710 кадров',
    },
    unitsCount: 3,
  },
  {
    categoryName: 'Камеры',
    sku: 'CAM-CANON-R6',
    name: 'Canon EOS R6',
    description: 'Полнокадровая беззеркальная 20 МП, видео 4K 60p',
    fullDesc:
      'Топовая камера для съёмки динамики. До 20 кадров/с, видео 4K 60p, скоростной автофокус по всему кадру.',
    basePrice: 4000,
    deposit: 100000,
    specs: {
      Сенсор: 'Full-frame 20 МП',
      Видео: '4K 60p 10-bit',
      Серия: '20 к/с электронный затвор',
      Стабилизация: '5-осевая, 8 ступеней',
    },
    unitsCount: 2,
  },

  // ===== Объективы =====
  {
    categoryName: 'Объективы',
    sku: 'LENS-SONY-2470GM',
    name: 'Sony FE 24-70 f/2.8 GM',
    description: 'Универсальный профессиональный зум-объектив',
    fullDesc:
      'Один из самых востребованных объективов для свадеб, репортажа, видео. Постоянная диафрагма f/2.8 на всём диапазоне.',
    basePrice: 2200,
    deposit: 60000,
    specs: {
      'Фокусное расстояние': '24–70 мм',
      'Макс. диафрагма': 'f/2.8',
      Байонет: 'Sony E',
      Вес: '886 г',
    },
    unitsCount: 3,
  },
  {
    categoryName: 'Объективы',
    sku: 'LENS-SIGMA-50ART',
    name: 'Sigma 50mm f/1.4 Art',
    description: 'Портретный объектив с большой светосилой',
    fullDesc:
      'Эталонный портретник серии Art. Великолепное размытие фона, резкость с открытой диафрагмы.',
    basePrice: 1200,
    deposit: 30000,
    specs: {
      'Фокусное расстояние': '50 мм',
      'Макс. диафрагма': 'f/1.4',
      Байонет: 'Sony E / Canon EF',
      Вес: '815 г',
    },
    unitsCount: 2,
  },

  // ===== LED-панели =====
  {
    categoryName: 'LED-панели',
    sku: 'LIGHT-APUTURE-200D',
    name: 'Aputure 200D Mark II',
    description: 'LED-моноблок 200 Вт, дневной свет 5500K',
    fullDesc:
      'Мощный осветитель для видеосъёмки. Управление через Bluetooth, поддержка V-mount батарей. CRI 96+.',
    basePrice: 1800,
    deposit: 40000,
    isFeatured: true,
    specs: {
      Мощность: '200 Вт',
      Цвет: '5500K (дневной)',
      CRI: '96+',
      Крепление: 'Bowens',
    },
    unitsCount: 3,
  },
  {
    categoryName: 'LED-панели',
    sku: 'LIGHT-GODOX-SL60',
    name: 'Godox SL-60W',
    description: 'Бюджетный LED-осветитель 60 Вт',
    fullDesc:
      'Стартовый вариант постоянного света для видеоблогеров и небольших проектов. Тихий вентилятор, плавная регулировка.',
    basePrice: 600,
    deposit: 12000,
    specs: {
      Мощность: '60 Вт',
      Цвет: '5600K',
      Управление: 'ИК-пульт',
      Крепление: 'Bowens',
    },
    unitsCount: 4,
  },

  // ===== Сценические прожекторы =====
  {
    categoryName: 'Сценические прожекторы',
    sku: 'STAGE-CHAUVET-SLIMPAR-T12',
    name: 'Chauvet SlimPAR T12 USB',
    description: 'Светодиодный прожектор RGB с DMX',
    fullDesc:
      'Тонкий и лёгкий прожектор с богатой цветовой палитрой. DMX-управление, встроенные эффекты, беспроводное D-Fi USB.',
    basePrice: 700,
    deposit: 10000,
    specs: {
      Светодиоды: '12× 3 Вт RGB',
      'Угол луча': '20°',
      'DMX-каналы': '3/4/7',
      Вес: '2.5 кг',
    },
    unitsCount: 6,
  },
  {
    categoryName: 'Сценические прожекторы',
    sku: 'STAGE-MOVING-HEAD-200',
    name: 'Moving Head LED 200',
    description: 'Вращающаяся голова 200 Вт',
    fullDesc:
      'Классический инструмент для дискотек, корпоративов, выпускных. Высокая скорость движения, гобо, призмы.',
    basePrice: 1500,
    deposit: 25000,
    specs: {
      Мощность: '200 Вт LED',
      'Угол луча': '14°',
      'DMX-каналы': '14',
      Вес: '13 кг',
    },
    unitsCount: 4,
  },
];

// =====================
// MAIN
// =====================

async function main() {
  console.log('🌱 Заполняем демо-инвентарь...\n');

  // ===== 1. Тиры =====
  console.log('💰 Создаём ценовые тиры...');
  for (const t of TIERS) {
    await prisma.pricingTier.upsert({
      where: { rank: t.rank },
      create: { rank: t.rank, minDays: t.minDays, maxDays: t.maxDays, note: t.note },
      update: { minDays: t.minDays, maxDays: t.maxDays, note: t.note },
    });
  }
  const tiers = await prisma.pricingTier.findMany({ orderBy: { rank: 'asc' } });
  console.log(`   ✓ Тиров: ${tiers.length}`);

  // ===== 2. Категории =====
  console.log('\n📂 Создаём категории...');
  // Карта name → id для быстрого lookup
  const categoryMap = new Map<string, number>();
  let categoryCount = 0;

  for (let pIdx = 0; pIdx < CATEGORY_TREE.length; pIdx += 1) {
    const parent = CATEGORY_TREE[pIdx];
    // Для root-категорий (parentId=null) Prisma не разрешает upsert через
    // составной ключ — null в where не работает. Делаем вручную через findFirst.
    let parentRow = await prisma.category.findFirst({
      where: { parentId: null, name: parent.name },
    });
    if (parentRow) {
      parentRow = await prisma.category.update({
        where: { id: parentRow.id },
        data: { description: parent.description, icon: parent.icon, sortOrder: pIdx },
      });
    } else {
      parentRow = await prisma.category.create({
        data: {
          slug: genCategorySlug(),
          name: parent.name,
          description: parent.description,
          icon: parent.icon,
          sortOrder: pIdx,
        },
      });
    }
    categoryMap.set(parent.name, parentRow.id);
    categoryCount += 1;

    if (parent.children) {
      for (let cIdx = 0; cIdx < parent.children.length; cIdx += 1) {
        const child = parent.children[cIdx];
        const childRow = await prisma.category.upsert({
          where: { parentId_name: { parentId: parentRow.id, name: child.name } },
          create: {
            slug: genCategorySlug(),
            name: child.name,
            description: child.description,
            icon: child.icon,
            sortOrder: cIdx,
            parentId: parentRow.id,
          },
          update: {
            description: child.description,
            icon: child.icon,
            sortOrder: cIdx,
          },
        });
        categoryMap.set(child.name, childRow.id);
        categoryCount += 1;
      }
    }
  }
  console.log(`   ✓ Категорий: ${categoryCount}`);

  // ===== 3. Карточки оборудования + цены + склад =====
  console.log('\n📦 Создаём карточки оборудования...');
  let equipmentCount = 0;
  let pricesCount = 0;
  let unitsCount = 0;

  for (const eq of EQUIPMENT) {
    const categoryId = categoryMap.get(eq.categoryName);
    if (!categoryId) {
      console.warn(`   ⚠ Категория "${eq.categoryName}" не найдена, пропуск ${eq.sku}`);
      continue;
    }

    const equipment = await prisma.equipment.upsert({
      where: { sku: eq.sku },
      create: {
        sku: eq.sku,
        name: eq.name,
        categoryId,
        description: eq.description,
        fullDesc: eq.fullDesc,
        deposit: eq.deposit,
        isActive: true,
        isFeatured: eq.isFeatured ?? false,
        specs: eq.specs,
        photos: [],
      },
      update: {
        categoryId,
        description: eq.description,
        fullDesc: eq.fullDesc,
        deposit: eq.deposit,
        isFeatured: eq.isFeatured ?? false,
        specs: eq.specs,
      },
    });
    equipmentCount += 1;

    // Цены по тирам — для каждого тира одна цена.
    // Вручную проверяем есть ли уже (нет уникального ключа catalogItemId+tierId).
    for (const tier of tiers) {
      const existing = await prisma.catalogItemPrice.findFirst({
        where: { catalogItemId: equipment.id, tierId: tier.id },
      });
      const tierSeed = TIERS.find((t) => t.rank === tier.rank)!;
      const price = tierPrice(eq.basePrice, tierSeed.discount);
      if (existing) {
        if (!existing.isOverridden) {
          await prisma.catalogItemPrice.update({
            where: { id: existing.id },
            data: { pricePerDay: price },
          });
        }
      } else {
        await prisma.catalogItemPrice.create({
          data: { catalogItemId: equipment.id, tierId: tier.id, pricePerDay: price },
        });
        pricesCount += 1;
      }
    }

    // Физические единицы — генерируем инв.номера на базе SKU.
    for (let i = 1; i <= eq.unitsCount; i += 1) {
      const inv = `${eq.sku}-${String(i).padStart(3, '0')}`;
      await prisma.warehouseItem.upsert({
        where: { inventoryNumber: inv },
        create: {
          inventoryNumber: inv,
          name: `${eq.name} #${i}`,
          status: WarehouseItemStatus.OPERATIONAL,
          catalogItemId: equipment.id,
        },
        update: {
          name: `${eq.name} #${i}`,
          catalogItemId: equipment.id,
        },
      });
      unitsCount += 1;
    }
  }

  console.log(`   ✓ Карточек: ${equipmentCount}`);
  console.log(`   ✓ Цен (новых): ${pricesCount}`);
  console.log(`   ✓ Единиц склада: ${unitsCount}`);
  console.log('\n✅ Готово!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
