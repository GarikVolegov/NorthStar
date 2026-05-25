import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

export const PREMIUM_REMINDER_MINUTES = [10, 30, 120, 1440];
export const FREE_REMINDER_MINUTES = [30, 120];

export function CalendarReminderFields({
  allowedReminders,
  reminderToggles,
  toggleReminder,
  showUpgradeHint,
}: {
  allowedReminders: number[];
  reminderToggles: Record<number, boolean>;
  toggleReminder: (minutes: number) => void;
  showUpgradeHint: boolean;
}) {
  const { t } = useTranslation();
  const reminderLabels: Record<number, string> = {
    10: t("calendar.remindersLabels.10"),
    30: t("calendar.remindersLabels.30"),
    120: t("calendar.remindersLabels.120"),
    1440: t("calendar.remindersLabels.1440"),
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium leading-none">
          {t("calendar.reminders")}
        </span>
      </div>
      <div className="space-y-2">
        {PREMIUM_REMINDER_MINUTES.map((minutes) => {
          const isAllowed = allowedReminders.includes(minutes);
          const isActive = !!reminderToggles[minutes];
          return (
            <div
              key={minutes}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg border",
                !isAllowed && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{reminderLabels[minutes]}</span>
                {!isAllowed && (
                  <Badge
                    variant="outline"
                    className="text-xs gap-1 text-amber-600 border-amber-300"
                  >
                    <Crown className="h-3 w-3" /> Premium
                  </Badge>
                )}
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={() => toggleReminder(minutes)}
                disabled={!isAllowed}
              />
            </div>
          );
        })}
      </div>
      {showUpgradeHint && (
        <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            {t("calendar.premiumReminders")}{" "}
            <a href={`${BASE}premium`} className="font-semibold underline">
              {t("calendar.upgradePremium")}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
