import { MatchBadge } from "@northstar/web";

export const Scores = () => (
  <div className="flex flex-wrap items-center gap-3">
    <MatchBadge score={92} />
    <MatchBadge score={70} />
    <MatchBadge score={45} />
    <MatchBadge score={88} label="Fit" size="sm" />
  </div>
);
