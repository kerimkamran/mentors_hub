/**
 * Search normalisation (NFR-I18N): ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g, ё/е are equivalent, so
 * "mammadov" finds "Məmmədov". Must stay identical to the SQL function mh_normalise (0002).
 */
const FROM = "əƏıİöÖüÜçÇşŞğĞёЁ";
const TO = "eeiioouuccssggее";

export function normalise(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFC")) {
    const i = FROM.indexOf(ch);
    out += i >= 0 ? TO[i] : ch;
  }
  return out.toLowerCase();
}
