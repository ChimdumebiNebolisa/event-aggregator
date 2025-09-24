import NextAuth, { type NextAuthOptions, type Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import type { JWT } from "next-auth/jwt";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

const GOOGLE_PROVIDER_ID = "google";

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
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
    // AzureADProvider({
    //   clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
    //   clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
    //   tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
    // }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      let extendedToken: ExtendedToken = {
        ...token,
      };

      if (account) {
        const expiresAt = account.expires_at
          ? account.expires_at * 1000
          : account.expires_in
            ? Date.now() + account.expires_in * 1000
            : undefined;

        extendedToken = {
          ...extendedToken,
          accessToken: account.access_token ?? extendedToken.accessToken,
          refreshToken: account.refresh_token ?? extendedToken.refreshToken,
          scope: account.scope ?? extendedToken.scope,
          expiresAt,
          providerAccountId:
            account.providerAccountId ?? extendedToken.providerAccountId,
          error: undefined,
        };

        if (account.providerAccountId) {
          await persistAccountTokens(account.providerAccountId, extendedToken);
        }
      }

      if (!extendedToken.expiresAt || Date.now() + 60_000 < extendedToken.expiresAt) {
        return extendedToken;
      }

      return refreshGoogleAccessToken(extendedToken);
    },
    async session({ session, token }) {
      const extendedToken = token as ExtendedToken;

      const enrichedSession = {
        ...session,
        user: {
          ...session.user,
          id: extendedToken.sub,
        },
        accessToken: extendedToken.accessToken,
        error: extendedToken.error,
      } as Session & { accessToken?: string; error?: string };

      return enrichedSession;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
