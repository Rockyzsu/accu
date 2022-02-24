# RISC-V 工具链

## 通过源码编译

以下命令可以安装最基础的 RV64GC 版本的工具链和 Spike 模拟器.

```sh
$ sudo apt install autoconf automake autotools-dev libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev

$ git clone https://github.com/riscv/riscv-gnu-toolchain
$ cd riscv-gnu-toolchain
$ ./configure --prefix=/home/ubuntu/app/riscv
$ make
```

```sh
$ git clone https://github.com/riscv-software-src/riscv-isa-sim
$ cd riscv-isa-sim
$ mkdir build
$ cd build
$ ../configure --prefix=/home/ubuntu/app/riscv
$ make
$ make install
```

```sh
$ git clone https://github.com/riscv-software-src/riscv-pk
$ cd riscv-pk
$ mkdir build
$ cd build
$ ../configure --prefix=/home/ubuntu/app/riscv --host=riscv64-unknown-elf
$ make
$ make install
```

```sh
$ spike --isa $ISA pk $PROGRAM
# 带 B 扩展: --isa RV64GC_ZBA_ZBB_ZBC_ZBS
# 带 V 扩展: --isa RV64GCV
```

## 下载预编译版

```sh
$ git clone https://github.com/Imperas/riscv-toolchains.git --branch rvv-1.0.0
```
