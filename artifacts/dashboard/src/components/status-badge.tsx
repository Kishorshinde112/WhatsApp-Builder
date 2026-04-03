import { Badge } from "./ui/badge";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";

  switch (normalized) {
    case "draft":
    case "queued":
    case "cancelled":
      variant = "secondary";
      className = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      break;
    case "validating":
      variant = "secondary";
      className = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      break;
    case "ready":
    case "sent":
      variant = "secondary";
      className = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      break;
    case "running":
    case "read":
      variant = "secondary";
      className = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      break;
    case "paused":
    case "noaccount":
      variant = "secondary";
      className = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      break;
    case "completed":
    case "delivered":
      variant = "secondary";
      className = "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      break;
    case "failed":
      variant = "destructive";
      break;
    default:
      variant = "outline";
  }

  return (
    <Badge variant={variant} className={`font-medium capitalize ${className}`}>
      {status}
    </Badge>
  );
}
