"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Veuillez renseigner votre email et votre mot de passe." };
  }

  const user = await authenticate(email, password);
  if (!user) {
    return { error: "Email ou mot de passe incorrect." };
  }

  await createSession(user);
  redirect(next.startsWith("/") ? next : "/dashboard");
}
