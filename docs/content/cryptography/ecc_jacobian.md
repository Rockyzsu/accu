# Cryptography/椭圆曲线 Jacobian 映射

椭圆曲线上的计算可以通过空间映射(Projective Space)进行一定程度的加速, 映射的本质上是将二维坐标系中的点加上无穷远点映射到三维坐标系的直线.

二维到三维:

```text
(x, y) -> (x, y, 1)
     O -> (0, 1, 0)
```

三维到二维:

```text
(x, y, z) -> (x / z, y / z)
(x, y, 0) -> O
```

可以注意到对于任意 a != 0, (ax, ay, az) 表示的是同一个点.

使用三元组进行椭圆曲线群运算的好处在于可以避免除法计算--通常进行除法的时间复杂度是进行乘法的 9 至 40 倍. 当我们用三元组 P = (x1, y1, z1), Q = (x2, y2, z2) 来计算 P + Q = (x3, y3, z3) 时

- 如果 P != ±Q

```text
u = y2 * z1 - y1 * z2
v = x2 * z1 - x1 * z2
w = u * u * z1 * z2 - v * v * v - 2 * v * v * x1 * z2
x3 = v * w
y3 = u * (v * v * x1 * z2 - w) - v * v * v * y1 * z2
z3 = v * v * v * z1 * z2
```

- 如果 P != +Q

```text
t = a * z1 * z1 + 3 * x1 * x1
u = y1 * z1
v = u * x1 * y1
w = t * t - 8 * v
x3 = 2 * u * w
y3 = t * (4 * v - w) - 8 * y1 * y1 * u * u
z3 = 8 * u * u * u
```

- 如果 P != -Q

```text
x3 = 0
y3 = 0
z3 = 0
```

## 代码实现

```
import secp256k1


class EcJacobian:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z

    @classmethod
    def encode(cls, ec):
        if ec == secp256k1.I:
            return EcJacobian(secp256k1.Fp(0), secp256k1.Fp(1), secp256k1.Fp(0))
        else:
            return EcJacobian(ec.x, ec.y, secp256k1.Fp(1))

    def decode(self):
        if self.z == secp256k1.Fp(0):
            return secp256k1.I
        else:
            return secp256k1.Ec(self.x / self.z, self.y / self.z)

    def double(self):
        x, y, z = self.x, self.y, self.z
        w = secp256k1.Fp(3) * x * x
        s = y * z
        b = x * y * s
        h = w * w - secp256k1.Fp(8) * b
        s_squared = s * s
        newx = secp256k1.Fp(2) * h * s
        newy = w * (secp256k1.Fp(4) * b - h) - secp256k1.Fp(8) * y * y * s_squared
        newz = secp256k1.Fp(8) * s * s_squared
        return EcJacobian(newx, newy, newz)

    def __add__(self, other):
        x1, y1, z1 = self.x, self.y, self.z
        x2, y2, z2 = other.x, other.y, other.z
        if z1 == secp256k1.Fp(0):
            return other
        if z2 == secp256k1.Fp(0):
            return self
        u1 = y2 * z1
        u2 = y1 * z2
        v1 = x2 * z1
        v2 = x1 * z2
        if v1 == v2:
            if u1 != u2:
                return EcJacobian.encode(secp256k1.I)
            else:
                return self.double()
        u = u1 - u2
        v = v1 - v2
        v_squared = v * v
        v_squared_x_v2 = v_squared * v2
        v_cubed = v * v_squared
        w = z1 * z2
        a = u * u * w - v_cubed - v_squared_x_v2 * secp256k1.Fp(2)
        x3 = v * a
        y3 = u * (v_squared_x_v2 - a) - v_cubed * u2
        z3 = v_cubed * w
        return EcJacobian(x3, y3, z3)


p = secp256k1.G * 42
q = secp256k1.G * 24
assert p + q == secp256k1.G * 66
assert (EcJacobian.encode(p) + EcJacobian.encode(q)).decode() == secp256k1.G * 66

assert p + p == secp256k1.G * 84
assert (EcJacobian.encode(p) + EcJacobian.encode(p)).decode() == secp256k1.G * 84

q = secp256k1.Ec(p.x, -p.y)
assert p + q == secp256k1.I
assert (EcJacobian.encode(p) + EcJacobian.encode(q)).decode() == secp256k1.I
```

完整代码: <https://github.com/mohanson/secp256k1-python>

## 参考

- [1] Anonymous, Wikibooks <https://en.wikibooks.org/wiki/Cryptography/Prime_Curve/Jacobian_Coordinates>
