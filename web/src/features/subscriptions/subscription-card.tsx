import { Card, CardBody, cn } from "@heroui/react";
import { ComponentProps, ReactNode } from "react";

type RootProps = ComponentProps<typeof Card>;

function _Root({ children, className, ...props }: RootProps) {
  return (
    <Card className={className} {...props}>
      <CardBody className="flex flex-row items-center justify-between p-5">
        {children}
      </CardBody>
    </Card>
  );
}

type HeaderProps = ComponentProps<"div"> & {
  title: string;
};

function _Header({ title, children, className, ...props }: HeaderProps) {
  return (
    <div className={className} {...props}>
      <p className="text-foreground-500 text-small mb-1 font-medium">{title}</p>
      <div className="flex items-baseline gap-2">{children}</div>
    </div>
  );
}

type ValueProps = ComponentProps<"span"> & {
  children: ReactNode;
  suffix?: string;
};

function _Value({ children, suffix, className, ...props }: ValueProps) {
  return (
    <>
      <span className={cn("text-large font-bold", className)} {...props}>
        {children}
      </span>
      {suffix && (
        <span className="text-foreground-400 text-small">{suffix}</span>
      )}
    </>
  );
}

type IconProps = ComponentProps<"div">;

function _Icon({ children, className, ...props }: IconProps) {
  return (
    <div
      className={cn(
        "bg-secondary/10 text-secondary flex h-10 w-10 items-center justify-center rounded-full [&>svg]:size-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type SubscriptionCardComponent = typeof _Root & {
  Header: typeof _Header;
  Value: typeof _Value;
  Icon: typeof _Icon;
};

export const SubscriptionCard: SubscriptionCardComponent = Object.assign(
  _Root,
  {
    Header: _Header,
    Value: _Value,
    Icon: _Icon,
  },
);
