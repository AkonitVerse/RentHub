import { useEffect } from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

/**
 * Глобальный Toaster. Поверх стандартной sonner-анимации:
 * при наведении на любое уведомление мы вызываем `toast.dismiss(id)` —
 * sonner сам прокручивает плавный fade-out. Это противоположно дефолтному
 * поведению (по hover sonner ставит автозакрытие на паузу), но именно так
 * хотел пользователь: «навёл курсор → уведомление сразу пропадает».
 *
 * Решение глобальное (через делегирование `pointerover`) — не требует
 * оборачивать каждый вызов `toast.*` отдельно.
 */
const Toaster = (props: ToasterProps) => {
  useEffect(() => {
    const handlePointerOver = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.('[data-sonner-toast]');
      if (!target) return;
      const id =
        target.getAttribute('data-id') ??
        target.getAttribute('data-sonner-toast-id') ??
        undefined;
      if (id) toast.dismiss(id);
      else toast.dismiss();
    };

    document.addEventListener('pointerover', handlePointerOver);
    return () => document.removeEventListener('pointerover', handlePointerOver);
  }, []);

  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-popover transition-opacity duration-150 hover:opacity-0',
          description: 'group-[.toast]:text-text-2',
          actionButton: 'group-[.toast]:bg-blue group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-surface-3 group-[.toast]:text-text-2',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
