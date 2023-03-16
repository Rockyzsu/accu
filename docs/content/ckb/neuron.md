# CKB/Neuron 钱包

Neuron 是 CKB 的全节点钱包, 截至 2023/03/14, 该钱包至少需要 45G 硬盘空间保存链上数据. 钱包下载地址: <https://github.com/nervosnetwork/neuron>.

当第一次启动钱包时, 钱包会自动运行一个 CKB 全节点并开始同步数据. 如果你确实不希望同步一个全节点, 也可以点击帮助 -> 设置 -> 网络 -> 添加网络, 填写社区公开的 mainnet 服务地址(同步速度较慢):

<https://github.com/nervosnetwork/ckb/wiki/Public-JSON-RPC-nodes#ckb>

|  type   |             url             |
| ------- | --------------------------- |
| mainnet | https://mainnet.ckbapp.dev/ |
| mainnet | https://mainnet.ckb.dev/    |
| testnet | https://testnet.ckbapp.dev/ |
| testnet | https://testnet.ckb.dev/    |

## 创建钱包

Neuron 是一个 HD(分层确定性)钱包, 由 BIP32, BIP39, BIP-43 和 BIP-44 共同定义. 当创建钱包时, 系统会显示 12 个助记词并提示你记录下来. 保管好这 12 个助记词, 遗忘或泄露都会造成财产的损失.

## 备份钱包

**助记词**

记住一点: 助记词 = 钱包. 任何人拿到助记词, 就意味着拥有了该钱包的一切权限.

**Keystore**

Keystore 是一个 JSON 文件, 要从 Keystore 恢复钱包需要一个额外的事先设置的密码. Keystore 文件 + 密码 = 钱包.

**Extended Public Key**

Extended Public Key (Xpub) 的介绍可以参考 <https://river.com/learn/terms/x/xpub-extended-public-key/>. 概括来说, xpub 保留了 HD 钱包的所有公钥而没有私钥, 因此它是一个只读的钱包.
