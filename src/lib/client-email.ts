import "server-only";
import { brl, fmtNum } from "./pricing.ts";
import type { QuickEstimate } from "./quick-estimate.ts";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface Company {
  company_name?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  city?: string | null;
  tech_name?: string | null;
  tech_registry?: string | null;
  warranty_modules_performance_years?: number | null;
  capture?: { paymentTitle?: string; payments?: { title: string; text: string }[] } | null;
}

const PURPLE = "#1C1234";
const GRAD = "linear-gradient(135deg,#F3EA3B 0%,#9BD373 55%,#6CC690 100%)";

function wa(phone: string | null | undefined, text: string) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`;
}

/** E-mail que o cliente recebe ao preencher a página de captura: estudo + autoridade + próximo passo. */
/** Conteúdo específico de cada serviço (carregador, eletroposto, manutenção, gestão). */
export interface EmailCustom {
  subject: string;
  kicker: string;
  headline: string;
  intro: string;
  stats: [string, string, string?][];
  reasons: [string, string][];
  payments: boolean;
  note: string;
  topic: string;
}

export function clientWelcomeEmail({
  origin,
  name,
  segment,
  estimate,
  company,
  custom,
}: {
  origin: string;
  name: string;
  segment: string;
  estimate: QuickEstimate | null;
  company: Company;
  custom?: EmailCustom | null;
}) {
  const first = name.trim().split(/\s+/)[0] || "tudo bem";
  const brand = company.company_name || "Quark Energia";
  const solar = segment !== "save" && estimate && estimate.monthlySavings > 0;
  const waLink = wa(company.whatsapp, `Olá! Sou ${first}, recebi meu estudo ${custom ? custom.topic : solar ? "solar" : "do carregador veicular"} por e-mail e quero falar com um especialista.`);
  const tech = company.tech_name ? `${company.tech_name}${company.tech_registry ? ` (${company.tech_registry})` : ""}` : null;

  const subject = custom
    ? custom.subject
    : solar
    ? `${first}, seu estudo solar: economia de ${brl(estimate!.monthlySavings, 0)} por mês ☀️`
    : `${first}, seu ponto de recarga para veículo elétrico ⚡`;

  const stat = (label: string, value: string, sub?: string) => `
    <td width="50%" style="padding:6px">
      <div style="background:#F7F6FA;border-radius:14px;padding:16px">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6D6985;font-weight:700">${esc(label)}</div>
        <div style="font-size:22px;font-weight:800;color:${PURPLE};margin-top:4px">${esc(value)}</div>
        ${sub ? `<div style="font-size:12px;color:#6D6985;margin-top:2px">${esc(sub)}</div>` : ""}
      </div>
    </td>`;

  const grid = (stats: [string, string, string?][]) => {
    const rows: string[] = [];
    for (let i = 0; i < stats.length; i += 2) rows.push(`<tr>${stats.slice(i, i + 2).map(([l, v, sub]) => stat(l, v, sub)).join("")}</tr>`);
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px -6px 0">${rows.join("")}</table>`;
  };
  const numbers = custom
    ? grid(custom.stats)
    : solar
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px -6px 0">
        <tr>${stat("Economia por mês", brl(estimate!.monthlySavings, 0), `${fmtNum(estimate!.savingsPct * 100)}% a menos na conta`)}${stat("Em 25 anos", brl(estimate!.savings25y, 0), "com reajuste da tarifa")}</tr>
        <tr>${stat("Sua conta", `${brl(estimate!.billBefore, 0)} → ${brl(estimate!.billAfter, 0)}`, "com fio B e taxas inclusos")}${stat("Sistema estimado", `${fmtNum(estimate!.kwp, 2)} kWp`, `${estimate!.modules} placas · ~${estimate!.areaM2} m² de telhado`)}</tr>
      </table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px -6px 0">
        <tr>${stat("Recarga completa", "Da noite para o dia", "em vez de horas na tomada comum")}${stat("Até 10× mais rápido", "que a tomada comum", "com carregador de 22 kW")}</tr>
      </table>`;

  const pay = company.capture?.payments?.length
    ? company.capture.payments
    : [
        { title: "À vista", text: "Desconto especial no pagamento à vista" },
        { title: "Cartão de crédito", text: "Parcele no cartão" },
        { title: "Financiamento em até 72x", text: "Com a primeira parcela em até 3 meses" },
      ];
  const payments = `<tr><td style="padding:18px 32px 0">
    <div style="border:1px solid #E5E3EE;border-radius:16px;padding:16px 18px">
      <p style="margin:0 0 8px;color:#2C7A52;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">${esc(company.capture?.paymentTitle || "Condições que cabem no seu bolso")}</p>
      ${pay
        .filter((p) => p.title?.trim())
        .map((p) => `<p style="margin:6px 0;color:${PURPLE};font-size:14px"><b>${esc(p.title)}</b>${p.text ? ` <span style="color:#6D6985">· ${esc(p.text)}</span>` : ""}</p>`)
        .join("")}
    </div>
  </td></tr>`;

  const reasons = (
    custom
      ? custom.reasons
      : solar
      ? [
          ["Engenharia própria", tech ? `Projetos assinados por ${tech}.` : "Projeto elétrico feito pela nossa equipe técnica, não terceirizado."],
          ["Tudo resolvido por nós", "Projeto, ART e homologação na distribuidora por nossa conta. Você só acompanha."],
          ["Equipamentos de primeira linha", `Módulos com até ${company.warranty_modules_performance_years || 25} anos de garantia de eficiência e inversor com monitoramento pelo celular.`],
          ["Do contrato à conta baixa", "Cerca de 40 dias entre a assinatura e o sistema homologado gerando economia."],
        ]
      : [
          ["Segurança em primeiro lugar", "Circuito dedicado, DR, DPS e botão de emergência, conforme a NBR 5410."],
          ["Engenharia própria", tech ? `Instalação sob responsabilidade de ${tech}.` : "Instalação feita e testada pela nossa equipe técnica."],
          ["Pronto em poucos dias", "Execução rápida e primeira recarga assistida."],
          ["Solar + carregador", "Combine com energia solar e rode praticamente de graça."],
        ]
  )
    .map(
      ([t, d]) => `<tr><td style="padding:8px 0;vertical-align:top;width:22px"><div style="width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid #C7BE40;margin-top:6px"></div></td>
        <td style="padding:8px 0"><div style="font-weight:700;color:${PURPLE};font-size:14px">${esc(t)}</div><div style="color:#4B4766;font-size:13px;line-height:1.5">${esc(d)}</div></td></tr>`,
    )
    .join("");

  const steps = [
    ["Hoje", "Um especialista vai falar com você pelo WhatsApp para confirmar alguns detalhes."],
    ["Visita técnica", "Sem custo: avaliamos telhado, sombra e padrão de entrada."],
    ["Proposta final", "Valor exato e opções de pagamento. No financiamento, a parcela costuma ficar próxima ou menor que a conta de hoje."],
  ]
    .map(
      ([t, d], i) => `<tr><td style="padding:6px 0;vertical-align:top;width:36px"><div style="width:26px;height:26px;border-radius:99px;background:${PURPLE};color:#F3EA3B;font-weight:800;font-size:12px;text-align:center;line-height:26px">${i + 1}</div></td>
        <td style="padding:6px 0"><div style="font-weight:700;color:${PURPLE};font-size:14px">${esc(t)}</div><div style="color:#4B4766;font-size:13px;line-height:1.5">${esc(d)}</div></td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#F0EFF5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 8px 32px rgba(28,18,52,.12)">
  <tr><td style="background:${PURPLE};padding:28px 32px 30px">
    <img src="${esc(origin)}/brand/logo-h-white.png" alt="${esc(brand)}" height="40" style="display:block;height:40px;width:auto;border:0" />
    <p style="margin:26px 0 0;color:#F3EA3B;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase">${esc(custom ? custom.kicker : solar ? "Seu estudo solar personalizado" : "Seu ponto de recarga")}</p>
    <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;line-height:1.25">${
      custom ? `${esc(first)}, ${esc(custom.headline)}` : solar ? `${esc(first)}, você pode deixar de pagar ${esc(brl(estimate!.monthlySavings, 0))} por mês para a distribuidora.` : `${esc(first)}, seu carro elétrico merece carregar em casa, com segurança.`
    }</h1>
  </td></tr>
  <tr><td style="height:6px;background:${GRAD};background-color:#9BD373"></td></tr>
  <tr><td style="padding:26px 32px 8px">
    <p style="margin:0 0 10px;color:#4B4766;font-size:14px;line-height:1.6">${
      custom
        ? esc(custom.intro)
        : solar
        ? `Com base na conta que você informou, este é o retrato do seu projeto. É uma estimativa inicial: na visita técnica ajustamos cada detalhe ao seu telhado.`
        : `Recebemos o seu interesse em um carregador veicular. Veja o que muda na sua rotina:`
    }</p>
    ${numbers}
  </td></tr>
  ${custom && !custom.payments ? "" : payments}
  ${
    waLink
      ? `<tr><td style="padding:18px 32px 6px" align="center">
    <a href="${esc(waLink)}" style="display:inline-block;background:${GRAD};background-color:#9BD373;color:${PURPLE};text-decoration:none;font-weight:800;font-size:15px;padding:15px 26px;border-radius:14px">Falar agora com um especialista →</a>
    <p style="margin:8px 0 0;color:#9A97AE;font-size:12px">Resposta rápida pelo WhatsApp</p>
  </td></tr>`
      : ""
  }
  <tr><td style="padding:22px 32px 4px">
    <p style="margin:0 0 4px;color:#2C7A52;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">Por que a ${esc(brand)}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${reasons}</table>
  </td></tr>
  <tr><td style="padding:18px 32px 26px">
    <p style="margin:0 0 4px;color:#2C7A52;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">Próximos passos</p>
    <table width="100%" cellpadding="0" cellspacing="0">${steps}</table>
  </td></tr>
  <tr><td style="background:#F7F6FA;padding:18px 32px;color:#9A97AE;font-size:11px;line-height:1.6">
    ${esc(brand)}${company.city ? ` · ${esc(company.city)}` : ""}${company.instagram ? ` · @${esc(String(company.instagram).replace(/^@/, ""))}` : ""}<br/>
    ${custom ? esc(custom.note) : solar ? "Valores estimados a partir da conta informada, com as regras da Lei 14.300 (fio B), taxa mínima e iluminação pública. O resultado final depende da visita técnica." : "Você recebeu este e-mail porque pediu um orçamento em nosso site."}
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return { subject, html };
}
