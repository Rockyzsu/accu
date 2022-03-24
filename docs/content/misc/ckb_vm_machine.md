# CKB-VM: 代码结构阅读指南

## CoreMachine

CoreMachine 定义了一套接口, 用于读取或存储数据到寄存器与内存, 它描述了 CKB-VM 的数据部分, 是 CKB-VM 的基石.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/mod.rs#L33-L52)

```rs
/// This is the core part of RISC-V that only deals with data part, it
/// is extracted from Machine so we can handle lifetime logic in dynamic
/// syscall support.
pub trait CoreMachine {
    type REG: Register;
    type MEM: Memory<REG = Self::REG>;

    fn pc(&self) -> &Self::REG;
    fn update_pc(&mut self, pc: Self::REG);
    fn commit_pc(&mut self);
    fn memory(&self) -> &Self::MEM;
    fn memory_mut(&mut self) -> &mut Self::MEM;
    fn registers(&self) -> &[Self::REG];
    fn set_register(&mut self, idx: usize, value: Self::REG);

    // Current running machine version, used to support compatible behavior
    // in case of bug fixes.
    fn version(&self) -> u32;
    fn isa(&self) -> u8;
}
```

## Machine

相比 CoreMachine, 额外实现了系统调用. 现在, 任何 RISC-V 指令都可以通过 Machine 完成实现.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/mod.rs#L54-L59)

```rs
/// This is the core trait describing a full RISC-V machine. Instruction
/// package only needs to deal with the functions in this trait.
pub trait Machine: CoreMachine {
    fn ecall(&mut self) -> Result<(), Error>;
    fn ebreak(&mut self) -> Result<(), Error>;
}
```

## SupportMachine

SupportMachine 负责一些支援工作, 定义了

1. 加载 Elf 文件, 完成程序初始化
2. cycles 相关操作
3. 解释器主循环, 判断是否需要退出程序执行

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/mod.rs#L61-L265)

```rs
/// This traits extend on top of CoreMachine by adding additional support
/// such as ELF range, cycles which might be needed on Rust side of the logic,
/// such as runner or syscall implementations.
pub trait SupportMachine: CoreMachine {
    // Current execution cycles, it's up to the actual implementation to
    // call add_cycles for each instruction/operation to provide cycles.
    // The implementation might also choose not to do this to ignore this
    // feature.
    fn cycles(&self) -> u64;
    fn set_cycles(&mut self, cycles: u64);
    fn max_cycles(&self) -> u64;

    fn running(&self) -> bool;
    fn set_running(&mut self, running: bool);

    // Erase all the states of the virtual machine.
    fn reset(&mut self, max_cycles: u64);
    fn reset_signal(&mut self) -> bool;

    fn add_cycles(&mut self, cycles: u64) -> Result<(), Error>;
    fn add_cycles_no_checking(&mut self, cycles: u64) -> Result<(), Error>;

    fn load_elf(&mut self, program: &Bytes, update_pc: bool) -> Result<u64, Error>;
    fn initialize_stack(&mut self, args: &[Bytes], stack_start: u64, stack_size: u64) -> Result<u64, Error>;
}
```

## DefaultCoreMachine

实现了 CoreMachine, CKB-VM 的 Rust 解释器部分.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/mod.rs#L267-L279)

```rs
#[derive(Default)]
pub struct DefaultCoreMachine<R, M> {
    registers: [R; RISCV_GENERAL_REGISTER_NUMBER],
    pc: R,
    next_pc: R,
    reset_signal: bool,
    memory: M,
    cycles: u64,
    max_cycles: u64,
    running: bool,
    isa: u8,
    version: u32,
}
```

## DefaultMachine

组合任意 SupportMachine 实现, 并同时实现了 Machine.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/mod.rs#L379-L391)

```rs
#[derive(Default)]
pub struct DefaultMachine<'a, Inner> {
    inner: Inner,

    // We have run benchmarks on secp256k1 verification, the performance
    // cost of the Box wrapper here is neglectable, hence we are sticking
    // with Box solution for simplicity now. Later if this becomes an issue,
    // we can change to static dispatch.
    instruction_cycle_func: Option<Box<InstructionCycleFunc>>,
    debugger: Option<Box<dyn Debugger<Inner> + 'a>>,
    syscalls: Vec<Box<dyn Syscalls<Inner> + 'a>>,
    exit_code: i8,
}
```

## TraceMachine

将 RISC-V 程序分成一个个单入口单出口的 Trace 并缓存, 避免对指令重复解码, 可提升性能.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/trace.rs#L35-L39)

```rs
pub struct TraceMachine<'a, Inner> {
    pub machine: DefaultMachine<'a, Inner>,

    traces: Vec<Trace>,
}
```

![img](/img/misc/ckb_vm_machine/interpreter.png)

## Box<AsmCoreMachine\>

实现了 CoreMachine, CKB-VM 的 ASM 解释器部分.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/definitions/src/asm.rs#L38-L55)

```rs
#[repr(C)]
pub struct AsmCoreMachine {
    pub registers: [u64; RISCV_GENERAL_REGISTER_NUMBER],
    pub pc: u64,
    pub next_pc: u64,
    pub running: u8,
    pub cycles: u64,
    pub max_cycles: u64,
    pub chaos_mode: u8,
    pub chaos_seed: u32,
    pub reset_signal: u8,
    pub isa: u8,
    pub version: u32,
    pub flags: [u8; RISCV_PAGES],
    pub memory: [u8; RISCV_MAX_MEMORY],
    pub frames: [u8; MEMORY_FRAMES],
    pub traces: [Trace; TRACE_SIZE],
}
```

## AsmMachine

以 ASM 方式对 RISC-V 程序进行解释执行.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/asm/mod.rs#L431-L434)

```rs
pub struct AsmMachine<'a> {
    pub machine: DefaultMachine<'a, Box<AsmCoreMachine>>,
    pub aot_code: Option<&'a AotCode>,
}
```

![img](/img/misc/ckb_vm_machine/asm.png)

## LabelGatheringMachine

将 RISC-V 分成一段一段的单入口单出口的代码片段, 并保存其入口和出口地址.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/aot/mod.rs#L88-L101)

```rs
struct LabelGatheringMachine {
    registers: [Value; 32],
    pc: Value,
    next_pc: Value,
    labels_to_test: Vec<u64>,
    isa: u8,
    version: u32,

    // A memory segment which contains code loaded from ELF
    memory: FlatMemory<u64>,
    labels: HashSet<u64>,
    sections: Vec<(u64, u64)>,
    dummy_sections: HashMap<u64, u64>,
}
```

## AotCompilingMachine

进行运行前编译, 生成 AOT Code.

[阅读代码](https://github.com/nervosnetwork/ckb-vm/blob/68d87a94668305bfc2b64f7225fc14caf690da8e/src/machine/aot/mod.rs#L424-L438)

```rs
pub struct AotCompilingMachine {
    isa: u8,
    version: u32,
    registers: [Value; 32],
    pc: Value,
    next_pc: Value,
    emitter: Emitter,
    memory: FlatMemory<u64>,
    sections: Vec<(u64, u64)>,
    dummy_sections: HashMap<u64, u64>,
    addresses_to_labels: HashMap<u64, u32>,
    writes: Vec<Write>,
    next_pc_write: Option<Value>,
    instruction_cycle_func: Option<Box<InstructionCycleFunc>>,
}
```

![img](/img/misc/ckb_vm_machine/aot.png)
