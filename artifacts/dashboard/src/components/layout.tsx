import { useTheme } from "./theme-provider";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Activity,
  Settings,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { Button } from "./ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
  { icon: Users, label: "Contacts", href: "/contacts" },
  { icon: Activity, label: "Tracking", href: "/tracking" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-20 flex h-full w-64 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold tracking-tight">Campaign Ops</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
                
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t p-4 flex flex-col gap-2">
          <Link href="/settings/providers">
            <div
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                location.startsWith("/settings")
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </div>
          </Link>
          
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-muted-foreground font-medium">Theme</span>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <button
                onClick={() => setTheme("light")}
                className={`p-1 rounded-sm ${theme === "light" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Sun className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1 rounded-sm ${theme === "dark" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Moon className="h-3 w-3" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-1 rounded-sm ${theme === "system" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Monitor className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pl-64">
        <div className="mx-auto max-w-6xl p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
