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
}

export const PROVIDERS: ProviderInfo[] = [
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
    steps: [
      "Acesse developer.deyecloud.com e entre com a mesma conta do Deye Cloud.",
      "Crie um aplicativo (Application) e copie o App ID e o App Secret.",
      "Use o servidor em que a sua conta foi criada (no Brasil costuma ser o eu1).",
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
    steps: [
      "No iSolarCloud (web), abra Configurações → Open API e gere as chaves (App Key, Access Key e RSA Key).",
      "Se a opção não aparecer, solicite o acesso à OpenAPI ao suporte Sungrow do Brasil.",
      "Recomendado: crie um usuário só de leitura para a integração.",
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
    steps: [
      "No FusionSolar (conta de empresa), vá em Sistema → Gerenciamento da empresa → API Northbound.",
      "Crie um usuário de API com acesso às usinas e anote o usuário e a senha (System Code).",
      "Escolha o mesmo servidor em que você acessa o FusionSolar.",
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
    steps: [
      "Peça ao suporte Solplanet a liberação da API para a sua conta de instalador.",
      "No portal Solplanet Pro, em Conta → Segurança, copie o App Key, o App Secret e o Token.",
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
