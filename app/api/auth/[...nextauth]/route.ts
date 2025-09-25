import NextAuth, { type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import prisma from "@/lib/prisma";

const GOOGLE_AUTHORIZATION_SCOPE = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const GOOGLE_PROVIDER_ID = "google";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface ExtendedToken extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  providerAccountId?: string;
  error?: string;
}

async function persistAccountTokens(
  providerAccountId: string,
  token: ExtendedToken,
) {
  const data: Record<string, unknown> = {};

  if (token.accessToken !== undefined) {
    data.access_token = token.accessToken;
  }

  if (token.refreshToken !== undefined) {
    data.refresh_token = token.refreshToken;
  }

  if (token.scope !== undefined) {
    data.scope = token.scope;
  }

  if (token.expiresAt !== undefined) {
    data.expires_at = Math.floor(token.expiresAt / 1000);
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.account.updateMany({
    where: {
      provider: GOOGLE_PROVIDER_ID,
      providerAccountId,
    },
    data,
  });
}

async function refreshGoogleAccessToken(
  token: ExtendedToken,
): Promise<ExtendedToken> {
  try {
    if (!token.refreshToken) {
      throw new Error("No refresh token available");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Google OAuth credentials");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens: {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    } = await response.json();

    if (!response.ok) {
      throw new Error(
        refreshedTokens.error_description ??
          refreshedTokens.error ??
          "Failed to refresh Google access token",
      );
    }

    const expiresAt =
      typeof refreshedTokens.expires_in === "number"
        ? Date.now() + refreshedTokens.expires_in * 1000
        : token.expiresAt;

    const updatedToken: ExtendedToken = {
      ...token,
      accessToken: refreshedTokens.access_token ?? token.accessToken,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      scope: refreshedTokens.scope ?? token.scope,
      expiresAt,
      error: undefined,
    };

    if (token.providerAccountId) {
      await persistAccountTokens(token.providerAccountId, updatedToken);
    }

    return updatedToken;
  } catch (error) {
    console.error("Failed to refresh Google access token", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_AUTHORIZATION_SCOPE,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      let extendedToken: ExtendedToken = { ...token };

      if (account?.provider === GOOGLE_PROVIDER_ID) {
        extendedToken = {
          ...extendedToken,
          accessToken: account.access_token ?? extendedToken.accessToken,
          refreshToken: account.refresh_token ?? extendedToken.refreshToken,
          scope: account.scope ?? extendedToken.scope,
          expiresAt:
            typeof account.expires_at === "number"
              ? account.expires_at * 1000
              : extendedToken.expiresAt,
          providerAccountId:
            account.providerAccountId ?? extendedToken.providerAccountId,
          error: undefined,
        };

        if (extendedToken.providerAccountId) {
          await persistAccountTokens(
            extendedToken.providerAccountId,
            extendedToken,
          );
        }

        return extendedToken;
      }

      if (
        extendedToken.expiresAt &&
        Date.now() < extendedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS
      ) {
        return extendedToken;
      }

      return refreshGoogleAccessToken(extendedToken);
    },
    async session({ session, token }) {
      const extendedToken = token as ExtendedToken;

      return {
        ...session,
        accessToken: extendedToken.accessToken,
        error: extendedToken.error,
      };
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
