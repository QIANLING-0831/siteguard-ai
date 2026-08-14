import { ArrowRight, ScanLine, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";

const steps = [
  [ScanLine, "AI 提出发现", "图片与记录先转换为待确认 Finding"],
  [ShieldCheck, "人员确认隐患", "安全判断不交给模型自动决定"],
  [Workflow, "整改复核闭环", "责任、期限、证据与历史全程可追踪"],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#eef2ef] text-[#17201c]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#163c2e] text-white">
              <ShieldCheck size={21} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[#163c2e]">SITEGUARD AI</p>
              <p className="text-xs text-[#66716b]">筑安智巡 · 面试原型</p>
            </div>
          </div>
          <span className="rounded-full border border-[#cbd5cf] bg-white/70 px-3 py-1 text-xs text-[#536159]">
            Human-in-the-loop
          </span>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#d56b2d]">
              AI 工程巡检与隐患闭环
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
              不止识别隐患，
              <span className="text-[#237a57]">更让整改真正闭环。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5c6962]">
              将现场照片和巡检记录转成可确认、可派发、可复核的工程任务。AI 提供建议，人员保留最终判断。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/prototype/dashboard?variant=A"
                className="inline-flex items-center gap-2 rounded-xl bg-[#173d2f] px-5 py-3 font-semibold text-white shadow-[0_12px_30px_rgba(23,61,47,.18)] transition hover:-translate-y-0.5"
              >
                查看驾驶舱原型 <ArrowRight size={18} />
              </Link>
              <a
                href="/prototype/dashboard?variant=B"
                className="inline-flex items-center rounded-xl border border-[#c6d0ca] bg-white px-5 py-3 font-semibold text-[#314139]"
              >
                直接看现场流程
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-12 rounded-full bg-[#cfe0d7]/60 blur-3xl" />
            <div className="relative rounded-[28px] border border-white/80 bg-white/85 p-3 shadow-[0_30px_70px_rgba(27,57,44,.13)] backdrop-blur">
              <div className="rounded-[22px] bg-[#173d2f] p-7 text-white">
                <div className="flex items-center justify-between text-xs text-white/65">
                  <span>今日巡检摘要</span><span>14:32 更新</span>
                </div>
                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[["待确认", "6"], ["高风险", "3"], ["逾期", "2"]].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-white/8 p-4">
                      <p className="text-3xl font-semibold">{value}</p>
                      <p className="mt-1 text-xs text-white/60">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-[#f5f1e8] p-5 text-[#26352e]">
                  <div className="flex items-start justify-between gap-5">
                    <div><p className="text-xs text-[#84796c]">最新 AI 发现</p><p className="mt-1 font-semibold">临边作业人员疑似未佩戴安全帽</p></div>
                    <span className="rounded-full bg-[#f2d6c6] px-2.5 py-1 text-xs text-[#9a4a24]">待确认</span>
                  </div>
                  <p className="mt-4 text-xs text-[#6c756f]">模型置信度 0.86 · 2号楼三层东侧</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 border-t border-[#d5ddd8] pt-6 md:grid-cols-3">
          {steps.map(([Icon, title, text]) => (
            <div key={title} className="flex gap-3 rounded-2xl p-3">
              <Icon className="mt-0.5 text-[#237a57]" size={20} />
              <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[#68736d]">{text}</p></div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
