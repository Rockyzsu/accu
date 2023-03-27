# 杂项/RISC-V 工具链

## 通过源码编译

以下命令可以安装 RV64GC 版本的工具链.

```sh
$ git clone https://github.com/riscv/riscv-gnu-toolchain
$ cd riscv-gnu-toolchain
$ git checkout 2023.03.14
$ git submodule update --init --recursive
# 添加参数 --with-arch 可以选择要编译的指令集扩展
#   --with-arch=rv64imac
#   --with-arch=rv64imac_zba_zbb_zbc_zbs
$ ./configure --prefix=/home/ubuntu/app/riscv
$ make

# 额外安装模拟器 qemu
$ make report SIM=qemu
# 额外安装模拟器 spike
$ make report SIM=spike
```

## 编译并运行 RISC-V 程序

```c
int main() {
  return 42;
}
```

```sh
$ riscv64-unknown-elf-gcc -o main main.c
# 使用参数 --isa 选择扩展
#   --isa RV64GC_ZBA_ZBB_ZBC_ZBS
#   --isa RV64GCV
$ spike --isa $ISA pk64 main
$ echo $?

$ qemu-riscv64 main
$ echo $?
```

## 下载预编译版

```sh
$ git clone https://github.com/Imperas/riscv-toolchains.git --branch rvv-1.0.0
```
