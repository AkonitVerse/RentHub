import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-md">
        <div className="font-display font-bold text-7xl text-blue mb-4">404</div>
        <h1 className="font-display font-bold text-2xl mb-2">Страница не найдена</h1>
        <p className="text-text-2 mb-6">
          Возможно, страница была удалена или вы перешли по неверной ссылке.
        </p>
        <Button asChild>
          <Link to="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
