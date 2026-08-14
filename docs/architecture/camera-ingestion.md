# 摄像头接入架构

## 已确定的边界

网站不直接连接 RTSP。浏览器不原生支持 RTSP，摄像头账号密码也不应进入前端代码。

正式链路：

```text
工地摄像头（RTSP / ONVIF Profile S/T）
  -> MediaMTX 视频网关
  -> WebRTC（网站低延迟预览）/ HLS（兼容与回放）
  -> FFmpeg 服务端抽帧
  -> Evidence
  -> 视觉适配器生成待确认 Finding
  -> 人工确认后才可生成 HazardCase
```

GB28181 摄像头先接入支持 GB28181 的国标平台或设备厂商平台，再由该平台向 MediaMTX 输出 RTSP/RTMP/SRT。不要让浏览器承担 SIP 注册、设备目录和媒体协商。

## 当前代码

- `GET /api/cameras`：返回不含 RTSP 地址和密码的摄像头清单。
- `GET /api/cameras/:cameraId/snapshot`：在服务端用 FFmpeg 从已配置源抓取一帧 JPEG。
- B 方案“工地摄像头”：播放 MediaMTX 的 WebRTC 页面，并把服务端抓拍作为 Evidence。
- B 方案“本机测试”：仅用于没有工地摄像头时验证采集交互。
- `POST /api/vision/inspect`：真实图片优先进入 YOLOWorld 开放词汇适配器，返回逐人框选与待确认 Finding；模型失败时明确回退 mock。

## 配置真实摄像头

1. 复制 `.env.example` 为 `.env.local`，填写 `CAMERA_SOURCES_JSON`。RTSP 地址只保留在服务端。
2. 首次运行 `pnpm camera:gateway:setup` 下载并校验固定版本的 Windows 网关。然后让路径名与摄像头 `id` 一致并启动：

   ```powershell
   $env:MTX_PATHS_GATE_1_SOURCE="rtsp://user:password@camera-ip:554/path"
   pnpm camera:gateway
   ```

3. 启动网站，进入 B 方案并打开“工地摄像头”。

MediaMTX 官方文档说明它可以拉取 RTSP 摄像头，并通过 WebRTC/HLS 向浏览器提供流。生产部署还需配置 HTTPS、鉴权、TURN、防火墙、录像保留策略和摄像头专用网络。
