import { YOUTUBE_MUSIC_URL_PATTERN } from "@/lib/url";
import { Input } from "@heroui/react";
import { Link } from "lucide-react";

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function UrlInput({
  value,
  onChange,
  disabled,
  placeholder = "Album or playlist URL",
}: UrlInputProps) {
  const isValid = value === "" || YOUTUBE_MUSIC_URL_PATTERN.test(value);

  return (
    <Input
      isClearable
      variant="faded"
      type="url"
      placeholder={placeholder}
      value={value}
      onValueChange={(v) => onChange(v.trim())}
      isDisabled={disabled}
      isInvalid={!isValid}
      radius="lg"
      errorMessage={!isValid ? "Enter a valid YouTube URL" : undefined}
      startContent={<Link className="text-foreground-400 h-4 w-4" />}
    />
  );
}
