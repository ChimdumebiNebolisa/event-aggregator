"use client";

import type { ReactNode } from "react";
import { signIn, signOut } from "next-auth/react";

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
}

function AuthButton({ children, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
    >
      {children}
    </button>
  );
}

export function GoogleSignInButton() {
  return <AuthButton onClick={() => void signIn("google")}>Sign in with Google</AuthButton>;
}

export function SignOutButton() {
  return <AuthButton onClick={() => void signOut()}>Sign out</AuthButton>;
}
