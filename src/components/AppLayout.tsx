import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Mail, Sparkles, History, Bookmark, CreditCard, User, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/translations";

const navItems: { to: string; icon: typeof Sparkles; label: TranslationKey }[] = [
  { to: "/app", icon: Sparkles, label: "nav.generate" },
  { to: "/app/history", icon: History, label: "nav.history" },
  { to: "/app/snippets", icon: Bookmark, label: "nav.snippets" },
  { to: "/pricing", icon: CreditCard, label: "nav.pricing" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (to: string) =>
    to === "/app" ? pathname === "/app" : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="flex h-16 items-center px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/app" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-md">
                <Mail className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-display text-foreground hidden sm:block">
                {t("brand.name")}
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 flex-1 justify-end mx-3">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("gap-2", isActive(item.to) && "bg-secondary text-secondary-foreground")}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{t(item.label)}</span>
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 ms-auto md:ms-0">
            <LanguageToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-secondary">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app/account")}>
                  <User className="me-2 h-4 w-4" /> {t("nav.account")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/pricing")}>
                  <CreditCard className="me-2 h-4 w-4" /> {t("nav.pricing")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="me-2 h-4 w-4" /> {t("nav.signout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Mail className="h-4 w-4 text-primary-foreground" />
              </div>
              {t("brand.name")}
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                <Button
                  variant="ghost"
                  className={cn("w-full justify-start gap-3 h-12", isActive(item.to) && "bg-secondary text-secondary-foreground")}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.label)}
                </Button>
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            <Button variant="ghost" className="w-full justify-start gap-3 h-12" onClick={() => { setMobileOpen(false); navigate("/app/account"); }}>
              <User className="h-5 w-5" />
              {t("nav.account")}
            </Button>
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
