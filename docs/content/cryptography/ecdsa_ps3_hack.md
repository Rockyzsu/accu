# Cryptography/椭圆曲线签名的错误用法

索尼使用通常存储在公司总部的私钥将其 Playstation 固件标记为有效且未经修改. PS3 只需要一个公钥来验证签名是否来自索尼. 通常, 这被认为是安全的. 但索尼在实施他们的签名算法时犯了一个新手错误: 他们使用相同的随机数对所有内容进行签名.

## 测验

回想一下签名中的(公共参数) r 是如何从随机数 k 生成的, 使用公式 kG = R，r 是点 R 的 x 坐标. 给定两个使用相同 k 的签名, 证明可以提取用于签名的私钥.

有:

- 公钥 pubkey
- 信息 m1, 及其签名 (r1, s1)
- 信息 m2, 及其签名 (r2, s2)

求:

- 私钥 prikey

## 数学推导

0. `s1 = (m1 + prikey * r1) / k`
0. `s2 = (m2 + prikey * r2) / k = (m2 + prikey * r1) / k`
0. `s1 / s2 = (m1 + prikey * r1) / (m2 + prikey * r1)`
0. `prikey = (s1 * m2 - s2 * m1) / (s2 - s1) / r1`

## 代码实现

```py
import secp256k1

pubkey = secp256k1.Ec(
    secp256k1.Fp(0xfb95541bf75e809625f860758a1bc38ac3c1cf120d899096194b94a5e700e891),
    secp256k1.Fp(0xc7b6277d32c52266ab94af215556316e31a9acde79a8b39643c6887544fdf58c)
)

m1 = 0x72a963cdfb01bc37cd283106875ff1f07f02bc9ad6121b75c3d17629df128d4e
r1 = 0x741a1cc1db8aa02cff2e695905ed866e4e1f1e19b10e2b448bf01d4ef3cbd8ed
s1 = 0x2222017d7d4b9886a19fe8da9234032e5e8dc5b5b1f27517b03ac8e1dd573c78

m2 = 0x059aa1e67abe518ea1e09587f828264119e3cdae0b8fcaedb542d8c287c3d420
r2 = 0x741a1cc1db8aa02cff2e695905ed866e4e1f1e19b10e2b448bf01d4ef3cbd8ed
s2 = 0x5c907cdd9ac36fdaf4af60e2ccfb1469c7281c30eb219eca3eddf1f0ad804655


class Fr:
    def __init__(self, x):
        assert(0 <= x < secp256k1.N)
        self.x = x

    def __repr__(self):
        return f'Fr(0x{self.x:064x})'

    def __eq__(self, other):
        return self.x == other.x

    def __add__(self, other):
        return Fr((self.x + other.x) % secp256k1.N)

    def __sub__(self, other):
        return Fr((self.x - other.x) % secp256k1.N)

    def __mul__(self, other):
        return Fr((self.x * other.x) % secp256k1.N)

    def __div__(self, other):
        return self * other ** -1

    def __pow__(self, other):
        return Fr(pow(self.x, other, secp256k1.N))

    def __neg__(self):
        return Fr(secp256k1.N - self.x)


Fr.__truediv__ = Fr.__div__

prikey = (Fr(s1) * Fr(m2) - Fr(s2) * Fr(m1)) / (Fr(s2) - Fr(s1)) / Fr(r1)
assert prikey.x == 0x5f6717883bef25f45a129c11fcac1567d74bda5a9ad4cbffc8203c0da2a1473c
```

完整代码: <https://github.com/mohanson/secp256k1-python>

## 参考

- [1] onyb: Quiz: The Playstation 3 Hack <https://onyb.gitbook.io/secp256k1-python/the-playstation-3-hack>
