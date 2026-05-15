"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
