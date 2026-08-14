"use client";

import {
  Camera,
  Check,
  CircleDot,
  LoaderCircle,
  Radio,
  ServerCog,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CapturedEvidence } from "./capture-types";

type PublicCameraSource = {
  id: string;
  name: string;
  location: string;
  playbackUrl: string;
};

type NetworkCameraPrototypeProps = {
  onClose: () => void;
  onUseLocal: () => void;
  onUsePhoto: (evidence: CapturedEvidence) => void;
};

export default function NetworkCameraPrototype({
  onClose,
  onUseLocal,
  onUsePhoto,
}: NetworkCameraPrototypeProps) {
  const [cameras, setCameras] = useState<PublicCameraSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotState, setSnapshotState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/cameras", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ cameras: PublicCameraSource[] }>)
      .then(({ cameras: nextCameras }) => {
        if (!active) return;
        setCameras(nextCameras);
        setSelectedId(nextCameras[0]?.id ?? null);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
  }, [snapshotUrl]);

  const selected = cameras.find((camera) => camera.id === selectedId) ?? null;

  const takeSnapshot = useCallback(async () => {
    if (!selected) return;
    setSnapshotState("loading");
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSnapshotUrl(null);
    setSnapshotBlob(null);
    try {
      const response = await fetch(`/api/cameras/${encodeURIComponent(selected.id)}/snapshot`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("snapshot_failed");
      const blob = await response.blob();
      setSnapshotBlob(blob);
      setSnapshotUrl(URL.createObjectURL(blob));
      setSnapshotState("ready");
    } catch {
      setSnapshotState("error");
    }
  }, [selected, snapshotUrl]);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#171b18]/75 p-4 backdrop-blur-sm sm:p-8">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] bg-[#fbf7ef] shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#ded8cb] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#23362d] text-white"><Radio size={19} /></span>
              <div><h2 className="font-bold">工地摄像头</h2><p className="text-xs text-[#837c70]">视频网关实时流 · 服务端安全抽帧</p></div>
            </div>
            <button onClick={onClose} className="grid size-10 place-items-center rounded-full border border-[#d9d1c2] bg-white" aria-label="关闭工地摄像头"><X size={18} /></button>
          </header>

          {loading ? (
            <div className="grid min-h-[480px] place-items-center text-[#736d63]"><div className="text-center"><LoaderCircle className="mx-auto animate-spin"/><p className="mt-3 text-sm">正在读取摄像头清单…</p></div></div>
          ) : cameras.length === 0 ? (
            <div className="grid min-h-[480px] place-items-center px-6 text-center">
              <div className="max-w-lg">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#ece5d8] text-[#5f695f]"><ServerCog size={28}/></span>
                <h3 className="mt-5 text-2xl font-bold">接入位已就绪，等待真实摄像头参数</h3>
                <p className="mt-3 text-sm leading-6 text-[#756f65]">配置 RTSP 地址、视频网关播放地址和摄像头位置后，这里会自动出现实时画面。账号密码只留在服务端，不会发送到浏览器。</p>
                <div className="mt-6 rounded-2xl bg-[#f1eadf] p-4 text-left font-mono text-xs leading-5 text-[#756e63]">配置文件：.env.local<br/>字段：CAMERA_SOURCES_JSON<br/>网关：MediaMTX（RTSP → WebRTC/HLS）</div>
                <button onClick={onUseLocal} className="mt-6 rounded-full bg-[#242b25] px-6 py-3 text-sm font-bold text-white">先用本机摄像头测试</button>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[260px_1fr]">
              <aside className="border-r border-[#ded8cb] p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[.15em] text-[#8e867a]">摄像头清单</p>
                <div className="space-y-2">
                  {cameras.map((camera) => <button key={camera.id} onClick={() => { setSelectedId(camera.id); setSnapshotState("idle"); setSnapshotUrl(null); }} className={`w-full rounded-2xl border p-4 text-left ${selectedId === camera.id ? "border-[#ee6f3d] bg-[#fff1e9]" : "border-[#ded8cb] bg-white"}`}><div className="flex items-center justify-between gap-3"><span className="font-bold">{camera.name}</span><CircleDot size={15} className="text-[#3f8563]"/></div><p className="mt-1 text-xs text-[#837c70]">{camera.location}</p></button>)}
                </div>
              </aside>
              <div className="p-4 sm:p-6">
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#171b18]">
                  {snapshotState === "ready" && snapshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- snapshot blob URL is generated in memory.
                    <img src={snapshotUrl} alt={`${selected?.name ?? "工地摄像头"}抓拍证据`} className="h-full w-full object-contain"/>
                  ) : selected ? (
                    <iframe src={`${selected.playbackUrl}?controls=true&muted=true&autoplay=true&playsInline=true`} title={`${selected.name}实时画面`} allow="autoplay; fullscreen" className="h-full w-full border-0"/>
                  ) : null}
                  {snapshotState === "loading" && <div className="absolute inset-0 grid place-items-center bg-black/70 text-white"><div className="text-center"><LoaderCircle className="mx-auto animate-spin"/><p className="mt-3 text-sm">正在从服务端视频流抽帧…</p></div></div>}
                </div>
                {snapshotState === "error" && <p className="mt-3 rounded-xl bg-[#fff0e8] p-3 text-sm text-[#a64c29]">抽帧失败。请检查摄像头在线状态、RTSP 地址和 FFmpeg 配置。</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-bold">{selected?.name}</p><p className="text-xs text-[#837c70]">{selected?.location} · 经视频网关播放</p></div>
                  {snapshotState === "ready" ? <div className="flex gap-2"><button onClick={takeSnapshot} className="rounded-full border border-[#d9d1c2] bg-white px-5 py-3 text-sm font-bold">重新抓拍</button><button onClick={() => snapshotBlob && selected && onUsePhoto({ blob: snapshotBlob, sourceLabel: selected.name })} className="inline-flex items-center gap-2 rounded-full bg-[#ee6f3d] px-6 py-3 text-sm font-bold text-white"><Check size={17}/>作为巡检证据</button></div> : <button onClick={takeSnapshot} className="inline-flex items-center gap-2 rounded-full bg-[#ee6f3d] px-6 py-3 text-sm font-bold text-white"><Camera size={17}/>抓拍现场照片</button>}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
