import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function getEmail(user: { email?: string | null }, profile: Record<string, unknown> | undefined) {
  const userEmail = typeof user?.email === "string" ? user.email : "";
  const profileEmail = typeof profile?.email === "string" ? profile.email : "";
  return (userEmail || profileEmail).toLowerCase();
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/denied",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = getEmail(user, profile as Record<string, unknown> | undefined);
      if (!email.endsWith("@appzen.com")) {
        return "/auth/denied";
      }
      return true;
    },
    async jwt({ token, user, profile }) {
      const email = getEmail(user ?? {}, profile as Record<string, unknown> | undefined);
      if (email) token.email = email;
      if (user?.name) token.name = user.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
});
