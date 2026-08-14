"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import VariantBWorkbench from "./variant-b-workbench";

type Variant = "A" | "B" | "C";

const variants: { key: Variant; name: string }[] = [
  { key: "A", name: "指挥中心" },
  { key: "B", name: "现场工作台" },
  { key: "C", name: "空间风险图" },
];

const hazards = [
  { id: "H-024", title: "临边作业人员疑似未佩戴安全帽", zone: "2号楼 · 三层东侧", level: "高", owner: "李工", status: "待确认", confidence: "0.86" },
  { id: "H-023", title: "材料堆放侵占消防通道", zone: "地下室 · B2区", level: "重大", owner: "王强", status: "整改中", confidence: "人工上报" },
  { id: "H-021", title: "配电箱防护门未关闭", zone: "1号楼 · 首层", level: "中", owner: "赵敏", status: "待复核", confidence: "0.79" },
];

const trend = [
  { day: "周一", value: 9 }, { day: "周二", value: 13 }, { day: "周三", value: 8 },
  { day: "周四", value: 16 }, { day: "周五", value: 11 }, { day: "周六", value: 7 }, { day: "今日", value: 12 },
];

const stats = [
  { label: "待确认发现", value: "6", change: "AI 建议", icon: Sparkles, tone: "amber" },
  { label: "开放隐患", value: "18", change: "3 项高风险", icon: ShieldAlert, tone: "red" },
  { label: "整改完成率", value: "87%", change: "+6.2%", icon: CheckCircle2, tone: "green" },
  { label: "逾期整改", value: "2", change: "需立即处理", icon: Clock3, tone: "slate" },
] as const;

function Badge({ children, critical = false }: { children: React.ReactNode; critical?: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${critical ? "bg-[#fee8de] text-[#aa4e26]" : "bg-[#e8efeb] text-[#3d5d4e]"}`}>{children}</span>;
}

function VariantA() {
  return (
    <div className="min-h-screen bg-[#f3f5f4] text-[#16201b]">
      <div className="grid min-h-screen lg:grid-cols-[230px_1fr]">
        <aside className="hidden bg-[#12392b] p-5 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/12"><ShieldCheck size={19} /></span><div><p className="font-semibold">SiteGuard AI</p><p className="text-[10px] text-white/45">筑安智巡</p></div></div>
          <nav className="mt-10 space-y-1 text-sm">
            {[[LayoutDashboard, "驾驶舱", true], [Camera, "AI巡检", false], [ClipboardCheck, "隐患整改", false], [MapPinned, "项目区域", false], [Users, "人员与班组", false]].map(([Icon, label, active]) => {
              const NavIcon = Icon as typeof LayoutDashboard;
              return <div key={label as string} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${active ? "bg-white text-[#163c2e]" : "text-white/62"}`}><NavIcon size={17} /><span>{label as string}</span></div>;
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/45">当前项目</p><p className="mt-1 text-sm font-semibold">科创中心二期</p><p className="mt-3 text-xs text-white/45">今日在线 · 126 人</p></div>
        </aside>

        <main className="min-w-0 p-5 lg:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-[#758079]">2026年8月9日 · 星期日</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">工程安全指挥中心</h1></div><div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-xl border border-[#d7deda] bg-white"><Bell size={17} /></button><button className="flex items-center gap-2 rounded-xl bg-[#173d2f] px-4 py-2.5 text-sm font-semibold text-white"><Camera size={16} />新建 AI 巡检</button></div></header>

          <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, change, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-[#e0e5e2] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-[#77817c]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${tone === "red" ? "bg-[#fff0e9] text-[#c2582a]" : tone === "green" ? "bg-[#e7f4ed] text-[#237a57]" : "bg-[#f2f1e9] text-[#7b713c]"}`}><Icon size={18} /></span></div><p className="mt-4 text-xs text-[#7c8680]">{change}</p></div>)}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
            <div className="rounded-2xl border border-[#e0e5e2] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">近 7 日隐患趋势</h2><p className="mt-1 text-xs text-[#7b8580]">含人工上报与 AI 确认结果</p></div><Badge>本周 76 项</Badge></div><div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="risk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2a7c59" stopOpacity={0.3}/><stop offset="95%" stopColor="#2a7c59" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebe8"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#7b8580", fontSize: 12 }}/><Tooltip/><Area type="monotone" dataKey="value" stroke="#237a57" strokeWidth={2.5} fill="url(#risk)"/></AreaChart></ResponsiveContainer></div></div>
            <div className="rounded-2xl bg-[#183f31] p-5 text-white"><div className="flex items-center justify-between"><h2 className="font-semibold">闭环进度</h2><span className="text-xs text-white/50">本月</span></div><div className="mx-auto mt-7 grid size-36 place-items-center rounded-full" style={{ background: "conic-gradient(#e7b46a 0 87%, rgba(255,255,255,.12) 87% 100%)" }}><div className="grid size-28 place-items-center rounded-full bg-[#183f31] text-center"><div><p className="text-3xl font-semibold">87%</p><p className="text-[11px] text-white/50">已按期关闭</p></div></div></div><div className="mt-7 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-white/7 p-3"><p className="text-white/45">平均整改</p><p className="mt-1 text-base font-semibold">6.4 小时</p></div><div className="rounded-xl bg-white/7 p-3"><p className="text-white/45">复核退回</p><p className="mt-1 text-base font-semibold">3 项</p></div></div></div>
          </section>

          <section className="mt-4 rounded-2xl border border-[#e0e5e2] bg-white"><div className="flex items-center justify-between border-b border-[#edf0ee] p-5"><div><h2 className="font-semibold">优先处理</h2><p className="mt-1 text-xs text-[#7b8580]">先处理高风险、逾期和待确认事项</p></div><button className="text-sm font-semibold text-[#237a57]">查看全部</button></div><div className="divide-y divide-[#edf0ee]">{hazards.map((item) => <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[80px_1fr_150px_90px] md:items-center"><span className="font-mono text-xs text-[#7f8983]">{item.id}</span><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#7b8580]">{item.zone} · 负责人 {item.owner}</p></div><Badge critical={item.level === "重大" || item.level === "高"}>{item.level}风险</Badge><span className="text-sm text-[#59655f]">{item.status}</span></div>)}</div></section>
        </main>
      </div>
    </div>
  );
}

function VariantC() {
  const zones = [
    { name: "1号楼", risk: 2, top: "18%", left: "14%", tone: "amber" },
    { name: "2号楼", risk: 5, top: "28%", left: "58%", tone: "red" },
    { name: "地下室", risk: 3, top: "67%", left: "37%", tone: "red" },
    { name: "材料区", risk: 1, top: "72%", left: "76%", tone: "green" },
  ];
  return (
    <main className="min-h-screen bg-[#101716] text-[#eaf0ed]">
      <header className="flex items-center justify-between border-b border-white/8 px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#b7ef65] text-[#142014]"><MapPinned size={18}/></span><div><p className="font-semibold">SiteGuard Spatial</p><p className="text-[10px] uppercase tracking-[.2em] text-white/35">空间风险图</p></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 sm:block">科创中心二期</span><button className="grid size-9 place-items-center rounded-full bg-white/7"><Bell size={16}/></button></div></header>

      <div className="grid min-h-[calc(100vh-73px)] xl:grid-cols-[1fr_390px]">
        <section className="relative min-h-[620px] overflow-hidden border-r border-white/8 bg-[#151d1b]">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)", backgroundSize: "42px 42px" }}/>
          <div className="absolute inset-[8%] rounded-[40px] border border-white/10 bg-[#1b2522] shadow-inner"><div className="absolute left-[8%] top-[12%] h-[42%] w-[34%] rounded-2xl border border-white/12 bg-white/[.025]"/><div className="absolute right-[9%] top-[15%] h-[38%] w-[35%] rounded-2xl border border-white/12 bg-white/[.025]"/><div className="absolute bottom-[10%] left-[18%] h-[25%] w-[58%] rounded-[28px] border border-white/12 bg-white/[.025]"/>
            {zones.map((zone) => <button key={zone.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-left" style={{ top: zone.top, left: zone.left }}><span className={`relative flex size-14 items-center justify-center rounded-full border-4 border-[#1b2522] font-bold text-[#172019] shadow-[0_0_0_1px_rgba(255,255,255,.15),0_12px_35px_rgba(0,0,0,.45)] ${zone.tone === "red" ? "bg-[#ff7958]" : zone.tone === "amber" ? "bg-[#f2c45e]" : "bg-[#b7ef65]"}`}>{zone.risk}<span className="absolute inset-0 animate-ping rounded-full bg-current opacity-10"/></span><span className="mt-2 block rounded-md bg-black/55 px-2 py-1 text-center text-[11px] font-semibold text-white backdrop-blur">{zone.name}</span></button>)}
          </div>
          <div className="absolute left-5 top-5 rounded-2xl border border-white/8 bg-[#101716]/80 p-4 backdrop-blur"><p className="text-xs text-white/40">全场风险</p><div className="mt-2 flex items-end gap-2"><p className="text-3xl font-semibold">11</p><span className="mb-1 text-xs text-[#ff8b6e]">开放隐患</span></div></div>
          <div className="absolute bottom-5 left-5 flex gap-3 rounded-full border border-white/8 bg-[#101716]/80 px-4 py-2 text-xs text-white/45 backdrop-blur"><span className="flex items-center gap-1"><CircleDot size={11} className="text-[#ff7958]"/>高风险</span><span className="flex items-center gap-1"><CircleDot size={11} className="text-[#f2c45e]"/>关注</span><span className="flex items-center gap-1"><CircleDot size={11} className="text-[#b7ef65]"/>正常</span></div>
        </section>

        <aside className="bg-[#111817] p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.16em] text-[#b7ef65]">Selected zone</p><h1 className="mt-1 text-2xl font-semibold">2号楼 · 三层</h1></div><Badge critical>5 项风险</Badge></div><div className="mt-6 grid grid-cols-3 gap-2">{[["现场人员", "42"], ["AI 发现", "3"], ["逾期", "1"]].map(([label,value]) => <div key={label} className="rounded-2xl bg-white/[.045] p-3"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] text-white/35">{label}</p></div>)}</div>
          <div className="mt-7 flex items-center justify-between"><h2 className="font-semibold">风险事件流</h2><button className="text-xs text-[#b7ef65]">全部事件</button></div><div className="mt-4 space-y-3">{hazards.map((item, index) => <article key={item.id} className="rounded-2xl border border-white/7 bg-white/[.035] p-4"><div className="flex items-start gap-3"><span className={`mt-1 grid size-8 shrink-0 place-items-center rounded-full ${index === 0 ? "bg-[#ff7958] text-[#211814]" : "bg-white/8 text-white/55"}`}>{index === 0 ? <Sparkles size={15}/> : <AlertTriangle size={15}/>}</span><div><div className="flex items-center gap-2"><span className="text-[10px] text-white/30">{item.id}</span><span className="text-[10px] text-[#ff9a81]">{item.status}</span></div><p className="mt-2 text-sm font-semibold leading-5">{item.title}</p><p className="mt-2 text-xs text-white/35">{item.zone}</p>{index === 0 && <p className="mt-3 rounded-lg bg-[#b7ef65]/10 px-2 py-1.5 text-[10px] text-[#c9f88a]">AI 建议 · 置信度 {item.confidence} · 等待人工确认</p>}</div></div></article>)}</div>
          <button className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[#b7ef65] px-4 py-3 font-semibold text-[#172019]"><span>进入区域巡检</span><ArrowRight size={18}/></button>
        </aside>
      </div>
    </main>
  );
}

export default function DashboardPrototype({ initialVariant }: { initialVariant: Variant }) {
  const [variant, setVariant] = useState<Variant>(initialVariant);
  const router = useRouter();
  const pathname = usePathname();

  const select = useCallback((next: Variant) => {
    setVariant(next);
    router.replace(`${pathname}?variant=${next}`, { scroll: false });
  }, [pathname, router]);

  const cycle = useCallback((direction: -1 | 1) => {
    const index = variants.findIndex((item) => item.key === variant);
    select(variants[(index + direction + variants.length) % variants.length].key);
  }, [select, variant]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle]);

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantBWorkbench />}
      {variant === "C" && <VariantC />}
      {process.env.NODE_ENV !== "production" && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#111817]/95 p-1.5 text-white shadow-2xl backdrop-blur">
          <button onClick={() => cycle(-1)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="上一个方案"><ArrowLeft size={16}/></button>
          <div className="min-w-36 text-center text-xs"><span className="font-semibold">{variant}</span><span className="mx-2 text-white/25">·</span><span className="text-white/65">{variants.find((item) => item.key === variant)?.name}</span></div>
          <button onClick={() => cycle(1)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="下一个方案"><ArrowRight size={16}/></button>
        </div>
      )}
    </>
  );
}
