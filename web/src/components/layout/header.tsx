import {
  Button,
  Chip,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Tooltip,
} from "@heroui/react";
import { useRouterState } from "@tanstack/react-router";
import { Disc3, Download, RefreshCw, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useCookies } from "../../hooks/use-cookies";
import { useVersionCheck } from "../../hooks/use-version-check";
import { CookieDropdown } from "../common/cookie-dropdown";
import { AnimatedThemeToggler } from "../magicui/animated-theme-toggler";

const MotionNavbarContent = motion.create(NavbarContent);

const blurFadeAnimation = {
  initial: { opacity: 0, y: -12, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: versionInfo } = useVersionCheck();
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
      position="sticky"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="lg"
    >
      {/* Mobile menu toggle */}
      <NavbarContent className="sm:hidden" justify="start">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        />
      </NavbarContent>

      {/* Brand - centered on mobile, left on desktop */}
      <NavbarContent className="pr-3 sm:hidden" justify="center">
        <NavbarBrand className="gap-2">
          <Disc3 className="text-primary h-7 w-7" />
          <span className="text-foreground text-large font-mono font-bold">
            yubal
          </span>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop: brand + navigation grouped together */}
      <MotionNavbarContent
        className="hidden sm:flex"
        justify="start"
        {...blurFadeAnimation}
      >
        <NavbarBrand className="mr-4 gap-3">
          <Disc3 className="text-primary h-8 w-8" />
          <span className="text-foreground text-large font-mono font-bold">
            yubal
          </span>
          <Chip
            as="a"
            href={`https://github.com/guillevc/yubal/${__IS_RELEASE__ ? `releases/tag/${__VERSION__}` : `commit/${__COMMIT_SHA__}`}`}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="flat"
            color="primary"
            classNames={{
              base: "cursor-pointer",
              content: "font-mono text-xs tracking-wider",
            }}
          >
            {__VERSION__}
          </Chip>
          <AnimatePresence>
            {versionInfo?.updateAvailable && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Tooltip
                  content="New version available - click to view release"
                  closeDelay={0}
                >
                  <Chip
                    as="a"
                    href={versionInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="dot"
                    color="secondary"
                    classNames={{
                      dot: "animate-pulse",
                    }}
                  >
                    <span className="font-mono">
                      {versionInfo.latestVersion} released
                    </span>
                  </Chip>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </NavbarBrand>
        <NavbarContent className="gap-3">
          <NavbarItem isActive={currentPath === "/"}>
            <Link
              href="/"
              color={currentPath === "/" ? "primary" : "foreground"}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Downloads
            </Link>
          </NavbarItem>
          <NavbarItem isActive={currentPath === "/sync"}>
            <Link
              href="/sync"
              color={currentPath === "/sync" ? "primary" : "foreground"}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Sync
            </Link>
          </NavbarItem>
        </NavbarContent>
      </MotionNavbarContent>

      {/* Desktop navigation items */}
      <MotionNavbarContent
        justify="end"
        className="hidden gap-1 sm:flex"
        {...blurFadeAnimation}
      >
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

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileSelect}
          className="hidden"
        />

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
      </MotionNavbarContent>

      {/* Mobile: theme toggle always visible */}
      <NavbarContent className="sm:hidden" justify="end">
        <NavbarItem>
          <AnimatedThemeToggler />
        </NavbarItem>
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu>
        <NavbarMenuItem isActive={currentPath === "/"}>
          <Link
            href="/"
            color={currentPath === "/" ? "primary" : "foreground"}
            className="flex w-full items-center gap-2"
            size="lg"
            onPress={() => setIsMenuOpen(false)}
          >
            <Download className="h-4 w-4" />
            Downloads
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem isActive={currentPath === "/sync"}>
          <Link
            href="/sync"
            color={currentPath === "/sync" ? "primary" : "foreground"}
            className="flex w-full items-center gap-2"
            size="lg"
            onPress={() => setIsMenuOpen(false)}
          >
            <RefreshCw className="h-4 w-4" />
            Sync
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            as="a"
            href="https://github.com/guillevc/yubal"
            target="_blank"
            rel="noopener noreferrer"
            color="foreground"
            className="w-full gap-2"
            size="lg"
          >
            <Star
              className="h-4 w-4 fill-amber-400 text-amber-400"
              strokeWidth={1}
            />
            Star on GitHub
          </Link>
        </NavbarMenuItem>
        <NavbarMenuItem>
          <CookieDropdown
            variant="mobile"
            cookiesConfigured={cookiesConfigured}
            isUploading={isUploading}
            isDeleting={isDeleting}
            onDropdownAction={handleDropdownAction}
            onUploadClick={triggerFileUpload}
          />
        </NavbarMenuItem>
        <NavbarMenuItem>
          <Link
            as="a"
            href={`https://github.com/guillevc/yubal/${__IS_RELEASE__ ? `releases/tag/${__VERSION__}` : `commit/${__COMMIT_SHA__}`}`}
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            className="w-full gap-2"
            size="lg"
          >
            Version {__VERSION__}
          </Link>
        </NavbarMenuItem>
        {versionInfo?.updateAvailable && (
          <NavbarMenuItem>
            <Link
              as="a"
              href={versionInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              color="success"
              className="w-full gap-2"
              size="lg"
            >
              <span className="text-secondary">
                Update to {versionInfo.latestVersion}
              </span>
            </Link>
          </NavbarMenuItem>
        )}
      </NavbarMenu>
    </Navbar>
  );
}
