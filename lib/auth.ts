import { createHash } from "node:crypto";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";
import { verifyPassword, hashPassword } from "./password";
import { ApiError } from "./http";
const dummyHash = hashPassword("not-an-account");
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 3600 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Local account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials.password ||
          credentials.password.length > 256
        )
          return null;
        const key = createHash("sha256")
          .update(credentials.email.toLowerCase().trim())
          .digest("hex");
        const [attempt] = await prisma.$queryRaw<
          { attempts: number }[]
        >`INSERT INTO "LoginAttempt" (key,attempts,"expiresAt") VALUES (${key},1,now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN "LoginAttempt"."expiresAt" < now() THEN 1 ELSE "LoginAttempt".attempts+1 END, "expiresAt"=CASE WHEN "LoginAttempt"."expiresAt" < now() THEN now()+interval '15 minutes' ELSE "LoginAttempt"."expiresAt" END RETURNING attempts`;
        if (attempt.attempts > 20) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        const valid = verifyPassword(
          credentials.password,
          user?.passwordHash ?? dummyHash,
        );
        if (user && !user.disabled && valid)
          await prisma.loginAttempt.deleteMany({ where: { key } });
        return user && !user.disabled && valid
          ? { id: user.id, email: user.email }
          : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub!;
      return session;
    },
  },
};
export async function requireUser(write = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.disabled)
    throw new ApiError(401, "UNAUTHENTICATED", "Session no longer valid.");
  if (write && user.readOnly)
    throw new ApiError(403, "READ_ONLY", "This demo account is read-only.");
  return user;
}
