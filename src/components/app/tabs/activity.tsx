import { Link } from "react-router-dom";
import type { AppDetail } from "@/core/types";
import { GlassCard, SectionTitle } from "@/components/ui/bits";
import { ActivityFeed } from "@/components/app/activity";

export function ActivityTab({ app }: { app: AppDetail }) {
  return (
    <GlassCard className="p-5">
      <SectionTitle title="Activity" sub="Latest 60 changes to this application" action={<Link to={`/logs?appId=${app.id}`} className="text-xs text-muted-foreground hover:text-foreground">Open in audit log →</Link>} />
      <ActivityFeed items={app.activity} showApp={false} />
    </GlassCard>
  );
}
