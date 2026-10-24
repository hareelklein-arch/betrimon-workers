"use server";

import { redirect } from "next/navigation";
import { loginWithPassword, logout } from "@/lib/auth";

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function loginAction(formData: FormData) {
  return loginWithPassword(formString(formData, "username"), formString(formData, "password"));
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
