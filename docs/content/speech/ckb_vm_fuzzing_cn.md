# 演讲/我们如何通过模糊测试保证 CKB-VM 的正确性(一)

## 引言

[模糊测试](https://en.wikipedia.org/wiki/Fuzzing)(Fuzzing 或 Fuzz)是软件测试中常用的一种测试方法. 模糊测试的核心思想是将自动或半自动生成的随机数据输入到一个函数中, 并监视程序的异常, 以发现可能存在的程序错误. 我们在 CKB-VM 2021 升级中采用了模糊测试技术, 并取得了相当好的效果. 本文的目的在于介绍模糊测试的基本原理以及我们是如何在本次 CKB-VM 2021 升级中应用模糊测试, 发现和排查错误.

## CKB-VM 2021 升级

CKB-VM 2021 升级最大的改变之一, 是增加了 RISC-V B 扩展指令集. B 扩展指令集中的 B 是 bit-manipulation 的缩写, 即位操作. 在 CKB-VM 2019 版本中, 我们提供了 RISC-V IMC 指令集: IMC 指令集提供基本的整数操作, 例如加法, 减法, 乘法或移位等操作. B 扩展指令集则进一步提供了更多新的操作: 例如整数的循环左移, 循环右移, 按位与/或/异或, 非, 按位置位/置零或者前导零计数等. 许多位操作都是我们在写算法时经常要使用到的, 而 B 扩展指令集就恰恰提供了这些操作的原生指令! 它带来好处是两方面的: 性能提升的同时且脚本体积减少.

下面使用一个例子来解释 B 扩展指令集的优势. 如果我们准备计算一个数字的前导零, 例如数字 12345678, 计算过程非常简单, 它将一个数字作为二进制看待, 并统计数字的开头有多少个零. 数字 12345678 的二进制表示是 `0000000000000000000000000000000000000000101111000110000101001110`, 因此它的前导零个数为 40.

在 CKB-VM 2019 版本中, 你可以使用二分法计算前导零, 其 C 语言代码如下:

```c
uint64_t clz(uint64_t n)
{
    if (n == 0) return 64;
    uint64_t c = 0;
    if (n <= 0x00000000FFFFFFFF) { c += 32; n <<= 32; };
    if (n <= 0x0000FFFFFFFFFFFF) { c += 16; n <<= 16; };
    if (n <= 0x00FFFFFFFFFFFFFF) { c += 8; n <<= 8; };
    if (n <= 0x0FFFFFFFFFFFFFFF) { c += 4; n <<= 4; };
    if (n <= 0x3FFFFFFFFFFFFFFF) { c += 2; n <<= 2; };
    if (n <= 0x7FFFFFFFFFFFFFFF) { c += 1; };
    return c;
}
```

在 CKB-VM 2021 版本中, 由于 CKB-VM 已经实现了 B 扩展指令集中的 clz 指令, 因此你只需要使用一行内联汇编代码:

```c
static inline uint64_t clz(uint64_t n) {
    uint64_t c;
    __asm__ ("clz %0, %1" : "=r"(c) : "r"(n));
    return c;
}
```

## 测试技术路径的选择

B 扩展指令集总共新增了 43 个指令, 按照作用可以细分为 4 个子类: 地址生成指令(Address generation instructions), 基础位操作指令(Basic bit-manipulation), 无进位乘法(Carry-less multiplication)和单位操作(Single-bit instructions)指令. 本文略过细节不讲, 详细的内容可以下载官方 PDF [https://github.com/riscv/riscv-bitmanip/releases](https://github.com/riscv/riscv-bitmanip/releases) 进行查看. 如此数量庞大的指令带给我们一个难题: 如何保证这 43 个指令的实现的正确性? 我们首先想到的是使用官方测试用例, 但非常的不幸, 由于 CKB-VM 与 RISC-V B 扩展指令集规范是同步推进的--我们几乎在官方发布 1.0 版本规范的同时就准备好了代码, 它导致的结果是官方在那时并未来得及准备测试用例, 因此我们面临没有测试用例可用的窘境. 另一个更加严峻的问题是, 我们那时候连可以使用的汇编器(Assembler, 将汇编代码编译为机器码的工具)都没有: 如果我们准备自己编写测试用例, 不能使用 C 语言, 甚至连汇编语言都无法使用.

为了解决这两个问题, 我们做了以下两部分工作. 我们首先自己实现了一个汇编器 [riscv-naive-assembler](https://github.com/XuJiandong/riscv-naive-assembler), 其次我们编写了一个随机 RISC-V 指令流生成程序.

汇编器是测试的第一步, 它的必要性有两点: 1) 我们可以使用汇编代码编写测试代码, 而不是机器码. 2) 因为 CKB-VM 在指令的执行前会做译码工作, 因此汇编器可以同 CKB-VM 内的译码器做交叉验证, 确保一条指令经过编码和译码后解析出来的仍然是同一条指令. 我们安排了两个开发者做这件工作, A 开发者编写一个独立于 CKB-VM 存在的汇编器, B 开发者在 CKB-VM 中编写译码过程, 在开发过程中 A 与 B 开发者互不沟通, 直到各自的工作完成. 之后, 我们生成随机的指令流, 首先通过汇编器, 然后将汇编器的输出传入 CKB-VM, 再从 CKB-VM 的译码过程中取回译码后的指令流, 与原始指令流进行比对并确保它们完全一致.

接下来是指令执行过程的测试. 我们面临的窘境是我们缺少官方的测试用例, 但请注意这个问题并不仅仅发生在我们身上, 其它 RISC-V 虚拟机团队也将同样的遇到此问题. 例如 [Spike](https://github.com/riscv-software-src/riscv-isa-sim), 它是一个知名的 RISC-V 模拟器, 它实现了大多数 RISC-V 扩展, 是 RISC-V 社区开发者最常用的工具之一. 我们注意到 Spike 在 CKB-VM 2021 升级不久后也加入了 B 扩展指令集, 因此我们同样可以使用 Spike 模拟器作为与 CKB-VM 2021 进行交叉验证的对照组, 如果一段随机的指令流经过 CKB-VM 2021 和 Spike 后可以得出一致的结果, 只要该随机指令流覆盖度足够高并且经过长时间的测试, 那么我们就有相当大的把握相信 CKB-VM 2021 对 B 扩展指令集的实现与 Spike 的实现是一致的. 当两个不同的团队得出相同的结果时, 结果也将更有说服力. 在 B 扩展指令集外, 我们还需要重新回归测试基本的 RISC-V IMC 指令集, 对于 IMC 指令集我们采用了 [Sail](https://github.com/riscv/sail-riscv) 模拟器而非 Spike 模拟器.

> 你大概会好奇这 Sail 与 Spike 模拟器之间有什么区别? Spike 实现了 RISC-V 指令, 但 Sail RISC-V 则是 RISC-V 指令的官方规范--只是目前为止 Sail 还未实现 B 扩展指令集.

## rfuzzing: 模糊测试的随机指令流生成器

从上面的技术路径来看, 要完成 CKB-VM 2021 升级的测试还差最后一块拼图: 随机指令流生成器. 我们为此编写了 [rfuzzing](https://github.com/mohanson/rfuzzing) 工具, 它采用一种内部格式标记了每个待测试指令的格式, 然后依据格式不停生成指令. 在 RISC-V 的 B 扩展指令集中, 一个指令只接受两种不同类型的输入: 寄存器和立即数.

关于寄存器, RISC-V 总共有 32 个寄存器, 其名称分别为:

```py
registers = [
    'zero', 'ra',   'sp',   'gp',
    'tp',   't0',   't1',   't2',
    's0',   's1',   'a0',   'a1',
    'a2',   'a3',   'a4',   'a5',
    'a6',   'a7',   's2',   's3',
    's4',   's5',   's6',   's7',
    's8',   's9',   's10',  's11',
    't3',   't4',   't5',   't6',
]
```

rfuzzing 在随机指令的生成过程中将这 32 个寄存器的前 31 个作为空闲寄存器(idle registers)供指令随意使用, 最后一个 t6 寄存器作为 checksum 状态寄存器--每个指令执行完毕后, checksum 寄存器都将当前指令的计算结果叠加到之前的状态上. 例如对于 clz 指令来说, 我们可能会生成如下的随机指令流:

```asm
clz ra, sp     # ra = clz(sp)  # 从空闲寄存器中随机取两个寄存器作为 clz 的输入
add t6, t6, ra # t6 = t6 + ra  # 将指令结果加入到 t6 寄存器, t6 最终的值即为 checksum

clz s5, gp     # s5 = clz(gp)  ...
add t6, t6, s5 # t6 = t6 + s5  ...
```

关于立即数, 我们会在指令的可选立即数范围内随机选择一个数字, 例如对于 rori 指令(循环右移指令), 它的基本格式是 `rori rd, rs, uimm6`, 它所执行的操作是将 rs 寄存器内的值循环右移 uimm6 位后保存在 rd 寄存器中, 其中 uimm6 立即数的大小在 0 到 64 之间. rfuzzing 就可能会针对 rori 指令生成如下的指令:

```asm
rori a3, a4, 27 # a3 = a4 >> 27 # 从空闲寄存器中随机取两个寄存器作为 rori 的输入并生成一个位于 0 到 64 之间的立即数
add t6, t6, a3  # t6 = t6 + a3  # 将指令结果加入到 t6 寄存器, t6 最终的值即为 checksum
```

我们循环上述的过程, 便可以生成一系列的测试指令, 每个指令的计算结果都被反映在 checksum 寄存器中. 最终我们将 checksum 寄存器的值作为程序的退出码退出程序, 我们在 CKB-VM 2021 与 Spike 中同时执行测试代码, 如果它们最终的退出码相同, 那么就可以认为这一系列的测试指令在两个虚拟机中都有相同的表现.

## rfuzzing: 寄存器的随机初始化

RISC-V 规范约定其所有寄存器均以零值开始初始化, 但这并不是我们想要的. 在随机生成的测试代码之前, 我们会额外插入一段随机初始化代码以初始化寄存器中的值, 使得测试代码可以从"混沌"状态开始. 熟悉测试的朋友们应当知道, 当输入数据是某些边界值的时候, 程序更容易出现问题, 例如一个除法运算, 我们就要谨慎除数为零的情况. 回到之前的前导零(clz)计算的例子, 我们认为以下两种情况比较特殊, 在编写代码的时候更容易写出 Bug:

0. 数字没有前导零, 即 0xffffffffffffffff
0. 数字为零(即它的所有位均为前导零), 0x0000000000000000

想象一下, 如果我们遵循完全随机的生成数字, 那么凑巧生成 0xffffffffffffffff 或 0x0000000000000000 的概率是多少? 答案是 5.42e-20, 这个概率真的是太低了! 因此在 CKB-VM 的模糊测试中, 我们有意提高了一些边界值数字出现的概率, 例如 0x0000000000000000, 0x0000000000000001, 0xffffffffffffffff, 0x8000000000000000 等.

## 测试结果和结论

本轮模糊测试经统计平均每秒可以测试 4 万个随机指令, 总共测试时长 4 天左右, 期间总共发现约 10 余处错误, 这些错误大多集中在 CKB-VM 的 ASM 与 AOT 模式下, 而在 CKB-VM 的解释器模式下错误较少. 其本质原因是 CKB-VM 的 ASM 与 AOT 模式存在大量手工编写的汇编代码, 比起 Rust 编写的解释器代码更容易出现错误. 我们将在下一篇文章中介绍一个难以通过常规手段发现的错误.

模糊测试是 CKB-VM 测试流程中重要的一环, 在经过模糊测试后, 我们对此次 CKB-VM 2021 平稳和安全地升级有非常强大的信心.

## 模糊测试的一些细节

通过这次实践, 我们认为模糊测试方法值得在各个项目中进行推广. 模糊测试的数据生成和测试都是交由计算机完成的, 只要我们不手动停下它它就可以无限测试下去, 这意味着我们可以使用更多时间去做更有意义的事情. 随着模糊测试的时间变长, 你也将有更强的信心相信自己的程序是正确的. 模糊测试有几个细节需要测试人员进行额外关注:

1. 随机输入的数据被过早拒绝. 许多时候我们需要一种结构化的数据, 例如 CKB-VM 的 ELF 结构数据. 如果你只是生成随机的数据, 那么大部分情况下它们将直接被解析器拒绝, 而无法深入程序内部. 因此在 CKB-VM 的模糊测试中我们使用合法的汇编代码作为输入.
2. 模糊测试的最佳应用场景是单个无状态的函数. 你很难用模糊测试去测试一个 K8S 系统, 这真的没有必要.

# 我们如何通过模糊测试保证 CKB-VM 的正确性(二)

这篇文章主要展示在 CKB-VM 2021 升级模糊测试的一些技术细节和操作步骤的演示. 本文是对第一篇文章的补充, 目标读者是希望可以对测试过程进行重现的开发者. 我们已经验证过本文所展示的步骤可以在 Ubuntu 20.04 系统下进行.

## 安装测试环境

rfuzzing 提供了本次 CKB-VM 2021 升级模糊测试的开发环境, 克隆项目, 并执行环境安装脚本, 该脚本会使用 apt 安装一系列的依赖, 然后在 rfuzzing/dep 目录下编译一些可执行文件:

```sh
$ git clone https://github.com/mohanson/rfuzzing
$ cd rfuzzing
$ git checkout 240704ab2ae0ba0bfa4a3d6ad6ed645dbfc1353c

$ sh deps/develop.sh env
```

## 汇编器 riscv-naive-assembler

我们首先对汇编器 riscv-naive-assembler 的原理和使用方式进行介绍. 汇编器已经被安装在 rfuzzing/dep/riscv-naive-assembler/target/release/riscv-naive-assembler 位置.

假设我们有如下的汇编代码, 将其保存为 origin.S, 注意到其中的 clmulh, 它是 B 扩展指令集中的一个指令:

```text
.global _start
_start:
    clmulh ra,s6,t3
    mv a0,ra
    li a7,93
    ecall
```

使用汇编器处理汇编代码, 汇编器会对原始代码进行分析并完成指令替换, 输出文件保存为 output.S.

```sh
$ riscv-naive-assembler/target/release/riscv-naive-assembler -i origin.S > output.S
```

```text
.global _start
_start:
    # clmulh ra,s6,t3
    .byte 0xb3,0x30,0xcb,0x0b
    mv a0,ra
    li a7,93
    ecall
```

output.S 与 origin.S 最大的区别在于我们注释掉了 `clmulh ra,s6,t3` 指令, 并在其本来位置插入 `.byte 0xb3,0x30,0xcb,0x0b`. `.byte` 指令在汇编代码的任何位置都会直接生成对应字节, 如果它恰好在文本段中, 那么该字节就会像汇编代码一样运行. 因此经过这部操作后, 原本不认识 B 扩展指令集的官方汇编器就可以对代码进行编译了.

请注意, riscv-naive-assembler 是我们的一个临时解决方案, 在本文的写作时(2021 年 09 月 29 日), 官方的 RISC-V 汇编器已经支持了 B 扩展指令(riscv64-unknown-elf-as, 下文会使用到它).

## Spike 模拟器的安装和使用

接下来, 我们创建一个包含一条前导零计数指令的测试文件, 这次我们直接使用 riscv64-unknown-elf-as 和 riscv64-unknown-elf-ld 两个工具对其进行编译:

```asm
.global _start
_start:
  li a0, 0x000000001fffffff
  clz a0, a0
  li a7, 93
  ecall
```

```sh
$ dep/riscv/bin/riscv64-unknown-elf-as -march=rv64gc_zba_zbb_zbc -o /tmp/main.o main.S
$ dep/riscv/bin/riscv64-unknown-elf-ld -o /tmp/main /tmp/main.o
```

使用 Spike 运行它, 并打印其退出码, 得知 Spike 返回了 35.

```sh
$ dep/riscv/bin/spike --isa=RV64GC_ZBA_ZBB_ZBC_ZBS dep/riscv/riscv64-unknown-elf/bin/pk /tmp/main
$ echo $?
35
```

然后在 CKB-VM 中测试它:

```sh
$ dep/ckb-vm-run/target/release/asm /tmp/main

asm exit=Ok(35) cycles=504 r[a1]=0
```

可以看到, CKB-VM 对该程序的执行结果也是 35, 同时消耗了 504 cycles. 这说明 CKB-VM 与 Spike 在该程序上的执行结果是一致的. 模糊测试的核心流程, 就是不停创建随机测试文件并在 Spike 和 CKB-VM 中进行交叉验证.

## 使用 rfuzzing 脚本进行模糊测试

通过在 src/main.py 中传入不同的参数来开启不同的模糊测试.

```sh
# 测试 IMC 指令集
$ python src/main.py imc
# 测试 B 指令集
$ python src/main.py b
```

执行脚本之后, 将获得如下的输出, 表示当前模糊测试的用例数量.

```text
generation 0
generation 1
generation 2
generation 3
...
```

## 案例研究

我们介绍一个在 CKB-VM v0.20.0-rc5 版本上通过模糊测试发现的一个 Bug, 你现在仍然能复现它. 发生问题的指令是 clmulh, clmulh 指令的作用是 "clmulh produces the upper half of the 2·XLEN carry-less product", 其伪代码实现:

```text
let rs1_val = X(rs1);
let rs2_val = X(rs2);
let output : xlenbits = 0;
foreach (i from 1 to xlen by 1) {
  output = if ((rs2_val >> i) & 1)
  then output ^ (rs1_val >> (xlen - i));
  else output;
}
X[rd] = output
```

在我们使用模糊测试方法生成随机的 clmulh 测试用例时, 发现在一些情况下 CKB-VM 的执行结果与 Spike 的执行结果不一致, 例如如下测试用例(已经过裁剪):

```asm
.global _start
_start:
  li ra, 42

  clmulh ra,s6,t3

  mv a0,ra
  li a7,93
  ecall
```

分别使用 Spike 和 CKB-VM 执行, Spike 返回的退出码是 0, 而 CKB-VM 返回的退出码是 42: 就好像从未执行过 clmulh 一样.

```sh
$ spike --isa RV64GC_ZBA_ZBB_ZBC_ZBS dep/riscv/riscv64-unknown-elf/bin/pk /tmp/main
$ echo $?
0

./CKB-VM-run/target/release/aot /tmp/main
aot exit=Ok(42) cycles=504 r[a1]=0
```

目前为止我们很难确定问题发生的原因, 因此紧接着我们就开始搜集更多在模糊测试中失败的测试用例, 在经过分析后发现这些测试有一个显著的相同点, 就是其 clmulh 的目的寄存器均为 ra, 例如 `clmulh ra, s0, t3` 或 `clmulh ra, gp, zero` ..., 而如果是其它的寄存器则模糊测试都是能通过的.

看起来问题出现在 ra 寄存器上!

观察 clmulh 的[代码实现](https://github.com/nervosnetwork/CKB-VM/blob/6da2cf89e7f00c3b68c4c8dd0b61edfdbd1e2677/src/machine/aot/aot.x64.c#L1089-L1117), 此处只复制它核心的三句问题代码, 可以发现在 clmulh 的执行之前我们会先保存 rsi 的值到栈上, 并在退出前恢复 rsi 的值:

```c
int aot_clmulh(AotContext* context, riscv_register_t target, AotValue a, AotValue b) {
  ...
  | push rsi                  // 将 rsi 寄存器保存到栈上
  ...
  | op2_r_x mov, target, r10  // 将 clmulh 的计算结果保存到 target 寄存器上
  | pop rsi                   // 恢复 rsi 寄存器
  ...
}
```

上述 target 寄存器不是指某个固定的寄存器, 它是一个变量, 注意到如果 `op2_r_x mov, target, r10` 中的 target 是 rsi 寄存器的话, clmulh 的计算结果会被最后一句 `pop rsi` 覆盖.

那么什么情况下 target 会是 rsi 寄存器? 答案是当 clmulh 的目的寄存器是 ra 的时候, ra 寄存器在代码中会被映射到 x86 寄存器的 rsi 寄存器中, 代码段如下: [https://github.com/nervosnetwork/CKB-VM/blob/6da2cf89e7f00c3b68c4c8dd0b61edfdbd1e2677/src/machine/aot/aot.x64.c#L141-L163](https://github.com/nervosnetwork/CKB-VM/blob/6da2cf89e7f00c3b68c4c8dd0b61edfdbd1e2677/src/machine/aot/aot.x64.c#L141-L163)

```c
x64_register_t riscv_reg_to_x64_reg(riscv_register_t r)
{
  switch (r) {
    case REGISTER_RA:
      return X64_RSI;
    ...
    default:
      return INVALID_X64_REGISTER;
  }
}
```

这样一个极难被发现的问题就通过模糊测试找到了.
