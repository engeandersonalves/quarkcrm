/**
 * PIX "copia e cola" (BR Code estático, padrão EMV do Banco Central).
 * Gera o texto que vira QR Code: o cliente aponta a câmera no app do banco
 * e o valor já vem preenchido.
 */

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** Sem acento, maiúsculo e só caracteres aceitos pelos bancos. */
function limpar(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-/]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF). */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Chave de telefone precisa do +55; CPF/CNPJ só dígitos; e-mail e aleatória como estão. */
export function normalizarChave(chave: string): string {
  const k = chave.trim();
  if (k.includes("@") || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(k)) return k.toLowerCase();
  const d = k.replace(/\D/g, "");
  if (k.startsWith("+")) return `+${d}`;
  // "(82) 98815-6223" é telefone; "123.456.789-09" é CPF.
  if (/[()\s]/.test(k) && (d.length === 10 || d.length === 11)) return `+55${d}`;
  return d || k;
}

export function pixCopiaECola({ chave, nome, cidade, valor, identificador }: { chave: string; nome: string; cidade: string; valor?: number; identificador?: string }): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizarChave(chave));
  const txid = (identificador || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (valor && valor > 0 ? campo("54", valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(nome, 25) || "RECEBEDOR") +
    campo("60", limpar(cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
