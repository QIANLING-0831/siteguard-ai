"use client";

import {
  Aperture,
  Camera,
  CameraOff,
  Check,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CapturedEvidence } from "./capture-types";

type CameraState = "idle" | "requesting" | "live" | "captured" | "error";

type CameraCapturePrototypeProps = {
  onClose: () => void;
  onUsePhoto: (evidence: CapturedEvidence) => void;
};

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "摄像头权限未开启。请在浏览器地址栏的权限设置中允许摄像头后重试。";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "没有找到可用摄像头，请确认设备已连接且未被禁用。";
  }
  if (error instanceof DOMException && error.name === "NotReadableError") {
    return "摄像头可能正被其他软件占用，请关闭占用程序后重试。";
  }
  return "暂时无法打开摄像头。请确认页面通过 localhost 或 HTTPS 访问后重试。";
}

export default function CameraCapturePrototype({
  onClose,
  onUsePhoto,
}: CameraCapturePrototypeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setPreview(null);
    setCapturedBlob(null);
    setErrorMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setErrorMessage("当前浏览器不支持摄像头访问，请使用最新版 Chrome 或 Edge。");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("live");
    } catch (error) {
      stopCamera();
      setState("error");
      setErrorMessage(cameraErrorMessage(error));
    }
  }, [stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const close = () => {
    stopCamera();
    onClose();
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
      setState("captured");
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#171b18]/75 p-4 backdrop-blur-sm sm:p-8">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] bg-[#fbf7ef] shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#ded8cb] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#ee6f3d] text-white">
                <Camera size={19} />
              </span>
              <div>
                <h2 className="font-bold">采集现场证据</h2>
                <p className="text-xs text-[#837c70]">本机摄像头 · 确认使用后作为巡检证据保存</p>
              </div>
            </div>
            <button
              onClick={close}
              className="grid size-10 place-items-center rounded-full border border-[#d9d1c2] bg-white"
              aria-label="关闭摄像头"
            >
              <X size={18} />
            </button>
          </header>

          <div className="grid lg:grid-cols-[1fr_300px]">
            <div className="bg-[#171b18] p-3 sm:p-6">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`h-full w-full object-cover ${state === "live" ? "block" : "hidden"}`}
                />
                {state === "captured" && preview && (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory camera frame has no stable URL for next/image.
                  <img src={preview} alt="刚刚拍摄的现场证据" className="h-full w-full object-cover" />
                )}
                {(state === "idle" || state === "error") && (
                  <div className="absolute inset-0 grid place-items-center px-8 text-center text-white">
                    <div>
                      <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/10">
                        {state === "error" ? <CameraOff size={28} /> : <Camera size={28} />}
                      </span>
                      <p className="mt-4 text-sm text-white/65">
                        {state === "error" ? errorMessage : "点击下方按钮后，浏览器才会请求摄像头权限。"}
                      </p>
                    </div>
                  </div>
                )}
                {state === "requesting" && (
                  <div className="absolute inset-0 grid place-items-center text-center text-white">
                    <div>
                      <LoaderCircle className="mx-auto animate-spin" size={30} />
                      <p className="mt-3 text-sm text-white/65">正在等待摄像头授权…</p>
                    </div>
                  </div>
                )}
                {state === "live" && (
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur">
                    <span className="size-2 animate-pulse rounded-full bg-[#ff7053]" /> 实时画面
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {(state === "idle" || state === "error") && (
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#222520]"
                  >
                    <Camera size={18} /> {state === "error" ? "重新尝试" : "打开摄像头"}
                  </button>
                )}
                {state === "live" && (
                  <button
                    onClick={capture}
                    className="inline-flex items-center gap-2 rounded-full bg-[#ee6f3d] px-6 py-3 text-sm font-bold text-white"
                  >
                    <Aperture size={19} /> 拍摄照片
                  </button>
                )}
                {state === "captured" && (
                  <>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white"
                    >
                      <RotateCcw size={17} /> 重拍
                    </button>
                    <button
                      onClick={() => capturedBlob && onUsePhoto({ blob: capturedBlob, sourceLabel: "本机摄像头" })}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ee6f3d] px-6 py-3 text-sm font-bold text-white"
                    >
                      <Check size={18} /> 使用这张照片
                    </button>
                  </>
                )}
              </div>
            </div>

            <aside className="p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#d45b2a]">采集状态</p>
              <h3 className="mt-2 text-xl font-bold">
                {state === "captured" ? "照片待加入巡检" : state === "live" ? "摄像头已连接" : "等待开始采集"}
              </h3>
              <div className="mt-6 space-y-4 text-sm text-[#716b61]">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-[#47735f]" size={18} />
                  <p>浏览器会显示系统权限提示，只有你允许后才能看到画面。</p>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-[#47735f]" size={18} />
                  <p>当前只采集单张照片，不录音、不持续录像；点击“使用”后才提交到项目数据库。</p>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-[#47735f]" size={18} />
                  <p>照片先作为 Evidence；后续 AI 结果仍是待人工确认的 Finding。</p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl bg-[#f1eadf] p-4 text-xs leading-5 text-[#756e63]">
                正式工地摄像头已使用独立的服务端网关入口；这里仅作为没有现场设备时的交互测试源。
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
