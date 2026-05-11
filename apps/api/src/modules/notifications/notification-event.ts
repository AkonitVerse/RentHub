import { OrderStatus, OrderSource } from '@prisma/client';

/**
 * Канонические события системы. Провайдеры решают, как доставлять.
 *
 * Формат payload — плоский, без ссылок на Prisma-модели целиком,
 * чтобы не утечь чувствительные поля (passwordHash и т.п.).
 */
export type NotificationEvent =
  | InquiryReceivedEvent
  | OrderCreatedEvent
  | OrderStatusChangedEvent
  | OrderOverdueEvent
  | OrderReturnReminderEvent
  | OrderExtendedEvent
  | PasswordResetCodeEvent
  | EmailVerificationCodeEvent
  | DailyOpsBriefEvent;

export interface InquiryReceivedEvent {
  type: 'INQUIRY_RECEIVED';
  /** Аудитория события: STAFF — менеджеры, CLIENT — оригинальный клиент. */
  audience: 'STAFF';
  orderId: number;
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  inquiryNote?: string | null;
  equipmentName?: string | null;
}

export interface OrderCreatedEvent {
  type: 'ORDER_CREATED';
  audience: 'STAFF';
  orderId: number;
  orderNumber: string;
  source: OrderSource;
  clientName: string;
  totalAmount: number;
  fromDate?: string | null;
  toDate?: string | null;
}

export interface OrderStatusChangedEvent {
  type: 'ORDER_STATUS_CHANGED';
  audience: 'CLIENT';
  orderId: number;
  orderNumber: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  clientEmail?: string | null;
  clientName: string;
}

export interface OrderOverdueEvent {
  type: 'ORDER_OVERDUE';
  audience: 'CLIENT' | 'STAFF';
  orderId: number;
  orderNumber: string;
  clientEmail?: string | null;
  clientName: string;
  toDate: string;
}

/** Напоминание клиенту: до возврата остался 1 день. */
export interface OrderReturnReminderEvent {
  type: 'ORDER_RETURN_REMINDER';
  audience: 'CLIENT';
  orderId: number;
  orderNumber: string;
  clientEmail?: string | null;
  clientName: string;
  /** ISO-дата возврата (toDate). */
  toDate: string;
  daysLeft: number;
}

/**
 * Утренняя сводка для менеджеров: сколько сегодня выдач/возвратов/просрочек.
 * Шлётся раз в день staff-аудитории.
 */
export interface DailyOpsBriefEvent {
  type: 'DAILY_OPS_BRIEF';
  audience: 'STAFF';
  date: string; // ISO yyyy-mm-dd
  pickupsCount: number;
  returnsCount: number;
  overdueCount: number;
}

export interface OrderExtendedEvent {
  type: 'ORDER_EXTENDED';
  audience: 'CLIENT';
  orderId: number;
  orderNumber: string;
  addedDays: number;
  addedAmount: number;
  newToDate: string;
  clientEmail?: string | null;
  clientName: string;
}

/**
 * Восстановление пароля: 6-значный одноразовый код, который надо отправить
 * на email пользователя. Валиден 15 минут.
 */
export interface PasswordResetCodeEvent {
  type: 'PASSWORD_RESET_CODE';
  audience: 'CLIENT';
  /** Email получателя (target адрес — провайдер использует напрямую). */
  clientEmail: string;
  clientName: string;
  /** Незахэшированный 6-значный код для содержимого письма. */
  code: string;
  /** Срок действия кода в минутах. */
  ttlMinutes: number;
}

/**
 * Подтверждение email при регистрации: 6-значный одноразовый код,
 * приходит на email будущего пользователя. После ввода кода в форму
 * `/verify-email` создаётся реальный User в БД и выдаётся JWT.
 *
 * До подтверждения в БД нет записи в `users` — данные регистрации
 * хранятся в `pending_registrations` и автоматически очищаются через 15 минут.
 */
export interface EmailVerificationCodeEvent {
  type: 'EMAIL_VERIFICATION_CODE';
  audience: 'CLIENT';
  clientEmail: string;
  clientName: string;
  code: string;
  ttlMinutes: number;
}
