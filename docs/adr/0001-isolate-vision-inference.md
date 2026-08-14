---
status: accepted
---

# 将视觉推理与隐患业务隔离

视觉推理通过可替换适配器输出 `Finding`，不能直接创建或关闭 `HazardCase`。这样既保留 Ultralytics + Supervision 的当天开发效率，也避免把 AGPL 许可、模型误报和未来模型替换扩散进整改闭环；代价是需要维护一层明确的推理结果契约和人工确认步骤。
