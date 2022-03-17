# 杂项/ CKB-VM ASM 介绍

CKB-VM ASM 模式是一个使用手写汇编编写的 RISC-V 解释器.

## Trace

Trace 是 CKB-VM 执行的基本块(Block). 根据定义, Trace 只有一个入口和出口, Trace 中出现的指令按照它们在代码中出现的顺序执行. 因此, 任何控制流指令, 例如跳转, 调⽤, 返回, 或系统调⽤将结束一个 Trace. 同时, 为了限制 Trace 的大小, 当一个 Trace 中包含的指令超出一定数目时, 也将强制结束该 Trace.

```text
00000000000102b8:
   102b8:	1101                	addi	sp,sp,-32
   102ba:	67c5                	lui	    a5,0x11
   102bc:	e822                	sd	    s0,16(sp)
   102be:	6445                	lui	    s0,0x11
   102c0:	39078713          	    addi	a4,a5,912 # 11390
   102c4:	39840413          	    addi	s0,s0,920 # 11398
   102c8:	8c19                	sub	    s0,s0,a4
   102ca:	e426                	sd	    s1,8(sp)
   102cc:	ec06                	sd	    ra,24(sp)
   102ce:	840d                	srai	s0,s0,0x3
   102d0:	39078493          	    addi	s1,a5,912
   102d4:	e411                	bnez	s0,102e0 <----------------- Trace 0
   102d6:	60e2                	ld	    ra,24(sp)
   102d8:	6442                	ld	    s0,16(sp)
   102da:	64a2                	ld	    s1,8(sp)
   102dc:	6105                	addi	sp,sp,32
   102de:	8082                	ret              <----------------- Trace 1
   102e0:	147d                	addi	s0,s0,-1
   102e2:	00341793          	    slli	a5,s0,0x3
   102e6:	97a6                	add	    a5,a5,s1
   102e8:	639c                	ld	    a5,0(a5)
   102ea:	9782                	jalr	a5       <----------------- Trace 2
   102ec:	b7e5                	j	    102d4    <----------------- Trace 3
```

## Trace 缓存

在执行流进入 ASM 代码之前, Rust 代码需要做一件事: 构建供 ASM 代码执行的 Trace. 因此 Rust 代码会在当前 PC 位置读取一个指令, 如果该指令不是分支/跳转等指令, 则继续读取下一个指令--直到构造出一个完整的 Trace.

通过构建缓存机制, 使得 Rust 不需要每次都重新生成 Trace. 假设试图从 pc 开始, 取一个 Trace, 其伪代码如下:

```text
trace_cache = [0; 8192];

func gen_trace(pc) -> Trace {
    slot = (pc / 32) % 8192
    if trace_cache[slot].address == pc {
        return trace_cache[slot]
    } else {
        trace = build_new_trace()
        trace_cache[slot] = trace
        return trace
    }
}
```

## Trace 执行

ASM 将 Trace 内的每个指令顺序执行, 直到到达 Trace 的结尾.

## Trace 执行的尾递归

如何连接 Rust 代码与 ASM 代码, 一个直观的构建方法是:

```text
    +<---------------------------+
    |                            |
主转码循环(Rust) -> Trace -> ASM 解释器
```

但是从 ASM 解释器返回到主转码循环会带来很⼤的性能损失, 这需要进行不必要的上下文切换和检查. 为了避免这些负⾯的性能影响，我们采⽤了尾递归方法：当 ASM 执行 Trace 到达 Trace 结尾时，我们跳转到 ASM 代码的入口处而不是退出 ASM 代码进入 Rust 代码.
 ASM 的入口处代码将会进行 Trace 缓存的检查, 如果缓存命中, 则继续执行新的 Trace; 如果缓存命中失败, 则进入 Rust 代码, 要求 Rust 代码开始新一轮的主转码循环.

```text
    +<---------------------------+
    |                            |        1. 缓存未命中
主转码循环(Rust) -> Trace -> ASM 解释器
                               |    |     2. 缓存命中
                               +<---+
```

其实由上可知, ASM 主转码循环是惰性工作的, 未被使用到的指令不会被翻译, 频繁被使用到的指令则大概率是被缓存的.
