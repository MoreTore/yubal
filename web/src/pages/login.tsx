import { useAuth } from "@/features/auth/auth-context";
import { Button, Card, CardBody, Input } from "@heroui/react";
import { Disc3 } from "lucide-react";
import { FormEvent, useState } from "react";

export function LoginPage() {
  const { enabled, login, isLoggingIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const success = await login(username.trim(), password);
    if (!success) {
      setError("Invalid username or password");
    }
  };

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-foreground text-base">
            Local authentication is disabled on this server.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <CardBody className="gap-6">
          <div className="text-center">
            <Disc3 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-semibold">Sign in to yubal</h1>
            <p className="text-foreground-500 mt-2 text-sm">
              Use the credentials configured via <code>YUBAL_AUTH_*</code>.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              label="Username"
              variant="bordered"
              value={username}
              onValueChange={setUsername}
              autoComplete="username"
              isRequired
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              variant="bordered"
              value={password}
              onValueChange={setPassword}
              autoComplete="current-password"
              isRequired
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button color="primary" type="submit" isLoading={isLoggingIn}>
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
