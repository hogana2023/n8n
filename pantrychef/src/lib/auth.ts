import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import type { Adapter } from "next-auth/adapters";
import type { Plan } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Google is optional: without credentials in the env the provider is simply
// left out, so a bare `git clone` + email signup still works.
const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  // Credentials sign-in requires JWT sessions; the adapter still persists users.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/signup",
    error: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        // Accounts created through Google have no passwordHash — refuse rather
        // than letting an empty password match.
        if (!user?.passwordHash) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) token.uid = user.id;

      // Re-read the plan on sign-in and whenever the client calls update(),
      // so a fresh checkout is reflected without forcing a re-login.
      if (token.uid && (user || trigger === "update" || !token.plan)) {
        const record = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { plan: true, name: true, image: true },
        });
        token.plan = record?.plan ?? "FREE";
        token.name = record?.name ?? token.name;
        token.picture = record?.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.plan = (token.plan as Plan) ?? "FREE";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
