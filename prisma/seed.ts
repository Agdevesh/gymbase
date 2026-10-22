import { PrismaClient, type PlanType } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const DAY = 24 * 3600 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
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
      subscription: { create: { planCode: "growth", status: "TRIAL", memberLimit: 500, staffLimit: 10, trialEndsAt: daysFromNow(14) } },
      users: {
        create: [
          { email: "owner@demo.gym", name: "Rohit Sharma", role: "OWNER", passwordHash: password, phone: "+919876500001" },
          { email: "reception@demo.gym", name: "Priya Verma", role: "RECEPTION", passwordHash: password, phone: "+919876500002" },
          { email: "trainer@demo.gym", name: "Amit Yadav", role: "TRAINER", passwordHash: password, phone: "+919876500003" },
        ],
      },
      plans: {
        create: [
          { name: "Monthly", type: "MONTHLY", durationDays: 30, pricePaise: 150000 },
          { name: "Quarterly", type: "QUARTERLY", durationDays: 90, pricePaise: 400000 },
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
        qrToken: randomBytes(16).toString("hex"),
        firstName,
        lastName,
        phone,
        gender: i % 2 ? "MALE" : "FEMALE",
        dob: new Date(1990 + i, i, 10 + i),
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
    // Arjun still owes half; everyone else paid in full.
    const paid = firstName === "Arjun" ? plan.pricePaise / 2 : plan.pricePaise;
    const gstPaise = Math.round(plan.pricePaise * 0.18);
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
        dueDate: firstName === "Arjun" ? daysFromNow(5) : null,
        payments: {
          create: { gymId: gym.id, memberId: member.id, method: i % 2 ? "UPI" : "CASH", amountPaise: paid, takenById: reception.id, paidAt: startDate },
        },
      },
    });
    if (planType === "PT") {
      await db.ptAssignment.create({
        data: { gymId: gym.id, memberId: member.id, trainerId: trainer.id, sessionsTotal: plan.ptSessions!, sessionsUsed: 4, startDate },
      });
    }
    if (!expired) {
      await db.checkIn.createMany({
        data: [0, 1, 2].map((d) => ({ gymId: gym.id, memberId: member.id, checkedInAt: daysFromNow(-d), checkedOutAt: new Date(daysFromNow(-d).getTime() + 3600 * 1000), source: "RECEPTION" as const, loggedById: reception.id })),
      });
    }
  }

  await db.lead.createMany({
    data: [
      { gymId: gym.id, name: "Kiran Patel", phone: "+919911000001", source: "WALK_IN", status: "NEW", interestedIn: "Monthly", followUpAt: daysFromNow(1), ownerId: reception.id },
      { gymId: gym.id, name: "Deepak Singh", phone: "+919911000002", source: "PHONE", status: "CONTACTED", interestedIn: "PT", followUpAt: daysFromNow(2), ownerId: reception.id },
      { gymId: gym.id, name: "Meera Iyer", phone: "+919911000003", source: "WEB", status: "LOST", lostReason: "Joined another gym" },
    ],
  });

  console.log("Seeded gym 'demo' with logins owner@demo.gym / reception@demo.gym / trainer@demo.gym (password: password123)");
}

main().finally(() => db.$disconnect());
