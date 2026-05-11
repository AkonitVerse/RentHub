# Техническая документация RentHub

## 1. Назначение и область применения

### 1.1 Общее описание

**RentHub** — информационная система управления арендой оборудования, реализованная в виде веб-приложения с разделением на публичный клиентский контур и административный контур операционного управления.

### 1.2 Решаемые задачи

Система автоматизирует следующие бизнес-процессы:

1. **Управление каталогом**:
   - Публикация и сопровождение каталога оборудования
   - Иерархическая категоризация (до 4 уровней вложенности)
   - Управление фотографиями и характеристиками
   - Гибкое ценообразование (5 тарифных тиров)

2. **Складской учет**:
   - Учет физических единиц оборудования
   - Контроль технического состояния
   - История обслуживания и ремонтов
   - Резервирование на временные интервалы

3. **Управление заказами**:
   - Прием заявок с публичной витрины
   - Создание заказов в административной панели
   - Контроль жизненного цикла аренды (7 статусов)
   - Автоматическая проверка доступности оборудования

4. **Работа с клиентами**:
   - База клиентов (физические и юридические лица)
   - Хранение реквизитов и контактов
   - История взаимодействий
   - Личный кабинет для зарегистрированных пользователей

5. **Финансовый учет**:
   - Офлайн-учет платежей
   - Контроль залоговых сумм
   - Расчет стоимости аренды по тирам
   - История платежных операций

6. **Автоматизация**:
   - Проверка просроченных заказов
   - Email-уведомления клиентам и менеджерам
   - Напоминания о возврате оборудования
   - Ежедневные сводки для персонала

7. **Аналитика**:
   - Дашборд с ключевыми метриками
   - Календарь занятости оборудования
   - Отчеты по выручке и загрузке
   - Статистика по популярности оборудования

### 1.3 Целевая аудитория

- **Администраторы** — полный доступ к настройкам и аналитике
- **Менеджеры** — операционная работа с заказами и клиентами
- **Клиенты** — просмотр каталога, оформление заявок, личный кабинет

## 2. Архитектура системы

### 2.1 Общая архитектурная схема

```
┌─────────────────────────────────────────────────────────────┐
│                    Пользовательский браузер                  │
│                     (Chrome, Firefox, Safari)                │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Web SPA (Frontend)                      │
│                   React 19 + TypeScript 5                    │
│                         Vite 6                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Публичная  │  │     Личный   │  │    Админ-    │      │
│  │   витрина    │  │    кабинет   │  │    панель    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API (JSON)
                             │ /api/v1/*
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Server (Backend)                      │
│                    NestJS 11 + TypeScript                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Модульная архитектура                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │  Auth   │ │ Orders  │ │Equipment│ │Warehouse│   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Clients │ │ Pricing │ │Analytics│ │Scheduler│   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────┼────────────────────────────┐  │
│  │     Инфраструктурные сервисы                          │  │
│  │  • Prisma ORM  • JWT Auth  • Validation  • Logging   │  │
│  │  • Guards      • Filters   • Pipes       • Swagger   │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────┬────────────────────────┬─────────────────────┘
               │                        │
               ▼                        ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│    PostgreSQL 17         │  │       Redis 7            │
│  (Основное хранилище)    │  │  (Кэш + Корзина)         │
│                          │  │                          │
│  • Users                 │  │  • Session cache         │
│  • Orders                │  │  • Cart storage          │
│  • Equipment             │  │  • Rate limiting         │
│  • Warehouse             │  │                          │
│  • Clients               │  │                          │
│  • 20 таблиц             │  │                          │
│  • 25 миграций Prisma    │  │                          │
└──────────────────────────┘  └──────────────────────────┘
```

### 2.2 Архитектурный стиль

**Модель развертывания**: Monorepo с использованием npm workspaces

```
RentHub/
├── apps/
│   ├── api/          # Backend-приложение (NestJS)
│   └── web/          # Frontend-приложение (React + Vite)
├── docker/           # Docker Compose конфигурации
└── docs/             # Документация
```

**Серверная часть**: Модульный монолит на NestJS
- Четкое разделение на предметные модули
- Общие инфраструктурные компоненты
- Единая база данных с транзакциями

**Клиентская часть**: Single Page Application (SPA)
- Ролевая маршрутизация
- Серверное состояние через TanStack Query
- Локальное состояние через Zustand

**Персистентность**:
- PostgreSQL — основные данные (транзакционные операции)
- Redis — кэш и временные данные (корзина, rate limiting)

### 2.3 Взаимодействие компонентов

1. **Браузер → Frontend**:
   - Загрузка статических файлов (HTML, CSS, JS)
   - Client-side routing (React Router)
   - Рендеринг UI (React компоненты)

2. **Frontend → Backend**:
   - REST API запросы (Axios)
   - JSON формат данных
   - JWT токены в httpOnly cookies
   - Автоматический refresh токенов

3. **Backend → PostgreSQL**:
   - Prisma ORM для работы с БД
   - Миграции для версионирования схемы
   - Connection pooling
   - Транзакции для критичных операций

4. **Backend → Redis**:
   - Двухуровневое кэширование (memory + Redis)
   - Хранение корзины (TTL 7 дней)
   - Rate limiting счетчики

5. **Backend → SMTP**:
   - Отправка email-уведомлений
   - Настраиваемые шаблоны
   - Асинхронная обработка

## 3. Backend (API Server)

### 3.1 Технологический стек

| Компонент | Технология | Версия | Назначение |
|-----------|-----------|--------|------------|
| Framework | NestJS | 11.x | Серверный фреймворк |
| Язык | TypeScript | 5.x | Типобезопасность |
| ORM | Prisma | 5.x | Работа с БД |
| Аутентификация | Passport + JWT | - | Управление сессиями |
| Валидация | class-validator | - | Проверка входных данных |
| Логирование | Pino | - | Структурированные логи |
| Документация | Swagger | - | OpenAPI спецификация |
| Планировщик | @nestjs/schedule | - | Cron-задачи |
| Email | Nodemailer | - | Отправка писем |
| Кэширование | @nestjs/cache-manager | - | Многоуровневый кэш |

### 3.2 Глобальные настройки приложения

Конфигурация в `apps/api/src/main.ts`:

```typescript
// Префикс API
app.setGlobalPrefix('api');

// Версионирование
app.enableVersioning({ 
  type: VersioningType.URI, 
  defaultVersion: '1' 
});

// Результат: /api/v1/*
```

**Глобальные политики**:

1. **Валидация входных данных**:
   ```typescript
   app.useGlobalPipes(new ValidationPipe({
     whitelist: true,              // Удалять неописанные поля
     forbidNonWhitelisted: true,   // Ошибка при лишних полях
     transform: true,              // Автопреобразование типов
   }));
   ```

2. **Безопасность**:
   - Helmet (security headers)
   - CORS (ограничение по WEB_URL)
   - Cookie parser (httpOnly cookies)
   - Rate limiting (ThrottlerGuard)

3. **Обработка ошибок**:
   - Глобальный HTTP exception filter
   - Структурированные ошибки в JSON
   - Логирование всех исключений

4. **Документация API**:
   - Swagger UI: `/api/docs`
   - В production защищен Basic Auth
   - Автогенерация из декораторов

### 3.3 Модульная структура

#### Предметные модули (бизнес-логика)

| Модуль | Путь | Назначение |
|--------|------|------------|
| **auth** | `/api/v1/auth` | Аутентификация, регистрация, восстановление пароля |
| **users** | `/api/v1/users` | Управление пользователями (ADMIN) |
| **me** | `/api/v1/me` | Личный кабинет текущего пользователя |
| **categories** | `/api/v1/categories` | Иерархия категорий каталога |
| **equipment** | `/api/v1/equipment` | Карточки оборудования |
| **warehouse** | `/api/v1/warehouse` | Складские единицы |
| **pricing** | `/api/v1/pricing` | Тарифные тиры и цены |
| **clients** | `/api/v1/clients` | База клиентов |
| **orders** | `/api/v1/orders` | Заказы и аренды |
| **cart** | `/api/v1/cart` | Корзина покупок |
| **payments** | `/api/v1/payments` | Учет платежей |
| **analytics** | `/api/v1/analytics` | Аналитика и отчеты |

#### Системные модули

| Модуль | Назначение |
|--------|------------|
| **notifications** | Email-уведомления |
| **email-templates** | Управление шаблонами писем |
| **org-settings** | Настройки организации |
| **legal** | Публичные правовые документы |
| **uploads** | Загрузка файлов |
| **scheduler** | Фоновые задачи (cron) |
| **health** | Health checks (liveness/readiness) |

#### Инфраструктурные модули

| Модуль | Назначение |
|--------|------------|
| **prisma** | Подключение к БД |
| **crypto** | Шифрование секретов |
| **common/guards** | Авторизационные guards |
| **common/decorators** | Кастомные декораторы |
| **common/filters** | Exception filters |

### 3.4 Аутентификация и авторизация

#### Схема аутентификации

```
1. Регистрация:
   POST /api/v1/auth/register
   ↓
   Создание PendingRegistration
   ↓
   Отправка 6-значного кода на email
   ↓
   POST /api/v1/auth/verify-email
   ↓
   Создание User + выдача JWT

2. Вход:
   POST /api/v1/auth/login
   ↓
   Проверка email/password (bcrypt)
   ↓
   Генерация access + refresh токенов
   ↓
   Установка httpOnly cookies

3. Обновление токена:
   POST /api/v1/auth/refresh
   ↓
   Проверка refresh токена
   ↓
   Выдача нового access токена

4. Выход:
   POST /api/v1/auth/logout
   ↓
   Очистка cookies
```

#### Ролевая модель

| Роль | Права доступа |
|------|---------------|
| **ADMIN** | Полный доступ ко всем разделам + настройки системы |
| **MANAGER** | Операционная работа: заказы, каталог, склад, клиенты |
| **USER** | Личный кабинет, просмотр своих заказов |

#### Guards (защита маршрутов)

```typescript
// Требует аутентификации
@UseGuards(JwtAuthGuard)

// Требует роль ADMIN
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')

// Требует роль ADMIN или MANAGER
@Roles('ADMIN', 'MANAGER')

// Публичный маршрут (без аутентификации)
@Public()
```

### 3.5 Модель данных

#### Схема базы данных

Полная схема: `apps/api/prisma/schema.prisma`

**Статистика:**
- 19 бизнес-моделей в Prisma
- 20 таблиц в PostgreSQL (19 бизнес + 1 служебная `_prisma_migrations`)
- 25 миграций Prisma

**Основные таблицы:**

```
Пользователи и аутентификация:
├── users                      # Пользователи системы
├── pending_registrations      # Незавершенные регистрации
└── password_reset_codes       # Коды сброса пароля

Каталог:
├── categories                 # Иерархия категорий (self-referencing)
├── equipment                  # Карточки оборудования
├── pricing_tiers              # Глобальные тарифные тиры (1-5)
└── catalog_item_prices        # Цены по тирам для каждой карточки

Склад:
├── warehouse_items            # Физические единицы оборудования
└── maintenance_log            # История обслуживания

Клиенты и заказы:
├── clients                    # База клиентов (физлица + юрлица)
├── orders                     # Заказы
├── order_lines                # Позиции заказа
├── order_status_log           # История изменений статусов
├── reservations               # Резервы оборудования
├── rental_extensions          # Продления аренды
└── payments                   # Платежи

Настройки:
├── org_settings               # Настройки организации (singleton)
├── email_templates            # Шаблоны email-уведомлений
└── legal_documents            # Правовые документы
```

#### Ключевые связи

```
User 1:0..1 Client              # Один пользователь = максимум один клиент
Client 1:N Order                # У клиента много заказов
Order 1:N OrderLine             # В заказе много позиций
OrderLine 1:N Reservation       # Позиция может иметь несколько резервов
Equipment 1:N WarehouseItem     # Карточка → физические единицы
WarehouseItem 1:N Reservation   # Единица резервируется на периоды
Category 1:N Category           # Иерархия категорий (parent-child)
```

### 3.6 Жизненный цикл заказа (State Machine)

#### Статусы заказа

```
┌─────────┐
│  DRAFT  │  Черновик (инквайри с витрины или незаконченный заказ)
└────┬────┘
     │
     ▼
┌─────────┐
│ PENDING │  Оформлен, ждет подтверждения менеджером
└────┬────┘
     │
     ▼
┌───────────┐
│ CONFIRMED │  Подтвержден, склад зарезервирован
└─────┬─────┘
      │
      ▼
┌────────┐
│ ACTIVE │  Оборудование выдано клиенту
└───┬────┘
    │
    ├──────────┐
    │          ▼
    │     ┌─────────┐
    │     │ OVERDUE │  Просрочен возврат
    │     └────┬────┘
    │          │
    ▼          ▼
┌──────┐
│ DONE │  Все позиции возвращены
└──────┘

┌───────────┐
│ CANCELLED │  Отменен (из любого статуса)
└───────────┘
```

#### Источники заказа

| Источник | Описание | Начальный статус |
|----------|----------|------------------|
| **MANUAL** | Создан менеджером в админке | DRAFT или PENDING |
| **WEB_CART** | Оформлен через корзину на витрине | PENDING |
| **WEB_INQUIRY** | Быстрая заявка с формы "Связаться" | DRAFT |

#### Валидация переходов

Переходы между статусами контролируются на уровне сервиса:

```typescript
// Разрешенные переходы
DRAFT → PENDING, CANCELLED
PENDING → CONFIRMED, CANCELLED
CONFIRMED → ACTIVE, CANCELLED
ACTIVE → OVERDUE, DONE, CANCELLED
OVERDUE → DONE, CANCELLED
```

**Бизнес-правила**:
- Нельзя подтвердить заказ без доступного оборудования
- Нельзя активировать заказ без назначенных складских единиц
- Нельзя завершить заказ, пока не все позиции возвращены
- При отмене заказа все резервы освобождаются

### 3.7 Резервирование и доступность оборудования

#### Модель резервов

```typescript
// Таблица reservations
{
  id: number
  orderLineId: number           // Позиция заказа
  warehouseItemId: number       // Физическая единица
  fromDate: DateTime            // Начало аренды
  toDate: DateTime              // Конец аренды
  status: ReservationStatus     // PLANNED | ACTIVE | RETURNED | CANCELLED
}
```

#### Статусы резервов

```
PLANNED    → Резерв создан, единица забронирована
ACTIVE     → Единица выдана клиенту
RETURNED   → Единица возвращена
CANCELLED  → Резерв отменен (заказ отменен)
```

#### Алгоритм проверки доступности

```typescript
// Проверка доступности единицы на период [fromDate, toDate]
function isAvailable(warehouseItemId, fromDate, toDate): boolean {
  // 1. Проверить физическое состояние
  if (item.status !== 'OPERATIONAL') return false;
  
  // 2. Проверить пересечение с активными резервами
  const conflicts = await prisma.reservation.findMany({
    where: {
      warehouseItemId,
      status: { in: ['PLANNED', 'ACTIVE'] },
      OR: [
        // Новый период начинается внутри существующего
        { fromDate: { lte: fromDate }, toDate: { gt: fromDate } },
        // Новый период заканчивается внутри существующего
        { fromDate: { lt: toDate }, toDate: { gte: toDate } },
        // Новый период полностью охватывает существующий
        { fromDate: { gte: fromDate }, toDate: { lte: toDate } }
      ]
    }
  });
  
  return conflicts.length === 0;
}
```

#### Конкурентный доступ

Для предотвращения race conditions используются **PostgreSQL advisory locks**:

```typescript
// Блокировка на время проверки и создания резерва
await prisma.$executeRaw`SELECT pg_advisory_xact_lock(${warehouseItemId})`;

// Проверка доступности
const available = await checkAvailability(...);

// Создание резерва (в той же транзакции)
if (available) {
  await prisma.reservation.create(...);
}

// Блокировка автоматически снимается при commit/rollback транзакции
```

### 3.8 Ценообразование

#### Тарифные тиры

Система поддерживает до 5 тарифных тиров с прогрессивным снижением цены:

| Тир | Диапазон дней | Пример цены |
|-----|---------------|-------------|
| 1 | 1-3 дня | 1000 ₽/день |
| 2 | 4-7 дней | 900 ₽/день |
| 3 | 8-14 дней | 800 ₽/день |
| 4 | 15-30 дней | 700 ₽/день |
| 5 | 31+ дней | 600 ₽/день |

#### Расчет стоимости

```typescript
// Алгоритм расчета стоимости аренды
function calculatePrice(equipmentId: number, days: number): number {
  // 1. Получить все цены для оборудования
  const prices = await prisma.catalogItemPrice.findMany({
    where: { catalogItemId: equipmentId },
    include: { tier: true },
    orderBy: { tier: { rank: 'asc' } }
  });
  
  // 2. Найти подходящий тир
  const tier = prices.find(p => 
    days >= p.tier.minDays && 
    (p.tier.maxDays === null || days <= p.tier.maxDays)
  );
  
  // 3. Рассчитать итоговую сумму
  return tier.pricePerDay * days;
}
```

#### Переопределение цен

Менеджер может вручную установить цену для конкретного тира:

```typescript
// Флаг isOverridden = true
// Такая цена не изменяется при массовом пересчете тиров
{
  catalogItemId: 123,
  tierId: 2,
  pricePerDay: 950,  // Вручную установленная цена
  isOverridden: true
}
```

### 3.9 Корзина (Cart)

#### Архитектура

```
┌──────────────┐
│   Browser    │
│  (cookie:    │
│  cart_sid)   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│         API Server               │
│  ┌────────────────────────────┐  │
│  │   CartService              │  │
│  │  • getCart()               │  │
│  │  • addItem()               │  │
│  │  • updateItem()            │  │
│  │  • removeItem()            │  │
│  │  • checkout()              │  │
│  └────────┬───────────────────┘  │
│           │                      │
│           ▼                      │
│  ┌────────────────────────────┐  │
│  │   Cache Manager            │  │
│  │  (двухуровневый)           │  │
│  │  ┌──────────┐ ┌─────────┐  │  │
│  │  │  Memory  │→│  Redis  │  │  │
│  │  └──────────┘ └─────────┘  │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

#### Структура данных корзины

```typescript
interface Cart {
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface CartItem {
  equipmentId: number;
  quantity: number;
  fromDate: string;    // ISO 8601
  toDate: string;      // ISO 8601
}
```

#### Процесс checkout

```typescript
1. Валидация корзины:
   - Проверка наличия товаров
   - Проверка дат (fromDate < toDate)
   - Проверка доступности оборудования

2. Создание заказа (транзакция):
   - Создание Order (status: PENDING)
   - Создание OrderLine для каждого товара
   - Расчет цен по тирам
   - Сохранение snapshot цен

3. Очистка корзины

4. Отправка уведомлений:
   - Клиенту: подтверждение заявки
   - Менеджерам: новая заявка
```

### 3.10 Email-уведомления

#### Типы уведомлений

| Событие | Получатель | Триггер |
|---------|-----------|---------|
| **Регистрация** | Клиент | Код верификации email |
| **Сброс пароля** | Клиент | Код восстановления |
| **Новая заявка** | Менеджеры | Checkout с витрины |
| **Статус заказа** | Клиент | Изменение статуса |
| **Напоминание о возврате** | Клиент | За N дней до toDate |
| **Просрочка** | Менеджеры | Заказ перешел в OVERDUE |
| **Утренняя сводка** | Менеджеры | Ежедневно в заданное время |

#### Шаблоны писем

Шаблоны хранятся в таблице `email_templates` и поддерживают плейсхолдеры:

```html
<!-- Пример шаблона -->
<p>Здравствуйте, {{clientName}}!</p>
<p>Ваш заказ №{{orderNumber}} подтвержден.</p>
<p>Дата выдачи: {{fromDate}}</p>
<p>Дата возврата: {{toDate}}</p>
```

**Доступные плейсхолдеры**:
- `{{clientName}}` — имя клиента
- `{{orderNumber}}` — номер заказа
- `{{fromDate}}`, `{{toDate}}` — даты аренды
- `{{totalAmount}}` — сумма заказа
- `{{orgName}}` — название организации
- `{{orgPhone}}`, `{{orgEmail}}` — контакты

#### SMTP-конфигурация

SMTP настраивается через админку (`/admin/settings/notifications`):

```typescript
{
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUser: 'noreply@example.com',
  smtpPass: '<encrypted>',      // Шифруется AES-256-GCM
  smtpSecure: false,             // STARTTLS
  senderName: 'RentHub',
  senderEmail: 'noreply@example.com'
}
```

### 3.11 Фоновые задачи (Scheduler)

#### Реализованные задачи

| Задача | Расписание | Назначение |
|--------|-----------|------------|
| **Проверка просрочек** | Каждые N минут | Перевод ACTIVE → OVERDUE |
| **Утренняя сводка** | Ежедневно в HH:MM | Отчет менеджерам |
| **Напоминания о возврате** | Ежедневно в HH:MM | За N дней до toDate |
| **Автоотмена инквайри** | Ежедневно в HH:MM | Удаление старых DRAFT |
| **Очистка pending-регистраций** | Каждый час | Удаление истекших |

#### Настройка через админку

Все параметры задач настраиваются в `org_settings`:

```typescript
{
  // Проверка просрочек
  overdueCheckEnabled: true,
  overdueCheckEveryMinutes: 10,
  
  // Утренняя сводка
  dailyBriefEnabled: true,
  dailyBriefHour: 8,
  dailyBriefMinute: 0,
  
  // Напоминания
  returnReminderEnabled: true,
  returnReminderHour: 9,
  returnReminderMinute: 0,
  returnReminderDaysBefore: 1,
  
  // Часовой пояс
  timezone: 'Europe/Moscow'
}
```

## 4. Frontend (Web Application)

### 4.1 Технологический стек

| Компонент | Технология | Версия | Назначение |
|-----------|-----------|--------|------------|
| Framework | React | 19.x | UI библиотека |
| Язык | TypeScript | 5.x | Типобезопасность |
| Сборщик | Vite | 6.x | Быстрая сборка и HMR |
| Роутинг | React Router | 7.x | Client-side routing |
| State (server) | TanStack Query | 5.x | Серверное состояние |
| State (local) | Zustand | 5.x | Локальное состояние |
| HTTP-клиент | Axios | - | API запросы |
| Формы | React Hook Form | - | Управление формами |
| Валидация | Zod | - | Schema validation |
| UI Kit | Radix UI | - | Headless компоненты |
| Стили | Tailwind CSS | 4.x | Utility-first CSS |
| Иконки | Lucide React | - | SVG иконки |
| Графики | Recharts | - | Визуализация данных |
| Rich Text | TipTap | - | WYSIWYG редактор |
| Drag & Drop | @dnd-kit | - | Сортировка категорий |

### 4.2 Архитектура приложения

```
apps/web/src/
├── pages/                    # Страницы приложения
│   ├── public/              # Публичная витрина
│   ├── auth/                # Аутентификация
│   ├── me/                  # Личный кабинет
│   └── admin/               # Административная панель
├── components/              # UI компоненты
│   ├── ui/                  # Базовые компоненты (Radix)
│   ├── layout/              # Layouts и guards
│   └── [feature]/           # Feature-специфичные компоненты
├── lib/                     # Библиотеки и утилиты
│   ├── api/                 # API клиент
│   ├── hooks/               # Custom hooks
│   ├── stores/              # Zustand stores
│   ├── utils/               # Утилиты
│   └── types/               # TypeScript типы
├── styles/                  # Глобальные стили
├── router.tsx               # Конфигурация маршрутов
└── main.tsx                 # Точка входа
```

### 4.3 Маршрутизация

#### Публичные маршруты

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | HomePage | Главная страница |
| `/catalog` | CatalogPage | Каталог оборудования |
| `/catalog/:categorySlug` | CatalogPage | Каталог по категории |
| `/equipment/:id` | EquipmentDetailPage | Карточка оборудования |
| `/contact` | ContactPage | Форма обратной связи |
| `/rental-terms` | RentalTermsPage | Условия аренды |
| `/legal/:slug` | LegalDocumentPage | Правовые документы |
| `/checkout/success` | CheckoutSuccessPage | Подтверждение заявки |

#### Аутентификация

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/login` | LoginPage | Вход в систему |
| `/forgot-password` | ForgotPasswordPage | Восстановление пароля |
| `/reset-password` | ResetPasswordPage | Ввод нового пароля |
| `/verify-email` | VerifyEmailPage | Верификация email |

#### Личный кабинет

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/me/profile` | MyProfilePage | Профиль и заказы |
| `/me/orders/:id` | MyOrderDetailPage | Детали заказа |

#### Административная панель

| Путь | Компонент | Роль | Описание |
|------|-----------|------|----------|
| `/admin` | AdminRoleRedirect | STAFF | Редирект по роли |
| `/admin/today` | TodayPage | STAFF | Сегодняшние задачи |
| `/admin/overview` | OverviewPage | ADMIN | Дашборд |
| `/admin/orders` | OrdersListPage | STAFF | Список заказов |
| `/admin/orders/new` | OrderCreatePage | STAFF | Создание заказа |
| `/admin/orders/:id` | OrderDetailPage | STAFF | Детали заказа |
| `/admin/equipment/catalog` | EquipmentListPage | STAFF | Каталог |
| `/admin/equipment/stock` | WarehousePage | STAFF | Склад |
| `/admin/equipment/categories` | CategoriesPage | STAFF | Категории |
| `/admin/equipment/pricing` | PricingPage | STAFF | Тарифы |
| `/admin/customers` | ClientsListPage | STAFF | Клиенты |
| `/admin/customers/:id` | ClientDetailPage | STAFF | Карточка клиента |
| `/admin/calendar` | CalendarPage | STAFF | Календарь |
| `/admin/analytics` | ReportsPage | ADMIN | Аналитика |
| `/admin/settings/*` | Settings* | ADMIN | Настройки |

### 4.4 Управление состоянием

#### Серверное состояние (TanStack Query)

```typescript
// Пример: получение списка заказов
const { data, isLoading, error } = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => api.orders.list(filters),
  staleTime: 30_000,  // Кэш на 30 секунд
});

// Мутация: создание заказа
const createMutation = useMutation({
  mutationFn: api.orders.create,
  onSuccess: () => {
    queryClient.invalidateQueries(['orders']);
    toast.success('Заказ создан');
  },
});
```

**Преимущества**:
- Автоматическое кэширование
- Оптимистичные обновления
- Автоматический retry при ошибках
- Фоновая ре-валидация
- DevTools для отладки

#### Локальное состояние (Zustand)

```typescript
// Пример: store корзины
interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (equipmentId: number) => void;
  clear: () => void;
}

const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.equipmentId !== id)
  })),
  clear: () => set({ items: [] }),
}));
```

**Используется для**:
- UI состояние (модальные окна, сайдбары)
- Локальная корзина (синхронизируется с сервером)
- Фильтры и сортировки
- Временные данные форм

### 4.5 API клиент

#### Структура

```typescript
// lib/api/client.ts
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,  // Отправка cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Автоматический refresh токена при 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await api.auth.refresh();
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

#### Модули API

```typescript
// lib/api/index.ts
export const api = {
  auth: {
    login: (data) => post('/v1/auth/login', data),
    register: (data) => post('/v1/auth/register', data),
    logout: () => post('/v1/auth/logout'),
    refresh: () => post('/v1/auth/refresh'),
  },
  orders: {
    list: (params) => get('/v1/orders', { params }),
    get: (id) => get(`/v1/orders/${id}`),
    create: (data) => post('/v1/orders', data),
    update: (id, data) => patch(`/v1/orders/${id}`, data),
  },
  equipment: { /* ... */ },
  warehouse: { /* ... */ },
  // ...
};
```

### 4.6 Компоненты и UI Kit

#### Базовые компоненты (Radix UI)

```
components/ui/
├── button.tsx           # Кнопки
├── input.tsx            # Поля ввода
├── select.tsx           # Выпадающие списки
├── dialog.tsx           # Модальные окна
├── dropdown-menu.tsx    # Контекстные меню
├── tabs.tsx             # Вкладки
├── table.tsx            # Таблицы
├── toast.tsx            # Уведомления
├── calendar.tsx         # Календарь
└── ...
```

**Особенности**:
- Headless компоненты (полный контроль стилей)
- Accessibility из коробки (ARIA, keyboard navigation)
- Стилизация через Tailwind CSS
- Темизация через CSS переменные

#### Feature-компоненты

```
components/
├── orders/
│   ├── OrderCard.tsx
│   ├── OrderStatusBadge.tsx
│   └── OrderTimeline.tsx
├── equipment/
│   ├── EquipmentCard.tsx
│   ├── EquipmentGallery.tsx
│   └── PriceCalculator.tsx
├── warehouse/
│   ├── WarehouseItemCard.tsx
│   └── AvailabilityCalendar.tsx
└── ...
```

### 4.7 Формы и валидация

#### React Hook Form + Zod

```typescript
// Схема валидации
const orderSchema = z.object({
  clientId: z.number().min(1, 'Выберите клиента'),
  fromDate: z.string().min(1, 'Укажите дату начала'),
  toDate: z.string().min(1, 'Укажите дату окончания'),
  contactPhone: z.string().regex(/^\+7\d{10}$/, 'Неверный формат'),
});

type OrderFormData = z.infer<typeof orderSchema>;

// Использование в компоненте
const form = useForm<OrderFormData>({
  resolver: zodResolver(orderSchema),
  defaultValues: { /* ... */ },
});

const onSubmit = form.handleSubmit(async (data) => {
  await createMutation.mutateAsync(data);
});
```

**Преимущества**:
- Типобезопасность (TypeScript)
- Декларативная валидация
- Автоматические сообщения об ошибках
- Оптимизация ре-рендеров

### 4.8 Безопасность на клиенте

#### Защита маршрутов

```typescript
// RequireStaff.tsx - требует роль ADMIN или MANAGER
function RequireStaff({ children }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <Loader />;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'USER') return <Navigate to="/me/profile" />;
  
  return children;
}

// RequireRole.tsx - требует конкретную роль
function RequireRole({ role, children }) {
  const { user } = useAuth();
  
  if (user?.role !== role) {
    return <Navigate to="/admin" />;
  }
  
  return children;
}
```

#### XSS защита

- React автоматически экранирует вывод
- `dangerouslySetInnerHTML` используется только для проверенного контента
- Sanitization HTML в TipTap редакторе

#### CSRF защита

- JWT токены в httpOnly cookies (недоступны из JS)
- SameSite=Lax для cookies
- CORS ограничен на backend

### 4.9 Оптимизация производительности

#### Code Splitting

```typescript
// Ленивая загрузка страниц
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const OrderDetailPage = lazy(() => import('./pages/admin/OrderDetailPage'));

// Suspense для fallback
<Suspense fallback={<PageLoader />}>
  <AdminLayout />
</Suspense>
```

#### Мемоизация

```typescript
// useMemo для тяжелых вычислений
const filteredOrders = useMemo(() => 
  orders.filter(o => o.status === selectedStatus),
  [orders, selectedStatus]
);

// useCallback для стабильных функций
const handleSubmit = useCallback((data) => {
  createMutation.mutate(data);
}, [createMutation]);
```

#### Виртуализация списков

```typescript
// Для больших списков (1000+ элементов)
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
});
```

### 4.10 Сборка и развертывание

#### Production build

```bash
npm run build

# Результат:
apps/web/dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Основной бандл
│   ├── vendor-[hash].js     # Зависимости
│   └── [chunk]-[hash].js    # Ленивые чанки
└── ...
```

#### Оптимизации Vite

- Tree shaking (удаление неиспользуемого кода)
- Минификация (Terser)
- Code splitting (автоматический)
- Asset hashing (кэширование)
- Compression (gzip/brotli на nginx)

## 5. База данных (PostgreSQL)

### 5.1 Схема базы данных

Полная схема находится в `apps/api/prisma/schema.prisma`

#### Основные таблицы (25+)

**Пользователи и аутентификация:**
```sql
users                      -- Пользователи системы
├── id (PK)
├── email (UNIQUE)
├── phone (UNIQUE, nullable)
├── passwordHash
├── role (ADMIN | MANAGER | USER)
├── firstName, lastName, name
└── refreshTokenHash

pending_registrations      -- Незавершенные регистрации
├── id (PK)
├── email (UNIQUE)
├── phone (UNIQUE)
├── passwordHash
├── firstName, lastName
├── codeHash               -- bcrypt hash 6-значного кода
├── expiresAt
└── attempts

password_reset_codes       -- Коды сброса пароля
├── id (PK)
├── userId (FK → users)
├── codeHash
├── expiresAt
├── used
└── attempts
```

**Каталог:**
```sql
categories                 -- Иерархия категорий
├── id (PK)
├── slug (UNIQUE)
├── name
├── parentId (FK → categories, nullable)
└── sortOrder

equipment                  -- Карточки оборудования
├── id (PK)
├── sku (UNIQUE)
├── name
├── categoryId (FK → categories)
├── description, fullDesc
├── deposit
├── isActive, isFeatured
├── rating, reviewCount
└── photos (JSON), specs (JSON)

pricing_tiers              -- Глобальные тарифные тиры
├── id (PK)
├── rank (UNIQUE, 1-5)
├── minDays
├── maxDays (nullable)
└── note

catalog_item_prices        -- Цены по тирам
├── id (PK)
├── catalogItemId (FK → equipment)
├── tierId (FK → pricing_tiers)
├── pricePerDay
└── isOverridden
```

**Склад:**
```sql
warehouse_items            -- Физические единицы
├── id (PK)
├── name
├── inventoryNumber (UNIQUE)
├── serialNumber
├── status (OPERATIONAL | BROKEN | RETIRED)
├── catalogItemId (FK → equipment, nullable)
├── purchaseDate, purchasePrice
├── warrantyUntil
└── notes

maintenance_log            -- История обслуживания
├── id (PK)
├── warehouseItemId (FK → warehouse_items)
├── startedAt, endedAt
├── reason
└── cost
```

**Клиенты:**
```sql
clients                    -- База клиентов
├── id (PK)
├── clientType (INDIVIDUAL | COMPANY)
├── name
├── phone (UNIQUE)
├── email (UNIQUE, nullable)
├── userId (FK → users, nullable, UNIQUE)
├── -- Реквизиты юрлиц:
├── inn, kpp, ogrn
├── legalAddress
├── contactPerson, contactPosition, contactPhone
└── bankAccount, bankBik, bankName
```

**Заказы:**
```sql
orders                     -- Заказы
├── id (PK)
├── number (UNIQUE)
├── clientId (FK → clients)
├── status (DRAFT | PENDING | CONFIRMED | ACTIVE | OVERDUE | DONE | CANCELLED)
├── source (MANUAL | WEB_CART | WEB_INQUIRY)
├── inquiryNote, inquiryEquipmentId
├── fromDate, toDate, daysCount
├── totalAmount, deposit
├── deliveryMethod (PICKUP | DELIVERY)
├── address
└── contactPhone, contactEmail, notes

order_lines                -- Позиции заказа
├── id (PK)
├── orderId (FK → orders)
├── equipmentId (FK → equipment)
├── warehouseItemId (FK → warehouse_items, nullable)
├── qty, days
├── unitPriceNet, sumAmount
├── unitTag
├── returnedAt
├── -- Snapshot цен:
├── pricingTierRank, pricingTierMinDays, pricingTierMaxDays
├── catalogItemDeposit
└── snapshotAt

order_status_log           -- История статусов
├── id (PK)
├── orderId (FK → orders)
├── fromStatus, toStatus
├── changedById (FK → users, nullable)
├── changedAt
└── note

reservations               -- Резервы оборудования
├── id (PK)
├── orderLineId (FK → order_lines)
├── warehouseItemId (FK → warehouse_items)
├── fromDate, toDate
└── status (PLANNED | ACTIVE | RETURNED | CANCELLED)

rental_extensions          -- Продления аренды
├── id (PK)
├── orderLineId (FK → order_lines)
├── oldToDate, newToDate
├── addedDays, addedAmount
└── createdById (FK → users, nullable)
```

**Платежи:**
```sql
payments                   -- Учет платежей
├── id (PK)
├── orderId (FK → orders)
├── amount
├── method (CASH | CARD | TRANSFER | OTHER)
├── kind (CHARGE | DEPOSIT | REFUND)
├── paidAt
├── note
└── createdById (FK → users, nullable)
```

**Настройки:**
```sql
org_settings               -- Настройки организации (singleton, id=1)
├── id (PK, always 1)
├── -- Cron задачи:
├── overdueCheckEnabled, overdueCheckEveryMinutes
├── dailyBriefEnabled, dailyBriefHour, dailyBriefMinute
├── returnReminderEnabled, returnReminderHour, returnReminderMinute, returnReminderDaysBefore
├── inquiryExpireEnabled, inquiryExpireHour, inquiryExpireMinute, inquiryExpireAfterDays
├── timezone
├── -- Реквизиты:
├── orgName, orgShortName, orgPhone, orgEmail, orgAddress, orgHours
├── logoPath
├── -- Публичная информация:
├── rentalTermsTitle, rentalTermsContent
├── -- Email:
├── senderName, senderEmail, staffEmails
└── smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure

email_templates            -- Шаблоны уведомлений
├── id (PK)
├── eventType (UNIQUE)
├── label
├── enabled
├── subject
└── bodyHtml

legal_documents            -- Правовые документы
├── id (PK)
├── slug (UNIQUE: 'terms' | 'personal-data' | 'privacy')
├── title
└── content (HTML)
```

### 5.2 Индексы

Критичные индексы для производительности:

```sql
-- Пользователи
CREATE INDEX idx_users_role ON users(role);

-- Заказы
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_source ON orders(source);
CREATE INDEX idx_orders_dates ON orders(fromDate, toDate);
CREATE INDEX idx_orders_client ON orders(clientId);

-- Оборудование
CREATE INDEX idx_equipment_category ON equipment(categoryId);
CREATE INDEX idx_equipment_active ON equipment(isActive);
CREATE INDEX idx_equipment_featured ON equipment(isFeatured);

-- Склад
CREATE INDEX idx_warehouse_status ON warehouse_items(status);
CREATE INDEX idx_warehouse_catalog ON warehouse_items(catalogItemId);

-- Резервы
CREATE INDEX idx_reservations_item_dates ON reservations(warehouseItemId, fromDate, toDate);
CREATE INDEX idx_reservations_status ON reservations(status);

-- Клиенты
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_type ON clients(clientType);
CREATE INDEX idx_clients_inn ON clients(inn);
```

### 5.3 Ограничения целостности

**Foreign Key Constraints:**

```sql
-- Restrict (нельзя удалить, если есть зависимости)
clients.id ← orders.clientId (RESTRICT)
equipment.id ← order_lines.equipmentId (RESTRICT)
warehouse_items.id ← reservations.warehouseItemId (RESTRICT)

-- Cascade (удаление каскадом)
orders.id ← order_lines.orderId (CASCADE)
orders.id ← order_status_log.orderId (CASCADE)
equipment.id ← catalog_item_prices.catalogItemId (CASCADE)

-- SetNull (обнуление при удалении)
users.id ← clients.userId (SET NULL)
warehouse_items.id ← order_lines.warehouseItemId (SET NULL)
```

**Unique Constraints:**

```sql
users.email, users.phone
equipment.sku
warehouse_items.inventoryNumber
orders.number
categories.slug
catalog_item_prices(catalogItemId, tierId)
```

### 5.4 Миграции

Миграции хранятся в `apps/api/prisma/migrations/`

**Применение миграций:**

```bash
# Development
npm run db:migrate

# Production
npm run db:migrate:deploy
```

**Создание новой миграции:**

```bash
# 1. Изменить schema.prisma
# 2. Создать миграцию
npx prisma migrate dev --name add_new_field

# 3. Применится автоматически в dev
```

### 5.5 Seed данные

**Минимальный seed** (`seed-empty.ts`):
- Создание администратора
- Базовые настройки организации
- Шаблоны email-уведомлений
- Правовые документы (заглушки)

**Демо seed** (`seed.ts`):
- Все из минимального seed
- Менеджер и клиент
- 3 категории с подкатегориями
- 20+ единиц оборудования
- 10+ складских единиц
- 5 тарифных тиров
- Демо-заказы

**Запуск:**

```bash
npm run db:seed        # Минимальный
npm run db:seed:demo   # С демо-данными
```

## 6. Безопасность

### 6.1 Аутентификация

#### JWT токены в httpOnly cookies

```typescript
// Установка cookies при логине
res.cookie('access_token', accessToken, {
  httpOnly: true,        // Недоступен из JavaScript
  secure: true,          // Только HTTPS (в production)
  sameSite: 'lax',       // CSRF защита
  maxAge: 15 * 60 * 1000 // 15 минут
});

res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
});
```

**Преимущества**:
- ✅ Защита от XSS (токены недоступны из JS)
- ✅ Автоматическая отправка с каждым запросом
- ✅ Refresh flow без хранения токенов в localStorage

#### Хэширование паролей

```typescript
// Bcrypt с cost factor 10
const hash = await bcrypt.hash(password, 10);

// Проверка
const isValid = await bcrypt.compare(password, hash);
```

#### Верификация email

```typescript
// 1. Генерация 6-значного кода
const code = Math.floor(100000 + Math.random() * 900000).toString();

// 2. Хэширование кода
const codeHash = await bcrypt.hash(code, 10);

// 3. Сохранение в БД с TTL 15 минут
await prisma.pendingRegistration.create({
  data: {
    email, phone, passwordHash, firstName, lastName,
    codeHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    attempts: 0
  }
});

// 4. Отправка кода на email
await emailService.send(email, 'Код верификации: ' + code);

// 5. Проверка кода (max 5 попыток)
const isValid = await bcrypt.compare(inputCode, pending.codeHash);
```

### 6.2 Авторизация

#### Ролевые Guards

```typescript
// JwtAuthGuard - проверка наличия валидного токена
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}

// RolesGuard - проверка роли пользователя
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin/settings')
getSettings() {
  // Доступно только ADMIN
}

// Публичный маршрут (без guards)
@Public()
@Get('catalog')
getCatalog() {
  // Доступно всем
}
```

#### Контекстная авторизация

```typescript
// Проверка владения ресурсом
async getMyOrder(orderId: number, userId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: true }
  });
  
  // Проверка: заказ принадлежит текущему пользователю
  if (order.client.userId !== userId) {
    throw new ForbiddenException('Доступ запрещен');
  }
  
  return order;
}
```

### 6.3 Защита от атак

#### Rate Limiting

```typescript
// Глобальные лимиты
ThrottlerModule.forRoot([
  { name: 'default', ttl: 60_000, limit: 120 },  // 120 req/min
  { name: 'auth', ttl: 60_000, limit: 10 }       // 10 req/min для auth
]);

// Применение к конкретному маршруту
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Post('login')
async login() { /* ... */ }
```

#### Валидация входных данных

```typescript
// DTO с валидацией
export class CreateOrderDto {
  @IsNumber()
  @Min(1)
  clientId: number;
  
  @IsDateString()
  fromDate: string;
  
  @IsDateString()
  toDate: string;
  
  @IsString()
  @Matches(/^\+7\d{10}$/)
  contactPhone: string;
  
  @IsEmail()
  @IsOptional()
  contactEmail?: string;
}

// Глобальная валидация
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Удалять неописанные поля
  forbidNonWhitelisted: true,   // Ошибка при лишних полях
  transform: true,              // Автопреобразование типов
}));
```

#### SQL Injection

Prisma автоматически защищает от SQL injection:

```typescript
// ✅ Безопасно (параметризованный запрос)
await prisma.user.findUnique({
  where: { email: userInput }
});

// ✅ Безопасно даже в raw queries
await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userInput}
`;
```

#### XSS защита

**Backend:**
```typescript
// Helmet устанавливает security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  }
}));
```

**Frontend:**
```typescript
// React автоматически экранирует вывод
<div>{userInput}</div>  // ✅ Безопасно

// dangerouslySetInnerHTML только для проверенного контента
<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(htmlContent) 
}} />
```

#### CSRF защита

```typescript
// SameSite cookies
res.cookie('access_token', token, {
  sameSite: 'lax',  // Защита от CSRF
  httpOnly: true,
  secure: true
});

// CORS ограничен
app.enableCors({
  origin: process.env.WEB_URL,  // Только доверенный домен
  credentials: true
});
```

### 6.4 Шифрование данных

#### Шифрование SMTP-пароля

```typescript
// AES-256-GCM шифрование
class SecretCipher {
  private key: Buffer;
  
  constructor(secretKey: string) {
    // Ключ из SECRET_ENCRYPTION_KEY (32 байта)
    this.key = Buffer.from(secretKey, 'base64');
  }
  
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Формат: iv:encrypted:authTag (все в base64)
    return [
      iv.toString('base64'),
      encrypted,
      authTag.toString('base64')
    ].join(':');
  }
  
  decrypt(ciphertext: string): string {
    const [ivB64, encryptedB64, authTagB64] = ciphertext.split(':');
    
    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

**Использование:**
```typescript
// Сохранение SMTP-пароля
const encrypted = cipher.encrypt(smtpPassword);
await prisma.orgSettings.update({
  where: { id: 1 },
  data: { smtpPass: encrypted }
});

// Чтение SMTP-пароля
const settings = await prisma.orgSettings.findUnique({ where: { id: 1 } });
const smtpPassword = cipher.decrypt(settings.smtpPass);
```

### 6.5 Production Security Checklist

#### Обязательные меры

- [x] **JWT секреты**: Длинные случайные строки (64+ символов)
- [x] **SECRET_ENCRYPTION_KEY**: 32 байта в base64
- [x] **HTTPS**: Обязательно в production (COOKIE_SECURE=true)
- [x] **CORS**: Ограничен доверенным доменом
- [x] **Rate limiting**: Включен для всех маршрутов
- [x] **Helmet**: Security headers
- [x] **Валидация**: Все входные данные
- [x] **Swagger**: Защищен Basic Auth или отключен

#### Hard-fail проверки

```typescript
// Проверка при старте приложения
if (isProduction) {
  const accessSecret = config.get('JWT_ACCESS_SECRET');
  const refreshSecret = config.get('JWT_REFRESH_SECRET');
  
  // Проверка на дефолтные значения
  if (/change-?me|default|please.?change/i.test(accessSecret)) {
    throw new Error('JWT_ACCESS_SECRET небезопасен для production');
  }
  
  // Проверка длины
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT секреты слишком короткие (минимум 32 символа)');
  }
}
```

#### Рекомендуемые меры

- [ ] **WAF**: Web Application Firewall (CloudFlare, AWS WAF)
- [ ] **DDoS защита**: CloudFlare, AWS Shield
- [ ] **Мониторинг**: Sentry для отслеживания ошибок
- [ ] **Логирование**: Централизованное хранение логов
- [ ] **Backup**: Регулярные резервные копии БД
- [ ] **Обновления**: Регулярное обновление зависимостей
- [ ] **Penetration testing**: Периодический аудит безопасности

## 7. Тестирование и качество кода

### 7.1 Unit-тестирование (Vitest)

#### Покрытие

Тесты покрывают критичную бизнес-логику:

```
apps/api/test/
├── pricing.spec.ts              # Расчет цен по тирам
├── categories.spec.ts           # Иерархия категорий
├── warehouse.spec.ts            # Резервы и доступность
├── order-state-machine.spec.ts  # Переходы статусов
├── client-linking.spec.ts       # Связь клиента с пользователем
└── secret-cipher.spec.ts        # Шифрование секретов
```

#### Примеры тестов

```typescript
// Тест расчета цен
describe('PricingService', () => {
  it('должен выбрать правильный тир для 5 дней', async () => {
    const price = await pricingService.calculatePrice(equipmentId, 5);
    expect(price.tierId).toBe(2);  // Тир 2: 4-7 дней
    expect(price.total).toBe(5 * 900);  // 5 дней × 900₽
  });
  
  it('должен учитывать переопределенные цены', async () => {
    await prisma.catalogItemPrice.update({
      where: { catalogItemId_tierId: { catalogItemId, tierId: 2 } },
      data: { pricePerDay: 850, isOverridden: true }
    });
    
    const price = await pricingService.calculatePrice(equipmentId, 5);
    expect(price.total).toBe(5 * 850);  // Переопределенная цена
  });
});

// Тест резервов
describe('WarehouseService', () => {
  it('должен определить конфликт резервов', async () => {
    // Создать резерв на 01.01-05.01
    await createReservation(itemId, '2024-01-01', '2024-01-05');
    
    // Проверить доступность на 03.01-07.01 (пересечение)
    const available = await warehouseService.isAvailable(
      itemId, '2024-01-03', '2024-01-07'
    );
    
    expect(available).toBe(false);
  });
  
  it('должен разрешить резерв после окончания предыдущего', async () => {
    await createReservation(itemId, '2024-01-01', '2024-01-05');
    
    // Резерв с 05.01 (день возврата) разрешен
    const available = await warehouseService.isAvailable(
      itemId, '2024-01-05', '2024-01-10'
    );
    
    expect(available).toBe(true);
  });
});
```

#### Запуск тестов

```bash
# Все тесты
npm run test

# Watch mode
npm run test:watch

# С покрытием
npm run test:cov
```

### 7.2 E2E-тестирование (Playwright)

#### Покрытие

```
apps/web/e2e/
├── smoke.spec.ts        # Smoke-тесты критичных сценариев
└── screenshots.spec.ts  # Генерация скриншотов для документации
```

#### Тестовые сценарии

```typescript
// Smoke-тесты
test.describe('Public', () => {
  test('должен открыть главную страницу', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('RentHub');
  });
  
  test('должен показать каталог', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.locator('[data-testid="equipment-card"]')).toHaveCount(10);
  });
});

test.describe('Auth', () => {
  test('должен войти как админ', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@renthub.com');
    await page.fill('[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/admin');
  });
});

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Логин перед каждым тестом
    await loginAsAdmin(page);
  });
  
  test('должен создать заказ', async ({ page }) => {
    await page.goto('/admin/orders/new');
    
    // Выбрать клиента
    await page.click('[data-testid="client-select"]');
    await page.click('[data-testid="client-option-1"]');
    
    // Заполнить даты
    await page.fill('[name="fromDate"]', '2024-06-01');
    await page.fill('[name="toDate"]', '2024-06-05');
    
    // Добавить позицию
    await page.click('[data-testid="add-line-button"]');
    await page.click('[data-testid="equipment-select"]');
    await page.click('[data-testid="equipment-option-1"]');
    
    // Сохранить
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/admin\/orders\/\d+/);
    await expect(page.locator('[data-testid="order-status"]')).toContainText('PENDING');
  });
});
```

#### Запуск E2E

```bash
# Все тесты
npm run test:e2e

# UI mode (интерактивный)
npm run test:e2e:ui

# Конкретный браузер
npx playwright test --project=chromium
```

### 7.3 CI/CD Pipeline

#### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
  
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test
  
  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
  
  e2e:
    runs-on: ubuntu-latest
    needs: build
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: renthub
          POSTGRES_PASSWORD: renthub
          POSTGRES_DB: renthub
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx prisma migrate deploy
      - run: npm run db:seed
      - run: npm run test:e2e
```

#### Проверки на каждый PR

- ✅ Lint (ESLint)
- ✅ Typecheck (TypeScript)
- ✅ Unit-тесты
- ✅ Build
- ✅ E2E-тесты

### 7.4 Качество кода

#### Линтеры и форматтеры

```json
// package.json
{
  "scripts": {
    "lint": "npm run lint --workspaces",
    "lint:fix": "npm run lint:fix --workspaces",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md}\""
  }
}
```

#### Pre-commit hooks (Husky + lint-staged)

```json
// .husky/pre-commit
npm run lint-staged

// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write"],
    "*.{js,json,md}": ["prettier --write"]
  }
}
```

#### TypeScript strict mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 7.5 Метрики качества

| Метрика | Значение | Статус |
|---------|----------|--------|
| **TypeScript coverage** | 100% | ✅ |
| **Lint errors** | 0 | ✅ |
| **Unit tests** | 15+ тестов | ✅ |
| **E2E tests** | 10+ сценариев | ✅ |
| **Build success** | ✅ | ✅ |
| **CI/CD** | Автоматизирован | ✅ |

## 8. Развертывание

### 8.1 Требования к окружению

**Минимальные требования:**
- Docker 24+ и Docker Compose v2
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space
- Доступ к домену и SSL-сертификату

**Рекомендуемые требования:**
- 4 CPU cores
- 8 GB RAM
- 50 GB SSD
- Managed PostgreSQL и Redis (для production)

### 8.2 Переменные окружения

#### Обязательные переменные

```env
# База данных
DATABASE_URL="postgresql://user:password@host:5432/renthub"
REDIS_URL="redis://default:password@host:6379"

# Безопасность (КРИТИЧНО!)
JWT_ACCESS_SECRET="<64+ символов>"
JWT_REFRESH_SECRET="<64+ символов>"
SECRET_ENCRYPTION_KEY="<base64, 32 байта>"

# Домен
WEB_URL="https://your-domain.com"
COOKIE_DOMAIN=".your-domain.com"
COOKIE_SECURE=true

# Приложение
NODE_ENV=production
PORT=3001
```

#### Генерация секретов

```bash
# JWT секреты
openssl rand -base64 64

# Encryption key (32 байта)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Пароли БД
openssl rand -base64 32
```

### 8.3 Docker Compose развертывание

#### Структура

```
docker/
├── compose.dev.yml      # Development (PostgreSQL + Redis)
└── compose.prod.yml     # Production (все сервисы)
```

#### Production compose

```yaml
# docker/compose.prod.yml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [internal]
  
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks: [internal]
  
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://default:${REDIS_PASSWORD}@redis:6379
      # ... остальные переменные
    volumes:
      - api_uploads:/app/uploads
    networks: [internal, edge]
  
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    ports:
      - '${WEB_PORT:-8080}:8080'
    networks: [edge]

volumes:
  postgres_data:
  redis_data:
  api_uploads:

networks:
  internal:
    internal: true  # Изолированная сеть для БД
  edge:             # Внешняя сеть
```

#### Запуск

```bash
# 1. Создать .env.production
cp .env.example .env.production
nano .env.production  # Заполнить все секреты

# 2. Запустить стек
docker compose -f docker/compose.prod.yml --env-file .env.production up -d --build

# 3. Проверить статус
docker compose -f docker/compose.prod.yml ps

# 4. Посмотреть логи
docker compose -f docker/compose.prod.yml logs -f api
```

### 8.4 Миграции базы данных

#### Автоматическое применение

Миграции применяются автоматически при старте API-контейнера:

```dockerfile
# apps/api/Dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

#### Ручное применение

```bash
# Применить миграции
docker compose -f docker/compose.prod.yml exec api npx prisma migrate deploy

# Откатить последнюю миграцию (требует подготовки)
docker compose -f docker/compose.prod.yml exec api npx prisma migrate resolve --rolled-back <migration_name>
```

### 8.5 Reverse Proxy (nginx)

#### Конфигурация

```nginx
# /etc/nginx/sites-available/renthub.conf
upstream api {
    server localhost:3001;
}

upstream web {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # API
    location /api {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (если потребуется)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Uploads
    location /uploads {
        proxy_pass http://api;
        proxy_set_header Host $host;
        
        # Кэширование статики
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend
    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 8.6 SSL-сертификат (Let's Encrypt)

```bash
# Установка certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление (cron)
0 0 * * * certbot renew --quiet
```

### 8.7 Резервное копирование

#### Автоматический backup PostgreSQL

```bash
#!/bin/bash
# /usr/local/bin/backup-renthub.sh

BACKUP_DIR="/backups/renthub"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Создать backup
docker compose -f /opt/renthub/docker/compose.prod.yml exec -T postgres \
  pg_dump -U renthub renthub | gzip > "$BACKUP_DIR/renthub_$DATE.sql.gz"

# Удалить старые backups
find "$BACKUP_DIR" -name "renthub_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Логирование
echo "[$DATE] Backup completed: renthub_$DATE.sql.gz" >> "$BACKUP_DIR/backup.log"
```

#### Cron задача

```bash
# Ежедневный backup в 2:00
0 2 * * * /usr/local/bin/backup-renthub.sh
```

#### Backup uploads

```bash
# Синхронизация uploads в S3 (опционально)
aws s3 sync /var/lib/docker/volumes/renthub_api_uploads/_data \
  s3://your-bucket/renthub-uploads/ \
  --delete
```

### 8.8 Мониторинг

#### Health checks

```bash
# Liveness (приложение запущено)
curl https://your-domain.com/api/v1/health

# Readiness (приложение готово принимать запросы)
curl https://your-domain.com/api/v1/health/ready
```

#### Uptime monitoring

Настроить внешний мониторинг:
- UptimeRobot (бесплатно до 50 мониторов)
- Pingdom
- StatusCake

#### Логирование

```bash
# Просмотр логов
docker compose -f docker/compose.prod.yml logs -f api

# Экспорт логов в файл
docker compose -f docker/compose.prod.yml logs api > api.log

# Централизованное логирование (опционально)
# - ELK Stack (Elasticsearch + Logstash + Kibana)
# - Grafana Loki
# - AWS CloudWatch
```

#### Sentry (мониторинг ошибок)

```env
# .env.production
SENTRY_DSN=https://...@o12345.ingest.sentry.io/67890
SENTRY_RELEASE=renthub-api@1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 8.9 Обновление версии

```bash
# 1. Создать backup
/usr/local/bin/backup-renthub.sh

# 2. Получить новый код
cd /opt/renthub
git pull origin main

# 3. Пересобрать и перезапустить
docker compose -f docker/compose.prod.yml --env-file .env.production up -d --build

# 4. Проверить логи
docker compose -f docker/compose.prod.yml logs -f api

# 5. Smoke-тест
curl https://your-domain.com/api/v1/health
```

### 8.10 Откат версии

```bash
# 1. Остановить текущую версию
docker compose -f docker/compose.prod.yml down

# 2. Откатить код
git checkout <previous-commit>

# 3. Восстановить БД из backup (если миграции несовместимы)
gunzip < /backups/renthub/renthub_20240601_020000.sql.gz | \
  docker compose -f docker/compose.prod.yml exec -T postgres \
  psql -U renthub renthub

# 4. Запустить предыдущую версию
docker compose -f docker/compose.prod.yml up -d --build
```
