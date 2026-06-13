import type { PlayceEvent } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";

export function EventHosts({ event }: { event: PlayceEvent }) {
  return (
    <div className="space-y-3">
      {event.hosts.map((h) => (
        <div key={h.id} className="flex items-center gap-3">
          <Avatar name={h.name} />
          <div>
            <p className="text-sm font-medium">{h.name}</p>
            <p className="text-xs text-muted-foreground">
              {h.role}
              {h.handle ? ` · ${h.handle}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventSpeakers({ event }: { event: PlayceEvent }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {event.speakers.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
        >
          <Avatar name={s.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.name}</p>
            <p className="truncate text-xs text-muted-foreground">{s.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
