import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const timeAgo = (iso?: string | null): string =>
  iso ? dayjs(iso).fromNow() : "";

export const clockTime = (iso: string): string => dayjs(iso).format("HH:mm");
