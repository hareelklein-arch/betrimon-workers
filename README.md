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

חשבונות דמו (קוד OTP: `123456`):

| תפקיד | טלפון |
| --- | --- |
| מנהל | 0500000001 |
| עובדת | 0500000002 |
| עובד | 0500000003 |
| עובדת | 0500000004 |

מקומית נשאר SQLite (`DATABASE_URL=file:./dev.db`). אל תעלו `.env` ל-Git.

## עלייה ל-Vercel + Supabase

1. ב-Supabase SQL Editor מריצים `supabase/migrations/001_init.sql`. אם כבר הרצתם אותו בעבר — מריצים גם `003_otp_push_and_text.sql`.
2. ב-Vercel מחברים את הריפו ומגדירים משתני סביבה:
   - `DATABASE_URL` — Transaction pooler של Supabase (פורט 6543) עם `pgbouncer=true&sslmode=require`
   - `SESSION_SECRET` — מחרוזת אקראית של לפחות 32 תווים
   - לבדיקה פרטית בלבד: `ALLOW_DEMO_OTP=true` ו-`DEMO_OTP` (לא להשאיר לנוער)
3. אחרי Deploy יוצרים ב-Supabase Table Editor משתמש מנהל אמיתי (`role=manager`, טלפון אמיתי).
4. לפני הפצה לנוער מוחקים מ-Vercel את `ALLOW_DEMO_OTP` ו-`DEMO_OTP`. בלי SMS כניסה תיחסם במכוון.

## איפה מה יושב

| חלק | פיתוח | פרודקשן |
| --- | --- | --- |
| קוד | הריפו הזה, Next.js | אותו קוד על Vercel |
| מידע | SQLite מקומי (`prisma/schema.sqlite.prisma`) | PostgreSQL ב-Supabase (`prisma/schema.prisma`) |
| התחברות | OTP קבוע (`123456`) | קוד בדיקה רק עם `ALLOW_DEMO_OTP`؛ SMS בהמשך |
| התראות | בתוך האפליקציה; Web Push אחרי מפתחות VAPID | אותו דבר |

סכימת הפרודקשן: [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql). אפיון: [docs/SPEC.md](docs/SPEC.md).

## מה כבר עובד

- כניסה בטלפון (עובד / מנהל)
- שיבוץ משמרות, מניעת כפילות, התרעת שעות לנוער
- דיווח שעות ואישור/דחייה של מנהל
- בקשת החלפה לכולם, ואישור שחוזר רק למבקש עם שם המאשר
- היסטוריה וסטטיסטיקות שכר לעובד
- דוח שכר חודשי, ייצוא CSV ל-Excel, נעילת חודש
- PWA (אפשר להוסיף למסך הבית בטלפון)
