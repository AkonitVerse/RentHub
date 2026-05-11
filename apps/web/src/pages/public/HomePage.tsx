import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Truck,
  ShieldCheck,
  Clock,
  CreditCard,
  ArrowRight,
  ArrowUpRight,
  Package,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon } from '@/components/ui/LucideIcon';
import {
  useAddCartLine,
  useCategories,
  useEquipmentList,
  useOrgContact,
} from '@/lib/hooks/queries';
import { fmtRub } from '@/lib/utils/format';
import { formatPhoneInput } from '@/lib/utils/phone';
import type { Equipment } from '@/lib/api/types';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/client';

function eqPhoto(eq: Equipment): string | null {
  const arr = (eq.photos ?? []) as string[];
  return arr[0] ?? null;
}

function eqBasePrice(eq: Equipment): number {
  return eq.prices?.find((p) => p.tier?.rank === 1)?.pricePerDay ?? 0;
}

const FEATURES = [
  {
    Icon: Truck,
    title: 'Доставка по городу',
    desc: 'Привезём в день заказа собственным транспортом',
  },
  { Icon: Clock, title: 'Гибкие сроки', desc: 'От одного дня до нескольких месяцев' },
  {
    Icon: ShieldCheck,
    title: 'Гарантия исправности',
    desc: 'Каждая единица проходит проверку перед выдачей',
  },
  {
    Icon: CreditCard,
    title: 'Удобная оплата',
    desc: 'Наличные или картой при получении',
  },
];

// Иконка категории берётся из её поля `icon` (Lucide-имя, выбранное в админке).
// Если пусто — fallback на универсальный Wrench. Слаги больше не маппятся жёстко.

export function HomePage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: popular, isLoading } = useEquipmentList({ limit: 8 });
  // Отдельный запрос для hero — берём только isFeatured карточки.
  // Если делать общий list, при попадании featured за края лимита (например
  // limit=8 и featured лежат на 9-12 позициях) hero показывал бы 2 вместо 3.
  const { data: featuredData } = useEquipmentList({ isFeatured: true, limit: 6 });
  const { data: orgContact } = useOrgContact();
  const orgPhoneFormatted = orgContact?.orgPhone
    ? formatPhoneInput(orgContact.orgPhone).trim()
    : '';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/catalog?search=${encodeURIComponent(search)}`);
  };

  // Витринные карточки для hero: до 3 рекомендованных (isFeatured) из
  // отдельного запроса (гарантирует что мы их найдём, даже если в общем
  // списке popular они вне первых N). Если featured нет — fallback на
  // топ по rating из popular.
  const featured = (featuredData?.items ?? []).slice(0, 3);
  const fallback = (popular?.items ?? [])
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3);
  const showcase = (featured.length > 0 ? featured : fallback) as NonNullable<
    typeof popular
  >['items'];

  return (
    <div className="space-y-10 lg:space-y-14">
      {/* === HERO === */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        {/* Технический grid-pattern на заднем фоне */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 70% 40%, black 30%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 70% at 70% 40%, black 30%, transparent 80%)',
          }}
        />
        {/* Точечный паттерн поверх */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.7]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--color-border-2) 1px, transparent 0)',
            backgroundSize: '32px 32px',
            maskImage:
              'linear-gradient(to bottom right, transparent 30%, black 70%, transparent 95%)',
            WebkitMaskImage:
              'linear-gradient(to bottom right, transparent 30%, black 70%, transparent 95%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 lg:pt-20 pb-12 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[64px] text-text leading-[1.02] tracking-tight">
                Аренда оборудования.
                <br />
                <span className="text-text-2">Просто, прозрачно, удобно.</span>
              </h1>
              <p className="mt-6 text-base lg:text-lg text-text-2 max-w-xl leading-relaxed">
                Выбираете нужное в каталоге, указываете даты — менеджер подтвердит наличие и
                рассчитает точную стоимость. Самовывоз или доставка, оплата при получении.
              </p>

              <form onSubmit={handleSearch} className="mt-8 flex gap-2 max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-text-3" />
                  <Input
                    className="h-12 pl-10 pr-4 bg-surface text-base"
                    placeholder="Найти оборудование..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" className="px-6">
                  Подобрать
                </Button>
              </form>
            </motion.div>

            {/* === Витрина: стопка карточек оборудования === */}
            <div className="relative h-[420px] lg:h-[480px] hidden md:block">
              {showcase.map((eq, idx) => {
                const cat = categories?.find((c) => c.id === eq.categoryId);
                const positions = [
                  { x: -40, y: -30, rotate: -6, scale: 0.82, z: 1 },
                  { x: 30, y: 30, rotate: 4, scale: 0.9, z: 2 },
                  { x: -20, y: 80, rotate: -2, scale: 1, z: 3 },
                ];
                const p = positions[idx];
                return (
                  <motion.div
                    key={eq.id}
                    initial={{ opacity: 0, y: 30, rotate: 0 }}
                    animate={{
                      opacity: 1,
                      x: p.x,
                      y: p.y,
                      rotate: p.rotate,
                      scale: p.scale,
                    }}
                    transition={{ delay: 0.1 + idx * 0.15, type: 'spring', stiffness: 80 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 lg:w-80"
                    style={{ zIndex: p.z }}
                  >
                    <ShowcaseCard
                      equipment={eq}
                      iconName={cat?.icon ?? null}
                      categoryName={cat?.name}
                      live={idx === 2}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile-витрина: одна карточка */}
            {showcase[0] && (
              <div className="md:hidden">
                <ShowcaseCard
                  equipment={showcase[0]}
                  iconName={categories?.find((c) => c.id === showcase[0].categoryId)?.icon ?? null}
                  categoryName={categories?.find((c) => c.id === showcase[0].categoryId)?.name}
                  live
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === ПРЕИМУЩЕСТВА — компактный баннер === */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border border border-border rounded-xl bg-surface overflow-hidden">
          {[
            { title: 'Каталог онлайн', desc: 'Доступность и цены — сразу', Icon: Package },
            { title: 'Гибкие сроки', desc: 'От одного дня до месяца', Icon: Clock },
            { title: 'Самовывоз / доставка', desc: 'На выбор клиента', Icon: Truck },
            { title: 'Оплата при выдаче', desc: 'Наличные или картой', Icon: CreditCard },
          ].map((s) => (
            <div key={s.title} className="p-5 lg:p-6 relative">
              <s.Icon className="absolute top-5 right-5 size-4 text-text-4" strokeWidth={1.6} />
              <div className="font-display font-semibold text-base lg:text-lg text-text leading-tight pr-8">
                {s.title}
              </div>
              <div className="text-xs lg:text-sm text-text-3 mt-1.5 leading-snug">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10 lg:space-y-14">
        {/* === КАТЕГОРИИ === */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-text-3 mb-1.5">
                01 — Каталог
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-text">
                Категории оборудования
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/catalog">
                Все категории <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {categories?.map((cat) => {
              return (
                <Link
                  key={cat.id}
                  to={`/catalog/${cat.slug}`}
                  className="group relative bg-surface p-5 hover:bg-surface-2 transition-colors"
                >
                  <LucideIcon
                    name={cat.icon}
                    className="size-6 text-text-2 group-hover:text-text transition-colors"
                    strokeWidth={1.6}
                  />
                  <div className="mt-4 font-medium text-sm text-text">{cat.name}</div>
                  <div className="mt-1 text-xs text-text-3 font-mono">
                    {cat._count?.catalogItems ?? 0} позиций
                  </div>
                  <ArrowUpRight className="absolute top-4 right-4 size-4 text-text-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* === ПОПУЛЯРНОЕ === */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-text-3 mb-1.5">
                02 — Популярное
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-text">
                В аренду чаще всего
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/catalog">
                Весь каталог <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {popular?.items.slice(0, 8).map((eq, idx) => {
                const cat = categories?.find((c) => c.id === eq.categoryId);
                return (
                  <motion.div
                    key={eq.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  >
                    <ProCard equipment={eq} iconName={cat?.icon ?? null} categoryName={cat?.name} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* === ПРЕИМУЩЕСТВА === */}
        <section>
          <div className="mb-5">
            <div className="text-xs font-mono uppercase tracking-wider text-text-3 mb-1.5">
              03 — Условия
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-text">
              Как мы работаем
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {FEATURES.map(({ Icon, title, desc }, idx) => (
              <div key={title} className="bg-surface p-6">
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-mono text-xs text-text-4">0{idx + 1}</span>
                  <Icon className="size-5 text-text-2" strokeWidth={1.6} />
                </div>
                <h3 className="font-display font-semibold text-base">{title}</h3>
                <p className="text-sm text-text-2 mt-2 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* === CTA === */}
        <section className="relative overflow-hidden rounded-2xl bg-blue text-white p-8 sm:p-12 lg:p-16">
          <div className="relative grid lg:grid-cols-[1.5fr_1fr] gap-8 items-end">
            <div className="max-w-xl">
              <div className="text-xs font-mono uppercase tracking-wider text-white/60 mb-3">
                Готовы оформить аренду
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl leading-[1.05] tracking-tight">
                Подберём оборудование под&nbsp;вашу задачу
              </h2>
              <p className="mt-4 text-white/75 text-base lg:text-lg max-w-md">
                Оставьте заявку — менеджер свяжется в&nbsp;течение 30 минут, уточнит сроки
                и&nbsp;подскажет оптимальный тариф.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
              <Button asChild size="lg" className="bg-white text-[#0f172a] hover:bg-white/90">
                <Link to="/contact">
                  Оставить заявку <ArrowRight className="size-4" />
                </Link>
              </Button>
              {orgPhoneFormatted && (
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white border border-white/20"
                >
                  <a href={`tel:${orgContact?.orgPhone ?? ''}`}>
                    <Phone className="size-4" /> {orgPhoneFormatted}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// === Витринная карточка для hero (компактная, без CTA) ===
function ShowcaseCard({
  equipment,
  iconName,
  categoryName,
}: {
  equipment: Equipment;
  iconName: string | null;
  categoryName?: string;
  live?: boolean;
}) {
  const photo = eqPhoto(equipment);
  const price = eqBasePrice(equipment);
  return (
    <Link
      to={`/equipment/${equipment.id}`}
      className="block bg-surface border border-border rounded-xl shadow-card overflow-hidden hover:shadow-card-hover hover:border-border-2 transition-all"
    >
      <div className="relative aspect-[16/10] bg-surface-2 border-b border-border overflow-hidden">
        {photo ? (
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <LucideIcon name={iconName} className="size-20 text-text-4" strokeWidth={1.1} />
          </div>
        )}
        {categoryName && (
          <div className="absolute top-3 right-3 bg-surface/95 backdrop-blur-sm border border-border rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide text-text-2">
            {categoryName}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="font-mono text-[10px] text-text-3 uppercase tracking-wide">
          {equipment.sku}
        </div>
        <div className="font-display font-semibold text-base leading-snug mt-1 line-clamp-2">
          {equipment.name}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wide">от</div>
            <div className="font-display font-bold text-lg leading-none mt-0.5 price">
              {fmtRub(price)}
            </div>
          </div>
          <div className="text-[10px] text-text-3 font-mono">в&nbsp;сутки</div>
        </div>
      </div>
    </Link>
  );
}

// === Карточка оборудования: строгая, без декора ===
function ProCard({
  equipment,
  iconName,
  categoryName,
}: {
  equipment: Equipment;
  iconName: string | null;
  categoryName?: string;
}) {
  const photo = eqPhoto(equipment);
  const price = eqBasePrice(equipment);
  const addLine = useAddCartLine();

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    try {
      await addLine.mutateAsync({
        catalogItemId: equipment.id,
        qty: 1,
        fromDate: from.toISOString(),
        toDate: to.toISOString(),
      });
      toast.success('Добавлено в заявку');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Не удалось добавить'));
    }
  };

  return (
    <Link
      to={`/equipment/${equipment.id}`}
      className="group h-full flex flex-col bg-surface border border-border rounded-xl overflow-hidden hover:border-border-2 transition-colors"
    >
      {/* Изображение / иконка */}
      <div className="relative aspect-[4/3] bg-surface-2 border-b border-border overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={equipment.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <LucideIcon name={iconName} className="size-16 text-text-4" strokeWidth={1.2} />
          </div>
        )}
        {categoryName && (
          <div className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 bg-surface/95 backdrop-blur-sm rounded text-[10px] font-mono uppercase tracking-wide text-text-2 border border-border">
            {categoryName}
          </div>
        )}
      </div>

      {/* Инфо */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="font-mono text-[10px] text-text-3 uppercase tracking-wide">
          {equipment.sku}
        </div>
        <h3 className="font-display font-semibold text-base leading-snug mt-1 line-clamp-2 min-h-[2.6rem]">
          {equipment.name}
        </h3>
        <div className="text-xs text-text-3 mt-1 line-clamp-1">{equipment.description}</div>

        <div className="mt-auto pt-4 flex items-end justify-between gap-2 border-t border-border mt-3">
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wide">от</div>
            <div className="font-display font-bold text-lg leading-none mt-1 price">
              {fmtRub(price)}
            </div>
            <div className="text-[10px] text-text-3 mt-1">в сутки</div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={addLine.isPending}>
            В заявку
          </Button>
        </div>
      </div>
    </Link>
  );
}
