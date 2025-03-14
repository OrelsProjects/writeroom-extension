import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isSelected: boolean;
}

export function NavItem({ to, icon: Icon, label, isSelected }: NavItemProps) {
  const navItemClassname = `nav-item ${isSelected ? "nav-item-selected" : ""}`;

  return (
    <Link to={to}>
      <Icon className={navItemClassname} />
    </Link>
  );
}
