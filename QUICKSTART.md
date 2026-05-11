# RentHub — Быстрый старт

## 🚀 Запуск за 5 минут

### Предварительные требования

- Node.js 20+
- Docker и Docker Compose
- Git

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/AkonitVerse/RentHub.git
cd RentHub
```

### Шаг 2: Установка зависимостей

```bash
npm install
```

### Шаг 3: Запуск инфраструктуры

```bash
# Поднять PostgreSQL и Redis
npm run dev:db
```

### Шаг 4: Настройка базы данных

```bash
# Применить миграции
npm run db:migrate

# Создать администратора
npm run db:seed
```

**Учетные данные администратора:**
- Email: `admin@renthub.com`
- Пароль: `admin`

### Шаг 5: Запуск приложения

```bash
# Запустить API и Web одновременно
npm run dev
```

### Шаг 6: Открыть в браузере

- **Web:** http://localhost:5173
- **API:** http://localhost:3001/api/v1
- **Swagger:** http://localhost:3001/api/docs

---

## 📚 Полезные команды

### Разработка

```bash
npm run dev              # Запустить API + Web
npm run dev:api          # Только API
npm run dev:web          # Только Web
npm run dev:db           # Только PostgreSQL + Redis
npm run dev:db:stop      # Остановить БД
```

### База данных

```bash
npm run db:migrate       # Применить миграции
npm run db:seed          # Минимальный seed (только админ)
npm run db:seed:demo     # Демо-данные (админ + менеджер + клиент + каталог)
npm run db:studio        # Открыть Prisma Studio
npm run db:reset         # Сбросить БД (удалить все данные)
```

### Тестирование

```bash
npm run test             # Unit-тесты
npm run test:e2e         # E2E-тесты
npm run lint             # Проверка кода
npm run typecheck        # Проверка типов
```

### Сборка

```bash
npm run build            # Собрать API + Web
```

---

## 🎯 Что дальше?

### Для изучения проекта

1. **Откройте Swagger:** http://localhost:3001/api/docs
2. **Войдите как админ:** http://localhost:5173/login
3. **Изучите админ-панель:** http://localhost:5173/admin
4. **Просмотрите каталог:** http://localhost:5173/catalog

### Для разработки

1. **Прочитайте README.md** — полное описание проекта
2. **Изучите docs/tech-doc.md** — техническая документация
3. **Посмотрите docs/user-guide.md** — руководство пользователя

### Для демонстрации

1. **Запустите демо-seed:**
   ```bash
   npm run db:seed:demo
   ```

2. **Учетные данные:**
   - **Админ:** admin@renthub.com / admin
   - **Менеджер:** manager@renthub.com / manager
   - **Клиент:** client@renthub.com / client123

3. **Демо-данные включают:**
   - 3 категории с подкатегориями
   - 20+ единиц оборудования
   - 10+ складских единиц
   - 5 тарифных тиров
   - Демо-заказы

---

## 🐛 Решение проблем

### Порты заняты

Если порты 5173, 3001, 5434 или 6380 заняты:

```bash
# Изменить порты в .env
PORT=3002                    # API
VITE_PORT=5174              # Web (в vite.config.ts)
# PostgreSQL и Redis порты в docker/compose.dev.yml
```

### База данных не подключается

```bash
# Проверить статус контейнеров
docker compose -f docker/compose.dev.yml ps

# Посмотреть логи
docker compose -f docker/compose.dev.yml logs postgres

# Перезапустить
npm run dev:db:stop
npm run dev:db
```

### Ошибки миграций

```bash
# Сбросить БД и применить миграции заново
npm run db:reset
```

### Ошибки зависимостей

```bash
# Очистить и переустановить
rm -rf node_modules apps/*/node_modules
npm install
```

---

## 📖 Документация

| Документ | Описание |
|----------|----------|
| [README.md](README.md) | Полное описание проекта |
| [docs/tech-doc.md](docs/tech-doc.md) | Техническая документация |
| [docs/user-guide.md](docs/user-guide.md) | Руководство пользователя |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Инструкция по развертыванию |

---

## 🤝 Поддержка

При возникновении проблем:

1. Проверьте [README.md](README.md) — раздел "Решение проблем"
2. Изучите логи приложения
3. Проверьте статус контейнеров Docker

---
