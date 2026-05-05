import { LayoutDashboard, Database, Home } from "lucide-react";
import { NavBar } from "@/components/ui/tubelight-navbar";

export function Header() {
  const navItems = [
    { name: "Home", url: "/", icon: Home },
    { name: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { name: "Connect Data", url: "/connect-data", icon: Database },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="container flex h-20 items-center justify-center">
        <NavBar items={navItems} />
      </div>
    </header>
  );
}
