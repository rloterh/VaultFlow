import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Building2,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  minRole?: Role;
  badge?: string;
  children?: NavItem[];
}

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Invoices",
    href: "/dashboard/invoices",
    icon: FileText,
    badge: "10",
  },
  {
    title: "Clients",
    href: "/dashboard/clients",
    icon: Users,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    minRole: "manager",
  },
];

export const bottomNavItems: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { title: "General", href: "/settings", icon: Building2 },
      { title: "Team", href: "/settings/team", icon: Users, minRole: "admin" },
      { title: "Billing", href: "/settings/billing", icon: CreditCard, minRole: "admin" },
    ],
  },
];
