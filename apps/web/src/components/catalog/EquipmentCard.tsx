import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAddCartLine } from '@/lib/hooks/queries';
import { fmtRub } from '@/lib/utils/format';
import { apiErrorMessage } from '@/lib/api/client';
import type { Equipment } from '@/lib/api/types';

interface EquipmentCardProps {
  equipment: Equipment;
}

function basePrice(eq: Equipment): number {
  return eq.prices?.find((p) => p.tier?.rank === 1)?.pricePerDay ?? 0;
}

export function EquipmentCard({ equipment }: EquipmentCardProps) {
  const photo = ((equipment.photos ?? []) as string[])[0] ?? null;
  const price = basePrice(equipment);
  const addLine = useAddCartLine();
  const available = equipment.availableUnits ?? 0;

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
      toast.success('Добавлено в корзину');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Не удалось добавить'));
    }
  };

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      transition={{ type: 'tween', duration: 0.15 }}
      className="group rounded-xl border bg-surface overflow-hidden shadow-card hover:shadow-card-hover transition-shadow"
    >
      <Link to={`/equipment/${equipment.id}`} className="block">
        <div className="aspect-[4/3] bg-gradient-to-br from-surface-2 to-surface-3 relative overflow-hidden">
          {photo ? (
            <img
              src={photo}
              alt={equipment.name}
              className="absolute inset-0 w-full h-full object-contain p-1"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Package className="size-16 text-text-4" strokeWidth={1.2} />
            </div>
          )}
          {available > 0 && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium">
              <span className="size-1.5 rounded-full bg-status-active" />
              {available} в наличии
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-[10px] font-mono text-text-3 uppercase tracking-wide mb-1">
            {equipment.sku}
          </div>
          <h3 className="font-display font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">
            {equipment.name}
          </h3>
          <div className="text-xs text-text-2 mt-1.5 line-clamp-1">{equipment.description}</div>

          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <div className="text-[11px] text-text-3">от</div>
              <div className="font-display font-bold text-lg price">{fmtRub(price)}</div>
              <div className="text-[11px] text-text-3">в сутки</div>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={addLine.isPending}>
              В корзину
            </Button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
