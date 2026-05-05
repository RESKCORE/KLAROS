import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/contexts/ClerkAuthContext";
import { useUser } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isMobile = useIsMobile();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const userName = user?.fullName || "User";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!userName) return "U";
    const names = userName.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  const navItems = [
    { name: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { name: "Connect Data", url: "/connect-data", icon: Database },
    { name: "History", url: "/history", icon: History },
  ];

  // Mobile menu toggle button
  const MobileMenuButton = () => (
    <Button
      variant="ghost"
      size="sm"
      className="fixed top-4 left-4 z-50 md:hidden rounded-full border bg-background/90 shadow-sm"
      onClick={() => setMobileOpen(!mobileOpen)}
    >
      {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </Button>
  );

  // Sidebar content
  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="relative flex h-20 items-center justify-center border-b border-border px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <Link to="/" className="relative flex items-center justify-center">
          <Logo size="sm" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.url;

          return (
            <Link
              key={item.name}
              to={item.url}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                !isMobile && collapsed && "justify-center"
              )}
              title={!isMobile && collapsed ? item.name : undefined}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary-foreground/15"
                    : "bg-muted/40 group-hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
              </span>
              {(isMobile || !collapsed) && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-3 space-y-2">
        {/* User Profile */}
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-muted/60",
            !isMobile && collapsed && "justify-center"
          )}
          title={!isMobile && collapsed ? userName : undefined}
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user?.imageUrl} alt={userName} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          {(isMobile || !collapsed) && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          )}
        </Link>

        {/* Logout Button */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-muted/60",
            !isMobile && collapsed && "justify-center px-2"
          )}
          title={!isMobile && collapsed ? "Logout" : undefined}
          onClick={signOut}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(isMobile || !collapsed) && <span>Logout</span>}
        </Button>
      </div>

      {/* Desktop toggle button */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <MobileMenuButton />

      {/* Mobile Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border/60 bg-gradient-to-b from-background via-background to-muted/40 backdrop-blur-sm transition-all duration-300",
          // Mobile styles
          isMobile
            ? cn(
              "w-64 transform",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )
            : // Desktop styles
            collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Spacer to prevent content from going under sidebar - only on desktop */}
      {!isMobile && (
        <div className={cn("transition-all duration-300", collapsed ? "ml-16" : "ml-64")} />
      )}
    </>
  );
}
