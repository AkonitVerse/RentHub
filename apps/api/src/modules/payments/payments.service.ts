import { Injectable, NotFoundException } from '@nestjs/common';
import { Payment, PaymentKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto } from './dto/payment.dto';

export interface OrderPaymentsSummary {
  payments: Payment[];
  /** Сумма зачёта по аренде (CHARGE − REFUND-charge). */
  paidCharge: number;
  /** Сумма залога (DEPOSIT − REFUND-deposit). */
  paidDeposit: number;
  /** Положительный остаток к доплате (totalAmount + deposit − поступления). */
  remaining: number;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrder(orderId: number): Promise<OrderPaymentsSummary> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalAmount: true, deposit: true },
    });
    if (!order) throw new NotFoundException(`Заказ ${orderId} не найден`);

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { paidAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    const paidCharge =
      sumByKind(payments, [PaymentKind.CHARGE]) - sumRefundsFor(payments, 'charge');
    const paidDeposit =
      sumByKind(payments, [PaymentKind.DEPOSIT]) - sumRefundsFor(payments, 'deposit');
    const owed = order.totalAmount + order.deposit;
    const totalIn = paidCharge + paidDeposit;
    const remaining = Math.max(0, owed - totalIn);

    return { payments, paidCharge, paidDeposit, remaining };
  }

  async create(orderId: number, dto: CreatePaymentDto, userId: number | null): Promise<Payment> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Заказ ${orderId} не найден`);

    return this.prisma.payment.create({
      data: {
        orderId,
        amount: dto.amount,
        method: dto.method,
        kind: dto.kind ?? PaymentKind.CHARGE,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        note: dto.note,
        createdById: userId,
      },
    });
  }

  async remove(paymentId: number): Promise<{ ok: true }> {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new NotFoundException(`Платёж ${paymentId} не найден`);
    await this.prisma.payment.delete({ where: { id: paymentId } });
    return { ok: true };
  }
}

function sumByKind(payments: Payment[], kinds: PaymentKind[]): number {
  return payments.filter((p) => kinds.includes(p.kind)).reduce((s, p) => s + p.amount, 0);
}

/**
 * REFUND — возврат денег клиенту. По смыслу относится либо к charge, либо к depositу.
 * Простоты ради: REFUND с пометкой в note 'deposit' уменьшает paidDeposit, иначе — paidCharge.
 * Можно расширить отдельным enum-ом позднее.
 */
function sumRefundsFor(payments: Payment[], target: 'charge' | 'deposit'): number {
  return payments
    .filter((p) => p.kind === PaymentKind.REFUND)
    .filter((p) => {
      const isDepositRefund = (p.note ?? '').toLowerCase().includes('deposit');
      return target === 'deposit' ? isDepositRefund : !isDepositRefund;
    })
    .reduce((s, p) => s + p.amount, 0);
}
