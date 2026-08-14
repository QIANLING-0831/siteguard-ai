# AI 工程巡检 MVP：视觉技术栈选型

研究日期：2026-08-09  
范围：仅核验项目官方 GitHub 仓库、官方文档及许可证；性能与工期判断均标记为工程推断，不视为厂商承诺或法律意见。

## 结论

今天做 Windows 面试原型，首选 **Ultralytics + Supervision**，不需要克隆整套上游仓库：

- `ultralytics` 负责图片/视频检测、训练和导出；
- `supervision` 负责画框、标签、区域规则、视频处理和后续跟踪；
- 先用 Ultralytics 的开放词汇模型做即时效果验证，或在有 NVIDIA GPU/云 GPU 时，用官方 Construction-PPE 数据集微调 nano 模型；
- GroundingDINO 只作为零样本对照，不建议今天在 Windows 主环境中安装；
- RF-DETR 是未来规避 Ultralytics 代码许可证约束时值得评估的训练替代，但今天不应同时引入第二套检测框架。

最重要的限制是：**Ultralytics 默认 COCO 预训练检测权重没有 `helmet`、`vest` 等 PPE 类别。** 官方 README 明确默认检测模型预训练于 COCO，而官方 COCO 类表只有 `person` 等 80 类，没有安全帽或反光背心。因此，仅安装 `ultralytics` 并加载默认权重，不能宣称已经具备 PPE 检测能力。[Ultralytics README](https://github.com/ultralytics/ultralytics#documentation)；[官方 COCO 类表](https://docs.ultralytics.com/datasets/detect/coco/)

## Ultralytics 是否有帮助

有，而且是一天 MVP 的最佳主框架。

官方包支持检测、跟踪、分割、分类、姿态、训练和 ONNX 等格式导出，安装入口是一条 `pip install ultralytics`；训练和推理均支持显式选择 `cpu` 或 CUDA 设备。官方当前 nano 检测模型还给出了 ONNX CPU 基准，说明单图 CPU 演示有现实可行性，但该数字是在指定 EC2 环境中测得，不能直接当成本机承诺。[官方仓库与快速示例](https://github.com/ultralytics/ultralytics)；[训练设备说明](https://docs.ultralytics.com/modes/train/)

### PPE 数据已经有，但不是 PPE 权重

Ultralytics 官方提供了 Construction-PPE 数据集：1,416 张图片、11 个类别，包括 `helmet`、`gloves`、`vest`、`boots`、`goggles`、`Person`，以及 `no_helmet`、`no_gloves`、`no_boots`、`no_goggle` 和 `none`。首次以 `data="construction-ppe.yaml"` 训练时会自动下载约 178.4 MB 数据。[Construction-PPE 官方文档](https://docs.ultralytics.com/datasets/detect/construction-ppe/)

但必须注意：

- 官方页面提供的是数据和训练示例，没有提供一个可直接下载的 PPE 专项已训练权重；
- `yolo26n.pt` 等默认预训练权重仍然是 COCO 权重，需再训练才能成为 PPE 模型；
- 数据中有 `vest`，却没有 `no_vest`；官方文档也明确指出这一点；
- 检出一个 `person` 和一个 `helmet`，并不自动证明该人“正确佩戴”安全帽。真正的合规判断还需要人体与 PPE 的空间归属规则、置信度阈值和人工确认；
- 1,416 张图适合原型，但不能据此承诺真实工地的准确率、召回率或跨摄像头泛化。

### 无训练即时验证

同一 Ultralytics 包中包含开放词汇的 `YOLOWorld`，可以通过 `set_classes()` 设置文本类别，不要求先针对固定类别训练；还可使用支持文本/视觉提示的 YOLOE。它们适合今天先验证 `person`、`hard hat`、`safety vest` 等提示是否能在演示照片上出框，但零样本结果必须人工检查，不能当成已验证 PPE 模型。[YOLOWorld 官方 API](https://docs.ultralytics.com/reference/models/yolo/model/#ultralytics.models.yolo.model.YOLOWorld)；[YOLOE 官方文档](https://docs.ultralytics.com/models/yoloe/)

### 许可风险

Ultralytics 仓库、默认模型以及 Construction-PPE 数据集均标注 AGPL-3.0。Ultralytics 的官方许可说明称：若不愿将整个项目按 AGPL-3.0 开源，内部业务工具、闭源产品、SaaS、商用嵌入或私有研发需要商业许可。面试用的本地、公开原型可以按 AGPL 路线处理，但若公司后续要把它作为闭源产品，必须在交付前单独做许可审查或购买 Enterprise License。[仓库 LICENSE](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)；[Ultralytics 官方许可说明](https://www.ultralytics.com/license)；[Construction-PPE 许可](https://docs.ultralytics.com/datasets/detect/construction-ppe/#license-and-attribution)

## 可替代或互补的官方项目

| 项目 | 对本 MVP 的作用 | PPE 开箱能力 | 安装与 Windows 风险 | CPU/GPU | 许可 | 今天的决定 |
|---|---|---|---|---|---|---|
| [Ultralytics](https://github.com/ultralytics/ultralytics) | 检测、训练、跟踪、导出；主推理框架 | 默认 COCO 权重无 PPE；官方 PPE 数据需微调；可用开放词汇模型先验证 | `pip install ultralytics`，官方文档覆盖 Windows 训练注意事项，风险最低 | 官方支持 CPU/CUDA；单图 CPU 可演示，训练优先 GPU | AGPL-3.0 或 Enterprise；PPE 数据也是 AGPL-3.0 | **安装，作为主方案** |
| [Supervision](https://github.com/roboflow/supervision) | 画框、标签、区域、视频、检测结果适配；补齐产品演示层 | 不含模型或 PPE 权重 | Python >=3.10，`pip install supervision`；依赖轻 | 本身不做深度模型推理，计算需求取决于上游模型 | MIT | **安装，作为主方案配套** |
| [GroundingDINO](https://github.com/IDEA-Research/GroundingDINO) | 用文本提示做开放词汇检测，可在没有 PPE 权重时当对照 | 可提示 `hard hat`、`safety vest`，但不是 PPE 专项保证 | 官方流程需 clone、`pip install -e .`、下载权重并编译本地扩展；README 专门警告 `_C` 安装错误，示例偏 POSIX，Windows 当天集成风险高 | 官方支持 CPU-only；GPU 更适合交互演示，这是工程判断 | 仓库 Apache-2.0；部署前仍应确认所选 checkpoint 条款 | **今天不装；需要时放独立环境** |
| [RF-DETR](https://github.com/roboflow/rf-detr) | 可训练的检测/分割替代，API 已能直接返回 Supervision 检测结果 | 默认 COCO 权重无 PPE，仍需自定义数据微调 | `pip install rfdetr`；包简单，但官方基准与训练资料以 GPU 为主，Windows 信心低于 Ultralytics | 官方延迟基准使用 NVIDIA T4/TensorRT；当天训练应准备 GPU | 开源包及 Apache-designated 权重为 Apache-2.0；Plus 的 XL/2XL 为 PML 1.0 | **第二阶段评估，不与主栈同时安装** |

Supervision 的官方 README 明确说明它是模型无关的应用工具，可接 Ultralytics、Transformers、MMDetection 和 RF-DETR，并提供可定制 annotator；它本身不是检测器，所以不会解决 PPE 准确率问题。[Supervision README](https://github.com/roboflow/supervision#quickstart)；[Supervision MIT License](https://github.com/roboflow/supervision/blob/develop/LICENSE.md)

GroundingDINO 官方说明其输入是 `(image, text)`，可以按词语阈值输出框，并支持 CPU-only；但安装需要本地扩展，且官方 README 明确警告安装不完整会出现 `_C` 未定义。这让它在“只有一天、Windows 本机”约束下更适合作为备用实验，而不是主链路。[GroundingDINO README](https://github.com/IDEA-Research/GroundingDINO#%EF%B8%8F-install)；[GroundingDINO License](https://github.com/IDEA-Research/GroundingDINO/blob/main/LICENSE)

RF-DETR 官方包支持检测、分割和关键点，并可从 COCO/YOLO 格式数据微调；它的开源包和指定权重采用 Apache-2.0，但 Plus 型号使用另一许可。默认示例加载的是 COCO 类，因此也不能开箱检测 PPE。[RF-DETR README、安装与许可](https://github.com/roboflow/rf-detr#install)；[RF-DETR 训练文档](https://github.com/roboflow/rf-detr/blob/develop/docs/learn/train/index.md)

## 一天 MVP 的执行建议

### 建议安装

只安装两个 Python 包，且放在项目自己的虚拟环境中：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install ultralytics supervision
```

实际落库时应生成并提交锁定后的版本清单，避免演示当天因上游更新产生差异。此研究阶段不替项目猜测版本号；应以本机 Python、CUDA 和可安装版本的探测结果锁定。

### 建议实现顺序

1. 先完成图片上传、检测结果 JSON、带框预览和“人工确认后生成隐患工单”的闭环。
2. 用 Ultralytics 开放词汇模型在 5–10 张演示照片上做快速探测，提示词至少分开测试 `person`、`hard hat`、`safety vest`。
3. 若有 NVIDIA GPU 或云 GPU，再以 nano 模型对 `construction-ppe.yaml` 做迁移训练；先跑短轮次 smoke test 验证流水线，再决定是否跑官方示例的 100 epochs。
4. 把 `no_helmet` 等检测结果当作“AI 建议”，由用户确认后才进入工单；不要在界面上写未经验证的“95% 准确率”。
5. 今天只支持静态图片最稳。视频跟踪、区域入侵和持续告警可由 Supervision 在下一阶段补充。

### 设备选择

- **无独显**：做静态单图推理和完整业务闭环；可以跑开放词汇/已训练模型，但不把本地完整 PPE 训练列为当天硬目标。
- **有 NVIDIA CUDA GPU**：可以尝试短轮次 PPE 微调和视频演示；仍需保留人工确认。
- **公司未来生产化**：重新评估训练数据代表性、许可、摄像头域差异、误报/漏报代价和人机复核流程，再选 Ultralytics Enterprise 或 Apache 路线的模型框架。

## 最终推荐

`ultralytics` 对这个功能有直接帮助，而且目前没有一个“今天更容易、官方自带 PPE 数据、Windows 安装更轻”的替代仓库。更好的做法不是把多个大型检测仓库都装进来，而是：

> **Ultralytics 做视觉主干，Supervision 做可视化与区域/视频能力，产品本身做隐患工单闭环；GroundingDINO 和 RF-DETR 只保留为后续替代路线。**

若目标是面试展示，这套选择能够同时展示 AI 能力、工程取舍和安全业务闭环；若目标转为公司闭源产品，则 Ultralytics/Construction-PPE 的 AGPL-3.0 是必须优先解决的架构与采购问题。
