import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

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

  const passwordHash = await hashPassword("betrimon");

  await prisma.user.create({
    data: {
      name: "אביגיל שקד",
      username: "avigail",
      passwordHash,
      phone: "0500000001",
      email: "manager@betrimon.local",
      role: "manager",
    },
  });

  const workers = [
    { name: "ליאם פרידמן", username: "liam", phone: "0500000002", birthDate: "2009-03-08", parentPhone: "0520000002", paymentMethod: "bit" },
    { name: "נועם אזולאי", username: "noam", phone: "0500000003", birthDate: "2008-08-19", parentPhone: "0520000003", paymentMethod: "bank" },
    { name: "הדר ממן", username: "hadar", phone: "0500000004", birthDate: "2010-01-14", parentPhone: "0520000004", paymentMethod: "bit" },
    { name: "אריאל בן-דוד", username: "ariel", phone: "0500000005", birthDate: "2009-06-02", parentPhone: "0520000005", paymentMethod: "bit" },
    { name: "מיקה רוזן", username: "mika", phone: "0500000006", birthDate: "2008-12-27", parentPhone: "0520000006", paymentMethod: "bank" },
    { name: "עידו שמעוני", username: "ido", phone: "0500000007", birthDate: "2010-04-11", parentPhone: "0520000007", paymentMethod: "bit" },
    { name: "רותם אלקיים", username: "rotem", phone: "0500000008", birthDate: "2009-10-05", parentPhone: "0520000008", paymentMethod: "bit" },
    { name: "גיא סבג", username: "guy", phone: "0500000009", birthDate: "2008-07-23", parentPhone: "0520000009", paymentMethod: "bank" },
  ];

  for (const worker of workers) {
    await prisma.user.create({
      data: {
        name: worker.name,
        username: worker.username,
        passwordHash,
        phone: worker.phone,
        role: "worker",
        profile: {
          create: {
            birthDate: new Date(worker.birthDate),
            parentPhone: worker.parentPhone,
            paymentMethod: worker.paymentMethod,
          },
        },
      },
    });
  }

  await Promise.all([
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

  console.log("משתמשים חדשים מוכנים.");
  console.log("מנהלת: avigail / betrimon");
  console.log("עובדים: liam, noam, hadar, ariel, mika, ido, rotem, guy / betrimon");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
