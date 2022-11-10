# 演讲/Ensuring the Correctness of CKB-VM by Fuzzing, Part 1.

## Overview

Fuzzing, or Fuzz Testing, is a technique commonly used in software testing. The concept behind Fuzzing is to put the stochastic data(generated automatically or semi-automatically) into a function to monitor the program against abnormalities so as to identify any potential program errors. We have adopted Fuzzing in the CKB-VM 2021 release and obtained promising results. This article will introduce the fundamentals of Fuzzing and how Fuzzing was applied in this CKB-VM 2021 release to identify and troubleshoot errors.

## CKB-VM 2021 Release

A major change in the CKB-VM 2021 release is to include the RISC-V B extension instruction set. The “B” in the B extension instruction set stands for bit-manipulation, i. e. bit manipulation operation. In the CKB-VM 2019 release, the RISC-V IMC instruction set has been added. The IMC instruction set provides basic integer operations, e.g. addition, subtraction, multiplication or shift. The B extended instruction set provides further new operations, such as cyclic left shift and cyclic right shift of integer, bitwise and, bitwise or, bitwise xor, or bitwise set/clear etc. Many bit operations are frequently used when writing algorithms, and the B extended instruction set delivers native instructions for precisely these operations! The advantages are mutual: better performance and less script size.

The following is an example to illustrate the strengths of the B extended instruction set. To calculate the leading zeros of a number, say the number 12345678, the process is fairly simple. Let’s takes this number as a binary and counts how many zeros there are at the beginning of the binary. The binary expression of the number 12345678 is 0000000000000000000000000000000000000000101111000110000101001110. Therefore, the total number of leading zeros is 40.

In the CKB-VM 2019 version, the dichotomy method can be used to counts the leading zeroes, and the C code is as follows

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

In CKB-VM 2021, as CKB-VM already implemented the clz instruction in the B-extension instruction set, only one line of inline assembly code is required:

```c
static inline uint64_t clz(uint64_t n) {
    uint64_t c;
    __asm__ ("clz %0, %1" : "=r"(c) : "r"(n));
    return c;
}
```

## Choosing a Technical Path for Testing

43 new instructions have been added to the B extension instruction set, which can be subdivided into four sub-categories: Address Generation Instructions, Basic Bit-Manipulation, Carry-less Multiplication and Single-bit Instructions. No details will be given in this article, further contents can be found in the official [PDF](https://github.com/riscv/riscv-bitmanip/releases).

Such a massive number of instructions raised a problem: how to guarantee the correctness of the implementation of these 43 instructions? The first thing that came to mind was to employ the official test cases. Unfortunately, as the CKB-VM and RISC-V B extension instruction set specifications were being developed in parallel, the code was being prepared almost simultaneously with the release of version 1.0 specification, consequently the official test cases were not available at that time, leaving us stranded with no test cases.

A more serious problem was the lack of an Assembler (a tool for compiling assembly code into machine code): it was impossible to use C, or even assembly language, if we were to write our own test cases.

To tackle these two challenges, a two-part approach was taken: the first was to implement our own assembler, [riscv-naive-assembler](https://github.com/XuJiandong/riscv-naive-assembler); the second was to write a random RISC-V instruction stream generation program.

The assembler is the starting point for testing and is necessary for two reasons: 1) instead of machine code, the test code can be written in assembly code. 2) as the CKB-VM decodes the instructions before the execution, the assembler can cross-validate with the decoder embedded in the CKB-VM to ensure that an instruction is still the same after encoding and decoding.

Two developers have been assigned to this task, developer A to write an assembler that is independent of the CKB-VM, and developer B to compose the decoding process in the CKB-VM. Throughout the course of development, developers A and B were in no communication with each other until the job was done. We then generated a random instruction stream, processed it thought the assembler, transferred the assembler output to the CKB-VM, extracted the decoded instruction stream from the decoding process of CKB-VM, and compared it to the original instruction stream to ensure the consistency.

Then came the testing of the instruction execution process. The lack of official test cases was not only a constraint for us, but for other RISC-V virtual machine teams as well. An example is [Spike](https://github.com/riscv-software-src/riscv-isa-sim), a well-known RISC-V simulator that has implemented most RISC-V extensions and is one of the most common used tools in the RISC-V community.

We noticed that Spike included the B extension instruction set shortly after the upgrade of CKB-VM 2021, so we can also use the Spike simulator as a cross-validation control group against CKB-VM 2021. If a random instruction stream can yield consistent results when subjected to CKB-VM 2021 and Spike, then we are fairly certain that the implementation of CKB-VM 2021 for the B extended instruction set is compatible with that of Spike, as long as the coverage of the random instruction stream is adequate and has been tested with sufficient time. The results will be more convincing when two different crews obtain the same results. Alongside the B extended instruction set, a return to testing the basic RISC-V IMC instruction set was necessary, for which we adopted the [Sail](https://github.com/riscv/sail-riscv) simulator rather than the Spike simulator.

> So what's the difference between the Sail and Spike simulators, you may wonder? Spike implements RISC-V instructions, while Sail RISC-V is the official specification for RISC-V instructions - only Sail has not yet implemented the B-extension instruction set.

## rfuzzing: a random instruction stream generator for fuzz testing

The technical path above shows that the final jigsaw piece to complete the testing of the CKB-VM 2021 release was still missing: the random instruction stream generator. For this, we have written the [rfuzzing](https://github.com/mohanson/rfuzzing) tool, which labels each instruction to be tested with an internal format, and then keeps generating instructions in accordance with the format. An instruction in the B extension instruction set of RISC-V accepts only two different types of input: registers and immediate.

There are 32 registers in RISC-V, which are entitled:

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

During the random instruction generating process, rfuzzing puts the first 31 of these 32 registers as idle registers for the instruction to use arbitrarily, and the last t6 register is used as the checksum status register. After each instruction is executed, the checksum registers will superimpose the computation result of the current instruction on the previous state. For example, a clz instruction might generate a random instruction stream as follows:

```text
clz ra, sp     # ra = clz(sp)  # take two random registers from the idle register as clz input
add t6, t6, ra # t6 = t6 + ra  # # add the result of the instruction to the t6 register, the final value of t6 is checksum

clz s5, gp     # s5 = clz(gp)  ...
add t6, t6, s5 # t6 = t6 + s5  ...
```

Regarding the immediate, we will choose a random number within the optional immediate range of the instruction. For example, an rori instruction (cyclic right-shift instruction) has the basic format rori rd, rs, uimm6, and executes a cyclic right-shift of the value in the rs register by uimm6 bits to the rd register, where the size of the uimm6 immediate value ranges from 0 to 64. rfuzzing may generate the following instruction specific to the rori instruction:

```text
rori a3, a4, 27 # a3 = a4 >> 27 # take two random registers from the free register as input to rori and generate an immediate value between 0 and 64
add t6, t6, a3  # t6 = t6 + a3  # add the result of the instruction to the t6 register, the final value of t6 is checksum
```

By looping through the above process, a series of test instructions can be generated, and the result of each instruction will be reflected in the checksum register.

Lastly, use the checksum register value as the exit code to exit the program. Executing the test code in both CKB-VM 2021 and Spike, if the final exit code is the same, then the series of test instructions can be considered to have the same performance in both virtual machines.

## rfuzzing: Stochastic Register Initialization

The RISC-V specification stipulates that all registers should initialise with a zero value, which is not what we want.
Before generating random test code, we insert an additional piece of random initialisation code to initialise the values in the registers, so the test code can start from a "chaotic" state. Those who are familiar with testing should know that programs are more likely to fail when the input data is some boundary value. In a division operation, for example, we have to be careful when the divisor is zero. Back to the previous example of the leading zero calculation(clz), we believe that the following two scenarios are exceptional and more likely to cause bugs in writing code:

1. The number has no leading zeros, i.e. 0xffffffffffffffff
2. The number is zero, i.e. 0x00000000000000000000

What is the probability of coincidentally generating 0xffffffffffffffffff or 0x0000000000000000 when following a completely random number generation? The answer is 5.42e-20, a really tiny chance! For this reason, in the CKB-VM Fuzz testing , we deliberately increased the odds of occurrence of some boundary numbers, such as 0x0000000000000000, 0x0000000000000001, 0xffffffffffffffff, 0x8000000000000000, etc.

## Test Results and Conclusions

In this round of the fuzz testing, an average of 40,000 random instructions were tested per second for a total of four days, during which about 10 errors were found, with the majority occurring in the ASM and AOT modes of CKB-VM, while fewer errors were detected in the interpreter mode of CKB-VM. Essentially, this is because the ASM and AOT modes of CKB-VM contain significant amounts of hand-written code, which is more error-prone than the interpreter written code in Rust. The next article will present an error that is difficult to detect by conventional means.

The fuzz testing is a key part of the CKB-VM testing process, and after conducting the fuzz testing we are confident that the CKB-VM 2021 will be upgraded smoothly and safely.

## Further Details of Fuzzing

We believe that the Fuzzing approach is worth replicating in all projects. Both the data generation and the tests are conducted by computer, and it can go on indefinitely unless we stop it manually, implying that we will have more time to spend on meaningful things. The longer the fuzzing, the more confidence you will have in your program being correct. Several details should be given extra attention by the tester:

1. Random input data has been rejected prematurely. Usually we need a structured data, such as the ELF structured data of the CKB-VM. If you only generate random data, in most cases those data will be rejected directly by the parser, and will not be able to reach inside the program. Thus we use the legitimate assembly code as input in our CKB-VM fuzzing tests.
2. The best use case for fuzzing test is with a single stateless function. It is difficult to test a K8S system with fuzzing test, indeed unnecessary.

# Ensuring the Correctness of CKB-VM by Fuzzing, Part 2.

This article focuses on the technical details and practical procedures of the CKB-VM 2021 Upgrade fuzzing test. As a complement to the first article, this article is aimed at developers who want to replicate the testing process. The steps shown in this article have been verified on Ubuntu 20.04 systems.

## Setting Up the Test Environment

rfuzzing provides the development environment for this CKB-VM 2021 update fuzzing test. Clone the project, and execute the environment installation script. The script installs a set of dependencies by using apt, and then compiles projects in the rfuzzing/dep directory:

```sh
$ git clone https://github.com/mohanson/rfuzzing
$ cd rfuzzing
$ git checkout 240704ab2ae0ba0bfa4a3d6ad6ed645dbfc1353c

$ sh deps/develop.sh env
```

## riscv-naive-assembler

First, an overview of how the assembler riscv-naive-assembler works and how to use it. The assembler has been installed in rfuzzing/dep/riscv-naive-assembler/target/release/riscv-naive-assembler.

Suppose an assembly code like the following is saved as origin.S, take a look at the clmulh, it is an instruction from the B extended instruction set:

```text
.global _start
_start:
    clmulh ra,s6,t3
    mv a0,ra
    li a7,93
    ecall
```

Use the assembler to process the assembly code, the assembler will analyse the original code and accomplish instruction substitution, the output file will be saved as output.S.

```sh
$ riscv-naive-assembler/target/release/riscv-naive-assembler -i origin.S > output.S

.global _start
_start:
    # clmulh ra,s6,t3
    .byte 0xb3,0x30,0xcb,0x0b
    mv a0,ra
    li a7,93
    ecall
```

output.S differs from origin.S mainly in the fact that we have commented out the clmulh ra,s6,t3 instructions and inserted the .byte 0xb3,0x30,0xcb,0x0b in its place.

.byte instruction directly generates the corresponding byte anywhere along the assembly code, and if it happens to be in a text segment, then the byte will run as if it were assembly code. Hence, with this operation, official assemblers that do not recognize the B extended instruction set will be able to compile the code.

Notice that riscv-naive-assembler is a temporary solution, at the time of writing (29/09/2021), the official RISC-V assembler has supported B-extended instructions (riscv64-unknown-elf-as, which will be used below).

## Installation and Usage of Spike Simulator

Next, create a test file containing a leading zero-count instruction, and compile it directly by using the riscv64-unknown-elf-as and riscv64-unknown-elf-ld tools:

```text
.global _start:
    li a0, 0x000000001fffffff
    clz a0, a0
    li a7, 93
    ecall
```

```sh
$ dep/riscv/bin/riscv64-unknown-elf-as -march=rv64gc_zba_zbb_zbc -o /tmp/main.o main.S
$ dep/riscv/bin/riscv64-unknown-elf-ld -o /tmp/main /tmp/main.o
```

Run it with Spike, print its exit code, and learn that Spike has returned 35.

```sh
$ dep/riscv/bin/spike --isa=RV64GC_ZBA_ZBB_ZBC_ZBS dep/riscv/riscv64-unknown-elf/bin/pk /tmp/main
$ echo $?
35
```

Test it in CKB-VM:

```sh
$ dep/ckb-vm-run/target/release/asm /tmp/main

asm exit=Ok(35) cycles=504 r[a1]=0
```

Again, the result of CKB-VM for this program is 35, with 504 cycles consumed. This means that CKB-VM and Spike have the same execution result on this program. The core process of the fuzzing test is to keep creating random test files and cross-validating them in Spike and CKB-VM.

## Fuzzing Test with rfuzzing Scripts

Enable different fuzzing tests by sending in different parameters to src/main.py.


```sh
$ python src/main.py imc # Testing the IMC instruction set
$ python src/main.py b   # Testing the B instruction set
```

Following outputs will be generated after executing the script, indicating the current number of use cases for the fuzzing.

```text
generation 0
generation 1
generation 2
generation 3
...
```

## Case Study

This presents a bug that was found by fuzzing test on CKB-VM v0.20.0-rc5, which can still be recaptured. The bug is with the clmulh instruction, which acts as "clmulh produces the upper half of the 2-XLEN carry-less product", and is implemented in pseudo-code:

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

When using fuzzing test to generate random clmulh test cases, the results of the CKB-VM execution were found to be inconsistent with the Spike execution in some cases. The following test case (which has been cropped) is an example:

```text
.global _start:
    li ra, 42
    clmulh ra,s6,t3
    mv a0,ra
    li a7,93
    ecall
```

Executed with Spike and CKB-VM respectively, Spike returned an exit code of 0, while CKB-VM gave an exit code of 42, as if clmulh had never been executed.

```sh
$ spike --isa RV64GC_ZBA_ZBB_ZBC_ZBS dep/riscv/riscv64-unknown-elf/bin/pk /tmp/main
$ echo $?
0

./CKB-VM-run/target/release/aot /tmp/main
aot exit=Ok(42) cycles=504 r[a1]=0
```

Up to this point, it was difficult to identify the cause of the problem, so more test cases that had failed in the fuzzing were collected. After analysing these cases, it became clear that these tests all had one thing in common, they all had ra as the destination register for clmulh, e.g. clmulh ra, s0, t3 or clmulh ra, gp, zero ... , while the fuzzing tests all pass if the registers are others.

Seems the problem lies in the ra register!

A quick look at the clmulh [code implementation](https://github.com/nervosnetwork/CKB-VM/blob/6da2cf89e7f00c3b68c4c8dd0b61edfdbd1e2677/src/machine/aot/aot.x64.c#%20L1089-L1117), where only the core three problematic lines of code are copied, shows that the value of rsi was saved on the stack before clmulh was executed and restored before exiting:

```c
int aot_clmulh(AotContext* context, riscv_register_t target, AotValue a, AotValue b) {
  ...
  | push rsi
  ...
  | op2_r_x mov, target, r10
  | pop rsi
  ...
}
```


The target register above is not a constant register, but a variable. Notice that if the target in op2_r_x mov, target, r10 is an rsi register, the result of the clmulh calculation will be overwritten by the pop rsi at the end.

In which case will the target be the rsi register? When the target register of clmulh is ra. In the code, the ra register will be mapped to the rsi register in the x86 register, as shown in the code below:

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

Hence an exceptionally undetectable problem is found by fuzzing test.
