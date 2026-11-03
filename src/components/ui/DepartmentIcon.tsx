import {
  Baby,
  Bone,
  Brain,
  Ear,
  Eye,
  Hand,
  HeartPulse,
  Siren,
  Stethoscope,
  Venus,
  type LucideIcon,
} from 'lucide-react';
import type { DepartmentIcon as DepartmentIconKey } from '@/types';
import { cn } from '@/lib/cn';

export const DEPARTMENT_ICON_MAP: Record<DepartmentIconKey, LucideIcon> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  bone: Bone,
  baby: Baby,
  venus: Venus,
  hand: Hand,
  ear: Ear,
  brain: Brain,
  eye: Eye,
  siren: Siren,
};

export function DepartmentIcon({
  icon,
  className,
  boxed = false,
}: {
  icon: DepartmentIconKey;
  className?: string;
  boxed?: boolean;
}) {
  const Icon = DEPARTMENT_ICON_MAP[icon];
  if (!boxed) return <Icon aria-hidden className={cn('h-5 w-5', className)} />;
  return (
    <span
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink',
        className,
      )}
    >
      <Icon aria-hidden className="h-6 w-6" />
    </span>
  );
}
