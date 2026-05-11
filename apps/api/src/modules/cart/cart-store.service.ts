import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CartLine {
  catalogItemId: number;
  qty: number;
  fromDate: string; // ISO
  toDate: string; // ISO
  addedAt: string; // ISO
}

export interface CartData {
  sessionId: string;
  lines: CartLine[];
  updatedAt: string;
}

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней
const FALLBACK_MAX_ENTRIES = 5000;
const FALLBACK_TTL_MS = TTL_SECONDS * 1000;

interface FallbackEntry {
  data: CartData;
  expiresAt: number;
}

/**
 * Хранилище корзины. По умолчанию использует Redis (REDIS_URL),
 * на случай его недоступности падает на in-memory Map с TTL и LRU
 * (защита от утечки памяти при долгом отказе Redis).
 */
@Injectable()
export class CartStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(CartStoreService.name);
  private redis: Redis | null = null;
  // Map с insertion-order — для LRU достаточно delete+set при touch.
  private fallback = new Map<string, FallbackEntry>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      try {
        this.redis = new Redis(url, {
          maxRetriesPerRequest: 1,
          lazyConnect: false,
          enableOfflineQueue: false,
        });
        this.redis.on('error', (err) => {
          this.logger.warn(`Redis ошибка: ${err.message}. Использую in-memory хранилище.`);
        });
      } catch (err) {
        this.logger.warn(`Не удалось подключиться к Redis: ${(err as Error).message}`);
      }
    }
    // Каждый час чистим протухшие in-memory записи (если Redis недоступен)
    this.cleanupTimer = setInterval(() => this.cleanupFallback(), 60 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // ignore
      }
    }
  }

  private key(sessionId: string): string {
    return `cart:${sessionId}`;
  }

  private cleanupFallback(): void {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of this.fallback.entries()) {
      if (v.expiresAt <= now) {
        this.fallback.delete(k);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cart fallback: очищено ${removed} протухших записей`);
    }
  }

  private fallbackGet(sessionId: string): CartData | null {
    const entry = this.fallback.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.fallback.delete(sessionId);
      return null;
    }
    // LRU touch: переместить в конец Map
    this.fallback.delete(sessionId);
    this.fallback.set(sessionId, entry);
    return entry.data;
  }

  private fallbackSet(data: CartData): void {
    this.fallback.set(data.sessionId, {
      data,
      expiresAt: Date.now() + FALLBACK_TTL_MS,
    });
    // Простейший LRU eviction: если переполнено — выкидываем самые старые
    while (this.fallback.size > FALLBACK_MAX_ENTRIES) {
      const oldest = this.fallback.keys().next().value;
      if (oldest === undefined) break;
      this.fallback.delete(oldest);
    }
  }

  async get(sessionId: string): Promise<CartData> {
    if (this.redis && this.redis.status === 'ready') {
      const raw = await this.redis.get(this.key(sessionId));
      if (raw) {
        try {
          return JSON.parse(raw) as CartData;
        } catch {
          // повреждённые данные — пересоздадим
        }
      }
    } else {
      const cached = this.fallbackGet(sessionId);
      if (cached) return cached;
    }
    return { sessionId, lines: [], updatedAt: new Date().toISOString() };
  }

  async save(data: CartData): Promise<void> {
    data.updatedAt = new Date().toISOString();
    if (this.redis && this.redis.status === 'ready') {
      await this.redis.set(this.key(data.sessionId), JSON.stringify(data), 'EX', TTL_SECONDS);
    } else {
      this.fallbackSet(data);
    }
  }

  async clear(sessionId: string): Promise<void> {
    if (this.redis && this.redis.status === 'ready') {
      await this.redis.del(this.key(sessionId));
    } else {
      this.fallback.delete(sessionId);
    }
  }
}
