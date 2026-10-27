// All money is stored as whole centavos to avoid floating-point drift.

export function formatPeso(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const pesos = Math.abs(centavos) / 100;
  return `${sign}₱${pesos.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parsePeso(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function toPesoInput(centavos: number): string {
  return (centavos / 100).toFixed(2);
}
