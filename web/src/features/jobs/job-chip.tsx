import { Chip } from "@heroui/react";
import { ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

const jobChip = tv({
  base: "font-mono",
  variants: {
    variant: {
      flat: "text-foreground-500",
      album: "bg-primary/15 text-primary",
      playlist: "bg-secondary/15 text-secondary",
      track:
        "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
    },
  },
  defaultVariants: {
    variant: "flat",
  },
});

type Props = {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof jobChip>;

export function JobChip({ children, variant, className }: Props) {
  return (
    <Chip
      size="sm"
      variant="flat"
      classNames={{
        base: jobChip({ variant, className }),
      }}
    >
      {children}
    </Chip>
  );
}
