import type { PlaycesEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";

export function EventSchedule({ event }: { event: PlaycesEvent }) {
  return (
    <div className="relative space-y-0">
      {event.schedule.map((item, i) => (
        <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-[color-mix(in_oklab,var(--brand)_18%,transparent)]" />
            {i < event.schedule.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-border" />
            )}
          </div>
          <div className="-mt-0.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {formatTime(item.startISO, event.timezone)}
              </span>
              {item.track && <Badge variant="outline">{item.track}</Badge>}
            </div>
            <p className="mt-1 font-medium">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
