.PHONY: dev prod clean migrate generate test

# Запуск в режиме разработки
dev:
	docker compose -f docker-compose.dev.yml up --build

# Запуск в production режиме
prod:
	docker compose up --build -d

# Остановка всех контейнеров
clean:
	docker compose -f docker-compose.dev.yml down -v
	docker compose down -v

# Генерация миграций Drizzle
generate:
	docker exec -it authflow-ms-app-1 pnpm run db:generate

# Применение миграций к БД
migrate:
	docker exec -it authflow-ms-app-1 pnpm run db:migrate

# Запуск E2E тестов
test:
	npx tsx tests/e2e.test.ts
