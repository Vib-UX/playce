"use client";

import { useState } from "react";
import { Mail, Loader2, Sparkles } from "lucide-react";
import { usePlaycesAuth } from "@/lib/auth/context";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface PrivyAuthButtonProps extends Omit<ButtonProps, "onClick"> {
  label?: string;
  onAuthenticated?: () => void;
}

/**
 * Single sign-in entry point. With Privy configured it opens the Privy modal;
 * in demo mode it collects an email and provisions a mock embedded wallet —
 * same UX, no wallet jargon.
 */
export function PrivyAuthButton({
  label = "Sign in",
  onAuthenticated,
  variant = "gradient",
  size = "md",
  children,
  ...props
}: PrivyAuthButtonProps) {
  const { login, mode, ready } = usePlaycesAuth();
  const [demoOpen, setDemoOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (mode === "demo") {
      setDemoOpen(true);
    } else {
      login();
    }
  };

  const submitDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    await login(email);
    setPending(false);
    setDemoOpen(false);
    onAuthenticated?.();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={!ready}
        {...props}
      >
        {children ?? (
          <>
            <Mail className="size-4" />
            {label}
          </>
        )}
      </Button>

      <Modal open={demoOpen} onClose={() => setDemoOpen(false)} className="max-w-md">
        <div className="p-7">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="size-3.5" />
            Demo onboarding
          </div>
          <h2 className="font-display text-xl font-semibold">Continue with email</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We&apos;ll create a secure embedded wallet for you instantly. No
            seed phrases, no extensions.
          </p>
          <form onSubmit={submitDemo} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-full border border-input bg-background pl-10 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating your wallet…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Powered by Privy embedded wallets · {ACTIVE_CHAIN.name}
          </p>
        </div>
      </Modal>
    </>
  );
}
