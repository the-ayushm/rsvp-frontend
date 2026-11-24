import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  markClassName?: string;
  compact?: boolean;
  light?: boolean;
  priority?: boolean;
};

export function DoveKnotMark({ className, priority = false }: Pick<LogoProps, "className" | "priority">) {
  return (
    <Image
      src="/brand/doveknot-mark.png"
      alt="DoveKnot"
      width={48}
      height={48}
      priority={priority}
      className={cn("h-10 w-10 object-contain", className)}
    />
  );
}

export function DoveKnotLogo({
  className,
  markClassName,
  compact = false,
  light = false,
  priority = false,
}: LogoProps) {
  if (compact) return <DoveKnotMark className={cn("h-9 w-9", markClassName, className)} priority={priority} />;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3", className)} aria-label="DoveKnot">
      <DoveKnotMark className={cn("h-10 w-10 shrink-0", markClassName)} priority={priority} />
      <span
        className={cn(
          "min-w-0 font-display text-[19px] font-semibold leading-none tracking-[0.08em]",
          light ? "text-white" : "text-foreground",
        )}
      >
        DoveKnot
      </span>
    </span>
  );
}
