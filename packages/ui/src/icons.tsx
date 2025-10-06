/**
 * Centralized icon exports from lucide-react
 * Consistent sizing and styling across the app
 */

import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clipboard,
  Clock,
  Command,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Folder,
  Github,
  Globe,
  Hash,
  Heart,
  Home,
  Info,
  Layers,
  Link,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  MoreHorizontal,
  MoreVertical,
  MousePointer,
  PenTool,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Share,
  Share2,
  Shield,
  Smartphone,
  Star,
  Sun,
  Trash,
  Trash2,
  Unlock,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Re-export all icons
export {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clipboard,
  Clock,
  Command,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Folder,
  Github,
  Globe,
  Hash,
  Heart,
  Home,
  Info,
  Layers,
  Link,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  MoreHorizontal,
  MoreVertical,
  MousePointer,
  PenTool,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Share,
  Share2,
  Shield,
  Smartphone,
  Star,
  Sun,
  Trash,
  Trash2,
  Unlock,
  Upload,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
};

// Export the type for type safety
export type { LucideIcon };

// Default icon props
export const iconDefaultProps = {
  className: "h-4 w-4",
  strokeWidth: 2,
} as const;

// Custom Weetle logo icon component
export function WeetleLogo({ className = "h-6 w-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  );
}