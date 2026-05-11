import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorPage() {
  const error = useRouteError();

  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const statusCode = isRouteErrorResponse(error) ? error.status : 500;
  const message = is404
    ? 'Страница не найдена'
    : 'Произошла ошибка при загрузке страницы';
  const description = is404
    ? 'Возможно, страница была удалена или вы перешли по неверной ссылке.'
    : 'Попробуйте обновить страницу или вернуться на главную.';

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-md">
        {!is404 && (
          <div className="flex justify-center mb-4">
            <AlertTriangle className="size-16 text-amber-500" />
          </div>
        )}
        <div className="font-display font-bold text-7xl text-blue mb-4">
          {statusCode}
        </div>
        <h1 className="font-display font-bold text-2xl mb-2">{message}</h1>
        <p className="text-text-2 mb-6">{description}</p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link to="/">На главную</Link>
          </Button>
          {!is404 && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RotateCcw className="size-4" />
              Обновить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
