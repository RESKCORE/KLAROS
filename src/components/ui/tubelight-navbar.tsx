"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import { LucideIcon, LogIn, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [isMobile, setIsMobile] = useState(false)

  // Update active tab based on current route
  useEffect(() => {
    const currentItem = items.find((item) => {
      // Handle hash links
      if (item.url.includes('#')) {
        return location.pathname + location.hash === item.url
      }
      return location.pathname === item.url
    })
    if (currentItem) {
      setActiveTab(currentItem.name)
    }
  }, [location.pathname, location.hash, items])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className={cn("inline-flex", className)}>
      <div className="flex items-center gap-2 bg-background/80 border border-border/60 backdrop-blur-xl py-1.5 px-2 rounded-full shadow-2xl shadow-black/5">
        {/* Logo - Left side */}
        <Link to="/" className="group flex items-center justify-center px-2 transition-all hover:opacity-90">
          <Logo size="sm" />
        </Link>

        {/* Separator */}
        <div className="w-px h-8 bg-border/60 mx-1" />

        {/* Navigation items */}
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name
          const isHashLink = item.url.includes('#')

          const handleClick = (e: React.MouseEvent) => {
            setActiveTab(item.name)
            
            if (isHashLink) {
              e.preventDefault()
              const hash = item.url.split('#')[1]
              const element = document.getElementById(hash)
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                window.history.pushState(null, '', item.url)
              }
            }
          }

          return (
            <Link
              key={item.name}
              to={item.url}
              onClick={handleClick}
              className={cn(
                "relative cursor-pointer text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200",
                "text-foreground/70 hover:text-foreground",
                isActive && "text-primary",
              )}
            >
              <span className="relative z-10 hidden md:inline">{item.name}</span>
              <span className="relative z-10 md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                  }}
                >
                  {/* Tubelight glow effect */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-primary rounded-t-full shadow-lg shadow-primary/50">
                    <div className="absolute w-16 h-8 bg-primary/30 rounded-full blur-lg -top-3 -left-2" />
                    <div className="absolute w-12 h-6 bg-primary/40 rounded-full blur-md -top-2" />
                    <div className="absolute w-6 h-5 bg-primary/50 rounded-full blur-sm -top-1 left-3" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}

        {/* Separator */}
        <div className="w-px h-8 bg-border/60 mx-1" />

        {/* Login/Signup Button */}
        <Link to="/login">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 h-10 px-4 hover:bg-primary/5 rounded-full"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Login / Signup</span>
          </Button>
        </Link>

        {/* Get Started Button */}
        <Link to="/connect-data">
          <Button 
            size="sm" 
            className="gap-2 h-10 px-4 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/30"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Get Started</span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
