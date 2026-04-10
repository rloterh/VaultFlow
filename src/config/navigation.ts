import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Building2,
  Shield,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { Permission, Role } from "./roles";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  minRole?: Role;
  permission?: Permission;
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
    permission: "reports:read",
  },
  {
    title: "Activity",
    href: "/dashboard/activity",
    icon: Activity,
    minRole: "manager",
  },
  {
    title: "Admin",
    href: "/dashboard/admin",
    icon: Shield,
    minRole: "admin",
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
      { title: "Billing", href: "/settings/billing", icon: CreditCard, permission: "org:billing" },
    ],
  },
];
