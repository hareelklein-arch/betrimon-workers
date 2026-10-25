"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/auth-actions";
import { PleaseWait, busy, waitLabel } from "@/components/please-wait";

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <form
      action={() => {
        busy(start, async () => {
          await logoutAction();
        });
      }}
    >
      <PleaseWait show={pending} />
      <button className="btn btn-secondary" type="submit" disabled={pending}>
        {waitLabel(pending, "יציאה")}
      </button>
    </form>
  );
}
