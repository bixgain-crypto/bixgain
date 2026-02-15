import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ListTodo, Clock, Coins, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Tasks() {
  const { session } = useAuth();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("reward_points", { ascending: false });
      return data || [];
    },
  });

  const { data: completedTasks } = useQuery({
    queryKey: ["completed-tasks", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("task_id")
        .eq("user_id", session!.user.id);
      return data?.map((a) => a.task_id) || [];
    },
  });

  const handleComplete = async (taskId: string, points: number) => {
    if (!session?.user?.id) return;
    
    const { error } = await supabase.from("activities").insert({
      user_id: session.user.id,
      task_id: taskId,
      activity_type: "task_completion",
      points_earned: points,
      description: "Task completed",
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("You've already completed this task!");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(`Earned ${points} BIX!`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ListTodo className="h-8 w-8 text-primary" />
            Available Tasks
          </h1>
          <p className="mt-1 text-muted-foreground">Complete tasks to earn BIX tokens</p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-lg p-6 animate-pulse h-48" />
            ))}
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task, i) => {
              const isCompleted = completedTasks?.includes(task.id);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass rounded-lg p-6 flex flex-col justify-between ${
                    isCompleted ? "opacity-60" : "hover:glow-gold-sm"
                  } transition-all`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {task.task_type}
                      </span>
                      <div className="flex items-center gap-1 text-primary font-mono font-bold">
                        <Coins className="h-4 w-4" />
                        {Number(task.reward_points).toLocaleString()}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{task.name}</h3>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    {task.end_date && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Ends {new Date(task.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    {isCompleted ? (
                      <div className="flex items-center gap-2 text-success text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleComplete(task.id, Number(task.reward_points))}
                        className="w-full bg-gradient-gold font-semibold"
                        size="sm"
                      >
                        Complete Task
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-lg p-12 text-center">
            <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tasks available right now. Check back soon!</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
