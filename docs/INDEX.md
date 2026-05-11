# RentHub — Индекс документации

## 📚 Полный список документации проекта

### Основная документация

| Документ | Описание | Объем |
|----------|----------|-------|
| [README.md](../README.md) | Полное описание проекта, архитектура, функционал | ~200 строк |
| [QUICKSTART.md](../QUICKSTART.md) | Быстрый старт за 5 минут | ~150 строк |

### Техническая документация

| Документ | Описание | Объем |
|----------|----------|-------|
| [tech-doc.md](tech-doc.md) | Подробная техническая документация | ~1000 строк |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Инструкция по развертыванию | ~300 строк |

### Пользовательская документация

| Документ | Описание | Объем |
|----------|----------|-------|
| [user-guide.md](user-guide.md) | Подробное руководство пользователя | ~800 строк |

### Конфигурационные файлы

| Файл | Описание |
|------|----------|
| [.env.example](../.env.example) | Пример переменных окружения |
| [docker/compose.dev.yml](../docker/compose.dev.yml) | Docker Compose для разработки |
| [docker/compose.prod.yml](../docker/compose.prod.yml) | Docker Compose для production |
| [apps/api/Dockerfile](../apps/api/Dockerfile) | Dockerfile для API |
| [apps/web/Dockerfile](../apps/web/Dockerfile) | Dockerfile для Web |
| [apps/web/nginx.conf](../apps/web/nginx.conf) | Конфигурация nginx |

### Схема базы данных

| Файл | Описание |
|------|----------|
| [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) | Полная схема БД |
| [apps/api/prisma/migrations/](../apps/api/prisma/migrations/) | История миграций |

### CI/CD

| Файл | Описание |
|------|----------|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | GitHub Actions pipeline |

---

## 📖 Как читать документацию

### Для быстрого старта

1. [QUICKSTART.md](../QUICKSTART.md) — запуск за 5 минут
2. [README.md](../README.md) — общее описание проекта

### Для изучения технической части

1. [tech-doc.md](tech-doc.md) — полная техническая документация
2. [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) — схема БД
3. Swagger UI — документация API (http://localhost:3001/api/docs)

### Для пользователей

1. [user-guide.md](user-guide.md) — руководство пользователя
2. Раздел FAQ в user-guide.md

### Для развертывания

1. [DEPLOYMENT.md](DEPLOYMENT.md) — инструкция по развертыванию
2. [.env.example](../.env.example) — пример конфигурации
3. [docker/compose.prod.yml](../docker/compose.prod.yml) — production compose

---

## 📊 Статистика документации

| Категория | Количество | Объем |
|-----------|-----------|-------|
| **Документы** | 5 файлов | ~2400 строк |
| **Технические** | 2 файла | ~1300 строк |
| **Пользовательские** | 1 файл | ~800 строк |
| **Конфигурация** | 7 файлов | - |
| **Схема БД** | 1 файл + 25 миграций | ~1000 строк |
| **Проект** | 19 модулей API, 35 страниц, 56 компонентов | - |

---

## ✅ Полнота документации

### Техническая документация
- ✅ Архитектура системы
- ✅ Описание модулей
- ✅ Модель данных
- ✅ API спецификация
- ✅ Безопасность
- ✅ Тестирование
- ✅ Развертывание

### Пользовательская документация
- ✅ Руководство для клиентов
- ✅ Инструкции для менеджеров
- ✅ Инструкции для администраторов
- ✅ FAQ
- ✅ Глоссарий

### Дополнительная документация
- ✅ Быстрый старт
- ✅ Примеры конфигурации
- ✅ Docker Compose файлы
- ✅ CI/CD pipeline

---

## 🔗 Полезные ссылки

### Внешняя документация

- [NestJS Documentation](https://docs.nestjs.com/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

### Инструменты

- [Swagger Editor](https://editor.swagger.io/) — редактор OpenAPI
- [Prisma Studio](https://www.prisma.io/studio) — GUI для БД
- [Postman](https://www.postman.com/) — тестирование API

---

## 📝 Обновление документации

При внесении изменений в проект обновляйте соответствующие разделы документации:

1. **Изменения в API** → обновить Swagger аннотации
2. **Изменения в БД** → создать миграцию Prisma
3. **Новый функционал** → обновить README.md и user-guide.md
4. **Изменения в архитектуре** → обновить tech-doc.md
5. **Изменения в развертывании** → обновить DEPLOYMENT.md

---

**Вся документация актуальна на:** 2024-2026

**Версия проекта:** 1.0.0
