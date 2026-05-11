import * as Lucide from 'lucide-react';
import type { LucideIcon as LucideIconType } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Курируемый набор иконок Lucide для категорий каталога.
 *
 * Зачем курируемый, а не `import * as Lucide`: tree-shaking не работает
 * с динамическими `Lucide[name]` — собрался бы весь пакет (~1.5 MB).
 * Список ниже покрывает строительную/инженерную/бытовую технику и общие
 * категории. Расширяется добавлением имени в `ICONS`.
 *
 * Контракт: значение поля `Category.icon` — это ключ из `ICON_NAMES`.
 * Если значение пустое или неизвестное — рендерится `Wrench` (fallback).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const L = Lucide as unknown as Record<string, LucideIconType | any>;

export const ICONS: Record<string, LucideIconType> = {
  // === Инструменты ===
  Wrench: L.Wrench,
  Hammer: L.Hammer,
  Screwdriver: L.Screwdriver ?? L.Wrench,
  Pickaxe: L.Pickaxe ?? L.Hammer,
  Axe: L.Axe ?? L.Hammer,
  Drill: L.Drill ?? L.Wrench,
  Saw: L.Saw ?? L.Hammer,
  Cog: L.Cog,
  Settings: L.Settings,
  Settings2: L.Settings2,

  // === Электрика и энергия ===
  Zap: L.Zap,
  ZapOff: L.ZapOff,
  Plug: L.Plug,
  PlugZap: L.PlugZap,
  Battery: L.Battery,
  BatteryCharging: L.BatteryCharging,
  BatteryFull: L.BatteryFull,
  Power: L.Power,
  CircuitBoard: L.CircuitBoard,
  Cable: L.Cable,
  Cpu: L.Cpu,

  // === Строительство ===
  Construction: L.Construction,
  HardHat: L.HardHat,
  Brick: L.Brick ?? L.Layers,
  BrickWall: L.BrickWall ?? L.Layers,
  Building: L.Building,
  Building2: L.Building2,
  Layers: L.Layers,
  Layers2: L.Layers2 ?? L.Layers,
  Layers3: L.Layers3 ?? L.Layers,
  Fence: L.Fence ?? L.Layers,
  Pyramid: L.Pyramid,
  Crane: L.Crane ?? L.Construction,

  // === Транспорт ===
  Truck: L.Truck,
  Car: L.Car,
  Bus: L.Bus,
  Bike: L.Bike,
  Tractor: L.Tractor ?? L.Truck,
  Forklift: L.Forklift ?? L.Truck,
  Container: L.Container,
  Caravan: L.Caravan ?? L.Truck,

  // === Климат и тепло ===
  Flame: L.Flame,
  Thermometer: L.Thermometer,
  ThermometerSun: L.ThermometerSun,
  ThermometerSnowflake: L.ThermometerSnowflake,
  Snowflake: L.Snowflake,
  Wind: L.Wind,
  Fan: L.Fan,
  AirVent: L.AirVent,
  Sun: L.Sun,
  CloudRain: L.CloudRain,

  // === Сад и природа ===
  Trees: L.Trees,
  TreeDeciduous: L.TreeDeciduous,
  TreePine: L.TreePine,
  Sprout: L.Sprout,
  Leaf: L.Leaf,
  Flower: L.Flower,
  Flower2: L.Flower2,
  Shovel: L.Shovel,

  // === Вода / уборка ===
  Droplet: L.Droplet,
  Droplets: L.Droplets,
  WavesIcon: L.Waves,
  SprayCan: L.SprayCan,
  Brush: L.Brush,
  PaintBucket: L.PaintBucket,
  PaintRoller: L.PaintRoller ?? L.Brush,
  Trash: L.Trash,
  Trash2: L.Trash2,
  Recycle: L.Recycle,

  // === Освещение ===
  Lightbulb: L.Lightbulb,
  LampDesk: L.LampDesk,
  LampFloor: L.LampFloor,
  LampCeiling: L.LampCeiling ?? L.Lightbulb,
  Sparkles: L.Sparkles,

  // === Безопасность ===
  Shield: L.Shield,
  ShieldCheck: L.ShieldCheck,
  ShieldAlert: L.ShieldAlert,
  Lock: L.Lock,
  Key: L.Key,
  AlarmSmoke: L.AlarmSmoke ?? L.Bell,
  Eye: L.Eye,
  ScanEye: L.ScanEye ?? L.Eye,

  // === Измерения ===
  Ruler: L.Ruler,
  Compass: L.Compass,
  Calculator: L.Calculator,
  Gauge: L.Gauge,
  Scale: L.Scale,

  // === Бытовая техника ===
  Refrigerator: L.Refrigerator ?? L.Box,
  WashingMachine: L.WashingMachine ?? L.Box,
  Microwave: L.Microwave ?? L.Box,
  Tv: L.Tv,
  Tv2: L.Tv2,
  Speaker: L.Speaker,
  Headphones: L.Headphones,
  Mic: L.Mic,

  // === Мебель / быт ===
  Sofa: L.Sofa,
  Armchair: L.Armchair,
  Bed: L.Bed,
  Lamp: L.Lamp,
  Tent: L.Tent ?? L.Box,

  // === Спорт ===
  Dumbbell: L.Dumbbell,
  Activity: L.Activity,
  Trophy: L.Trophy,

  // === Камера / медиа ===
  Camera: L.Camera,
  CameraOff: L.CameraOff,
  Video: L.Video,
  Image: L.Image,
  Film: L.Film,
  Music: L.Music,

  // === Упаковка / каталог ===
  Box: L.Box,
  Boxes: L.Boxes,
  Package: L.Package,
  Package2: L.Package2,
  PackageOpen: L.PackageOpen,
  ShoppingBag: L.ShoppingBag,
  ShoppingCart: L.ShoppingCart,
  Tag: L.Tag,
  Tags: L.Tags,
  Gift: L.Gift,
  Archive: L.Archive,
  ArchiveRestore: L.ArchiveRestore,

  // === Кухня / еда ===
  ChefHat: L.ChefHat,
  Utensils: L.Utensils,
  UtensilsCrossed: L.UtensilsCrossed,
  Coffee: L.Coffee,
  Pizza: L.Pizza,
  Apple: L.Apple,

  // === Бизнес / общие ===
  Briefcase: L.Briefcase,
  BookOpen: L.BookOpen,
  Folder: L.Folder,
  FolderOpen: L.FolderOpen,
  FolderTree: L.FolderTree,
  Grid: L.Grid2X2 ?? L.Grid3X3 ?? L.LayoutGrid,
  Grid3X3: L.Grid3X3,
  LayoutGrid: L.LayoutGrid,
  Layout: L.Layout,
  List: L.List,

  // === Время / события ===
  Calendar: L.Calendar,
  Clock: L.Clock,
  Timer: L.Timer,
  Bell: L.Bell,

  // === Связь ===
  Phone: L.Phone,
  Mail: L.Mail,
  MessageSquare: L.MessageSquare,
  Send: L.Send,

  // === Прочее ===
  Star: L.Star,
  Heart: L.Heart,
  Flag: L.Flag,
  Map: L.Map,
  MapPin: L.MapPin,
  Globe: L.Globe,
  Pin: L.Pin,
};

export const ICON_NAMES = Object.keys(ICONS);

/**
 * Резолвит имя в компонент. Толерантно к легаси-формату Tabler («IconBolt» → «Bolt»).
 */
function resolveIcon(name: string | null | undefined): LucideIconType {
  if (!name) return Lucide.Wrench;
  if (ICONS[name]) return ICONS[name];
  // Tabler-стиль: убираем префикс "Icon"
  if (name.startsWith('Icon') && ICONS[name.slice(4)]) return ICONS[name.slice(4)];
  // Регистронезависимо
  const lower = name.toLowerCase();
  const found = ICON_NAMES.find((k) => k.toLowerCase() === lower);
  if (found) return ICONS[found];
  return Lucide.Wrench;
}

interface LucideIconProps extends Omit<React.SVGAttributes<SVGElement>, 'name'> {
  name: string | null | undefined;
  size?: number | string;
  strokeWidth?: number;
}

export function LucideIcon({ name, size, strokeWidth, className, ...rest }: LucideIconProps) {
  const Icon = resolveIcon(name);
  return <Icon className={cn(className)} size={size} strokeWidth={strokeWidth} {...rest} />;
}
