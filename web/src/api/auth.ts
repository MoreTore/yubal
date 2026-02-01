export interface AuthSession {
  enabled: boolean;
  authenticated: boolean;
}

export async function getAuthSession(): Promise<AuthSession> {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to load auth session");
  }
  return (await response.json()) as AuthSession;
}

export async function login(username: string, password: string): Promise<boolean> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
