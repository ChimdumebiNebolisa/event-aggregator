import Image from "next/image";
import { getServerSession } from "next-auth";

import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-8 text-white">
        <div className="flex max-w-lg flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-semibold">Welcome to Event Aggregator</h1>
          <p className="text-lg text-slate-200">
            Sign in with Google to start discovering events tailored for you.
          </p>
          <GoogleSignInButton />
        </div>
      </div>
    );
  }

  const displayName = session.user?.name ?? "there";
  const avatar = session.user?.image;
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-8 text-white">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        {avatar ? (
          <Image
            src={avatar}
            alt={`${displayName}'s profile picture`}
            width={128}
            height={128}
            className="h-32 w-32 rounded-full object-cover shadow-lg"
            unoptimized
            priority
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold uppercase shadow-lg">
            {initial}
          </div>
        )}
        <h1 className="text-4xl font-semibold">Hello, {displayName}!</h1>
        <p className="text-lg text-slate-200">
          You are signed in with Google. Explore your personalized event feed and stay up to date with the latest happenings.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
