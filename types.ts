import { LucideIcon } from 'lucide-react';

export interface Feature {
  title: string;
  step: string;
  description: string;
  detail: string;
  icon: LucideIcon;
}

export interface Persona {
  title: string;
  subtitle: string;
  description: string;
  metrics: string[];
  gradient: string;
}

export interface NavItem {
  label: string;
  href: string;
}