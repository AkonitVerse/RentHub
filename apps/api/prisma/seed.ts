/**
 * Seed-скрипт для RentHub.
 * Создаёт 3-уровневую иерархию категорий, склад физических единиц,
 * каталог карточек с глобальными ценовыми тирами, клиентов, заказы
 * во всех статусах (с резервированиями), демо-инквайри и продления.
 */
import 'dotenv/config';
import {
  PrismaClient,
  OrderStatus,
  OrderSource,
  DeliveryMethod,
  WarehouseItemStatus,
  ReservationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

const today = new Date();
today.setHours(0, 0, 0, 0);
const addDays = (base: Date, n: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

// =====================
// Дерево категорий (3 уровня)
// =====================

interface CategoryNode {
  name: string;
  description?: string;
  icon?: string;
  children?: CategoryNode[];
}

const CATEGORY_TREE: CategoryNode[] = [
  {
    name: 'Электроинструмент',
    icon: 'IconBolt',
    description: 'Профессиональный электрический инструмент',
    children: [
      { name: 'Дрели и перфораторы' },
      { name: 'Шлифмашины' },
      { name: 'Пилы' },
    ],
  },
  {
    name: 'Строительное оборудование',
    icon: 'IconLayers',
    description: 'Оборудование для строительных работ',
    children: [
      { name: 'Бетономешалки' },
      { name: 'Виброплиты' },
      { name: 'Строительные леса' },
    ],
  },
  {
    name: 'Садовая техника',
    icon: 'IconTree',
    description: 'Техника для сада и участка',
    children: [
      { name: 'Газонокосилки' },
      { name: 'Бензопилы' },
      { name: 'Триммеры' },
    ],
  },
  {
    name: 'Генераторы и компрессоры',
    icon: 'IconBolt',
    description: 'Энергетическое оборудование',
    children: [
      { name: 'Бензиновые генераторы' },
      { name: 'Компрессоры' },
    ],
  },
  {
    name: 'Клининговое оборудование',
    icon: 'IconSparkles',
    description: 'Оборудование для уборки',
    children: [
      { name: 'Строительные пылесосы' },
      { name: 'Мойки высокого давления' },
    ],
  },
  {
    name: 'Измерительное оборудование',
    icon: 'IconTool',
    description: 'Измерительные приборы и инструменты',
    children: [
      { name: 'Лазерные нивелиры' },
      { name: 'Лазерные дальномеры' },
    ],
  },
];

// =====================
// Каталог
// =====================

interface CatalogItemSeed {
  sku: string;
  name: string;
  description: string;
  fullDesc: string;
  categoryPath: string[];
  deposit: number;
  isActive: boolean;
  isFeatured?: boolean;
  rating: number;
  reviewCount: number;
  specs: Record<string, string>;
  basePrice: number;
  unitCount: number;
}

const CATALOG: CatalogItemSeed[] = [
  {
    sku: '1001234001',
    name: 'Перфоратор Bosch GBH 2-26',
    categoryPath: ['Электроинструмент', 'Дрели и перфораторы'],
    description: 'SDS-Plus, 2.7 Дж, 830 Вт',
    fullDesc:
      'Профессиональный перфоратор Bosch GBH 2-26 для бетона, кирпича и металла. Универсальный патрон SDS-Plus, мощность 830 Вт, энергия удара 2.7 Дж.',
    deposit: 5000,
    isActive: true,
    isFeatured: true,
    rating: 4.9,
    reviewCount: 213,
    specs: { Мощность: '830 Вт', 'Энергия удара': '2.7 Дж', Патрон: 'SDS-Plus', Вес: '2.7 кг' },
    basePrice: 650,
    unitCount: 4,
  },
  {
    sku: '1001234002',
    name: 'Болгарка Makita GA9020',
    categoryPath: ['Электроинструмент', 'Шлифмашины'],
    description: '230 мм, 2200 Вт',
    fullDesc: 'Профессиональная угловая шлифмашина Makita GA9020 для резки и шлифовки металла.',
    deposit: 3000,
    isActive: true,
    rating: 4.8,
    reviewCount: 87,
    specs: { Мощность: '2200 Вт', 'Диаметр диска': '230 мм', Вес: '5.1 кг' },
    basePrice: 450,
    unitCount: 3,
  },
  {
    sku: '1001234003',
    name: 'Виброплита Wacker DPU 4045',
    categoryPath: ['Строительное оборудование', 'Виброплиты'],
    description: '450 кг, реверс, дизель',
    fullDesc: 'Реверсивная дизельная виброплита Wacker Neuson DPU 4045 для уплотнения грунта.',
    deposit: 25000,
    isActive: true,
    isFeatured: true,
    rating: 4.7,
    reviewCount: 41,
    specs: { Вес: '450 кг', Двигатель: 'Дизель', Реверс: 'Да', 'Центробежная сила': '45 кН' },
    basePrice: 2200,
    unitCount: 2,
  },
  {
    sku: '1001234004',
    name: 'Бензопила Stihl MS 261',
    categoryPath: ['Садовая техника', 'Бензопилы'],
    description: '50 см³, шина 40 см',
    fullDesc: 'Профессиональная бензопила Stihl MS 261 для интенсивных лесозаготовительных работ.',
    deposit: 8000,
    isActive: true,
    rating: 4.9,
    reviewCount: 156,
    specs: {
      'Объём двигателя': '50.2 см³',
      Мощность: '4.0 л.с.',
      'Длина шины': '40 см',
      Вес: '4.9 кг',
    },
    basePrice: 950,
    unitCount: 4,
  },
  {
    sku: '1001234005',
    name: 'Генератор Honda EU22i',
    categoryPath: ['Генераторы и компрессоры', 'Бензиновые генераторы'],
    description: '2.2 кВт, инверторный',
    fullDesc: 'Инверторный бензиновый генератор Honda EU22i. Тихий, экономичный.',
    deposit: 10000,
    isActive: true,
    isFeatured: true,
    rating: 4.9,
    reviewCount: 92,
    specs: { Мощность: '2.2 кВт', Тип: 'Инверторный', Топливо: 'Бензин АИ-92', Вес: '21 кг' },
    basePrice: 1100,
    unitCount: 4,
  },
  {
    sku: '1001234006',
    name: 'Бетономешалка Кратон 180 л',
    categoryPath: ['Строительное оборудование', 'Бетономешалки'],
    description: '180 л, 800 Вт',
    fullDesc: 'Бытовая бетономешалка Кратон BCM-180 объёмом 180 литров.',
    deposit: 3000,
    isActive: true,
    rating: 4.5,
    reviewCount: 64,
    specs: { Объём: '180 л', Мощность: '800 Вт', 'Скорость вращения': '28 об/мин', Вес: '70 кг' },
    basePrice: 480,
    unitCount: 6,
  },
  {
    sku: '1001234007',
    name: 'Лазерный дальномер Bosch GLM 50',
    categoryPath: ['Измерительное оборудование', 'Лазерные дальномеры'],
    description: 'до 50 м, ±1.5 мм',
    fullDesc: 'Профессиональный лазерный дальномер Bosch GLM 50 с диапазоном до 50 метров.',
    deposit: 1500,
    isActive: true,
    rating: 4.8,
    reviewCount: 134,
    specs: { Диапазон: 'до 50 м', Точность: '±1.5 мм', Вес: '0.1 кг' },
    basePrice: 220,
    unitCount: 8,
  },
  {
    sku: '1001234008',
    name: 'Строительный пылесос Karcher WD 3',
    categoryPath: ['Клининговое оборудование', 'Строительные пылесосы'],
    description: '1000 Вт, 17 л',
    fullDesc: 'Универсальный строительный пылесос Karcher WD 3 для сухой и влажной уборки.',
    deposit: 2000,
    isActive: true,
    rating: 4.6,
    reviewCount: 89,
    specs: { Мощность: '1000 Вт', Объём: '17 л', Тип: 'Сухая/влажная уборка' },
    basePrice: 350,
    unitCount: 5,
  },
  {
    sku: '1001234009',
    name: 'Циркулярная пила Makita 5008MG',
    categoryPath: ['Электроинструмент', 'Пилы'],
    description: '1800 Вт, 210 мм',
    fullDesc: 'Профессиональная циркулярная пила Makita 5008MG с диском 210 мм.',
    deposit: 4000,
    isActive: true,
    rating: 4.7,
    reviewCount: 105,
    specs: { Мощность: '1800 Вт', 'Диаметр диска': '210 мм', 'Глубина пропила': '76 мм' },
    basePrice: 550,
    unitCount: 3,
  },
  {
    sku: '1001234010',
    name: 'Газонокосилка Honda HRX 476',
    categoryPath: ['Садовая техника', 'Газонокосилки'],
    description: 'Бензиновая, 47 см, самоходная',
    fullDesc: 'Самоходная бензиновая газонокосилка Honda HRX 476 с шириной скашивания 47 см.',
    deposit: 8000,
    isActive: true,
    rating: 4.8,
    reviewCount: 71,
    specs: { Двигатель: 'Бензин', 'Ширина скашивания': '47 см', Привод: 'Самоходная' },
    basePrice: 850,
    unitCount: 4,
  },
];

// =====================
// Тиры
// =====================

interface TierSeed {
  rank: number;
  minDays: number;
  maxDays: number | null;
  note: string;
  discountPercent: number;
}

const TIERS: TierSeed[] = [
  { rank: 1, minDays: 1, maxDays: 3, note: 'до 3 суток — базовая ставка', discountPercent: 0 },
  { rank: 2, minDays: 4, maxDays: 7, note: 'от 4 до 7 суток — −10%', discountPercent: 10 },
  { rank: 3, minDays: 8, maxDays: null, note: 'от 8 суток — −20%', discountPercent: 20 },
];

function tierPrice(basePrice: number, discountPercent: number): number {
  return Math.ceil((basePrice * (100 - discountPercent)) / 100);
}

function pickTier(days: number): TierSeed {
  for (const t of TIERS) {
    if (days >= t.minDays && (t.maxDays == null || days <= t.maxDays)) return t;
  }
  return TIERS[TIERS.length - 1];
}

// =====================
// Клиенты
// =====================

const CLIENTS: Array<{
  name: string;
  phone: string;
  email?: string;
  clientType?: 'INDIVIDUAL' | 'COMPANY';
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  contactPerson?: string;
  contactPosition?: string;
  contactPhone?: string;
  bankAccount?: string;
  bankBik?: string;
  bankName?: string;
}> = [
  { name: 'Сидоров А.К.', phone: '+79234567890', email: 'sidorov@mail.ru' },
  { name: 'Иванов А.К.', phone: '+79234567891' },
  { name: 'Громов Д.В.', phone: '+79234567892', email: 'gromov@yandex.ru' },
  { name: 'Орлова Е.С.', phone: '+79234567893', email: 'orlova@gmail.com' },
  { name: 'Петров И.С.', phone: '+79234567894' },
  { name: 'Никитин О.П.', phone: '+79234567895', email: 'nikitin@mail.ru' },
  { name: 'Соколова М.А.', phone: '+79234567896' },
  { name: 'Кузнецов Н.Н.', phone: '+79234567897', email: 'kuznetsov@gmail.com' },
  // Юридические лица
  {
    clientType: 'COMPANY',
    name: 'ООО «СтройМастер»',
    phone: '+79234567898',
    email: 'info@stroimaster.ru',
    inn: '7707083893',
    kpp: '770701001',
    ogrn: '1027700132195',
    legalAddress: 'г. Москва, ул. Строителей, д. 15, оф. 301',
    contactPerson: 'Козлов Андрей Петрович',
    contactPosition: 'Генеральный директор',
    contactPhone: '+79234567899',
    bankAccount: '40702810400000012345',
    bankBik: '044525225',
    bankName: 'ПАО Сбербанк',
  },
  {
    clientType: 'COMPANY',
    name: 'ИП Волков С.А.',
    phone: '+79234567800',
    inn: '772012345678',
    ogrn: '312774600000012',
    contactPerson: 'Волков Сергей Алексеевич',
  },
];

// =====================
// Заказы по статусам
// =====================

interface OrderSeed {
  number: string;
  clientIdx: number;
  status: OrderStatus;
  source?: OrderSource;
  fromOffset: number;
  toOffset: number;
  deliveryMethod: DeliveryMethod;
  contactPhone: string;
  address?: string;
  lines: { sku: string; qty: number }[];
  /** Назначить и зарезервировать конкретные единицы (по индексу из списка карточки). */
  assignUnits?: boolean;
  notes?: string;
}

const ORDERS_SEED: OrderSeed[] = [
  // ACTIVE: оборудование выдано, единицы назначены, Reservation в ACTIVE
  {
    number: 'RH-2841',
    clientIdx: 0,
    status: OrderStatus.ACTIVE,
    fromOffset: 0,
    toOffset: 7,
    contactPhone: '+79234567890',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'ул. Партизана Железняка, 12',
    lines: [
      { sku: '1001234001', qty: 2 },
      { sku: '1001234004', qty: 1 },
    ],
    assignUnits: true,
  },
  // PENDING: оформлен через витрину, ждёт подтверждения
  {
    number: 'RH-2842',
    clientIdx: 1,
    status: OrderStatus.PENDING,
    fromOffset: 1,
    toOffset: 3,
    source: OrderSource.WEB_CART,
    contactPhone: '+79234567891',
    deliveryMethod: DeliveryMethod.PICKUP,
    lines: [{ sku: '1001234006', qty: 1 }],
  },
  // OVERDUE: уже прошёл срок возврата
  {
    number: 'RH-2843',
    clientIdx: 2,
    status: OrderStatus.OVERDUE,
    fromOffset: -3,
    toOffset: -1,
    contactPhone: '+79234567892',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'пр. Свободный, 79',
    lines: [
      { sku: '1001234003', qty: 1 },
      { sku: '1001234005', qty: 1 },
      { sku: '1001234007', qty: 1 },
    ],
    assignUnits: true,
  },
  // ACTIVE: масштабный заказ
  {
    number: 'RH-2844',
    clientIdx: 3,
    status: OrderStatus.ACTIVE,
    fromOffset: -6,
    toOffset: 8,
    contactPhone: '+79234567893',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'Взлётка, БЦ Сириус',
    lines: [
      { sku: '1001234001', qty: 1 },
      { sku: '1001234002', qty: 1 },
      { sku: '1001234004', qty: 1 },
      { sku: '1001234005', qty: 2 },
      { sku: '1001234007', qty: 1 },
    ],
    assignUnits: true,
  },
  // CONFIRMED: подтверждён, склад зарезервирован, выдача завтра
  {
    number: 'RH-2845',
    clientIdx: 4,
    status: OrderStatus.CONFIRMED,
    fromOffset: 2,
    toOffset: 5,
    contactPhone: '+79234567894',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'ул. Маерчака, 18',
    lines: [
      { sku: '1001234006', qty: 1 },
      { sku: '1001234007', qty: 1 },
    ],
    assignUnits: true,
  },
  // ACTIVE: с продлением (см. ниже)
  {
    number: 'RH-2846',
    clientIdx: 5,
    status: OrderStatus.ACTIVE,
    fromOffset: -4,
    toOffset: 6,
    contactPhone: '+79234567895',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'Северное шоссе, 7к2',
    lines: [
      { sku: '1001234003', qty: 1 },
      { sku: '1001234006', qty: 2 },
      { sku: '1001234008', qty: 1 },
      { sku: '1001234005', qty: 1 },
      { sku: '1001234007', qty: 1 },
    ],
    assignUnits: true,
  },
  // DONE: давно завершён
  {
    number: 'RH-2847',
    clientIdx: 6,
    status: OrderStatus.DONE,
    fromOffset: -10,
    toOffset: -9,
    contactPhone: '+79234567896',
    deliveryMethod: DeliveryMethod.PICKUP,
    lines: [{ sku: '1001234004', qty: 1 }],
    assignUnits: true,
  },
  // OVERDUE: ещё одна просрочка
  {
    number: 'RH-2848',
    clientIdx: 7,
    status: OrderStatus.OVERDUE,
    fromOffset: -8,
    toOffset: -2,
    contactPhone: '+79234567897',
    deliveryMethod: DeliveryMethod.DELIVERY,
    address: 'мкр. Покровский, 18',
    lines: [
      { sku: '1001234008', qty: 1 },
      { sku: '1001234005', qty: 1 },
    ],
    assignUnits: true,
  },
];

/**
 * Инквайри-заказы (DRAFT, source=WEB_INQUIRY) — лёгкие заявки с витрины.
 * Менеджер откроет, дозаполнит даты/позиции и переведёт в PENDING.
 */
const INQUIRIES_SEED = [
  {
    name: 'Алексей М.',
    phone: '+79111234567',
    email: undefined,
    sku: '1001234001',
    message: 'Нужен в субботу на стройку, 2 шт',
  },
  {
    name: 'Ирина С.',
    phone: '+79121234567',
    email: 'irina.s@mail.ru',
    sku: '1001234008',
    message: 'Сушка квартиры после ремонта',
  },
  {
    name: 'Сергей П.',
    phone: '+79141234567',
    email: 'sergey.p@yandex.ru',
    sku: '1001234004',
    message: 'Проверка по выходным',
  },
];

// =====================
// Main
// =====================

async function main(): Promise<void> {
  // 1. Пользователи
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@renthub.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin';

  // Имя и фамилия администратора (захардкожено, как в seed-empty.ts)
  const adminFirstName = 'Главный';
  const adminLastName = 'Администратор';
  const adminName = `${adminFirstName} ${adminLastName}`;

  // Используем существующего админа или создаём нового
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: 'ADMIN',
        firstName: adminFirstName,
        lastName: adminLastName,
        name: adminName,
      },
    });
  }

  const manager = await prisma.user.upsert({
    where: { email: 'manager@renthub.com' },
    update: {},
    create: {
      email: 'manager@renthub.com',
      passwordHash: await bcrypt.hash('manager', 12),
      role: 'MANAGER',
      firstName: 'Мария',
      lastName: 'Менеджер',
      name: 'Мария Менеджер',
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: 'client@renthub.com' },
    update: {},
    create: {
      email: 'client@renthub.com',
      passwordHash: await bcrypt.hash('client123', 12),
      role: 'USER',
      firstName: 'Иван',
      lastName: 'Клиент',
      name: 'Иван Клиент',
      phone: '+79234567890',
    },
  });
  console.log(`✓ Пользователи: admin (${admin.email}), manager (${manager.email}), client`);

  // 2. Категории — 3 уровня
  const categoryByPath = new Map<string, number>();
  let sortOrder = 0;
  const createCategory = async (
    node: CategoryNode,
    parentId: number | null,
    pathParts: string[],
  ): Promise<void> => {
    sortOrder += 1;
    const created = await prisma.category.create({
      data: {
        slug: genCategorySlug(),
        name: node.name,
        description: node.description,
        icon: node.icon,
        sortOrder,
        parentId,
      },
    });
    categoryByPath.set([...pathParts, node.name].join('/'), created.id);
    if (node.children) {
      for (const child of node.children) {
        await createCategory(child, created.id, [...pathParts, node.name]);
      }
    }
  };
  for (const root of CATEGORY_TREE) {
    await createCategory(root, null, []);
  }
  console.log(`✓ Категорий: ${categoryByPath.size}`);

  // 3. Глобальные тиры
  const tierByRank = new Map<
    number,
    { id: number; minDays: number; maxDays: number | null; rank: number }
  >();
  for (const t of TIERS) {
    const created = await prisma.pricingTier.create({
      data: { rank: t.rank, minDays: t.minDays, maxDays: t.maxDays, note: t.note },
    });
    tierByRank.set(t.rank, {
      id: created.id,
      minDays: created.minDays,
      maxDays: created.maxDays,
      rank: created.rank,
    });
  }
  console.log(`✓ Тиров: ${TIERS.length}`);

  // 4. Каталог + цены тиров + физические единицы
  const itemBySku = new Map<string, { id: number; deposit: number }>();
  const unitsBySku = new Map<string, number[]>(); // sku -> массив warehouseItemId
  let invSeq = 0;
  for (const item of CATALOG) {
    const categoryId = categoryByPath.get(item.categoryPath.join('/'));
    if (!categoryId) throw new Error(`Категория не найдена: ${item.categoryPath.join('/')}`);

    const eq = await prisma.equipment.create({
      data: {
        sku: item.sku,
        name: item.name,
        categoryId,
        description: item.description,
        fullDesc: item.fullDesc,
        deposit: item.deposit,
        isActive: item.isActive,
        isFeatured: item.isFeatured ?? false,
        rating: item.rating,
        reviewCount: item.reviewCount,
        specs: item.specs,
        photos: [],
      },
    });
    itemBySku.set(item.sku, { id: eq.id, deposit: item.deposit });

    for (const t of TIERS) {
      await prisma.catalogItemPrice.create({
        data: {
          catalogItemId: eq.id,
          tierId: tierByRank.get(t.rank)!.id,
          pricePerDay: tierPrice(item.basePrice, t.discountPercent),
        },
      });
    }

    const units: number[] = [];
    for (let i = 0; i < item.unitCount; i += 1) {
      invSeq += 1;
      const inv = `INV-${String(invSeq).padStart(6, '0')}`;
      // ~10% единиц на ремонте — для демонстрации статуса BROKEN
      const status: WarehouseItemStatus =
        i === 1 && item.unitCount >= 4
          ? WarehouseItemStatus.BROKEN
          : WarehouseItemStatus.OPERATIONAL;
      const created = await prisma.warehouseItem.create({
        data: {
          name: item.name,
          inventoryNumber: inv,
          serialNumber: `SN-${item.sku}-${String(i + 1).padStart(3, '0')}`,
          status,
          // Категория наследуется от карточки каталога — не дублируем здесь.
          catalogItemId: eq.id,
        },
      });
      if (status === WarehouseItemStatus.OPERATIONAL) units.push(created.id);
    }
    unitsBySku.set(item.sku, units);
  }
  console.log(`✓ Каталог: ${CATALOG.length} карточек, ${invSeq} физ. единиц`);

  // 4.1 MaintenanceLog для BROKEN-единиц
  const brokenItems = await prisma.warehouseItem.findMany({
    where: { status: WarehouseItemStatus.BROKEN },
  });
  for (const it of brokenItems) {
    await prisma.maintenanceLog.create({
      data: {
        warehouseItemId: it.id,
        startedAt: addDays(today, -3),
        reason: 'Плановая диагностика и замена расходников',
        cost: 1500,
      },
    });
  }
  console.log(`✓ Записей обслуживания: ${brokenItems.length}`);

  // 5. Клиенты. Привязываем 0-го клиента к clientUser.
  const clientByIdx = new Map<number, number>();
  for (let i = 0; i < CLIENTS.length; i += 1) {
    const c = CLIENTS[i];
    const created = await prisma.client.create({
      data: {
        ...c,
        userId: i === 0 ? clientUser.id : undefined,
      },
    });
    clientByIdx.set(i, created.id);
  }
  console.log(`✓ Клиентов: ${CLIENTS.length} (один привязан к demo-аккаунту client@renthub.com)`);

  // 6. Заказы + Reservation для assignUnits=true
  function pickReservationStatus(orderStatus: OrderStatus): ReservationStatus | null {
    if (orderStatus === OrderStatus.CONFIRMED) return ReservationStatus.PLANNED;
    if (orderStatus === OrderStatus.ACTIVE || orderStatus === OrderStatus.OVERDUE)
      return ReservationStatus.ACTIVE;
    if (orderStatus === OrderStatus.DONE) return ReservationStatus.RETURNED;
    if (orderStatus === OrderStatus.CANCELLED) return ReservationStatus.CANCELLED;
    return null; // PENDING/DRAFT — без резерва
  }

  const usedUnitsBySku = new Map<string, Set<number>>();
  const orderByNumber = new Map<
    string,
    { orderId: number; lines: { id: number; sku: string; qty: number }[]; toDate: Date }
  >();

  for (const o of ORDERS_SEED) {
    const fromDate = addDays(today, o.fromOffset);
    const toDate = addDays(today, o.toOffset);
    const days = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000));
    const tier = pickTier(days);
    const tierMeta = tierByRank.get(tier.rank)!;

    const orderLinesData = o.lines.map((l) => {
      const meta = itemBySku.get(l.sku);
      if (!meta) throw new Error(`Каталог: SKU не найден: ${l.sku}`);
      const itemRow = CATALOG.find((it) => it.sku === l.sku)!;
      const unitPrice = tierPrice(itemRow.basePrice, tier.discountPercent);
      return {
        sku: l.sku,
        equipmentId: meta.id,
        qty: l.qty,
        days,
        unitPriceNet: unitPrice,
        sumAmount: unitPrice * l.qty * days,
        deposit: meta.deposit,
      };
    });
    const totalAmount = orderLinesData.reduce((s, l) => s + l.sumAmount, 0);

    const created = await prisma.order.create({
      data: {
        number: o.number,
        clientId: clientByIdx.get(o.clientIdx)!,
        status: o.status,
        source: o.source ?? OrderSource.MANUAL,
        fromDate,
        toDate,
        daysCount: days,
        totalAmount,
        deposit: orderLinesData.reduce((s, l) => s + l.deposit * l.qty, 0),
        deliveryMethod: o.deliveryMethod,
        address: o.address,
        contactPhone: o.contactPhone,
        notes: o.notes,
        lines: {
          create: orderLinesData.map((l) => ({
            equipmentId: l.equipmentId,
            qty: l.qty,
            days: l.days,
            unitPriceNet: l.unitPriceNet,
            sumAmount: l.sumAmount,
            pricingTierRank: tierMeta.rank,
            pricingTierMinDays: tierMeta.minDays,
            pricingTierMaxDays: tierMeta.maxDays,
            catalogItemDeposit: l.deposit,
          })),
        },
        statusLog: {
          create: {
            fromStatus: null,
            toStatus: o.status,
            changedById: admin.id,
            note: 'Создан при первичной загрузке',
          },
        },
      },
      include: { lines: true },
    });

    // Назначаем единицы и создаём резервы
    if (o.assignUnits) {
      const reservationStatus = pickReservationStatus(o.status);
      if (reservationStatus) {
        for (const lineData of orderLinesData) {
          const line = created.lines.find((cl) => cl.equipmentId === lineData.equipmentId)!;
          const allUnits = unitsBySku.get(lineData.sku) ?? [];
          const used = usedUnitsBySku.get(lineData.sku) ?? new Set<number>();
          // Берём первые свободные qty единиц
          const toAssign: number[] = [];
          for (const uid of allUnits) {
            if (toAssign.length >= lineData.qty) break;
            if (!used.has(uid)) {
              toAssign.push(uid);
              used.add(uid);
            }
          }
          usedUnitsBySku.set(lineData.sku, used);

          for (const wid of toAssign) {
            await prisma.reservation.create({
              data: {
                orderLineId: line.id,
                warehouseItemId: wid,
                fromDate,
                toDate,
                status: reservationStatus,
              },
            });
          }
          // Назначаем первую единицу как «основную» в OrderLine
          if (toAssign.length > 0) {
            await prisma.orderLine.update({
              where: { id: line.id },
              data: { warehouseItemId: toAssign[0] },
            });
          }
        }
      }
    }

    orderByNumber.set(o.number, {
      orderId: created.id,
      lines: created.lines.map((l) => ({
        id: l.id,
        sku: o.lines.find((ol) => itemBySku.get(ol.sku)?.id === l.equipmentId)!.sku,
        qty: l.qty,
      })),
      toDate,
    });
  }
  console.log(`✓ Текущих заказов: ${ORDERS_SEED.length}`);

  // 6-hist. Исторические DONE-заказы за последние 30 дней — для аналитики.
  // Без них графики выручки и утилизации пусты, т.к. createdAt = сегодня.
  const HISTORY_DAYS = 30;
  const skus = CATALOG.map((c) => c.sku);
  let histSeq = 2900;

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
    // 1–3 заказа в день
    const ordersToday = 1 + (daysAgo % 3);
    for (let j = 0; j < ordersToday; j += 1) {
      histSeq += 1;
      const clientIdx = (daysAgo + j) % CLIENTS.length;
      const clientId = clientByIdx.get(clientIdx)!;
      const rentalDays = 2 + (daysAgo % 5);
      const fromDate = addDays(today, -daysAgo - rentalDays);
      const toDate = addDays(today, -daysAgo);
      const tier = pickTier(rentalDays);
      const tierMeta = tierByRank.get(tier.rank)!;

      // Выбираем 1–3 случайные позиции
      const lineCount = 1 + (j % 3);
      const linesSeed: { equipmentId: number; qty: number; sum: number; deposit: number }[] = [];
      for (let k = 0; k < lineCount; k += 1) {
        const sku = skus[(daysAgo * 3 + j + k) % skus.length];
        const meta = itemBySku.get(sku);
        if (!meta) continue;
        const itemRow = CATALOG.find((it) => it.sku === sku)!;
        const qty = 1 + (k % 2);
        const unitPrice = tierPrice(itemRow.basePrice, tier.discountPercent);
        linesSeed.push({
          equipmentId: meta.id,
          qty,
          sum: unitPrice * qty * rentalDays,
          deposit: meta.deposit,
        });
      }
      if (linesSeed.length === 0) continue;

      const totalAmount = linesSeed.reduce((s, l) => s + l.sum, 0);
      const createdAt = addDays(today, -daysAgo);

      const hist = await prisma.order.create({
        data: {
          number: `RH-${histSeq}`,
          clientId,
          status: OrderStatus.DONE,
          source: OrderSource.MANUAL,
          fromDate,
          toDate,
          daysCount: rentalDays,
          totalAmount,
          deposit: linesSeed.reduce((s, l) => s + l.deposit * l.qty, 0),
          deliveryMethod: j % 2 === 0 ? DeliveryMethod.PICKUP : DeliveryMethod.DELIVERY,
          address: j % 2 === 1 ? 'ул. Партизана Железняка, 12' : undefined,
          contactPhone: CLIENTS[clientIdx].phone,
          lines: {
            create: linesSeed.map((l) => ({
              equipmentId: l.equipmentId,
              qty: l.qty,
              days: rentalDays,
              unitPriceNet: Math.ceil(l.sum / (l.qty * rentalDays)),
              sumAmount: l.sum,
              pricingTierRank: tierMeta.rank,
              pricingTierMinDays: tierMeta.minDays,
              pricingTierMaxDays: tierMeta.maxDays,
              catalogItemDeposit: l.deposit,
            })),
          },
          statusLog: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.DONE,
              changedById: admin.id,
              note: 'Исторический заказ (демо)',
            },
          },
        },
      });

      // Сдвигаем createdAt в прошлое через raw SQL
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET "createdAt" = $1 WHERE id = $2`,
        createdAt,
        hist.id,
      );

      // Платежи для DONE-заказов: аренда оплачена + залог получен и возвращён
      const depositAmount = linesSeed.reduce((s, l) => s + l.deposit * l.qty, 0);
      const methods: Array<'CASH' | 'CARD' | 'TRANSFER'> = ['CASH', 'CARD', 'TRANSFER'];
      const method = methods[daysAgo % 3];

      await prisma.payment.create({
        data: {
          orderId: hist.id,
          amount: totalAmount,
          method,
          kind: 'CHARGE',
          createdById: admin.id,
          note: 'Оплата аренды',
        },
      });
      if (depositAmount > 0) {
        await prisma.payment.create({
          data: {
            orderId: hist.id,
            amount: depositAmount,
            method,
            kind: 'DEPOSIT',
            createdById: admin.id,
            note: 'Получение залога',
          },
        });
        // Возврат залога при завершении
        await prisma.payment.create({
          data: {
            orderId: hist.id,
            amount: depositAmount,
            method,
            kind: 'REFUND',
            createdById: admin.id,
            note: 'Возврат залога',
          },
        });
      }
    }
  }
  console.log(`✓ Исторических заказов: ${histSeq - 2900} (для аналитики за ${HISTORY_DAYS} дней)`);

  // 6.1 Демо-продление: добавим RentalExtension для одной из ACTIVE-позиций RH-2846
  const ext = orderByNumber.get('RH-2846');
  if (ext && ext.lines.length > 0) {
    const targetLine = ext.lines[0];
    const oldToDate = ext.toDate;
    const newToDate = addDays(oldToDate, 3);
    await prisma.rentalExtension.create({
      data: {
        orderLineId: targetLine.id,
        oldToDate,
        newToDate,
        addedDays: 3,
        addedAmount: 0,
        createdById: manager.id,
      },
    });
  }
  console.log(`✓ Продлений: 1 (демо)`);

  // 7. Лёгкие инквайри (DRAFT + WEB_INQUIRY)
  let inquirySeq = 100;
  for (const inq of INQUIRIES_SEED) {
    const meta = itemBySku.get(inq.sku);
    let inquiryClient = await prisma.client.findUnique({ where: { phone: inq.phone } });
    if (!inquiryClient) {
      inquiryClient = await prisma.client.create({
        data: {
          name: inq.name,
          phone: inq.phone,
          email: inq.email,
        },
      });
    }
    inquirySeq += 1;
    await prisma.order.create({
      data: {
        number: `RH-IN-${inquirySeq}`,
        clientId: inquiryClient.id,
        status: OrderStatus.DRAFT,
        source: OrderSource.WEB_INQUIRY,
        contactPhone: inq.phone,
        contactEmail: inq.email,
        inquiryNote: inq.message,
        inquiryEquipmentId: meta?.id ?? null,
        statusLog: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.DRAFT,
            changedById: null,
            note: meta ? `Заявка с витрины (по ${inq.sku})` : 'Заявка с витрины',
          },
        },
      },
    });
  }
  console.log(`✓ Инквайри-заявок: ${INQUIRIES_SEED.length}`);

  // 8. Юридические документы (шаблонные тексты, администратор может отредактировать)
  const LEGAL_DOCS = [
    {
      slug: 'terms',
      title: 'Условия использования',
      content: `<h2>Условия использования платформы RentHub</h2>
<p><strong>Дата вступления в силу:</strong> 1 февраля 2026 г.</p>

<h3>1. Общие положения</h3>
<p>Настоящие Условия использования регулируют отношения между организацией-арендодателем (далее — «Арендодатель») и физическим лицом (далее — «Пользователь»), использующим платформу для оформления аренды оборудования. Реквизиты Арендодателя указаны в разделе «Контакты» сайта.</p>

<h3>2. Регистрация и учётная запись</h3>
<p>Для оформления заказов Пользователь регистрирует учётную запись, указывая достоверные данные: имя, фамилию, адрес электронной почты и контактный телефон. Пользователь несёт ответственность за сохранность пароля и за все действия, совершённые с использованием его учётной записи.</p>

<h3>3. Оформление аренды</h3>
<p>Пользователь самостоятельно выбирает оборудование в каталоге, указывает срок аренды и оформляет заявку. Стоимость рассчитывается автоматически по тарифам, действующим на момент оформления.</p>
<p>Заявка подлежит подтверждению со стороны Арендодателя. До момента подтверждения заявка не накладывает обязательств на стороны.</p>

<h3>4. Получение и возврат оборудования</h3>
<p>Получение и возврат оборудования осуществляется в офисе Арендодателя в согласованные сроки. При получении оборудование осматривается, и оформляется акт приёма-передачи.</p>
<p>Возврат осуществляется в исправном состоянии. При обнаружении повреждений составляется соответствующий акт, а стоимость восстановления удерживается из суммы залога.</p>

<h3>5. Оплата</h3>
<p>Оплата аренды производится при получении оборудования наличными или банковской картой. Залог возвращается после возврата оборудования за вычетом штрафов (при наличии).</p>

<h3>6. Просрочка возврата</h3>
<p>В случае нарушения сроков возврата начисляется пеня в соответствии с тарифами, указанными в карточке оборудования.</p>

<h3>7. Ответственность сторон</h3>
<p>Арендодатель не несёт ответственности за ущерб, возникший вследствие неправильной эксплуатации оборудования Пользователем. Пользователь обязан использовать оборудование по прямому назначению и в соответствии с инструкциями.</p>

<h3>8. Изменение условий</h3>
<p>Арендодатель оставляет за собой право вносить изменения в настоящие Условия. Действующая редакция всегда доступна на этой странице.</p>

<h3>9. Контакты</h3>
<p>По всем вопросам обращайтесь в службу поддержки. Контактные данные указаны в разделе «Контакты».</p>`,
    },
    {
      slug: 'personal-data',
      title: 'Согласие на обработку персональных данных',
      content: `<h2>Согласие на обработку персональных данных</h2>
<p><strong>Редакция от:</strong> 1 февраля 2026 г.</p>

<p>Регистрируясь на платформе, Пользователь даёт согласие организации-оператору платформы (далее — «Оператор») на обработку своих персональных данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».</p>

<h3>1. Перечень обрабатываемых персональных данных</h3>
<ul>
<li>фамилия, имя, отчество;</li>
<li>номер контактного телефона;</li>
<li>адрес электронной почты;</li>
<li>адрес доставки или получения оборудования;</li>
<li>история заказов и платежей.</li>
</ul>

<h3>2. Цели обработки</h3>
<ul>
<li>регистрация и идентификация Пользователя на платформе;</li>
<li>оформление и сопровождение заказов аренды;</li>
<li>информирование о статусе заказов, сроках возврата и важных событиях;</li>
<li>ведение клиентской базы и истории взаимодействий;</li>
<li>исполнение требований налогового и иного законодательства РФ.</li>
</ul>

<h3>3. Действия с персональными данными</h3>
<p>Оператор осуществляет сбор, запись, систематизацию, накопление, хранение, уточнение, извлечение, использование и удаление персональных данных Пользователя.</p>

<h3>4. Срок действия согласия</h3>
<p>Настоящее согласие действует с момента регистрации и до его отзыва Пользователем. Отзыв осуществляется письменным заявлением в адрес Оператора.</p>

<h3>5. Передача третьим лицам</h3>
<p>Персональные данные не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ.</p>

<h3>6. Защита данных</h3>
<p>Оператор принимает необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения и уничтожения.</p>`,
    },
    {
      slug: 'privacy',
      title: 'Политика обработки персональных данных',
      content: `<h2>Политика обработки персональных данных</h2>
<p><strong>Действует с:</strong> 1 февраля 2026 г.</p>

<h3>1. Кто мы</h3>
<p>Оператор платформы — организация, оказывающая услуги онлайн-аренды оборудования. Полные реквизиты указаны в разделе «Контакты».</p>

<h3>2. Какие данные мы собираем</h3>
<p>Мы собираем данные, которые Пользователь сам предоставляет при регистрации и оформлении заказов: имя, фамилию, телефон, email, адрес. Также автоматически собираются технические данные: IP-адрес, тип браузера, время посещения — исключительно для обеспечения работы платформы и анализа её использования.</p>

<h3>3. Как мы используем данные</h3>
<ul>
<li>для оформления и исполнения заказов;</li>
<li>для связи с Пользователем по вопросам, связанным с арендой;</li>
<li>для улучшения работы платформы;</li>
<li>для соблюдения требований законодательства.</li>
</ul>

<h3>4. Cookies</h3>
<p>Платформа использует файлы cookies для авторизации, сохранения настроек и корректной работы корзины. Вы можете отключить cookies в настройках браузера, но в этом случае некоторые функции могут быть недоступны.</p>

<h3>5. Передача данных третьим лицам</h3>
<p>Мы не передаём и не продаём персональные данные третьим лицам. Передача возможна только в случаях, прямо предусмотренных законодательством РФ.</p>

<h3>6. Хранение данных</h3>
<p>Данные хранятся на серверах, расположенных на территории Российской Федерации, в течение срока, необходимого для исполнения обязательств перед Пользователем и требований законодательства.</p>

<h3>7. Ваши права</h3>
<p>Вы вправе в любой момент:</p>
<ul>
<li>запросить информацию о хранящихся персональных данных;</li>
<li>потребовать их уточнения или удаления;</li>
<li>отозвать согласие на обработку данных.</li>
</ul>
<p>Для этого направьте запрос в службу поддержки.</p>

<h3>8. Изменения политики</h3>
<p>Мы можем периодически обновлять настоящую Политику. Актуальная версия всегда доступна на этой странице.</p>`,
    },
  ];
  for (const doc of LEGAL_DOCS) {
    await prisma.legalDocument.upsert({
      where: { slug: doc.slug },
      update: {},
      create: doc,
    });
  }
  console.log(`✓ Юр. документов: ${LEGAL_DOCS.length}`);

  // 9. Обновляем org-settings с демо-текстом для "Условий аренды"
  const rentalTermsContent = `<h2>Общие условия аренды оборудования</h2>
<p>Добро пожаловать на платформу RentHub! Здесь вы можете арендовать профессиональное оборудование для ваших проектов.</p>

<h3>Процесс аренды</h3>
<ol>
<li><strong>Выбор оборудования:</strong> Просмотрите каталог и выберите нужное оборудование.</li>
<li><strong>Указание сроков:</strong> Выберите дату начала и окончания аренды.</li>
<li><strong>Оформление заказа:</strong> Заполните контактные данные и выберите способ доставки.</li>
<li><strong>Оплата:</strong> Оплатите заказ наличными при получении или картой.</li>
<li><strong>Получение:</strong> Получите оборудование в нашем офисе или по адресу доставки.</li>
</ol>

<h3>Требования к клиентам</h3>
<ul>
<li>Возраст не менее 18 лет</li>
<li>Наличие документа, удостоверяющего личность</li>
<li>Контактный телефон и адрес доставки</li>
</ul>

<h3>Правила возврата оборудования</h3>
<p>Оборудование должно быть возвращено в оговоренный срок в чистом виде и в исправном состоянии. При задержке возврата взимается штраф в размере 10% от стоимости аренды за каждый день просрочки.</p>

<h3>Ответственность</h3>
<p>Клиент несёт ответственность за сохранность оборудования во время аренды. При повреждении или потере оборудования клиент обязан возместить стоимость ремонта или замены.</p>

<h3>Контакты</h3>
<p>По вопросам аренды обращайтесь к нашим менеджерам по телефону или электронной почте (см. раздел «Контакты»).</p>`;

  await prisma.orgSettings.update({
    where: { id: 1 },
    data: {
      rentalTermsTitle: 'Условия аренды',
      rentalTermsContent,
    },
  });
  console.log(`✓ Условия аренды: добавлены демо-данные`);

  console.log('\n✓ Сидер завершён успешно\n');
  console.log('  Учётные записи для входа:');
  console.log(`    Администратор: ${adminEmail} / ${adminPassword}`);
  console.log('    Менеджер:      manager@renthub.com / manager');
  console.log('    Клиент:        client@renthub.com / client123 (привязан к Сидорову А.К.)');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
