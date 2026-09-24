import { test } from "node:test";
import assert from "node:assert/strict";
import { mesclarDados, temDadosReais } from "./mesclar.ts";
import type { Cliente, Dados, Equipamento, Locacao } from "./types.ts";

const eq = (id: string, nome: string): Equipamento => ({
  id,
  nome,
  categoria: "Andaimes",
  unidade: "peça",
  estoque_total: 10,
  em_manutencao: 0,
  preco_diaria: 1,
  preco_semanal: 1,
  preco_quinzenal: 1,
  preco_mensal: 1,
  valor_reposicao: 0,
  ativo: true,
  observacoes: "",
  criado_em: "",
});
const cli = (id: string, nome: string, telefone = ""): Cliente => ({
  id,
  nome,
  telefone,
  documento: "",
  email: "",
  observacoes: "",
  criado_em: "",
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", referencia: "", maps_url: "" },
});
const loc = (id: string, numero: number, cliente_id: string | null, equipamento_id: string) =>
  ({ id, numero, cliente_id, itens: [{ equipamento_id, nome: "", unidade: "", quantidade: 1, precos: { diaria: 1, semanal: 1, quinzenal: 1, mensal: 1 } }] }) as unknown as Locacao;
const vazio = (): Omit<Dados, "config"> => ({ equipamentos: [], clientes: [], locacoes: [], lancamentos: [] });

test("equipamento com o mesmo nome é reaproveitado e as locações apontam para ele", () => {
  const base = { ...vazio(), equipamentos: [eq("n1", "Andaime tubular 1,5 m")] };
  const novo = { ...vazio(), equipamentos: [eq("l1", "ANDAIME  tubular 1,5 m"), eq("l2", "Betoneira")], locacoes: [loc("a", 1, null, "l1")] };
  const r = mesclarDados(base, novo);
  assert.deepEqual(r.equipamentos.map((e) => e.id), ["l2"]);
  assert.equal(r.locacoes[0].itens[0].equipamento_id, "n1");
});

test("cliente com o mesmo telefone não duplica", () => {
  const base = { ...vazio(), clientes: [cli("n1", "Vinícius", "(82) 98815-6223")] };
  const novo = { ...vazio(), clientes: [cli("l1", "Vinicius Daniel", "82988156223")], locacoes: [loc("a", 1, "l1", "x")] };
  const r = mesclarDados(base, novo);
  assert.equal(r.clientes.length, 0);
  assert.equal(r.locacoes[0].cliente_id, "n1");
});

test("número de locação já usado ganha o próximo livre", () => {
  const base = { ...vazio(), locacoes: [loc("n1", 1, null, "x"), loc("n2", 2, null, "x")] };
  const novo = { ...vazio(), locacoes: [loc("l1", 1, null, "x"), loc("l2", 5, null, "x")] };
  const r = mesclarDados(base, novo);
  assert.deepEqual(r.locacoes.map((l) => l.numero).sort(), [5, 6]);
  assert.deepEqual(r.renumeradas, [[1, 6]]);
});

test("importar o mesmo backup duas vezes não duplica nada", () => {
  const d = { ...vazio(), equipamentos: [eq("e", "X")], clientes: [cli("c", "Ana")], locacoes: [loc("l", 1, "c", "e")] };
  const r = mesclarDados(d, d);
  assert.equal(r.equipamentos.length + r.clientes.length + r.locacoes.length, 0);
});

test("temDadosReais ignora só o catálogo", () => {
  assert.equal(temDadosReais({ ...vazio(), equipamentos: [eq("e", "X")] }), false);
  assert.equal(temDadosReais({ ...vazio(), clientes: [cli("c", "Ana")] }), true);
});
