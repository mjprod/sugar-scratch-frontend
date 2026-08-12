export const round = (value: number, precision = 3) =>
  parseFloat(value.toFixed(precision))

export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max)

export const adjust = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
) => round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin))
