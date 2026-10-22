import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function at(daysFromToday: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  await prisma.dateChatMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.payRate.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.jobType.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();

  const manager = await prisma.user.create({
    data: {
      name: "רועי כהן",
      phone: "0500000001",
      email: "manager@betrimon.local",
      role: "manager",
    },
  });

  const noa = await prisma.user.create({
    data: {
      name: "נועה לוי",
      phone: "0500000002",
      role: "worker",
      profile: {
        create: {
          birthDate: new Date("2009-04-12"),
          parentPhone: "0520000002",
          paymentMethod: "bit",
          bankDetails: "ביט: 050-000-0002",
        },
      },
    },
  });

  const yonatan = await prisma.user.create({
    data: {
      name: "יונתן מזרחי",
      phone: "0500000003",
      role: "worker",
      profile: {
        create: {
          birthDate: new Date("2008-11-03"),
          parentPhone: "0520000003",
          paymentMethod: "bank",
          bankDetails: "בנק הדואר 9 / 123456",
        },
      },
    },
  });

  const maya = await prisma.user.create({
    data: {
      name: "מאיה אברהם",
      phone: "0500000004",
      role: "worker",
      profile: {
        create: {
          birthDate: new Date("2010-07-21"),
          parentPhone: "0520000004",
          paymentMethod: "bit",
        },
      },
    },
  });

  const [field, hall, garden] = await Promise.all([
    prisma.site.create({ data: { name: "מגרש הספורט" } }),
    prisma.site.create({ data: { name: "אולם התרבות" } }),
    prisma.site.create({ data: { name: "גן השעשועים" } }),
  ]);

  const [guard, clean, eventHelp] = await Promise.all([
    prisma.jobType.create({ data: { name: "שמירה" } }),
    prisma.jobType.create({ data: { name: "ניקיון" } }),
    prisma.jobType.create({ data: { name: "עזרה באירוע" } }),
  ]);

  await prisma.payRate.createMany({
    data: [
      { minAge: 0, maxAge: 15, hourlyRate: 22 },
      { minAge: 16, maxAge: 17, hourlyRate: 25 },
      { minAge: 18, maxAge: 99, hourlyRate: 32.3 },
      { jobTypeId: guard.id, hourlyRate: 28 },
      { jobTypeId: eventHelp.id, hourlyRate: 30 },
      { jobTypeId: clean.id, hourlyRate: 24 },
    ],
  });

  const shiftPastNoa = await prisma.shift.create({
    data: {
      userId: noa.id,
      siteId: field.id,
      jobTypeId: guard.id,
      workDate: at(-3, 0),
      startsAt: at(-3, 16),
      endsAt: at(-3, 19),
      createdById: manager.id,
    },
  });

  const shiftPastYonatan = await prisma.shift.create({
    data: {
      userId: yonatan.id,
      siteId: hall.id,
      jobTypeId: clean.id,
      workDate: at(-2, 0),
      startsAt: at(-2, 9),
      endsAt: at(-2, 12),
      createdById: manager.id,
    },
  });

  await prisma.shift.create({
    data: {
      userId: maya.id,
      siteId: garden.id,
      jobTypeId: eventHelp.id,
      workDate: at(1, 0),
      startsAt: at(1, 17),
      endsAt: at(1, 20),
      createdById: manager.id,
    },
  });

  const swapShift = await prisma.shift.create({
    data: {
      userId: yonatan.id,
      siteId: field.id,
      jobTypeId: guard.id,
      workDate: at(2, 0),
      startsAt: at(2, 16),
      endsAt: at(2, 20),
      createdById: manager.id,
    },
  });

  await prisma.shift.create({
    data: {
      userId: noa.id,
      siteId: hall.id,
      jobTypeId: eventHelp.id,
      workDate: at(3, 0),
      startsAt: at(3, 18),
      endsAt: at(3, 21),
      createdById: manager.id,
    },
  });

  await prisma.shift.create({
    data: {
      userId: noa.id,
      siteId: field.id,
      jobTypeId: guard.id,
      workDate: at(4, 0),
      createdById: manager.id,
      notes: "שעות בתיאום בצ'אט",
    },
  });

  await prisma.shift.create({
    data: {
      userId: maya.id,
      siteId: field.id,
      jobTypeId: guard.id,
      workDate: at(4, 0),
      createdById: manager.id,
      notes: "שעות בתיאום בצ'אט",
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: noa.id,
      shiftId: shiftPastNoa.id,
      siteId: field.id,
      jobTypeId: guard.id,
      workDate: at(-3, 16),
      hours: 3,
      hourlyRate: 28,
      status: "approved",
      reviewedById: manager.id,
      reviewedAt: new Date(),
      note: "שמירה במשחק כדורגל",
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: yonatan.id,
      shiftId: shiftPastYonatan.id,
      siteId: hall.id,
      jobTypeId: clean.id,
      workDate: at(-2, 9),
      hours: 3,
      hourlyRate: 24,
      status: "submitted",
      note: "ניקיון אחרי חוג",
    },
  });

  await prisma.timeEntry.create({
    data: {
      userId: maya.id,
      siteId: garden.id,
      jobTypeId: eventHelp.id,
      workDate: at(-8, 10),
      hours: 2.5,
      hourlyRate: 22,
      status: "approved",
      reviewedById: manager.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.swapRequest.create({
    data: {
      shiftId: swapShift.id,
      requesterId: yonatan.id,
      status: "open",
      expiresAt: new Date(swapShift.startsAt.getTime() - 6 * 36e5),
    },
  });

  const workers = await prisma.user.findMany({ where: { role: "worker", id: { not: yonatan.id } } });
  await prisma.notification.createMany({
    data: workers.map((worker) => ({
      userId: worker.id,
      type: "swap_requested",
      title: "בקשת החלפה",
      body: "יונתן מזרחי מבקש החלפה: שמירה במגרש הספורט",
    })),
  });

  console.log("נתוני דמו מוכנים.");
  console.log("מנהל: 0500000001");
  console.log("עובדים: 0500000002 / 0500000003 / 0500000004");
  console.log("קוד OTP במצב פיתוח: 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
