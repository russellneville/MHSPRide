'use client';
import Image from "next/image";
import { Button } from "../ui/button";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Header() {
  const links = [
    { path: "/", name: "Home" },
    { path: "/dashboard", name: "Book a ride" },
    { path: "#about", name: "About us" },
    { path: "#contact", name: "Contact us" },
  ];

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled />;
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-background border-b border-border">
      <div className="flex items-center justify-between px-6 md:px-20 py-4">
        {/* Logo */}
        <Link href="/">
          <div className="cursor-pointer">
            <Image
              className="dark:hidden"
              src="/assets/mhsp_title_logo.png"
              alt="logo"
              height={35}
              width={125}
            />
            <Image
              className="hidden dark:block"
              src="/assets/mhsp_title_logo.png"
              alt="logo"
              height={35}
              width={125}
            />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map(({ path, name }) => (
            <Link
              key={name}
              href={path}
              className="text-sm font-medium transition hover:text-mainColor"
            >
              {name}
            </Link>
          ))}
        </nav>

        {/* Right side buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

          <Button asChild className="hidden md:inline-flex">
            <Link href="/register">Get started</Link>
          </Button>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-md border border-border"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-background border-t border-border">
          <nav className="flex flex-col items-center py-4 space-y-3">
            {links.map(({ path, name }) => (
              <Link
                key={name}
                href={path}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium transition hover:text-mainColor"
              >
                {name}
              </Link>
            ))}
            <Button asChild onClick={() => setMenuOpen(false)}>
              <Link href="/login">Get started</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
