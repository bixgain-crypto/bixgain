import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Calendar, CheckCircle2, Clock, Loader2, Send, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AiOperation = {
  type: string;
  summary: string;
  status: string;
  scheduled_at?: string;
  error?: string;
  result?: any;
};

type AiPromptResponse = {
  status: string;
  overall_summary?: string;
  message?: string;
  operations?: AiOperation[];
};

type ScheduledTask = {
  id: string;
  operation_type: string;
  prompt_text: string | null;
  scheduled_at: string;
  status: string;
  result: any;
  error_message: string | null;
  created_at: string;
  executed_at: string | null;
};

const EXAMPLE_PROMPTS = [
  "Create a social task called 'Follow us on X' with 100 XP reward, link to https://x.com/bixgain, 60 seconds required",
  "Send 50 BIX to all users as a holiday bonus, claimable within 2 hours",
  "Schedule a login task for tomorrow at 9 AM called 'Daily Check-in Bonus' with 25 XP",
  "Create 3 tasks: Follow Twitter (100 XP), Join Discord (75 XP), Subscribe YouTube (150 XP)",
];

export function AdminAiPrompt() {
  const [prompt, setPrompt] = useState("");
  const [lastResponse, setLastResponse] = useState<AiPromptResponse | null>(null);
  const queryClient = useQueryClient();

  const { data: scheduledTasks, isLoading: loadingScheduled } = useQuery({
    queryKey: ["admin-scheduled-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_admin_tasks" as any)
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);
      return (data || []) as unknown as ScheduledTask[];
    },
    refetchInterval: 30000,
  });

  const aiMutation = useMutation({
    mutationFn: async (promptText: string) => {
      const { data, error } = await supabase.functions.invoke("admin-ai-prompt", {
        body: { prompt: promptText },
      });

      if (error) {
        const details = (error as any).details;
        let parsed: any = null;
        if (details && typeof details === "string") {
          try { parsed = JSON.parse(details); } catch {}
        }
        if (!parsed && data && typeof data === "object") parsed = data;
        throw new Error(parsed?.error || error.message || "AI request failed");
      }

      if (data?.error) throw new Error(data.error);
      return data as AiPromptResponse;
    },
    onSuccess: (data) => {
      setLastResponse(data);

      if (data.status === "clarification_needed") {
        toast.info(data.message || "AI needs more information");
        return;
      }

      const executed = data.operations?.filter((op) => op.status === "executed").length || 0;
      const scheduled = data.operations?.filter((op) => op.status === "scheduled").length || 0;
      const failed = data.operations?.filter((op) => op.status === "failed" || op.status === "schedule_failed").length || 0;

      const parts: string[] = [];
      if (executed > 0) parts.push(`${executed} executed`);
      if (scheduled > 0) parts.push(`${scheduled} scheduled`);
      if (failed > 0) parts.push(`${failed} failed`);

      toast.success(`AI Command: ${parts.join(", ")}`);
      setPrompt("");
      queryClient.invalidateQueries({ queryKey: ["admin-scheduled-tasks"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    aiMutation.mutate(trimmed);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-warning border-warning"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "executing":
        return <Badge variant="outline" className="text-primary border-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executing</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
      case "executed":
        return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Executed</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="text-blue-500 border-blue-500"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "failed":
      case "schedule_failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Prompt Input */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-5 w-5 text-primary" />
          <span>AI Admin Command</span>
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </div>

        <Textarea
          placeholder="Type a command... e.g. 'Create a task called Follow Twitter with 100 XP reward, schedule it for tomorrow at 10 AM'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {prompt.length}/2000 · Ctrl+Enter to send
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || aiMutation.isPending}
            size="sm"
            className="gap-1.5"
          >
            {aiMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {aiMutation.isPending ? "Processing..." : "Execute"}
          </Button>
        </div>
      </div>

      {/* Example prompts */}
      <div className="glass rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Example commands:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left"
            >
              {ex.length > 60 ? ex.slice(0, 60) + "..." : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Last AI Response */}
      {lastResponse && (
        <div className="glass rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">
            {lastResponse.status === "clarification_needed" ? "⚠️ Clarification Needed" : "✅ Last Execution Result"}
          </p>

          {lastResponse.overall_summary && (
            <p className="text-sm text-muted-foreground">{lastResponse.overall_summary}</p>
          )}

          {lastResponse.message && (
            <p className="text-sm text-warning">{lastResponse.message}</p>
          )}

          {lastResponse.operations && lastResponse.operations.length > 0 && (
            <div className="space-y-2">
              {lastResponse.operations.map((op, i) => (
                <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30">
                  {statusBadge(op.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{op.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      Type: {op.type}
                      {op.scheduled_at && ` · Scheduled: ${new Date(op.scheduled_at).toLocaleString()}`}
                    </p>
                    {op.error && (
                      <p className="text-xs text-destructive mt-1">{op.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled Tasks List */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduled Tasks
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-scheduled-tasks"] })}
          >
            Refresh
          </Button>
        </div>

        {loadingScheduled ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !scheduledTasks || scheduledTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scheduled tasks yet. Use the AI prompt above to schedule operations.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {scheduledTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-sm">
                {statusBadge(task.status)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{task.prompt_text || task.operation_type}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                    <span>Type: {task.operation_type}</span>
                    <span>·</span>
                    <span>Scheduled: {new Date(task.scheduled_at).toLocaleString()}</span>
                    {task.executed_at && (
                      <>
                        <span>·</span>
                        <span>Executed: {new Date(task.executed_at).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  {task.error_message && (
                    <p className="text-xs text-destructive mt-1">{task.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
