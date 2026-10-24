export function isNextControlFlow(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

export function errorText(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as { message?: string; code?: string; meta?: unknown };
    return [e.code, e.message, e.meta ? JSON.stringify(e.meta) : ""].filter(Boolean).join("\n");
  }
  return String(error);
}
