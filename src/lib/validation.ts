/** Pure validators / format helpers. */

export function isValidPassword(pw: string) {
  return (
    pw.length >= 6 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function suggestUsernames(seed: string) {
  const base =
    (seed || "alexsmi").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) ||
    "alexsmi";
  return [
    `${base}45760`,
    `smi${base.slice(0, 4)}81472`,
    `ale${base.slice(0, 3)}4448`,
    `smiale71043`,
    `${base}83073`,
  ];
}
