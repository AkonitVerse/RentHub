import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ICONS, ICON_NAMES, LucideIcon } from '@/components/ui/LucideIcon';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** Текущее значение (имя иконки) или null. */
  value: string | null;
  /** Колбэк выбора. Передайте null для «без иконки». */
  onChange: (name: string | null) => void;
  /** Заголовок кнопки-триггера. По умолчанию — «Выбрать иконку». */
  triggerLabel?: string;
}

/**
 * Кнопка-триггер с превью текущей иконки + модалка с поиском по именам.
 *
 * Использование:
 *   <IconPicker value={form.icon} onChange={(name) => setForm({...form, icon: name})} />
 *
 * Список иконок ограничен курируемым набором в LucideIcon.tsx (~150 шт.) —
 * этого хватает для категорий каталога, и не раздувает bundle.
 */
export function IconPicker({ value, onChange, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_NAMES;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const handlePick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md border bg-surface hover:bg-surface-2 transition-colors text-left"
      >
        <div className="size-9 rounded-md bg-surface-2 grid place-items-center flex-shrink-0">
          <LucideIcon name={value} className="size-5 text-text" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {value ?? <span className="text-text-3">Иконка не выбрана</span>}
          </div>
          <div className="text-xs text-text-3">
            {triggerLabel ?? 'Кликните, чтобы выбрать иконку'}
          </div>
        </div>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="size-6 grid place-items-center text-text-3 hover:text-status-overdue rounded"
            title="Убрать иконку"
          >
            <X className="size-3.5" />
          </button>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Выбор иконки</DialogTitle>
            <DialogDescription>
              {ICON_NAMES.length} иконок из набора Lucide. Найдите по части имени (английский).
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-3" />
            <Input
              autoFocus
              placeholder="Поиск: hammer, drill, fire…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-[400px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center text-sm text-text-3 py-8">
                По запросу «{query}» ничего не найдено
              </div>
            ) : (
              filtered.map((name) => {
                const Icon = ICONS[name];
                const isActive = value === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handlePick(name)}
                    title={name}
                    className={cn(
                      'aspect-square rounded-md border grid place-items-center transition-all relative',
                      'hover:bg-blue-soft hover:border-blue/60',
                      isActive
                        ? 'bg-blue-soft border-blue ring-2 ring-blue/30'
                        : 'border-border bg-surface',
                    )}
                  >
                    <Icon className="size-5 text-text" strokeWidth={1.6} />
                    {isActive && (
                      <div className="absolute -top-1 -right-1 size-4 rounded-full bg-blue text-white grid place-items-center">
                        <Check className="size-2.5" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Без иконки
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
