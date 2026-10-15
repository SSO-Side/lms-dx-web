"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="loginId">아이디</Label>
        <Input id="loginId" name="loginId" autoComplete="username" required autoFocus disabled={isPending} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="h-11"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "로그인하는 중…" : "로그인"}
      </Button>
    </form>
  );
}
