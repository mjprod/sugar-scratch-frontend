import { Bell, Gift, Mail, ShoppingBag, Sparkles, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HubItem = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
};

const HUB_ITEMS: HubItem[] = [
  { id: "daily", label: "Daily Reward", detail: "Ready to claim", icon: Gift, accent: "#D4AF37" },
  {
    id: "store",
    label: "Reward Store",
    detail: "Purchase Diamonds · View Store",
    icon: ShoppingBag,
    accent: "#60A5FA",
  },
  { id: "inbox", label: "Inbox", detail: "2 new messages", icon: Mail, accent: "#EC4899" },
  {
    id: "redeem",
    label: "Redeem Code",
    detail: "Unlock creator rewards",
    icon: Ticket,
    accent: "#8B5CF6",
  },
];

export function HubScreen({ onOpenStore }: { onOpenStore?: () => void }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[calc(52px+env(safe-area-inset-top))] pb-[calc(112px+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-[32px] border border-white/[0.08] bg-[radial-gradient(circle_at_80%_0%,rgba(139,92,246,.28),transparent_45%),#151515] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Sparkles className="size-4" />
            <p className="text-[12px] font-semibold tracking-[0.14em] uppercase">Today</p>
          </div>
          <h1 className="mt-3 text-[32px] font-bold tracking-[-0.03em]">Rewards</h1>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/55">
            Claim daily gifts, check inbox, and unlock creator rewards.
          </p>
          <button
            type="button"
            className="mt-6 h-12 rounded-full bg-[#8B5CF6] px-6 text-[14px] font-semibold transition active:scale-[0.98]"
          >
            Claim Daily Reward
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {HUB_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.id === "store" ? onOpenStore : undefined}
                className="flex min-h-24 items-center rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-4 text-left transition active:scale-[0.99] hover:-translate-y-1 hover:bg-white/[0.07]"
              >
                <span
                  className="grid size-12 place-items-center rounded-2xl"
                  style={{ color: item.accent, backgroundColor: `${item.accent}1f` }}
                >
                  <Icon className="size-5" />
                </span>
                <span className="ml-3">
                  <span className="block text-[15px] font-semibold">{item.label}</span>
                  <span className="mt-1 block text-[12px] text-white/45">{item.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-4">
          <Bell className="size-5 text-white/45" />
          <p className="text-[13px] text-white/55">No live events right now. Check back tomorrow.</p>
        </div>
      </div>
    </section>
  );
}
