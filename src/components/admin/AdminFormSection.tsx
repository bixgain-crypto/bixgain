import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export function AdminFormSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass rounded-lg border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-secondary/30 transition-colors rounded-lg">
        <h2 className="font-semibold text-sm">{title}</h2>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
