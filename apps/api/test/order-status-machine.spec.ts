import { describe, it, expect } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  assertReadyForPending,
  getAllowedNextStatuses,
} from '../src/modules/orders/order-status.machine';

describe('Order status machine', () => {
  describe('assertTransition', () => {
    it('переход в тот же статус — no-op', () => {
      expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.PENDING)).not.toThrow();
    });

    it('DRAFT → PENDING разрешён', () => {
      expect(() => assertTransition(OrderStatus.DRAFT, OrderStatus.PENDING)).not.toThrow();
    });

    it('DRAFT → CONFIRMED запрещён (нужно сначала PENDING)', () => {
      expect(() => assertTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED)).toThrow(
        /Запрещён переход/,
      );
    });

    it('PENDING → CONFIRMED разрешён', () => {
      expect(() => assertTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).not.toThrow();
    });

    it('CONFIRMED → ACTIVE разрешён', () => {
      expect(() => assertTransition(OrderStatus.CONFIRMED, OrderStatus.ACTIVE)).not.toThrow();
    });

    it('ACTIVE → DRAFT запрещён (нельзя откатить выданный заказ)', () => {
      expect(() => assertTransition(OrderStatus.ACTIVE, OrderStatus.DRAFT)).toThrow(
        /Запрещён переход/,
      );
    });

    it('ACTIVE → CANCELLED запрещён (выданный нельзя отменить)', () => {
      expect(() => assertTransition(OrderStatus.ACTIVE, OrderStatus.CANCELLED)).toThrow(
        /Запрещён переход/,
      );
    });

    it('OVERDUE → ACTIVE разрешён (продление снимает просрочку)', () => {
      expect(() => assertTransition(OrderStatus.OVERDUE, OrderStatus.ACTIVE)).not.toThrow();
    });

    it('OVERDUE → DONE разрешён', () => {
      expect(() => assertTransition(OrderStatus.OVERDUE, OrderStatus.DONE)).not.toThrow();
    });

    it('DONE — терминальный статус', () => {
      expect(() => assertTransition(OrderStatus.DONE, OrderStatus.PENDING)).toThrow();
      expect(() => assertTransition(OrderStatus.DONE, OrderStatus.ACTIVE)).toThrow();
      expect(() => assertTransition(OrderStatus.DONE, OrderStatus.CANCELLED)).toThrow();
    });

    it('CANCELLED — терминальный статус', () => {
      expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toThrow();
      expect(() => assertTransition(OrderStatus.CANCELLED, OrderStatus.DRAFT)).toThrow();
    });

    it('сообщение об ошибке содержит список разрешённых переходов', () => {
      try {
        assertTransition(OrderStatus.DRAFT, OrderStatus.ACTIVE);
        expect.fail('должно было упасть');
      } catch (e: any) {
        expect(e.message).toContain('PENDING');
        expect(e.message).toContain('CANCELLED');
      }
    });
  });

  describe('getAllowedNextStatuses', () => {
    it('возвращает копию массива, не оригинал', () => {
      const allowed = getAllowedNextStatuses(OrderStatus.DRAFT);
      allowed.push(OrderStatus.ACTIVE);
      expect(ALLOWED_TRANSITIONS.DRAFT).not.toContain(OrderStatus.ACTIVE);
    });

    it('для DRAFT возвращает [PENDING, CANCELLED]', () => {
      expect(getAllowedNextStatuses(OrderStatus.DRAFT).sort()).toEqual(
        [OrderStatus.CANCELLED, OrderStatus.PENDING].sort(),
      );
    });

    it('для DONE возвращает пустой массив', () => {
      expect(getAllowedNextStatuses(OrderStatus.DONE)).toEqual([]);
    });
  });

  describe('assertReadyForPending', () => {
    it('проходит при заполненных полях', () => {
      expect(() =>
        assertReadyForPending({
          fromDate: new Date(),
          toDate: new Date(),
          contactPhone: '+71234567890',
          linesCount: 1,
        }),
      ).not.toThrow();
    });

    it('падает без дат', () => {
      expect(() =>
        assertReadyForPending({
          fromDate: null,
          toDate: null,
          contactPhone: '+71234567890',
          linesCount: 1,
        }),
      ).toThrow(/даты/);
    });

    it('падает без позиций', () => {
      expect(() =>
        assertReadyForPending({
          fromDate: new Date(),
          toDate: new Date(),
          contactPhone: '+71234567890',
          linesCount: 0,
        }),
      ).toThrow(/позиция/);
    });

    it('падает без телефона', () => {
      expect(() =>
        assertReadyForPending({
          fromDate: new Date(),
          toDate: new Date(),
          contactPhone: '',
          linesCount: 1,
        }),
      ).toThrow(/телефон/);
    });

    it('собирает все ошибки в одно сообщение', () => {
      try {
        assertReadyForPending({
          fromDate: null,
          toDate: null,
          contactPhone: '',
          linesCount: 0,
        });
        expect.fail('должно было упасть');
      } catch (e: any) {
        expect(e.message).toContain('даты');
        expect(e.message).toContain('телефон');
        expect(e.message).toContain('позиция');
      }
    });
  });
});
