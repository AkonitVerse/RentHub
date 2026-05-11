import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ArrowLeft, ShoppingBag, MessageSquare, Check, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAddCartLine, useEquipment } from '@/lib/hooks/queries';
import { fmtRub, fmtDays } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { apiErrorMessage } from '@/lib/api/client';

const MAX_RENTAL_DAYS = 365;

export function EquipmentDetailPage() {
  const { id } = useParams();
  const equipmentId = Number(id);
  // refetchOnWindowFocus + refetchInterval — учёт того, что доступность меняется
  // в реальном времени (другой клиент мог зарезервировать пока пользователь смотрел карточку).
  const { data: equipment, isLoading } = useEquipment(equipmentId);

  const addLine = useAddCartLine();
  const [days, setDays] = useState<number>(1);
  // selectedTierId хранится отдельно, но при изменении дней синхронизируется с подходящим тиром
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);

  const sortedPrices = useMemo(
    () => [...(equipment?.prices ?? [])].sort((a, b) => (a.tier?.rank ?? 0) - (b.tier?.rank ?? 0)),
    [equipment?.prices],
  );

  const tier1 = sortedPrices.find((p) => p.tier?.rank === 1);

  // Тариф, в который попадают дни
  const matchedPrice =
    sortedPrices.find(
      (p) => p.tier && days >= p.tier.minDays && (p.tier.maxDays == null || days <= p.tier.maxDays),
    ) ?? null;

  // Двусторонняя синхронизация: при изменении days обнуляем ручной выбор тарифа,
  // если фактически попали в другой тариф (чтобы подсветка соответствовала реальности).
  useEffect(() => {
    if (selectedTierId !== null && matchedPrice && selectedTierId !== matchedPrice.id) {
      setSelectedTierId(null);
    }
  }, [days, selectedTierId, matchedPrice]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-[4/3]" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="text-center py-20">
        <p className="text-text-2">Карточка не найдена</p>
      </div>
    );
  }

  const photos = (equipment.photos ?? []) as string[];

  const selectedPrice = sortedPrices.find((p) => p.id === selectedTierId) ?? matchedPrice;
  const effectivePrice = selectedPrice?.pricePerDay ?? tier1?.pricePerDay ?? 0;

  // Если кликнули по тарифу — выставляем дни в его minDays (двусторонняя связь).
  const handlePickTier = (priceId: number, minDays: number) => {
    if (selectedTierId === priceId) {
      // повторный клик снимает выбор
      setSelectedTierId(null);
      return;
    }
    setSelectedTierId(priceId);
    setDays(minDays);
  };

  const tierTotal = (price: (typeof sortedPrices)[number]) => {
    if (!price.tier) return { amount: 0, days: 0, isOpen: false };
    const d = price.tier.maxDays ?? price.tier.minDays;
    return { amount: price.pricePerDay * d, days: d, isOpen: price.tier.maxDays === null };
  };

  // Минимальная и максимальная цена аренды (тир 1 за minDays и последний тир за maxDays || 30).
  const minTier = sortedPrices[0];
  const maxTier = sortedPrices[sortedPrices.length - 1];
  const priceRangeMin = minTier && minTier.tier ? minTier.pricePerDay * minTier.tier.minDays : 0;
  const priceRangeMax =
    maxTier && maxTier.tier ? maxTier.pricePerDay * (maxTier.tier.maxDays ?? 30) : 0;

  const totalForDays = effectivePrice * Math.max(1, days);
  const availableUnits = equipment.availableUnits ?? 0;
  const totalUnits = equipment.totalUnits ?? equipment._count?.warehouseItems ?? 0;
  const lowStock = availableUnits > 0 && availableUnits <= 2;

  const handleAddToCart = async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + Math.max(1, days));
    try {
      await addLine.mutateAsync({
        catalogItemId: equipment.id,
        qty: 1,
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
      });
      toast.success('Добавлено в корзину');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Не удалось добавить'));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/catalog">
          <ArrowLeft className="size-4" /> К каталогу
        </Link>
      </Button>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12">
        {/* === GALLERY === */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-surface-2 to-surface-3 overflow-hidden border relative">
            {photos[0] ? (
              <img
                src={photos[0]}
                alt={equipment.name}
                className="absolute inset-0 w-full h-full object-contain p-2"
              />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <Package className="size-32 text-text-4" strokeWidth={1.2} />
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photos.slice(0, 8).map((p) => (
                <div
                  key={p}
                  className="aspect-square rounded-lg bg-surface-2 overflow-hidden relative"
                >
                  <img
                    src={p}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain p-1"
                  />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* === INFO === */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          {equipment.category && (
            <Link to={`/catalog/${equipment.category.slug}`}>
              <Badge variant="outline">{equipment.category.name}</Badge>
            </Link>
          )}
          <div className="text-xs font-mono text-text-3 mt-3 uppercase tracking-wide">
            {equipment.sku}
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight mt-2">
            {equipment.name}
          </h1>

          <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-medium',
                availableUnits === 0 && 'text-status-overdue',
                lowStock && 'text-amber-600',
                availableUnits > 2 && 'text-emerald-600',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  availableUnits === 0
                    ? 'bg-status-overdue'
                    : lowStock
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
              />
              {availableUnits === 0
                ? 'Сейчас занято полностью'
                : `Доступно: ${availableUnits} из ${totalUnits} ед.`}
              {lowStock && ' — заканчиваются'}
            </span>
            {equipment.deposit > 0 && (
              <span className="text-text-3">· Залог {fmtRub(equipment.deposit)}</span>
            )}
          </div>

          {/* Диапазон цены сразу — до выбора тарифа */}
          {priceRangeMin > 0 && priceRangeMax > priceRangeMin && (
            <div className="mt-3 text-xs text-text-3">
              Аренда от <span className="font-semibold text-text-2">{fmtRub(priceRangeMin)}</span>{' '}
              (короткий срок) до{' '}
              <span className="font-semibold text-text-2">{fmtRub(priceRangeMax)}</span> (длинный
              срок)
            </div>
          )}

          <div className="mt-6 p-5 rounded-xl border bg-surface-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display font-bold text-3xl price">
                {fmtRub(effectivePrice)}
              </span>
              <span className="text-text-2">/ сутки</span>
              {selectedPrice &&
                selectedPrice.tier &&
                (() => {
                  const { amount, days: tierDays, isOpen } = tierTotal(selectedPrice);
                  return (
                    <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-blue-soft text-blue font-semibold">
                      {isOpen ? 'от ' : ''}
                      {fmtRub(amount)} за {fmtDays(tierDays)}
                    </span>
                  );
                })()}
            </div>

            {sortedPrices.length > 0 && (
              <>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="text-xs text-text-3 uppercase tracking-wide">
                    Тариф по сроку аренды
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <label
                      htmlFor="days-input"
                      className="text-text-3 inline-flex items-center gap-1"
                    >
                      <Calendar className="size-3" /> Дней:
                    </label>
                    <input
                      id="days-input"
                      type="number"
                      min={1}
                      max={MAX_RENTAL_DAYS}
                      value={days}
                      onChange={(e) =>
                        setDays(Math.min(MAX_RENTAL_DAYS, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="w-20 rounded border bg-surface px-2 py-1 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Подсказка о действующем тарифе */}
                {matchedPrice?.tier && (
                  <div className="mt-2 text-xs text-text-3">
                    Для {fmtDays(days)} применяется{' '}
                    <span className="font-semibold text-text-2">
                      тариф {matchedPrice.tier.rank}
                    </span>
                    {' · '}
                    <span className="font-mono">{fmtRub(matchedPrice.pricePerDay)}/сут</span>
                    {' · '}итого{' '}
                    <span className="font-semibold text-text">{fmtRub(totalForDays)}</span>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {sortedPrices.map((price) => {
                    if (!price.tier) return null;
                    const tier = price.tier;
                    const isMatched = matchedPrice?.id === price.id;
                    const isSelected = selectedTierId === price.id;
                    // Хайлайтим автоматически выбранный тариф (по дням), если ручного выбора нет
                    const isHighlighted = isSelected || (selectedTierId === null && isMatched);
                    return (
                      <button
                        key={price.id}
                        type="button"
                        onClick={() => handlePickTier(price.id, tier.minDays)}
                        title={`Кликните, чтобы установить дней = ${tier.minDays}`}
                        className={cn(
                          'relative rounded-lg p-3 border text-left transition-all cursor-pointer',
                          'hover:border-blue/60 hover:bg-blue-soft/40 active:scale-[0.98]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40',
                          isHighlighted
                            ? 'border-blue bg-blue-soft ring-2 ring-blue/30'
                            : 'border-border bg-surface',
                        )}
                      >
                        {isHighlighted && (
                          <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-blue text-white grid place-items-center">
                            <Check className="size-3" strokeWidth={3} />
                          </div>
                        )}
                        <div className="text-xs text-text-3">
                          {tier.minDays}
                          {tier.maxDays ? `–${tier.maxDays}` : '+'} сут
                        </div>
                        <div className="font-display font-bold text-lg price">
                          {fmtRub(price.pricePerDay)}
                        </div>
                        {tier.note && (
                          <div className="text-xs text-status-active mt-0.5">{tier.note}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleAddToCart}
              disabled={addLine.isPending || availableUnits === 0}
            >
              <ShoppingBag className="size-5" />
              {availableUnits === 0 ? 'Нет в наличии' : 'Добавить в корзину'}
            </Button>
            <Button asChild size="lg" variant="outline" className="flex-1">
              <Link to={`/contact?equipmentId=${equipment.id}`}>
                <MessageSquare className="size-5" /> Запросить аренду
              </Link>
            </Button>
          </div>

          <Tabs defaultValue="specs" className="mt-8">
            <TabsList>
              <TabsTrigger value="specs">Характеристики</TabsTrigger>
              <TabsTrigger value="description">Описание</TabsTrigger>
            </TabsList>
            <TabsContent value="specs">
              {equipment.specs && Object.keys(equipment.specs).length > 0 ? (
                <dl className="rounded-xl border divide-y bg-surface">
                  {Object.entries(equipment.specs).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 px-4 py-3">
                      <dt className="text-sm text-text-2">{k}</dt>
                      <dd className="text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-text-3">Характеристики не указаны</p>
              )}
            </TabsContent>
            <TabsContent value="description">
              <p className="text-sm text-text-2 leading-relaxed whitespace-pre-line">
                {equipment.fullDesc ?? equipment.description}
              </p>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
