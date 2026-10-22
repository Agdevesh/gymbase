import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { clearRateLimit, rateLimit } from "@/lib/ratelimit";

declare module "next-auth" {
  interface Session {
    user: { id: string; gymId: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    gymId: string;
    role: Role;
  }
}

export class Throttled extends CredentialsSignin { code = "throttled"; }

const credentialsSchema = z.object({
  gym: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { gym: {}, email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { gym, email, password } = parsed.data;
        // 10 failed attempts per login per 15 minutes; a correct password clears the counter.
        const key = `login:${gym.toLowerCase()}:${email.toLowerCase()}`;
        if (!(await rateLimit(key, 10, 15 * 60_000))) throw new Throttled();
        const user = await db.user.findFirst({
          where: { email: email.toLowerCase(), active: true, gym: { slug: gym } },
        });
        if (!user || !(await compare(password, user.passwordHash))) return null;
        await clearRateLimit(key);
        return { id: user.id, name: user.name, email: user.email, gymId: user.gymId, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.gymId = user.gymId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.gymId = token.gymId as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
