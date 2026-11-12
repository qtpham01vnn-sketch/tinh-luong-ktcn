const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];

function readTriple(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const dv = n % 10;
  const parts: string[] = [];

  if (full || tram > 0) parts.push(`${DIGITS[tram]} trăm`);

  if (chuc > 1) {
    parts.push(`${DIGITS[chuc]} mươi`);
    if (dv === 1) parts.push('mốt');
    else if (dv === 4) parts.push('tư');
    else if (dv === 5) parts.push('lăm');
    else if (dv > 0) parts.push(DIGITS[dv]);
  } else if (chuc === 1) {
    parts.push('mười');
    if (dv === 5) parts.push('lăm');
    else if (dv > 0) parts.push(DIGITS[dv]);
  } else if (dv > 0) {
    if (full || tram > 0) parts.push('lẻ');
    parts.push(DIGITS[dv]);
  }
  return parts.join(' ');
}

/** Đọc số tiền thành chữ tiếng Việt: 305661144 → "Ba trăm lẻ năm triệu ... đồng" */
export function numberToVietnameseWords(value: number): string {
  let n = Math.round(Math.abs(value || 0));
  if (n === 0) return 'Không đồng';

  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const isLeading = i === groups.length - 1;
    words.push(readTriple(g, !isLeading) + UNITS[i]);
  }

  const text = words.join(' ').replace(/\s+/g, ' ').trim();
  const prefix = value < 0 ? 'Âm ' : '';
  return `${prefix}${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
}
