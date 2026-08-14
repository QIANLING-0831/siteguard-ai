import DashboardPrototype from "./prototype-client";

type Variant = "A" | "B" | "C";

export default async function DashboardPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const raw = (await searchParams).variant;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const initialVariant: Variant = value === "B" || value === "C" ? value : "A";

  return <DashboardPrototype initialVariant={initialVariant} />;
}
