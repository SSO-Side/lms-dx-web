"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changePasswordAction } from "@/server/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function PasswordForm({ canCancel }: { canCancel: boolean }) {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">현재(임시) 비밀번호</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required autoFocus disabled={isPending} className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">새 비밀번호</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} disabled={isPending} className="h-11" aria-describedby="newPasswordHint" />
        <p id="newPasswordHint" className="text-xs text-neutral-500">
          8자 이상
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} disabled={isPending} className="h-11" />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? "변경하는 중…" : "비밀번호 변경"}
      </Button>
      {canCancel && (
        <Link href="/app" className={buttonVariants({ variant: "ghost", className: "w-full" })}>
          취소
        </Link>
      )}
    </form>
  );
}
