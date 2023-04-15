# 人工智能/Stable Diffusion　- Rocky

Stable Diffusion 是一种通过文字描述创造出图像的 AI 模型. 它是一个开源软件, 有许多人愿意在网络上免费分享他们的计算资源, 使得新手可以[在线尝试](https://stablediffusionweb.com/#demo).

## 安装

本地部署的 Stable Diffusion 有更高的可玩性, 例如允许您替换模型文件, 细致的调整参数, 以及突破线上服务的道德伦理检查等. 鉴于我目前没有可供霍霍的 GPU, 因此我将在一台 2 核 4G 内存的云服务上部署它. 这着实非常惊人!

在安装运行 Stable Diffusion 之前, 首先需要为 Linux 机器创建一个 16G 大小的交换分区. Stable Diffusion 在运行过程中大概需要吃掉 12G 内存, 交换分区可以勉强让我们达到其最低运行需求.

```sh
$ dd if=/dev/zero of=/mnt/swap bs=64M count=256
$ chmod 0600 /mnt/swap
$ mkswap /mnt/swap
$ swapon /mnt/swap
```

下载并安装 Stable Diffusion WebUI:

```sh
$ git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
$ cd stable-diffusion-webui
$ git checkout 22bcc7be428c94e9408f589966c2040187245d81

# 我们需要 CPU 版本的 torch
$ export TORCH_COMMAND="pip install torch==1.13.1 torchvision==0.14.1 --index-url https://download.pytorch.org/whl/cpu"
$ export USE_NNPACK=0

# 前 4 个参数是为了让其运行在 CPU 上, 最后一个参数是让 WebUI 可以远程访问
$ bash webui.sh --skip-torch-cuda-test --no-half --precision full --use-cpu all --listen
```

等待一段时间, 在浏览器中打开 `127.0.0.1:7860` 即可见到 UI 界面.

## 下载更多模型

模型, 有时称为检查点文件, 是预先训练的 Stable Diffusion 权重, 用于生成一般或特定的图像类型. 模型可以生成的图像取决于用于训练它们的数据. 如果训练数据中没有猫, 模型将无法产生猫的形象. 同样, 如果您仅使用猫图像训练模型, 则只会产生猫.

[此处](https://stable-diffusion-art.com/models/)介绍了一些常见的模型(v1.4, v1.5, F222, Anything V3, Open Journey v4).

Stable Diffusion WebUI 运行时会自动下载 Stable Diffusion v1.5 模型. 下面提供了一些快速下载其它模型的命令.

```sh
$ cd models/Stable-diffusion

# Stable diffusion v1.4
$ wget https://huggingface.co/CompVis/stable-diffusion-v-1-4-original/resolve/main/sd-v1-4.ckpt
# Stable diffusion v1.5
$ wget https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt
# F222
$ wget https://huggingface.co/acheong08/f222/resolve/main/f222.ckpt
# Anything V3
$ wget https://huggingface.co/Linaqruf/anything-v3.0/resolve/main/anything-v3-fp16-pruned.safetensors
# Open Journey
$ wget https://huggingface.co/prompthero/openjourney/resolve/main/mdjrny-v4.ckpt
# DreamShaper
$ wget https://civitai.com/api/download/models/5636 -O dreamshaper_331BakedVae.safetensors
# ChilloutMix
$ wget https://civitai.com/api/download/models/11745 -O chilloutmix_NiPrunedFp32Fix.safetensors
# Robo Diffusion
$ wget https://huggingface.co/nousr/robo-diffusion/resolve/main/models/robo-diffusion-v1.ckpt
# Mo-di-diffusion
$ wget https://huggingface.co/nitrosocke/mo-di-diffusion/resolve/main/moDi-v1-pruned.ckpt
# Inkpunk Diffusion
$ wget https://huggingface.co/Envvi/Inkpunk-Diffusion/resolve/main/Inkpunk-Diffusion-v2.ckpt
```

## 修改配置文件

ui-config.json 内包含众多的设置项, 可按照个人的习惯修改部分默认值. 例如我的配置部分如下:

```json
{
    "txt2img/Batch size/value": 4,
    "txt2img/Width/value": 480,
    "txt2img/Height/value": 270
}
```

## 示例

```text
 model: anything-v3-fp16-pruned.safetensors
prompt: colorful reflective fabric inner, pixiv, hyper detailed, futuristic fashion, anime girl, nude
```

![img](/img/ai/stable_diffusion/01.png)

```text
 model: chilloutmix_NiPrunedFp32Fix.safetensors
prompt: beautiful, masterpiece, best quality, extremely detailed face, perfect lighting, (1girl, solo, 1boy, 1girl, NemoNelly, Slight penetration, lying, on back, spread legs:1.5), street, crowd, ((skinny)), ((puffy eyes)), brown hair, medium hair, cowboy shot, medium breasts, swept bangs, walking, outdoors, sunshine, light_rays, fantasy, rococo, hair_flower,low tied hair, smile, half-closed eyes, dating, (nude), nsfw, (heavy breathing:1.5), tears, crying, blush, wet, sweat, <lora:koreanDollLikeness_v15:0.4>, <lora:povImminentPenetration_ipv1:0>, <lora:breastinclassBetter_v14:0.1>
prompt: paintings, sketches, (worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)), skin spots, acnes, skin blemishes, age spot, (ugly:1.331), (duplicate:1.331), (morbid:1.21), (mutilated:1.21), (tranny:1.331), mutated hands, (poorly drawn hands:1.331), blurry, (bad anatomy:1.21), (bad proportions:1.331), extra limbs, (disfigured:1.331), (missing arms:1.331), (extra legs:1.331), (fused fingers:1.61051), (too many fingers:1.61051), (unclear eyes:1.331), bad hands, missing fingers, extra digit, bad body, pubic
```

上述提示词结尾引用了 3 个 Lora 模型, 需提前下载至 `models/Lora` 目录.

```sh
$ cd models/Lora
$ wget https://huggingface.co/amornlnw7/koreanDollLikeness_v15/resolve/main/koreanDollLikeness_v15.safetensors
$ wget https://huggingface.co/samle/sd-webui-models/resolve/main/povImminentPenetration_ipv1.safetensors
$ wget https://huggingface.co/jomcs/NeverEnding_Dream-Feb19-2023/resolve/main/lora/breastinclassBetter_v14.safetensors
```

![img](/img/ai/stable_diffusion/02.png)
