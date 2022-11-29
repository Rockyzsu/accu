# Cryptography/椭圆曲线双线性配对(Pairing)

椭圆曲线中的双线性配对是一个非常复杂的议题. 我最早是从以太坊虚拟机的预编译合约中了解到这个概念: <https://eips.ethereum.org/EIPS/eip-197>. 随后工作要求将该算法移植到 RISC-V 上, 并且对它该算法的 cycles 消耗提出了非常严苛的要求, 真的是生活艰难!

## 双射和同构的概念

数学中, 一个由集合 X 映射至集合 Y 的函数, 若对每一在 Y 内的 y, 存在唯一一个在 X 内的 x 与其对应, 且对每一在 X 内的 x, 存在唯一一个在 Y 内的 y 与其对应, 则此函数为双射函数.

同构用于描述两个群之间的一种性质. 如果两个群之间存在一个函数满足双射的前提下, 同时满足 ϕ(a + b) = ϕ(a) + ϕ(b), 则称这两个群是同构的.

## 有限域

复习一下概念. 什么是有限域? 所谓有限域是指域集合元素个数为有限个的一个域.

最常用的有限域是素数域. 记为 Fp = {0, 1, ..., p − 1}, 其中 p 为素数, 0 和 1 分别为加法/乘法的单位元.

有限域中元素的个数称作有限域的阶. 可以证明, 所有的有限域的阶能写成 q = p<sup>n</sup> 的形式, 我们记作 Fq. 且有定理表明, 所有拥有相同的阶的有限群都是同构(isomorphic)的, 一般记作 F(p<sup>n</sup>).

F(p²) 的一个表现形式为 {a + bi|a ∈ Fp, b ∈ Fp}, 其中 i² = −1. 这种表示相当于对 Fp 做了一个域扩展 (Field Extension)Fp[x]/(x²+1). 基本上, 扩展字段通过采用现有字段, 然后"发明"一个新元素并定义该元素和现有元素之间的关系.

## Pairing

椭圆曲线的 Pairing 表示为一个映射

```text
e: G1 × G2 → GT
```

G1, G2 定义在群 E(Fp<sup>k</sup>) 上(或其子群), 而 GT 定义在乘法群 Fp<sup>k</sup>上. 该映射满足如下性质

```text
e(P + P′, Q) = e(P, Q) · e(P′, Q)
e(P, Q + Q′) = e(P, Q) · e(P, Q′)
```

该性质的一个推论为

```text
e(aP, bQ) = e(P, Q)^ab
```

同时 Pairing 函数需要满足非退化性(non-degeneracy):

```text
e(G, G) != 1
```

右边的 1 表示目标群中的乘法单位元. 非退化性保证了只要我们选择椭圆曲线上的非单位成员 G, 就能得到目标群中的非单位元.

Pairing 可用于破解 DDH 问题, 以及用于现代加密体系如 ZkSNARK. 简单来说, 基于 pairing 的加密体系能够通过密文验证两组明文的乘积是否相同, 但仍然不会暴露这个乘积. 这是有趣的一点, 因为传统加密体系要求算法尽可能多的破坏明文的信息, 但 Pairing 却可以通过密文来获得部分关于明文的知识.

例: 请举例在实数域中 e(x, y) = 2<sup>xy</sup> 是双线性函数.

答:

```text
e(3, 4+ 5) = 2^(3 * 9) = 2²⁷
e(3, 4) * e(3, 5) = 2^(3 * 4) * 2^(3 * 5) = 2¹² * 2¹⁵ = 2²⁷.
```

例: 通过 Pairing 证明您知道 x² - x - 42 = 0 的解, 然而并不透露这个解的具体数值.

答:

如果 e(G, G)<sup>k</sup> = 1 成立, 那么 k 必须为 0 或者目标群的倍数. 因此, 如果存在 e(G, G)<sup>x² - x - 42</sup> , 我们可以确定原始二次方程式成立. 使用双线性性重写方程 e(G, G)<sup>x²</sup> ⋅ e(G, G)<sup>-x</sup> ⋅ e(G, G)<sup>-42</sup> = 1, 进一步的 e(xG, xG) ⋅ e(xG, -G) ⋅ e(G, -42G) = 1. 因此, 我们只需要提供 xG 的值. 同时由于椭圆曲线的离散对数问题, 从 xG 反推回 x 是困难的.

## Pairing 算法计算任务划分

这里先介绍一下要实现 Pairing 算法需要用到的数学工作.

对于椭圆曲线签名而言, 其计算任务从基础到复杂而言分为 4 层:

0. Arithmetic in Fp: addition, subtraction, multiplication, inversion
0. Group operations: point add, point double
0. Point multiplication: Q = x * G
0. ECC: ECDSA

对于 Pairing 而言:

0. Arithmetic in Fp: addition, subtraction, multiplication, inversion, **frobenius map**, **exponentiation**
0. Towered arithmetic: **Fp¹² → Fp⁶ → Fp² → Fp**
0. Group operations: point add, point double, **miller loop**, **final exponentiation**
0. Optimal ate pairing: e: (G₁ x G₂) → G<sub>T</sub>
0. ECC: Pairing

## 参考

- [1] VitalikButerin, Exploring Elliptic Curve Pairings, <https://medium.com/@VitalikButerin/exploring-elliptic-curve-pairings-c73c1864e627>
- [2] Joshua Fitzgerald, What are zk-SNARKs? Pairings (Part 1), <https://medium.com/coinmonks/what-are-zk-snarks-pairings-part-1-a76b58f1a51b>
