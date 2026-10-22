import { PrismaClient, type PlanType } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();
const DAY = 24 * 3600 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  // `--if-missing` (used by the Vercel build) keeps an existing demo gym instead of resetting it.
  if (process.argv.includes("--if-missing") && (await db.gym.findUnique({ where: { slug: "demo" } }))) {
    console.log("Demo gym already exists; skipping seed.");
    return;
  }
  await db.gym.deleteMany({ where: { slug: "demo" } });
  const password = await hash("password123", 10);

  const gym = await db.gym.create({
    data: {
      name: "Iron Temple Fitness",
      slug: "demo",
      phone: "+919876500000",
      email: "hello@irontemple.in",
      address: "12 MG Road, Indore, MP 452001",
      gstin: "23ABCDE1234F1Z5",
      gstPercent: 18,
      invoiceSeq: 6,
      subscription: { create: { planCode: "growth", status: "TRIAL", memberLimit: 500, staffLimit: 10, trialEndsAt: daysFromNow(14) } },
      users: {
        create: [
          { email: "owner@demo.gym", name: "Rohit Sharma", role: "OWNER", passwordHash: password, phone: "+919876500001" },
          { email: "reception@demo.gym", name: "Priya Verma", role: "RECEPTION", passwordHash: password, phone: "+919876500002" },
          { email: "trainer@demo.gym", name: "Amit Yadav", role: "TRAINER", passwordHash: password, phone: "+919876500003", commissionPercent: 20 },
        ],
      },
      plans: {
        create: [
          { name: "Monthly", type: "MONTHLY", durationDays: 30, pricePaise: 150000 },
          { name: "Quarterly", type: "QUARTERLY", durationDays: 90, pricePaise: 400000 },
          { name: "Half-yearly", type: "HALF_YEARLY", durationDays: 180, pricePaise: 750000 },
          { name: "Yearly", type: "YEARLY", durationDays: 365, pricePaise: 1200000 },
          { name: "PT 12 sessions", type: "PT", durationDays: 45, pricePaise: 600000, ptSessions: 12 },
        ],
      },
    },
    include: { users: true, plans: true },
  });

  const reception = gym.users.find((u) => u.role === "RECEPTION")!;
  const trainer = gym.users.find((u) => u.role === "TRAINER")!;
  const planByType = (t: PlanType) => gym.plans.find((p) => p.type === t)!;

  const people: [string, string | null, string, PlanType, number][] = [
    // name, surname, phone, plan, days since membership started
    ["Neha", "Gupta", "+919900000001", "YEARLY", 120],
    ["Arjun", "Mehta", "+919900000002", "MONTHLY", 10],
    ["Sana", "Khan", "+919900000003", "QUARTERLY", 85],
    ["Vikram", null, "+919900000004", "MONTHLY", 40], // expired
    ["Pooja", "Jain", "+919900000005", "MONTHLY", 2],
    ["Rahul", "Dubey", "+919900000006", "PT", 15],
  ];

  let i = 0;
  for (const [firstName, lastName, phone, planType, ago] of people) {
    i += 1;
    const plan = planByType(planType);
    const startDate = daysFromNow(-ago);
    const endDate = new Date(startDate.getTime() + plan.durationDays * DAY);
    const expired = endDate < new Date();
    const member = await db.member.create({
      data: {
        gymId: gym.id,
        code: `GB-${String(i).padStart(4, "0")}`,
        firstName,
        lastName,
        phone,
        gender: i % 2 ? "MALE" : "FEMALE",
        dob: new Date(1990 + i, i, 10 + i),
        usualTime: i % 2 ? "Morning 6-8" : "Evening 7-9",
        emergencyName: "Family",
        emergencyPhone: "+919900009999",
        joinedAt: startDate,
        memberships: {
          create: { gymId: gym.id, planId: plan.id, startDate, endDate, pricePaise: plan.pricePaise, status: expired ? "EXPIRED" : "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    const membership = member.memberships[0];
    // Arjun still owes half; everyone else paid in full (including GST).
    const gstPaise = Math.round(plan.pricePaise * 0.18);
    const paid = firstName === "Arjun" ? (plan.pricePaise + gstPaise) / 2 : plan.pricePaise + gstPaise;
    await db.invoice.create({
      data: {
        gymId: gym.id,
        number: `INV-2026-${String(i).padStart(4, "0")}`,
        memberId: member.id,
        membershipId: membership.id,
        subtotalPaise: plan.pricePaise,
        gstPercent: 18,
        gstPaise,
        totalPaise: plan.pricePaise + gstPaise,
        paidPaise: paid,
        issuedAt: startDate,
        dueDate: startDate,
        payments: {
          create: { gymId: gym.id, memberId: member.id, method: i % 2 ? "UPI" : "CASH", amountPaise: paid, takenById: reception.id, paidAt: startDate },
        },
      },
    });
    if (planType === "PT") {
      const pt = await db.ptAssignment.create({
        data: { gymId: gym.id, memberId: member.id, trainerId: trainer.id, membershipId: membership.id, feePaise: plan.pricePaise, sessionsTotal: plan.ptSessions!, sessionsUsed: 4, startDate,
          sessions: { create: [1, 2, 3, 4].map((n) => ({ trainerId: trainer.id, at: new Date(startDate.getTime() + n * 3 * DAY) })) } },
      });
      await db.commission.create({ data: { gymId: gym.id, userId: trainer.id, amountPaise: Math.round(plan.pricePaise * 0.2), reason: `PT ${firstName} ${lastName} (${plan.ptSessions} sessions)`, period: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`, ptAssignmentId: pt.id } });
    }
  }

  await db.gym.update({ where: { id: gym.id }, data: { memberSeq: people.length } });

  await db.lead.createMany({
    data: [
      { gymId: gym.id, name: "Kiran Patel", phone: "+919911000001", source: "WALK_IN", status: "NEW", interestedIn: "Monthly", followUpAt: daysFromNow(1), ownerId: reception.id },
      { gymId: gym.id, name: "Deepak Singh", phone: "+919911000002", source: "PHONE", status: "CONTACTED", interestedIn: "PT", followUpAt: daysFromNow(2), ownerId: reception.id },
      { gymId: gym.id, name: "Meera Iyer", phone: "+919911000003", source: "WEB", status: "LOST", lostReason: "Joined another gym" },
      { gymId: gym.id, name: "Farhan Ali", phone: "+919911000004", source: "WHATSAPP", status: "NEW", interestedIn: "Quarterly", followUpAt: daysFromNow(-1), ownerId: reception.id },
      { gymId: gym.id, name: "Ritu Sharma", phone: "+919911000005", source: "INSTAGRAM", status: "TRIAL", interestedIn: "Yearly", followUpAt: new Date(), ownerId: reception.id },
    ],
  });

  console.log("Seeded gym 'demo' with logins owner@demo.gym / reception@demo.gym / trainer@demo.gym (password: password123)");
}

main().finally(() => db.$disconnect());
