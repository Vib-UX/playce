import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="aurora-text font-display text-6xl font-bold">404</span>
      <h1 className="mt-4 font-display text-2xl font-bold">Moment not found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you
        back to capturing moments.
      </p>
      <Link href="/" className={buttonVariants({ variant: "gradient", className: "mt-6" })}>
        Back home
      </Link>
    </div>
  );
}
