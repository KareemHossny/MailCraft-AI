import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages } from "lucide-react";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, toggleLocale } = useLanguage();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className={className}
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">{locale === "en" ? "العربية" : "EN"}</span>
    </Button>
  );
}
