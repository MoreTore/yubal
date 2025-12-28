import { addToast, Button } from "@heroui/react";
import { Cookie, Disc3, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCookiesStatus, uploadCookies } from "../api/cookies";
import { useTheme } from "../hooks/useTheme";

export function Header() {
  const { theme, toggle } = useTheme();
  const [cookiesConfigured, setCookiesConfigured] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCookiesStatus().then(setCookiesConfigured);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const content = await file.text();
      const success = await uploadCookies(content);

      if (success) {
        setCookiesConfigured(true);
        addToast({
          title: "Cookies uploaded",
          description: "YouTube cookies configured successfully",
          color: "success",
        });
      } else {
        addToast({
          title: "Upload failed",
          description: "Failed to upload cookies file",
          color: "danger",
        });
      }
    } catch {
      addToast({
        title: "Upload failed",
        description: "Could not read the file",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <header className="mb-6 flex items-center gap-3">
      <div className="border-primary/20 bg-primary/10 rounded-lg border p-2">
        <Disc3 className="text-primary h-6 w-6" />
      </div>
      <div className="flex-1">
        <h1 className="text-foreground font-mono text-xl font-semibold tracking-tight">
          yubal
        </h1>
        <p className="text-foreground-500 font-mono text-xs">v0.1.0</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        isIconOnly
        variant="light"
        aria-label="Upload cookies"
        isLoading={isUploading}
        onPress={() => fileInputRef.current?.click()}
      >
        <Cookie
          className={`h-5 w-5 ${cookiesConfigured ? "text-success" : ""}`}
        />
      </Button>
      <Button
        isIconOnly
        variant="light"
        aria-label="Toggle theme"
        onPress={toggle}
      >
        {theme === "dark" ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </Button>
    </header>
  );
}
