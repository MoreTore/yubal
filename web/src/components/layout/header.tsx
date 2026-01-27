import {
  Button,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { useRouterState } from "@tanstack/react-router";
import { Disc3, Star } from "lucide-react";
import { useState } from "react";
import { useCookies } from "../../hooks/use-cookies";
import { CookieDropdown } from "../common/cookie-dropdown";
import { AnimatedThemeToggler } from "../magicui/animated-theme-toggler";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const {
    cookiesConfigured,
    isUploading,
    isDeleting,
    fileInputRef,
    handleFileSelect,
    handleDropdownAction,
    triggerFileUpload,
  } = useCookies();

  return (
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="lg"
      classNames={{
        brand: "grow-0",
      }}
    >
      <NavbarBrand className="mr-4">
        <Disc3 className="text-primary h-8 w-8" />
        <p className="ml-2 hidden text-xl font-extrabold sm:block">yubal</p>
      </NavbarBrand>
      <NavbarContent justify="start" className="gap-2">
        <NavbarItem className="group" isActive={currentPath === "/"}>
          <Link
            isBlock
            href="/"
            color="foreground"
            className="px-3 py-2 font-normal text-foreground-400 group-data-[active=true]:text-foreground"
          >
            Downloads
          </Link>
        </NavbarItem>
        <NavbarItem className="group" isActive={currentPath === "/sync"}>
          <Link
            isBlock
            href="/sync"
            color="foreground"
            className="px-3 py-2 font-normal text-foreground-400 group-data-[active=true]:text-foreground"
          >
            Playlists
          </Link>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="items-center gap-2" justify="end">
        <NavbarItem>
          <Button
            as="a"
            href="https://github.com/guillevc/yubal"
            target="_blank"
            rel="noopener noreferrer"
            variant="light"
            startContent={
              <Star
                className="h-4 w-4 fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300"
                strokeWidth={1}
              />
            }
          >
            Star on GitHub
          </Button>
        </NavbarItem>
        <NavbarItem>
          <CookieDropdown
            variant="desktop"
            cookiesConfigured={cookiesConfigured}
            isUploading={isUploading}
            isDeleting={isDeleting}
            onDropdownAction={handleDropdownAction}
            onUploadClick={triggerFileUpload}
          />
        </NavbarItem>
        <NavbarItem>
          <AnimatedThemeToggler />
        </NavbarItem>
      </NavbarContent>

      {/* Hidden file input for cookie upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleFileSelect}
        className="hidden"
      />
    </Navbar>
  );
}
