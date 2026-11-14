import { test } from "node:test";
import assert from "node:assert/strict";
import { fullAddress, missingCadastro, parseCadastro } from "./cadastro-parser.ts";

test("cadastro com rótulos (ficha do WhatsApp)", () => {
  const { data: d } = parseCadastro(`Nome completo: MARIA JOSÉ DA SILVA
CPF: 529.982.247-25
RG: 1234567 SSP/AL
Data de nascimento: 12/03/85
Estado civil: Casada
Profissão: Professora
Endereço: Rua das Flores, 120, apto 302 - Ponta Verde
Cidade: Maceió - AL
CEP: 57035-000
Whatsapp: (82) 99999-1234
E-mail: Maria.Silva@Gmail.com
Modelo: Cappuccino creme
Forma de pagamento: 21x no cartão
Obs: entregar depois das 18h`);
  assert.equal(d.name, "Maria José da Silva");
  assert.equal(d.doc, "52998224725");
  assert.equal(d.rg, "1234567 SSP/AL");
  assert.equal(d.birth, "12/03/1985");
  assert.equal(d.marital, "casado(a)");
  assert.equal(d.profession, "professora");
  assert.equal(d.street, "Rua das Flores");
  assert.equal(d.number, "120");
  assert.equal(d.complement, "apto 302");
  assert.equal(d.district, "Ponta Verde");
  assert.equal(d.city, "Maceió");
  assert.equal(d.state, "AL");
  assert.equal(d.cep, "57035-000");
  assert.equal(d.phone, "(82) 99999-1234");
  assert.equal(d.email, "maria.silva@gmail.com");
  assert.equal(d.model, "cappuccino");
  assert.equal(d.color, "Creme");
  assert.equal(d.payment, "21x no cartão");
  assert.equal(d.notes, "entregar depois das 18h");
  assert.deepEqual(missingCadastro(d), []);
  assert.equal(fullAddress(d), "Rua das Flores, 120, apto 302, Ponta Verde");
});

test("cadastro em texto corrido, sem rótulos", () => {
  const { data: d } = parseCadastro(`João Pedro Alves
529.982.247-25
Av. Fernandes Lima, 3500 - Farol, Maceió/AL
57057-000
82 98888-7777
joao@hotmail.com
solteiro
quero a MZ preta`);
  assert.equal(d.name, "João Pedro Alves");
  assert.equal(d.doc, "52998224725");
  assert.equal(d.street, "Av. Fernandes Lima");
  assert.equal(d.number, "3500");
  assert.equal(d.city, "Maceió");
  assert.equal(d.state, "AL");
  assert.equal(d.cep, "57057-000");
  assert.equal(d.phone, "(82) 98888-7777");
  assert.equal(d.email, "joao@hotmail.com");
  assert.equal(d.marital, "solteiro(a)");
  assert.equal(d.model, "mz");
  assert.equal(d.color, "Preta");
  assert.equal(d.payment, "");
});

test("CPF inválido e falta de dados aparecem nas pendências", () => {
  const { data: d } = parseCadastro("Nome: Ana Lima\nCPF: 111.222.333-44");
  assert.deepEqual(missingCadastro(d), ["CPF válido", "WhatsApp", "Endereço", "Cidade"]);
});

test("números de série da scooter", () => {
  const { data: d } = parseCadastro("Chassi: qk25 cap 0001784\nMotor: MT1000-55821\nBateria: LB60V20-9932\nModelo: T1 branca");
  assert.equal(d.chassis, "QK25CAP0001784");
  assert.equal(d.motorNo, "MT1000-55821");
  assert.equal(d.batteryNo, "LB60V20-9932");
  assert.equal(d.model, "t1");
  assert.equal(d.color, "Branca");
});

test("tudo numa linha só, separado por vírgulas", () => {
  const { data: d } = parseCadastro("Carla Mendes, cpf 529.982.247-25, rua do Sol, 45, Centro, maceio al, cep 57020-010, 82 99123-4567, carla@gmail.com");
  assert.equal(d.name, "Carla Mendes");
  assert.equal(d.doc, "52998224725");
  assert.equal(d.street, "rua do Sol");
  assert.equal(d.number, "45");
  assert.equal(d.district, "Centro");
  assert.equal(d.city, "Maceio");
  assert.equal(d.state, "AL");
  assert.equal(d.cep, "57020-010");
  assert.equal(d.phone, "(82) 99123-4567");
  assert.equal(d.email, "carla@gmail.com");
});

test("forma de pagamento no meio da frase", () => {
  assert.equal(parseCadastro("Ana Lima\nquero a T1 em 21x no cartão").data.payment, "21x no cartão");
  assert.equal(parseCadastro("Ana Lima\nvou pagar no pix").data.payment, "pix");
});

test("profissão junto do estado civil e observações limpas", () => {
  const { data: d } = parseCadastro("João Pedro Alves\n529.982.247-25\nsolteiro, motorista de aplicativo\nquero a MZ preta em 21x no cartão\npode entregar sábado de manhã");
  assert.equal(d.marital, "solteiro(a)");
  assert.equal(d.profession, "motorista de aplicativo");
  assert.equal(d.notes, "pode entregar sábado de manhã");
});
