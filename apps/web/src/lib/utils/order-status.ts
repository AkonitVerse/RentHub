import type { OrderStatus, OrderSource } from '../api/types';

/**
 * Зеркало серверной матрицы переходов из
 * apps/api/src/modules/orders/order-status.machine.ts.
 *
 * Используется для:
 * - фильтрации селекта статусов в OrderDetailPage,
 * - блокировки drag-n-drop колонок в канбане OrdersListPage.
 *
 * Сервер всё равно валидирует переход — это удобство UI.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'DRAFT', 'CANCELLED'],
  CONFIRMED: ['ACTIVE', 'PENDING', 'CANCELLED'],
  ACTIVE: ['OVERDUE', 'DONE'],
  OVERDUE: ['ACTIVE', 'DONE'],
  DONE: [],
  CANCELLED: [],
};

export function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return [...ALLOWED_TRANSITIONS[current]];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Черновик',
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждён',
  ACTIVE: 'В аренде',
  OVERDUE: 'Просрочен',
  DONE: 'Завершён',
  CANCELLED: 'Отменён',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: 'Создан в админке',
  WEB_CART: 'С корзины витрины',
  WEB_INQUIRY: 'Заявка с витрины',
};

/** Цвета для бейджей и колонок канбана (Tailwind-классы). */
export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  DONE: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  CANCELLED: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
};

/**
 * Порядок колонок канбана. CANCELLED показывается отдельно (в конце или скрытый).
 */
export const KANBAN_COLUMNS: OrderStatus[] = [
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'OVERDUE',
  'DONE',
];
