# בית רימון — ניהול עובדים ושכר

מערכת קטנה בעברית לניהול העסקת בני נוער ביישוב: שיבוץ משמרות, דיווח שעות, החלפות, והפקת דוח תשלום חודשי.

שני תפקידים: **עובד** ו**מנהל**.

## הרצה מקומית

```bash
npm install
npm run db:reset
npm run dev
```

פותחים http://localhost:3000

חשבונות דמו (סיסמה לכולם: `betrimon`):

| תפקיד | שם משתמש |
| --- | --- |
| מנהלת | avigail |
| עובדים | liam, noam, hadar, ariel, mika, ido, rotem, guy |

מקומית נשאר SQLite (`DATABASE_URL=file:./dev.db`). אל תעלו `.env` ל-Git.

## עלייה ל-Vercel + Supabase

1. ב-Supabase SQL Editor מריצים לפי הסדר את הקבצים ב-`supabase/migrations/` ואז `supabase/seed.sql`.
2. ב-Vercel מחברים את הריפו ומגדירים משתני סביבה:
   - `DATABASE_URL` — Transaction pooler של Supabase (פורט 6543) עם `pgbouncer=true&sslmode=require`
   - `SESSION_SECRET` — מחרוזת אקראית של לפחות 32 תווים
3. נכנסים עם שם משתמש וסיסמה. מנהל יכול להגדיר חשבונות חדשים במסך ניהול.

## איפה מה יושב

| חלק | פיתוח | פרודקשן |
| --- | --- | --- |
| קוד | הריפו הזה, Next.js | אותו קוד על Vercel |
| מידע | SQLite מקומי (`prisma/schema.sqlite.prisma`) | PostgreSQL ב-Supabase (`prisma/schema.prisma`) |
| התחברות | שם משתמש וסיסמה | אותו דבר |
| התראות | בתוך האפליקציה; Web Push אחרי מפתחות VAPID | אותו דבר |

סכימת הפרודקשן: [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql). אפיון: [docs/SPEC.md](docs/SPEC.md).

## מה כבר עובד

- כניסה בשם משתמש וסיסמה (עובד / מנהל)
- שיבוץ משמרות, מניעת כפילות, התרעת שעות לנוער
- דיווח שעות ואישור/דחייה של מנהל
- בקשת החלפה לכולם, ואישור שחוזר רק למבקש עם שם המאשר
- היסטוריה וסטטיסטיקות שכר לעובד
- דוח שכר חודשי, ייצוא CSV ל-Excel, נעילת חודש
- PWA (אפשר להוסיף למסך הבית בטלפון)
