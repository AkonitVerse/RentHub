import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * Матрица разрешённых переходов статусов заказа.
 *
 * DRAFT      — черновик (инквайри с витрины или незаполненный заказ)
 * PENDING    — оформлен, ждёт подтверждения
 * CONFIRMED  — подтверждён, единицы зарезервированы
 * ACTIVE     — выдан клиенту
 * OVERDUE    — срок возврата истёк
 * DONE       — все позиции возвращены
 * CANCELLED  — отменён
 *
 * Назад из ACTIVE/OVERDUE в более ранние статусы нельзя (склад уже выдан клиенту).
 * Из OVERDUE → ACTIVE возможно — это сценарий продления аренды задним числом.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.DRAFT, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.ACTIVE, OrderStatus.PENDING, OrderStatus.CANCELLED],
  ACTIVE: [OrderStatus.OVERDUE, OrderStatus.DONE],
  OVERDUE: [OrderStatus.ACTIVE, OrderStatus.DONE],
  DONE: [],
  CANCELLED: [],
};

/**
 * Возвращает массив статусов, в которые можно перейти из текущего.
 * Используется на фронте для фильтрации селектов и блокировки drag-n-drop.
 */
export function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return [...ALLOWED_TRANSITIONS[current]];
}

/**
 * Бросает 400, если переход запрещён. Переход в тот же статус — no-op.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    const allowedLabel = allowed.length > 0 ? allowed.join(', ') : '—';
    throw new BadRequestException(
      `Запрещён переход ${from} → ${to}. Разрешено из ${from}: ${allowedLabel}`,
    );
  }
}

/**
 * Требования к заполненности заказа для перехода из DRAFT.
 * DRAFT может быть с пустыми датами и без позиций (инквайри),
 * но для PENDING нужны даты, контакт и хотя бы одна позиция.
 */
export interface OrderReadinessSnapshot {
  fromDate: Date | null;
  toDate: Date | null;
  contactPhone: string;
  linesCount: number;
}

export function assertReadyForPending(snapshot: OrderReadinessSnapshot): void {
  const errors: string[] = [];
  if (!snapshot.fromDate || !snapshot.toDate) errors.push('даты аренды');
  if (!snapshot.contactPhone) errors.push('контактный телефон');
  if (snapshot.linesCount === 0) errors.push('хотя бы одна позиция');
  if (errors.length > 0) {
    throw new BadRequestException(`Не заполнено для подтверждения: ${errors.join(', ')}`);
  }
}
