import { ArrowDownToLine, Cable, Construction, Cpu, Droplets, FileText, Frame, Gauge, LayoutPanelTop, Plug, ScanSearch, ShieldCheck, Smartphone, Thermometer, ToggleRight, Truck, type LucideIcon } from "lucide-react";
import type { MaintIcon } from "@/lib/maintenance";

export const MAINT_ICONS: Record<MaintIcon, LucideIcon> = {
  droplets: Droplets,
  scan: ScanSearch,
  thermo: Thermometer,
  frame: Frame,
  plug: Plug,
  gauge: Gauge,
  ground: ArrowDownToLine,
  panel: LayoutPanelTop,
  shield: ShieldCheck,
  toggle: ToggleRight,
  cable: Cable,
  cpu: Cpu,
  phone: Smartphone,
  report: FileText,
  truck: Truck,
  ladder: Construction,
};
