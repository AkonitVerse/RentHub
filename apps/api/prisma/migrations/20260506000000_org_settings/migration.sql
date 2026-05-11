CREATE TABLE "org_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "overdueCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overdueCheckEveryMinutes" INTEGER NOT NULL DEFAULT 10,
    "dailyBriefEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyBriefHour" INTEGER NOT NULL DEFAULT 8,
    "dailyBriefMinute" INTEGER NOT NULL DEFAULT 0,
    "returnReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "returnReminderHour" INTEGER NOT NULL DEFAULT 9,
    "returnReminderMinute" INTEGER NOT NULL DEFAULT 0,
    "returnReminderDaysBefore" INTEGER NOT NULL DEFAULT 1,
    "inquiryExpireEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inquiryExpireHour" INTEGER NOT NULL DEFAULT 3,
    "inquiryExpireMinute" INTEGER NOT NULL DEFAULT 0,
    "inquiryExpireAfterDays" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- Singleton-строка с дефолтами (id = 1)
INSERT INTO "org_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
