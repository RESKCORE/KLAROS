import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin, Heart } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="relative border-t border-border/40 bg-gradient-to-b from-muted/30 to-muted/50">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-mesh opacity-20" />

      <div className="container relative py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-4 group">
              <Logo size="md" />
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-4">
              Transform complex decisions into clear, data-driven outcomes with AI-powered analysis.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-2">
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <nav className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <Link to="/dashboard" className="hover:text-foreground transition-colors w-fit">
                Dashboard
              </Link>
              <Link to="/connect-data" className="hover:text-foreground transition-colors w-fit">
                Connect Data
              </Link>
              <a href="#how-it-works" className="hover:text-foreground transition-colors w-fit">
                How It Works
              </a>
              <a href="#" className="hover:text-foreground transition-colors w-fit">
                Pricing
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <nav className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors w-fit">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-foreground transition-colors w-fit">
                Terms of Service
              </a>
              <a href="#" className="hover:text-foreground transition-colors w-fit">
                Cookie Policy
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} KLAROS. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            Made with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> for better decisions
          </p>
        </div>
      </div>
    </footer>
  );
}
