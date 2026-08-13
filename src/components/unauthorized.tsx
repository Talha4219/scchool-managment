import { ShieldX } from "lucide-react";

export function Unauthorized({ message = "You do not have permission to access this page." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldX className="h-16 w-16 text-red-300 mb-4" />
      <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Denied</h2>
      <p className="text-sm text-slate-500 max-w-md">{message}</p>
    </div>
  );
}
