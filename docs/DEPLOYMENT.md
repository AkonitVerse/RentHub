# Развёртывание RentHub

## 1. Общая схема

Production-развёртывание включает:
- `web` - фронтенд-контейнер (статический SPA + nginx);
- `api` - backend-контейнер (NestJS);
- `postgres` - основная база данных;
- `redis` - кеш и служебное хранилище.

Базовый compose-файл: `docker/compose.prod.yml`.

## 2. Предварительные требования

- Docker 24+ и Docker Compose v2;
- доступ к домену и HTTPS-терминатору (reverse proxy или ingress);
- подготовленные значения секретов и параметров окружения.

## 3. Переменные окружения

Создайте файл `.env.production` на сервере (не коммитьте в git).

Минимально обязательные значения:

```env
POSTGRES_USER=renthub
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=renthub
REDIS_PASSWORD=<strong-password>

JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<long-random-secret>
SECRET_ENCRYPTION_KEY=<base64-32-bytes>

WEB_URL=https://your-domain.example
COOKIE_DOMAIN=.your-domain.example
COOKIE_SECURE=true
```

Дополнительно:
- `SENTRY_DSN`, `SENTRY_RELEASE` для мониторинга;
- `SWAGGER_USER`, `SWAGGER_PASSWORD` для ограничения Swagger в production;
- `VITE_API_URL` при необходимости переопределить API URL на этапе сборки web.

## 4. Запуск через Docker Compose

Из корня проекта:

```bash
docker compose -f docker/compose.prod.yml --env-file .env.production up -d --build
```

Проверка состояния:

```bash
docker compose -f docker/compose.prod.yml ps
docker compose -f docker/compose.prod.yml logs -f api
```

## 5. Миграции базы данных

Миграции применяются на старте API-контейнера.

Для ручного запуска:

```bash
docker compose -f docker/compose.prod.yml exec api npx prisma migrate deploy
```

При нескольких инстансах API миграции выполняются отдельной задачей один раз до rollout.

## 6. Проверка после деплоя

Проверьте:
- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- вход в систему;
- создание и изменение заказа;
- загрузку публичного каталога.

Пример:

```bash
curl https://your-domain.example/api/v1/health
curl https://your-domain.example/api/v1/health/ready
```

## 7. Обновление версии

1. Обновите код на сервере.
2. Пересоберите контейнеры:

```bash
docker compose -f docker/compose.prod.yml --env-file .env.production up -d --build
```

3. Проверьте логи API и web.
4. Выполните smoke-check ключевых бизнес-сценариев.

## 8. Откат

Если после обновления обнаружены критические ошибки:

1. Верните предыдущую стабильную ревизию кода.
2. Перезапустите стек с пересборкой.
3. При несовместимых миграциях используйте заранее подготовленный backup БД.

Важно:
- rollback миграций требует отдельной reverse-миграции или восстановления из резервной копии.

## 9. Резервное копирование

Резервное копирование включает:
- backup PostgreSQL;
- контроль срока хранения бэкапов;
- проверку восстановления.

Пример ручного backup:

```bash
docker compose -f docker/compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

## 10. Безопасность эксплуатации

- храните секреты вне репозитория;
- используйте только HTTPS в production;
- задавайте длинные JWT-секреты;
- ограничивайте доступ к Swagger;
- отслеживайте ошибки через логи и мониторинг.
