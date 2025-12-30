export const SCALE = BigInt(1e18);

export const mul = (a: bigint, b: bigint) => {
  return (a * b) / SCALE;
};

export const div = (a: bigint, b: bigint) => {
  return (a * SCALE) / b;
};

export const convertDecimals = (
  value: bigint,
  fromDecimals: number,
  toDecimals: number
) => {
  const diff = toDecimals - fromDecimals;

  if (diff === 0) return value;

  if (diff > 0) {
    const factor = BigInt(10) ** BigInt(diff);
    return value * factor;
  }

  const factor = BigInt(10) ** BigInt(-diff);
  return value / factor;
};

export const scaleNumber = (value: number, decimals: number) => {
  return stringToBigInt(value.toString(), decimals);
};

export const stringToBigInt = (value: string, decimals: number): bigint => {
  if (!value || value === ".") throw new Error("errors.invalidNumber");
  value = value.replace(/,/g, "");
  const multiplier = value.substring(0, 1) === "-" ? -1 : 1;
  value = value.replace("-", "");

  const [num, power] = value.split("e");

  if (power) decimals += Number(power);

  if (!num) return 0n;
  const comps = num.split(".");
  const whole = comps[0] || "0";

  if (decimals >= 0) {
    let fraction = comps[1] || "0";
    if (fraction.length <= decimals) {
      while (fraction.length < decimals) fraction += "0";
    } else {
      fraction = fraction.substring(0, decimals) || "0";
    }

    const base = BigInt(10) ** BigInt(decimals);
    return (BigInt(whole) * base + BigInt(fraction)) * BigInt(multiplier);
  }
  const base = BigInt(10) ** BigInt(-decimals);
  return (BigInt(whole) / base) * BigInt(multiplier);
};
