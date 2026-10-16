import type { ProviderId } from "./types.ts";

/**
 * Catálogo dos fabricantes (seguro para o navegador: só textos e campos).
 * As chamadas às APIs acontecem no servidor, em providers/*.
 */

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  hint?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** Plataforma de monitoramento do fabricante. */
  platform: string;
  color: string;
  brands: string;
  fields: ProviderField[];
  /** Como conseguir o acesso à API. */
  steps: string[];
  /** O que o conector traz além da lista de usinas. */
  features: ("dias" | "meses" | "eletrica")[];
  /** Sem API: usinas cadastradas à mão e alimentadas por planilha. */
  manual?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "solarz",
    name: "SolarZ",
    platform: "SolarZ Monitoramento",
    color: "#FF7A00",
    brands: "Todas as usinas que já estão na sua SolarZ, de qualquer fabricante",
    fields: [
      { key: "username", label: "Usuário de API", type: "text", placeholder: "Gerado na SolarZ" },
      { key: "password", label: "Senha do Usuário de API", type: "password" },
    ],
    features: ["dias", "meses"],
    steps: [
      "Entre na SolarZ (app.solarz.com.br) com a conta de administrador.",
      "No menu lateral, abra Configurações, desça até Usuário de API e clique em + Gerar Usuário de API.",
      "Copie o usuário e a senha que aparecem (a senha só é mostrada uma vez). O e-mail e a senha normais da SolarZ não funcionam aqui.",
    ],
  },
  {
    id: "solis",
    name: "Solis",
    platform: "SolisCloud",
    color: "#F39200",
    brands: "Solis / Ginlong",
    fields: [
      { key: "keyId", label: "API Key ID", type: "text", placeholder: "1300386381676…" },
      { key: "keySecret", label: "API Key Secret", type: "password" },
    ],
    features: ["dias", "meses", "eletrica"],
    steps: [
      "Entre no SolisCloud (soliscloud.com) com a conta da empresa.",
      "Vá em Conta → Serviço de API e clique em Ativar (ou peça a ativação ao suporte Solis).",
      "Copie o KeyID e o KeySecret que aparecem ali.",
    ],
  },
  {
    id: "deye",
    name: "Deye",
    platform: "Deye Cloud",
    color: "#0F7FD8",
    brands: "Deye",
    fields: [
      {
        key: "region",
        label: "Servidor",
        type: "select",
        options: [
          { value: "eu1", label: "Internacional / Europa (eu1)" },
          { value: "us1", label: "Américas (us1)" },
        ],
      },
      { key: "appId", label: "App ID", type: "text", placeholder: "2023…" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "account", label: "E-mail ou usuário do Deye Cloud", type: "text" },
      { key: "password", label: "Senha do Deye Cloud", type: "password" },
    ],
    features: ["dias", "meses", "eletrica"],
    steps: [
      "A chave de API só existe em conta de Integrador do Deye Cloud.",
      "Acesse developer.deyecloud.com com essa conta, crie um aplicativo e copie o App ID e o App Secret.",
      "Informe também o e-mail e a senha do Deye Cloud e o servidor (no Brasil costuma ser o eu1).",
    ],
  },
  {
    id: "solarman",
    name: "Solarman",
    platform: "SOLARMAN Smart / Business",
    color: "#00A0E9",
    brands: "Deye, Sofar, Livoltek e outros com datalogger Solarman",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "account", label: "E-mail da conta Solarman", type: "text" },
      { key: "password", label: "Senha da conta Solarman", type: "password" },
    ],
    features: ["dias", "meses", "eletrica"],
    steps: [
      "Peça a liberação da OpenAPI à Solarman (service@solarmanpv.com) informando o e-mail da conta.",
      "Eles enviam o App ID e o App Secret.",
      "Use o mesmo e-mail e senha com que você entra no app SOLARMAN.",
    ],
  },
  {
    id: "sungrow",
    name: "Sungrow",
    platform: "iSolarCloud",
    color: "#E5352B",
    brands: "Sungrow",
    fields: [
      {
        key: "server",
        label: "Servidor",
        type: "select",
        options: [
          { value: "intl", label: "Internacional (Brasil e América Latina)" },
          { value: "eu", label: "Europa" },
          { value: "au", label: "Austrália" },
          { value: "cn", label: "China" },
        ],
      },
      { key: "appKey", label: "App Key (API Key)", type: "text" },
      { key: "accessKey", label: "Access Key (Secret Key)", type: "password" },
      { key: "rsaKey", label: "RSA Key (se a sua conta tiver)", type: "textarea", optional: true, hint: "Aparece em Open API junto das outras chaves. Deixe em branco se não houver." },
      { key: "account", label: "Usuário do iSolarCloud", type: "text" },
      { key: "password", label: "Senha do iSolarCloud", type: "password" },
    ],
    features: ["eletrica"],
    steps: [
      "Entre no Sungrow Developer Portal (developer-api.isolarcloud.com) com a conta do iSolarCloud.",
      "Clique em Create Application, preencha os dados da empresa e escolha a opção sem OAuth 2.0.",
      "Aguarde a aprovação (de 1 a 5 dias úteis) e copie a App Key e a Secret Key (e a RSA Key, se houver).",
      "Informe também o usuário e a senha do iSolarCloud.",
    ],
  },
  {
    id: "growatt",
    name: "Growatt",
    platform: "ShineServer / OSS",
    color: "#F5A623",
    brands: "Growatt",
    fields: [
      {
        key: "server",
        label: "Servidor",
        type: "select",
        options: [
          { value: "global", label: "Internacional (openapi.growatt.com)" },
          { value: "us", label: "EUA (openapi-us.growatt.com)" },
          { value: "cn", label: "China (openapi-cn.growatt.com)" },
          { value: "au", label: "Austrália (openapi-au.growatt.com)" },
        ],
      },
      { key: "token", label: "Token da API", type: "password" },
    ],
    features: ["dias", "meses", "eletrica"],
    steps: [
      "Entre no servidor Growatt (server.growatt.com) com a conta de instalador.",
      "Abra Configurações / Gerenciamento de conta e gere o Token da API (ou peça ao suporte Growatt).",
      "Cole o token aqui.",
    ],
  },
  {
    id: "huawei",
    name: "Huawei",
    platform: "FusionSolar",
    color: "#C7000B",
    brands: "Huawei SUN2000",
    fields: [
      {
        key: "host",
        label: "Servidor",
        type: "select",
        options: [
          { value: "la5", label: "América Latina (la5.fusionsolar.huawei.com)" },
          { value: "intl", label: "Internacional (intl.fusionsolar.huawei.com)" },
          { value: "eu5", label: "Europa (eu5.fusionsolar.huawei.com)" },
          { value: "region01eu5", label: "Europa 01 (region01eu5)" },
        ],
      },
      { key: "userName", label: "Usuário da API (Northbound)", type: "text" },
      { key: "systemCode", label: "Senha da API (System Code)", type: "password" },
    ],
    features: ["dias", "meses", "eletrica"],
    steps: [
      "Entre no FusionSolar com o usuário master da empresa (só ele vê a Gestão de API).",
      "Abra Mais → Gerenciamento da empresa → aba Gestão de API e clique em adicionar.",
      "Dê um nome, a validade, escolha “API básica” e selecione as usinas.",
      "Crie a senha com maiúsculas, minúsculas, números e caractere especial. Use esse usuário e senha aqui, não o login normal do FusionSolar.",
    ],
  },
  {
    id: "solplanet",
    name: "Solplanet",
    platform: "Solplanet Pro (AISWEI)",
    color: "#00B386",
    brands: "Solplanet / AISWEI",
    fields: [
      { key: "appKey", label: "App Key", type: "text", placeholder: "9 dígitos" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "token", label: "Token Pro", type: "password" },
    ],
    features: ["dias", "eletrica"],
    steps: [
      "Peça ao suporte Solplanet a liberação da API para a sua conta de instalador.",
      "No portal Solplanet Pro, em Conta → Segurança, copie o App Key, o App Secret e o Token.",
    ],
  },
  {
    id: "goodwe",
    name: "GoodWe",
    platform: "SEMS Portal",
    color: "#D2232A",
    brands: "GoodWe",
    fields: [
      { key: "account", label: "E-mail do SEMS Portal", type: "text" },
      { key: "password", label: "Senha do SEMS Portal", type: "password" },
    ],
    features: ["eletrica"],
    steps: [
      "Use o e-mail e a senha com que você entra no SEMS Portal (semsportal.com) ou no app SEMS.",
      "Com a conta de instalador, todas as usinas da carteira são importadas.",
      "Recomendado: crie um usuário de visitante só para a integração.",
    ],
  },
  {
    id: "livoltek",
    name: "Livoltek",
    platform: "Livoltek Portal",
    color: "#1E9E5B",
    brands: "Livoltek",
    fields: [
      { key: "secuid", label: "Security ID", type: "text" },
      { key: "key", label: "Chave de API (Key)", type: "password" },
    ],
    features: [],
    steps: [
      "Peça ao suporte Livoltek o Security ID (secuid) e a chave de API da sua conta.",
      "Com eles, o app gera o token de acesso sozinho a cada consulta.",
    ],
  },
  {
    id: "foxess",
    name: "FoxESS",
    platform: "FoxESS Cloud",
    color: "#E6501E",
    brands: "FoxESS",
    fields: [{ key: "apiKey", label: "Chave de API (API Key)", type: "password" }],
    features: ["dias", "meses", "eletrica"],
    steps: ["Entre no foxesscloud.com, abra Perfil → API Management e gere a chave de API.", "Cole a chave aqui."],
  },
  {
    id: "apsystems",
    name: "APsystems",
    platform: "EMA (OpenAPI)",
    color: "#0072BC",
    brands: "APsystems (microinversores)",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "sids", label: "IDs dos sistemas (SID)", type: "textarea", hint: "Um por linha ou separados por vírgula. Aparecem no EMA em cada sistema." },
    ],
    features: ["dias", "meses"],
    steps: ["Solicite a OpenAPI no EMA (ou ao suporte APsystems) para receber o App ID e o App Secret.", "Informe os IDs dos sistemas que quer monitorar."],
  },
  {
    id: "manual",
    name: "Outros fabricantes",
    platform: "Planilha de geração",
    color: "#6D6985",
    brands: "Marcas sem API e sem SolarZ: planilha de geração",
    fields: [],
    features: ["dias", "meses"],
    manual: true,
    steps: [
      "Se a usina já está na sua SolarZ (AUXSOL, Hoymiles, Canadian e outras), prefira conectar a SolarZ: entra automático.",
      "Sem SolarZ e sem API: cadastre a usina aqui e importe a geração diária.",
      "No portal do fabricante, exporte o relatório de geração (Excel/CSV) com data e kWh por dia.",
      "Na usina, clique em Importar planilha: o app lê as colunas de data e energia sozinho.",
    ],
  },
];

export const providerInfo = (id: string) => PROVIDERS.find((p) => p.id === id);

/** Campos obrigatórios que faltam. */
export function missingCredentials(id: string, creds: Record<string, string>) {
  const p = providerInfo(id);
  if (!p) return ["Fabricante"];
  return p.fields.filter((f) => !f.optional && !String(creds[f.key] ?? "").trim()).map((f) => f.label);
}

/**
 * Marcas que não publicam API própria, mas chegam pela SolarZ (que já integra o portal delas).
 * Ao escolher uma delas, o app conecta a conta SolarZ.
 */
export const VIA_SOLARZ: { name: string; color: string; portal: string; note: string }[] = [
  { name: "AUXSOL", color: "#E4002B", portal: "AUXSOL Cloud", note: "A AUXSOL informa ter API aberta, mas não publica documentação. As usinas AUXSOL entram pela SolarZ; para API direta, peça a ficha técnica ao suporte AUXSOL." },
  { name: "Hoymiles", color: "#F7931E", portal: "S-Miles Cloud", note: "Sem API pública. As usinas Hoymiles entram pela SolarZ." },
  { name: "Canadian", color: "#D7141A", portal: "CSI Cloud", note: "Sem API pública. As usinas Canadian entram pela SolarZ." },
  { name: "WEG", color: "#00579D", portal: "WEG Solar Portal", note: "A WEG libera API pela SolarZ (guia “Criando API da WEG SOLAR”). As usinas entram pela SolarZ." },
  { name: "SAJ", color: "#E60012", portal: "Elekeeper", note: "Integrada pela SolarZ (guia “Como criar API da Elekeeper”)." },
  { name: "Hyxipower", color: "#00A3E0", portal: "HyxiPower", note: "Integrada pela SolarZ (guia “Gerando API do Portal HyxiPower”)." },
];
