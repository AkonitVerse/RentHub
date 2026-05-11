import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ACCEPT_KEY = 'cookie-consent';
const ACCEPTED_VALUE = 'accepted-v1'; // версия — поднимем при изменении политики
const SESSION_DISMISS_KEY = 'cookie-banner-dismissed';

/**
 * Минималистичный cookie-баннер с двумя сценариями закрытия.
 *
 * - **«Понятно»** — пользователь подтвердил, что прочитал. Сохраняется в
 *   localStorage → баннер больше не появляется на этом устройстве (до смены
 *   версии политики или очистки данных браузера).
 * - **Крестик** — отложить уведомление. Сохраняется в sessionStorage → в этой
 *   вкладке/сессии баннер не возвращается, но при следующем визите появится снова.
 *
 * GDPR-стиль с категориями (необходимые / аналитика / маркетинг) намеренно не делаем:
 * у нас сессионная cookie корзины и refresh-токен — обе технически необходимы для
 * работы сайта. Аналитики и маркетинговых трекеров нет. Закон РФ (152-ФЗ +
 * рекомендации РКН) требует только информирования и возможности продолжить
 * пользоваться сайтом — что и обеспечивает простое уведомление.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Чтение хранилищ делаем после монтирования, чтобы избежать SSR-mismatch.
    try {
      // 1. Постоянное согласие — приоритет. Если пользователь когда-то нажал
      //    «Понятно» — больше не показываем никогда (до смены версии политики).
      if (window.localStorage.getItem(ACCEPT_KEY) === ACCEPTED_VALUE) return;
      // 2. Временно скрытый баннер в этой сессии — не возвращаем до новой вкладки.
      if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') return;
      setVisible(true);
    } catch {
      // localStorage может быть недоступен (приватный режим Safari) — показываем баннер
      setVisible(true);
    }
  }, []);

  /** «Понятно» — постоянное подтверждение. Запоминаем навсегда. */
  const accept = () => {
    try {
      window.localStorage.setItem(ACCEPT_KEY, ACCEPTED_VALUE);
    } catch {
      // не критично — баннер просто появится снова при следующем визите
    }
    setVisible(false);
  };

  /** Крестик — отложить. Скрываем только в этой сессии. */
  const dismiss = () => {
    try {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    } catch {
      // приватный режим — баннер вернётся, ничего страшного
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md z-[60]"
          role="dialog"
          aria-live="polite"
          aria-label="Уведомление о cookies"
        >
          <div className="rounded-xl border bg-surface shadow-lg p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-blue-soft text-blue grid place-items-center flex-shrink-0">
                <Cookie className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Файлы cookies</h3>
                <p className="text-xs text-text-2 mt-1 leading-relaxed">
                  Сайт использует файлы cookies. Подробнее — в{' '}
                  <Link to="/legal/privacy" className="text-blue hover:underline">
                    Политике обработки персональных данных
                  </Link>
                  .
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={accept} className="flex-1 sm:flex-initial">
                    Понятно
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="size-8 grid place-items-center rounded-md text-text-3 hover:bg-surface-3 hover:text-text -mt-1 -mr-1 flex-shrink-0"
                aria-label="Отложить — баннер вернётся при следующем визите"
                title="Отложить — баннер вернётся при следующем визите"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
