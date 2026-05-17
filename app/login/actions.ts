"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/$/, "");
  return "https://buygroup-manager.vercel.app";
}

export async function signIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const next = formValue(formData, "next") || "/";

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function signUp(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const firstName = formValue(formData, "firstName");
  const lastName = formValue(formData, "lastName");
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firstName,
        lastName,
        name: [firstName, lastName].filter(Boolean).join(" ").trim()
      }
    }
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Account created. Sign in to continue.");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formValue(formData, "email");
  const origin = (await headers()).get("origin") ?? siteUrl();
  const redirectTo = `${origin.replace(/\/$/, "")}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/forgot-password?message=Check your email for a password reset link.");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const password = formValue(formData, "password");
  const confirmPassword = formValue(formData, "confirmPassword");

  if (password !== confirmPassword) {
    redirect("/reset-password?error=Passwords%20do%20not%20match.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Password updated. Sign in with your new password.");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
