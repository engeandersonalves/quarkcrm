/** Metodologia: equações, hipóteses, limitações e referências — para citar no trabalho. */
import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink-200/70">
      <h3 className="mb-2 font-display text-[16px] font-bold text-ink-900">{title}</h3>
      <div className="space-y-2 text-[13.5px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

function Eq({ children }: { children: ReactNode }) {
  return <pre className="overflow-x-auto rounded-xl bg-ink-50 px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink-800 ring-1 ring-ink-200/60">{children}</pre>;
}

export function Method() {
  return (
    <div className="flex flex-col gap-3">
      <Block title="Pergunta de pesquisa">
        <p>
          Com o crescimento acelerado da micro e minigeração distribuída (MMGD) solar, o sistema elétrico passa a ter excesso de geração ao meio-dia em dias de baixa carga
          (domingos e feriados). O ONS já aplica cortes (curtailment) em usinas centralizadas e a ANEEL discute mecanismos para limitar a injeção da geração distribuída em
          momentos críticos. Este laboratório quantifica: <b>quanta energia solar seria desperdiçada</b> sob diferentes regras de corte e <b>quanto dela pode ser recuperada</b>{" "}
          com armazenamento (químico, gravitacional, hídrico, térmico, hidrogênio), cargas flexíveis (bombeamento, aquecimento, veículos, máquinas) e estratégias de controle.
        </p>
      </Block>

      <Block title="1. Recurso solar">
        <p>Posição do sol a cada passo (no meio do intervalo), com hora legal convertida em hora solar:</p>
        <Eq>{`δ = 23,45°·sen(360°·(284 + n)/365)                      (Cooper)
EoT = 229,18·(0,000075 + 0,001868cosB − 0,032077senB
      − 0,014615cos2B − 0,04089sen2B),  B = 2π(n−1)/365   (Spencer)
t_solar = t_legal + [4·(λ − 15·fuso) + EoT]/60
ω = 15°·(t_solar − 12)
cos θz = senφ·senδ + cosφ·cosδ·cosω`}</Eq>
        <p>Irradiância global de céu limpo (Haurwitz) modulada por um índice de céu claro estocástico:</p>
        <Eq>{`GHI_cs = 1098·cos θz·exp(−0,057/cos θz)
GHI(t) = k(t)·GHI_cs(t)
k_dia = 1,02·σ(μ_mês + 1,25·z_d),   z_d = 0,55·z_{d−1} + √(1−0,55²)·ε
k(t)  = k_dia + 1,3·k_dia(1−k_dia)·x(t),  x AR(1) com τ = 0,4 h`}</Eq>
        <p>
          μ_mês é calibrado por bisseção para que a média de GHI reproduza a climatologia mensal do local (erro &lt; 6%, verificado em teste automatizado). A persistência entre
          dias (0,55) reproduz sequências de dias nublados; a flutuação intradiária reproduz passagem de nuvens e picos de sobreirradiância (k &gt; 1).
        </p>
      </Block>

      <Block title="2. Plano dos módulos, temperatura e conversão">
        <Eq>{`k_t = GHI/(G_on·cos θz);   DHI = GHI·f_Erbs(k_t);   DNI = (GHI − DHI)/cos θz
cos θ = cos θz·cos β + sen θz·sen β·cos(γs − γ)
POA = DNI·max(0, cos θ) + DHI·(1+cos β)/2 + GHI·ρ·(1−cos β)/2    (Liu–Jordan isotrópico)
T_c = T_a + (NOCT − 20)/800 · POA
P_dc = P_stc·(1−d)^idade·(1 − perdas)·(POA/1000)·[1 + γ_P·(T_c − 25)]
P_ac = min(P_dc·η_inv(P_dc) − P_vazio, P_ac,nom)`}</Eq>
        <p>
          η_inv segue uma curva com perdas fixas, lineares e quadráticas em relação à carga. A temperatura do ar é senoidal (mín. ~3h, máx. 15h) com amplitude reduzida em dias
          nublados.
        </p>
      </Block>

      <Block title="3. Armazenamento">
        <Eq>{`Carga:     E(t+Δt) = E(t) + P_c·η_c·Δt
Descarga:  E(t+Δt) = E(t) − (P_d/η_d)·Δt
Limites:   SOC_min·E_nom ≤ E ≤ SOC_max·E_nom ;  P_c ≤ P_c,máx ;  P_d ≤ P_d,máx
Autodescarga: E ← E·(1 − s·Δt/24)
Gravitacional: E = m·g·h        Hídrico: E = ρ·V·g·h        H₂: E = 33,3 kWh/kg
Ciclos equivalentes = E_descarregada / [E_nom·(SOC_max − SOC_min)]
Vida = min(ciclos_vida / ciclos_ano ; 20% / perda_calendário_ano)
LCOS = CAPEX / (E_entregue_ano · vida)`}</Eq>
        <p>
          O mesmo modelo de reservatório de energia vale para todas as tecnologias; o que muda são os parâmetros (eficiência, profundidade de descarga, potência relativa, vida,
          autodescarga). Assim a comparação entre lítio, chumbo, sódio, fluxo, gravitacional, bombeado e hidrogênio é justa e reproduzível.
        </p>
      </Block>

      <Block title="4. Cargas e flexibilidade">
        <p>
          <b>Fixas</b>: perfil horário normalizado × consumo diário (com ruído AR(1)), equipamentos com janela e ciclo de trabalho, motores (P = P_eixo·FC/η, partida = P/fp × k_partida).
        </p>
        <p>
          <b>Flexíveis</b> têm uma energia a cumprir numa janela. A cada passo a parcela <i>obrigatória</i> é a que não caberia mais até o prazo; o resto é <i>opcional</i> e só
          roda com sobra solar:
        </p>
        <Eq>{`P_obrig = min(P_máx, max(0, E_restante − P_máx·(t_restante − Δt)) / Δt)
P_opc   = min(P_máx, E_restante/Δt) − P_obrig
Boiler: E_térmica = V·c·(T − T_fria);  consumo = litros(40 °C)·c·(40 − T_fria);  perdas ∝ E
Bomba:  m³ bombeados = E_bomba · (Q/P);   η_hidráulico = ρ·g·Q·H / P`}</Eq>
      </Block>

      <Block title="5. Controle (EMS) e rede">
        <Eq>{`demanda = cargas fixas + flexíveis obrigatórias
sobra   = P_FV,permitida − min(P_FV,permitida, demanda)
sobra → [ordem da estratégia: armazenamento | flexíveis opcionais | rede ≤ limite] → resto = CORTE
déficit → [armazenamento (≥ piso da estratégia) | gerador | rede ≤ limite] → resto = NÃO ATENDIDO
Balanço verificado a cada passo: FV + rede + gerador = cargas + injeção + ΔP_armazenamento`}</Eq>
        <p>
          Eventos: <b>corte de injeção</b> reduz o limite de exportação a uma fração da potência do inversor; <b>desligamento remoto da GD</b> e <b>apagão</b> param inversores
          sem backup (anti-ilhamento, ABNT NBR 16149/16150); inversores híbridos seguem alimentando as cargas em ilha. A estratégia <b>anti-corte</b> usa o conhecimento do corte
          anunciado para injetar antes da janela e manter espaço livre na bateria.
        </p>
        <p>Indicador-chave: energia que seria cortada só com as cargas fixas (P_FV − P_fixa − limite, durante eventos) versus o que foi efetivamente cortado.</p>
      </Block>

      <Block title="6. Economia (Lei 14.300/2022)">
        <Eq>{`Custo = Σ P_rede·tarifa(t)·Δt − E_compensada·(tarifa_média − fioB·%ano) + combustível
%fioB: 2023 15% · 2024 30% · 2025 45% · 2026 60% · 2027 75% · 2028 90% · 2029+ 100%
E_compensada = min(E_injetada, E_importada)  (créditos restantes ficam para meses seguintes)`}</Eq>
        <p>Simplificações: custo de disponibilidade, bandeiras tarifárias e impostos por faixa não são modelados separadamente (entram na tarifa cheia informada).</p>
      </Block>

      <Block title="Validação e limitações">
        <ul className="list-disc space-y-1 pl-5">
          <li>Testes automatizados: posição solar, orientação N×S, média climática, produtividade anual plausível (1.400–1.800 kWh/kWp em Natal), fechamento do balanço de energia em todos os cenários, SOC dentro dos limites.</li>
          <li>Climatologia embutida é aproximada (ordem de grandeza do Atlas Brasileiro de Energia Solar/INPE). Para publicação, use dados medidos ou TMY do local e calibre a semente/nebulosidade.</li>
          <li>Modelo de energia (fluxo de potência ativa em passo de 5–60 min): não resolve transitórios elétricos, harmônicos, tensão/frequência, desequilíbrio de fases nem a dinâmica da rede — para isso, acople com ferramentas de análise de rede (OpenDSS, PSCAD, Simulink).</li>
          <li>Degradação de baterias é estimada por ciclos equivalentes + calendário (não por modelo eletroquímico).</li>
          <li>Reprodutibilidade: todo cenário é um JSON com semente fixa — exporte e anexe ao trabalho.</li>
        </ul>
      </Block>

      <Block title="Referências para aprofundar">
        <ul className="list-disc space-y-1 pl-5">
          <li>Duffie, J. A.; Beckman, W. A. <i>Solar Engineering of Thermal Processes</i>. Wiley — geometria solar, Liu–Jordan, Cooper, Spencer.</li>
          <li>Erbs, D. G.; Klein, S. A.; Duffie, J. A. (1982). Estimation of the diffuse radiation fraction… <i>Solar Energy</i> 28(4).</li>
          <li>Haurwitz, B. (1945). Insolation in relation to cloudiness and cloud density. <i>Journal of Meteorology</i>.</li>
          <li>Pereira, E. B. et al. <i>Atlas Brasileiro de Energia Solar</i>, 2ª ed. INPE, 2017.</li>
          <li>Lei nº 14.300/2022 (marco legal da MMGD) e Resolução Normativa ANEEL nº 1.000/2021.</li>
          <li>ABNT NBR 16149 e 16150 — interface de conexão de sistemas fotovoltaicos à rede.</li>
          <li>ONS — relatórios sobre restrições de operação (constrained-off) de usinas eólicas e solares.</li>
          <li>Pinho, J. T.; Galdino, M. A. <i>Manual de Engenharia para Sistemas Fotovoltaicos</i>. CEPEL/CRESESB, 2014.</li>
        </ul>
      </Block>
    </div>
  );
}
