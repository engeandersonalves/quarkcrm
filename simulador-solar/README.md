# 🧪 Quark Lab — Simulador de energia solar

App independente (não depende do Quark CRM, de login nem de banco de dados) para **estudar e pesquisar** sistemas solares: zero grid, baterias, cargas flexíveis, cortes de geração distribuída e apagões. Tudo roda no navegador.

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd simulador-solar
npm install
npm run dev        # abre em http://localhost:3000
```

### Arquivo único (sem servidor)

```bash
npm run build:single
```

Gera `dist/quark-lab.html`: o simulador inteiro num só arquivo. Abre com dois cliques em qualquer navegador, sem instalar nada (a internet só é usada para as fontes). Dá para mandar por e-mail ou pendrive. O mesmo build gera `dist/artifact.html`, a versão publicada como artifact no Claude.

Outros comandos: `npm test` (testes do motor físico), `npm run typecheck`, `npm run build && npm start` (versão de produção).

## Publicar (opcional)

Na [Vercel](https://vercel.com/new), importe este repositório como um **projeto novo** e, em *Root Directory*, escolha `simulador-solar`. Não precisa de variáveis de ambiente.

## O que modela

| Bloco | O que modela |
|---|---|
| **Sol e clima** | Posição solar (Cooper/Spencer), céu limpo (Haurwitz), nuvens estocásticas calibradas pela média mensal de 15 cidades brasileiras, Erbs + Liu–Jordan no plano inclinado, temperatura da célula (NOCT). Semente fixa ⇒ resultado reproduzível. |
| **FV e inversor** | kWp, inclinação, azimute, coef. de temperatura, perdas, degradação, bifacial, curva de eficiência, clipping, consumo em vazio, surto de partida, híbrido com backup (EPS). |
| **Armazenamento** | LFP, NMC, chumbo-ácido, íon-sódio, fluxo de vanádio, supercapacitor, **bateria gravitacional** (E = m·g·h), **reservatório bombeado** (E = ρ·V·g·h) e **hidrogênio**. Várias unidades com prioridade; ciclos, vida útil e LCOS. |
| **Cargas** | Perfis residencial/comercial/rural/industrial, equipamentos com horário, **motores** (rendimento, fator de potência, corrente de partida), **bomba d'água** (caixa-d'água como bateria), **carro elétrico** (burro ou inteligente), **boiler com desviador** (bateria térmica) e cargas deslocáveis. |
| **Rede e eventos** | On-grid, **zero grid**, limite de injeção, off-grid; **corte de injeção (curtailment)**, **desligamento remoto da GD** e **apagões** por horário, dia da semana, mês e probabilidade; gerador a diesel. |
| **Controle (EMS)** | Autoconsumo, **anti-corte preditivo**, cargas flexíveis primeiro, injetar primeiro, arbitragem na tarifa branca, reserva para apagão, peak shaving. |
| **Resultados** | Diagrama de fluxo animado, gráficos passo a passo, energia por dia, SOC, temperatura do boiler, desperdício, energia salva durante cortes, autossuficiência, economia (Lei 14.300), CO₂; CSV completo. |
| **Estudos** | Comparação de cenários/estratégias, varredura paramétrica e **Monte Carlo** do clima (P10/P50/P90). Aba **Método** com equações, hipóteses, limitações e referências. |

## Estrutura

```
src/lib/sim/         motor de simulação (TypeScript puro, sem dependências)
  solar.ts           sol, nuvens, plano inclinado, temperatura, inversor
  climate.ts         climatologia das cidades
  storage.ts         tecnologias de armazenamento
  loads.ts           perfis e agendas de cargas
  engine.ts          simulação passo a passo + despacho (EMS) + KPIs
  presets.ts         cenários prontos (perguntas de pesquisa)
  study.ts           varredura paramétrica e Monte Carlo
  sim.test.ts        testes (balanço de energia, produtividade, clima…)
src/components/sim/  interface (editor, diagrama, gráficos, comparação, estudos, método)
```

Cenários são JSON puro: use os botões do topo para exportar/importar e anexar ao trabalho.
