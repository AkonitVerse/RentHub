/**
 * Минимальный bootstrap БД для production / разработки.
 * Создаёт ровно одного администратора. Всё остальное (оборудование, склад,
 * категории, клиенты, заказы) заводится через админ-панель.
 *
 * Учётные данные админа берутся из переменных окружения:
 *   SEED_ADMIN_EMAIL    — email (по умолчанию admin@renthub.com)
 *   SEED_ADMIN_PASSWORD — пароль (по умолчанию admin)
 *   SEED_ADMIN_PHONE    — телефон в формате +7XXXXXXXXXX (по умолчанию +79241111111)
 *
 * Имя и фамилия администратора: Главный Администратор (захардкожено)
 *
 * Запуск:  npm run db:seed --workspace=@renthub/api
 */
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. TRUNCATE всех таблиц с RESTART IDENTITY и CASCADE.
  const tables = [
    'rental_extensions',
    'reservations',
    'maintenance_log',
    'order_status_log',
    'order_lines',
    'payments',
    'orders',
    'catalog_item_prices',
    'warehouse_items',
    'equipment',
    'pricing_tiers',
    'clients',
    'categories',
    'password_reset_codes',
    'email_templates',
    'legal_documents',
    'org_settings',
    'users',
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  console.log(`✓ TRUNCATE: очищено ${tables.length} таблиц`);

  // 2. Один администратор. Дефолтный профиль уже заполнен (имя/фамилия/телефон)
  // — на свежей установке админ может сразу зайти и пользоваться, не дописывая
  // обязательные поля. Email/имя/телефон переопределяются env-переменными.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@renthub.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin';
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+79241111111';

  // Имя и фамилия администратора
  const firstName = 'Главный';
  const lastName = 'Администратор';
  const adminName = `${firstName} ${lastName}`;

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      phone: adminPhone,
    },
  });
  console.log(`✓ Создан администратор: ${adminEmail}`);

  // 3. Singleton-настройки организации.
  // По дефолту заполняем плейсхолдер-данными — чтобы свежая установка имела
  // что показывать на витрине (контакты, адрес, часы) до того как админ
  // заменит на свои реальные значения через "Настройки → Общие".
  await prisma.orgSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      orgName: 'RentHub',
      orgShortName: 'RentHub',
      orgPhone: '+7 (924) 000-00-00',
      orgEmail: 'info@renthub.ru',
      orgAddress: 'г. Красноярск,\nул. Примерная, 24',
      orgHours: 'Пн-Сб 9:00 -19:00\nВс 10:00 - 18:00\nБез выходных',
    },
  });
  console.log('✓ Инициализированы настройки организации');

  // 4. Стартовые юр. документы — без них на витрине не открыть /legal/...
  // Контент пустой — админ заполняет через "Настройки → Правовая информация".
  // Заголовок (title) показывается в шапке страницы автоматически, дублировать
  // его в content через <h2> не нужно.
  const LEGAL_DOCS = [
    { slug: 'terms', title: 'Условия использования', content: '' },
    { slug: 'personal-data', title: 'Согласие на обработку персональных данных', content: '' },
    { slug: 'privacy', title: 'Политика обработки персональных данных', content: '' },
  ];
  for (const doc of LEGAL_DOCS) {
    await prisma.legalDocument.create({ data: doc });
  }
  console.log('✓ Созданы юр. документы (отредактировать в админке)');

  // 5. Email-шаблоны — без них письма не уходят.
  const EMAIL_TEMPLATES = [
    {
      eventType: 'INQUIRY_RECEIVED',
      label: 'Новая заявка с витрины',
      subject: 'Новая заявка {{orderNumber}}',
      bodyHtml:
        '<p>Клиент: {{contactName}} ({{contactPhone}})</p><p>Сообщение: {{inquiryNote}}</p>',
    },
    {
      eventType: 'ORDER_CREATED',
      label: 'Новый заказ оформлен',
      subject: 'Заказ {{orderNumber}} оформлен',
      bodyHtml: '<p>Клиент: {{clientName}}, сумма: {{totalAmount}}₽</p>',
    },
    {
      eventType: 'ORDER_STATUS_CHANGED',
      label: 'Изменение статуса заказа',
      subject: 'Статус заказа {{orderNumber}}',
      bodyHtml:
        '<p>Здравствуйте, {{clientName}}! Статус заказа изменён: {{fromStatus}} → {{toStatus}}.</p>',
    },
    {
      eventType: 'ORDER_OVERDUE',
      label: 'Просрочка возврата',
      subject: 'Просрочен возврат {{orderNumber}}',
      bodyHtml: '<p>{{clientName}}, срок возврата по заказу {{orderNumber}} был {{toDate}}.</p>',
    },
    {
      eventType: 'ORDER_RETURN_REMINDER',
      label: 'Напоминание о возврате',
      subject: 'Скоро возврат: {{orderNumber}}',
      bodyHtml:
        '<p>{{clientName}}, напоминаем — {{toDate}} день возврата по заказу {{orderNumber}}.</p>',
    },
    {
      eventType: 'ORDER_EXTENDED',
      label: 'Продление аренды',
      subject: 'Заказ {{orderNumber}} продлён',
      bodyHtml: '<p>Заказ продлён до {{newToDate}}, доплата {{addedAmount}}₽.</p>',
    },
    {
      eventType: 'PASSWORD_RESET_CODE',
      label: 'Код восстановления пароля',
      subject: 'Код восстановления пароля',
      bodyHtml: '<p>{{clientName}}, ваш код: <b>{{code}}</b>. Действителен {{ttlMinutes}} мин.</p>',
    },
    {
      eventType: 'EMAIL_VERIFICATION_CODE',
      label: 'Код подтверждения email при регистрации',
      subject: 'Код подтверждения регистрации в {{brandName}}',
      bodyHtml:
        '<p>Здравствуйте, {{clientName}}!</p>' +
        '<p>Вы начали регистрацию аккаунта на площадке <b>{{brandName}}</b>. ' +
        'Чтобы завершить её, введите код подтверждения на сайте:</p>' +
        '<p style="text-align:center;margin:24px 0">' +
        '<span style="font-size:28px;letter-spacing:6px;font-weight:bold;font-family:monospace">{{code}}</span>' +
        '</p>' +
        '<p>Код действителен {{ttlMinutes}} минут. <b>Никому не сообщайте этот код</b> — ' +
        'настоящие сотрудники {{brandName}} никогда не запрашивают его в чатах, ' +
        'по телефону или в письмах.</p>' +
        '<p style="color:#666;font-size:12px">Если регистрацию начинали не вы — ' +
        'просто проигнорируйте это письмо. Аккаунт создан не будет.</p>',
    },
    {
      eventType: 'DAILY_OPS_BRIEF',
      label: 'Утренняя сводка для менеджеров',
      subject: 'Сводка на {{date}}',
      bodyHtml:
        '<p>Выдач: {{pickupsCount}}, возвратов: {{returnsCount}}, просрочек: {{overdueCount}}.</p>',
    },
  ];
  for (const t of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.create({ data: t });
  }
  console.log('✓ Созданы шаблоны email-уведомлений (9 шт.)');

  console.log('\n✓ База готова. Войти: http://localhost:5173/login');
  console.log(`  Логин: ${adminEmail}`);
  console.log(`  Пароль: ${adminPassword}`);
  console.log('\n  Всё остальное создавайте через админ-панель.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
