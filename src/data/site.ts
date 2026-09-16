export type PlanStatus = "Ready" | "Settled" | "Blocked" | "Scheduled";

export const samplePlans = [
  { id: "PKT-2048", name: "Friday money plan", prompt: "Pay rent Friday, keep $200, put the rest to work.", status: "Ready" as PlanStatus, amount: "$1,840.00", date: "Sep 18" },
  { id: "PKT-2041", name: "Monthly essentials", prompt: "Pay utilities and move $75 into MON.", status: "Settled" as PlanStatus, amount: "$286.40", date: "Sep 12" },
  { id: "PKT-2039", name: "Weekend limit", prompt: "Spend up to $120 this weekend.", status: "Blocked" as PlanStatus, amount: "$145.00", date: "Sep 10" },
  { id: "PKT-2032", name: "Savings sweep", prompt: "Keep $500 available and save everything above it.", status: "Scheduled" as PlanStatus, amount: "$420.00", date: "Sep 20" },
] as const;

export const receipts = [
  { id: "0x8f2…91e", action: "USDC rent payment", rail: "Agora", amount: "−$1,200.00", status: "Confirmed", time: "12 min ago" },
  { id: "0x2ad…77c", action: "MON market buy", rail: "Kuru", amount: "−$440.00", status: "Confirmed", time: "12 min ago" },
  { id: "POL-0934", action: "Weekend purchase", rail: "Policy", amount: "−$145.00", status: "Blocked", time: "Sep 10" },
  { id: "0x14b…3aa", action: "Utilities payment", rail: "Agora", amount: "−$211.40", status: "Confirmed", time: "Sep 08" },
] as const;

export const rules = [
  { title: "Always keep", value: "$200.00", detail: "Available balance never falls below this amount." },
  { title: "Single payment cap", value: "$1,500.00", detail: "Anything larger needs a new approval." },
  { title: "Market allocation", value: "25% max", detail: "Maximum share of one plan routed to markets." },
] as const;