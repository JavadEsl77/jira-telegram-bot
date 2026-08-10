# Jira Telegram Bot

یک Telegram Bot برای تیم فنی که با **Jira Server / Data Center** یکپارچه شده است.
هر عضو تیم می‌تواند حساب Jira شخصی خود را به Telegram متصل کند و تسک‌هایش را مدیریت کند.

---

## قابلیت‌های فعلی

| قابلیت | توضیح |
|--------|-------|
| 🔐 احراز هویت per-user | هر کاربر با PAT شخصی خودش وارد می‌شود |
| 📋 لیست تسک‌ها | تسک‌های تخصیص‌یافته به کاربر با pagination |
| 🎫 جزئیات Issue | وضعیت، اولویت، مسئول، برچسب‌ها |
| 🔄 تغییر وضعیت | انتقال Issue بین وضعیت‌ها با تأییدیه |
| ⚙️ تنظیمات | قطع و وصل کردن حساب Jira |

---

## پیش‌نیازها

- Node.js 20 یا بالاتر
- یک Telegram Bot Token (از [@BotFather](https://t.me/BotFather))
- دسترسی به یک نصب Jira Server / Data Center (نسخه 8.14+)

---

## نصب و راه‌اندازی

### ۱. نصب وابستگی‌ها

```bash
npm install
```

### ۲. تنظیم متغیرهای محیطی

فایل `.env.example` را به `.env` کپی کنید:

```bash
cp .env.example .env
```

سپس مقادیر را پر کنید:

```env
NODE_ENV=development

# Telegram
BOT_TOKEN=<token از BotFather>

# Jira
JIRA_BASE_URL=https://jira.example.com

# پایگاه داده SQLite
DATABASE_URL=file:./dev.db

# کلید رمزنگاری Token (64 کاراکتر hex = 32 بایت)
JIRA_TOKEN_ENCRYPTION_KEY=<با دستور زیر بسازید>
```

### ۳. ساختن کلید رمزنگاری

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

مقدار خروجی را در `JIRA_TOKEN_ENCRYPTION_KEY` قرار دهید.

### ۴. راه‌اندازی پایگاه داده

```bash
npm run db:migrate
```

### ۵. اجرا

```bash
# حالت توسعه (با hot reload)
npm run dev

# حالت تولید
npm run build
npm start
```

---

## نحوه استفاده

### اتصال به Jira

۱. `/start` در Telegram بزنید
۲. دکمه **🔐 اتصال به Jira** را بزنید
۳. **Personal Access Token** حساب Jira خود را ارسال کنید

> برای ساختن PAT: وارد Jira شوید → پروفایل → **Personal Access Tokens** → **Create token**

### قطع اتصال

از منوی **⚙️ تنظیمات** → **❌ قطع اتصال Jira**

---

## ساختار پروژه

```
src/
├── index.ts                    # نقطه ورود
├── app.ts                      # ساخت و wire کردن وابستگی‌ها
│
├── user/                       # مدیریت کاربران
│   ├── user.types.ts           # interface های User و JiraCredentials
│   ├── user.repository.ts      # interface UserRepository + InMemory
│   ├── user.repository.database.ts  # پیاده‌سازی Prisma
│   └── user.service.ts         # منطق تجاری کاربران
│
├── crypto/
│   └── token-encryption.ts     # رمزنگاری AES-256-GCM برای PAT
│
├── jira/
│   ├── jira.client.ts          # HTTP client با Bearer auth
│   ├── jira.client.factory.ts  # ساخت JiraClient per-user
│   ├── jira.types.ts           # TypeScript types برای API Jira
│   └── services/
│       ├── issue.service.ts    # دریافت و لیست Issue‌ها
│       ├── transition.service.ts  # تغییر وضعیت Issue
│       └── search.service.ts   # جستجو با JQL
│
└── bot/
    ├── bot.ts                  # ایجاد instance بات
    ├── register-handlers.ts    # ثبت تمام handler‌ها
    ├── conversation-state.ts   # مدیر وضعیت مکالمه per-user
    ├── handlers/
    │   ├── start.handler.ts        # دستور /start
    │   ├── connect-jira.handler.ts # جریان اتصال Jira
    │   ├── settings.handler.ts     # تنظیمات و قطع اتصال
    │   ├── my-tasks.handler.ts     # لیست تسک‌ها
    │   ├── issue-detail.handler.ts # جزئیات Issue
    │   └── transition.handler.ts   # تغییر وضعیت
    ├── keyboards/
    │   ├── main.keyboard.ts
    │   ├── connect-jira.keyboard.ts
    │   ├── settings.keyboard.ts
    │   ├── issue.keyboard.ts
    │   └── issue-detail.keyboard.ts
    └── formatters/
        └── issue.formatter.ts  # فرمت‌بندی Issue برای Telegram

prisma/
├── schema.prisma               # مدل پایگاه داده
└── migrations/                 # تاریخچه migration ها
```

---

## معماری احراز هویت

```
Telegram User
    │
    ├─→ Personal Access Token (PAT)
    │       │
    │       ├─→ GET /rest/api/2/myself
    │       │         (Bearer Auth)
    │       │
    │       └─→ username + displayName از پاسخ Jira
    │
    └─→ رمزنگاری PAT با AES-256-GCM
            │
            └─→ ذخیره در SQLite (Prisma)
```

### نکات امنیتی

- PAT هرگز در log چاپ نمی‌شود
- PAT در Telegram بازنشر نمی‌شود
- PAT رمزنگاری‌شده (AES-256-GCM) در SQLite ذخیره می‌شود
- هر کاربر فقط به Credential خودش دسترسی دارد
- بدون کلید رمزنگاری (`JIRA_TOKEN_ENCRYPTION_KEY`)، بات اصلاً شروع نمی‌کند

---

## دستورات توسعه

```bash
npm run dev          # اجرای development با hot reload
npm run build        # کامپایل TypeScript
npm start            # اجرای نسخه کامپایل‌شده
npm test             # اجرای تست‌ها
npm run db:migrate   # اجرای migration ها
npm run db:generate  # بازتولید Prisma Client
```

### تست احراز هویت Jira

برای تست مستقل اتصال Jira:

```bash
# در .env اضافه کنید:
# TEST_JIRA_TOKEN=<PAT شما>

npx tsx scripts/test-jira-auth.ts
```

---

## متغیرهای محیطی

| متغیر | ضروری | توضیح |
|-------|-------|-------|
| `BOT_TOKEN` | ✅ | Token بات Telegram از BotFather |
| `JIRA_BASE_URL` | ✅ | آدرس پایه Jira (بدون slash انتهایی) |
| `DATABASE_URL` | ✅ | مسیر SQLite (مثال: `file:./dev.db`) |
| `JIRA_TOKEN_ENCRYPTION_KEY` | ✅ | کلید رمزنگاری — 64 کاراکتر hex |
| `NODE_ENV` | - | `development` یا `production` |
| `TEST_JIRA_TOKEN` | - | فقط برای اجرای `test-jira-auth.ts` |

---

## تکنولوژی‌ها

| لایه | ابزار |
|------|-------|
| Runtime | Node.js |
| زبان | TypeScript |
| Telegram | [grammY](https://grammy.dev/) |
| HTTP Client | axios |
| پایگاه داده | SQLite (از طریق Prisma + libsql) |
| ORM | Prisma 7 |
| رمزنگاری | Node.js built-in `crypto` (AES-256-GCM) |
