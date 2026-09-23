# ☀️ Quark CRM — Propostas de Energia Solar

App completo para **orçar, gerar propostas premium e acompanhar vendas** de energia solar. Funciona no celular e no computador (pode ser instalado na tela inicial como app), com banco de dados em tempo real e alertas por e-mail.

## O que tem

| Módulo | Destaques |
|---|---|
| **Orçamento** | Kit (preço, marca/potência de placas e inversor, quantidades) → potência (kWp) e geração média calculadas na hora. Mão de obra **R$/placa × placas**, material elétrico **R$/kWp × kWp**, outros custos livres. Comissão, imposto e lucro em **% ou R$**. Desconto e arredondamento. “Checkout” detalhado com R$/Wp, markup e margem líquida. Sugestão automática de nº de placas pelo consumo. Salvamento automático. |
| **Proposta do cliente** | Link exclusivo (`/p/…`) com capa personalizada, conta antes × depois, equipamentos, gráfico de geração mês a mês, payback, TIR, economia em 25 anos, impacto ambiental, simulação de financiamento (parcela × economia), cartão, garantias, etapas e botão **Aceitar proposta**. Baixa em **PDF A4**. **Só o preço final aparece** — custos internos nunca saem do banco. |
| **CRM** | Funil Kanban (arrastar e soltar; no celular, “mover para”), lista com filtros, ficha do lead com histórico (notas, ligações, WhatsApp, visitas), etapas, orçamentos e tarefas. |
| **Tarefas** | Agrupadas em atrasadas / hoje / próximos dias; responsável e prioridade. |
| **Painel** | Vendido no mês, pipeline, conversão, lucro previsto, vendas por mês, funil e movimento das propostas. |
| **Alertas por e-mail** | Novo lead, nova tarefa, **cliente abriu a proposta**, **proposta aceita** e resumo diário de tarefas. |
| **Captura de leads** | Formulário público `/captura` (para site/Instagram/bio), com código para incorporar. |
| **Tempo real** | Tudo atualiza sozinho em todos os aparelhos (Supabase Realtime). |

Veja um exemplo de proposta em **`/p/exemplo`**.

### Fórmula de preço

```
custo direto = kit + (mão de obra/placa × placas) + (material elétrico/kWp × kWp) + outros custos
preço final  = (custo direto + valores fixos em R$) ÷ (1 − Σ percentuais)
```

Os percentuais de comissão, imposto e lucro incidem sobre o **preço final de venda** — assim, depois de pagar comissão e imposto, sobra exatamente o lucro definido. Desconto e arredondamento saem do lucro.

## Instalação (≈ 15 minutos, tudo com plano gratuito)

### 1. Banco de dados — Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API** copie a *Project URL*, a chave *anon* e a chave *service_role*.
4. (Opcional) Em **Authentication → Providers → Email**, desative “Confirm email” para entrar sem confirmar o e-mail.

### 2. E-mail — Resend
1. Crie uma conta em [resend.com](https://resend.com) e gere uma **API Key**.
2. Para enviar de um endereço seu (ex.: `alertas@suaempresa.com.br`), verifique o domínio em **Domains**. Sem domínio verificado, o Resend só envia para o e-mail da sua própria conta.

### 3. Publicar — Vercel
1. Importe este repositório em [vercel.com/new](https://vercel.com/new).
2. Em **Environment Variables**, cadastre as variáveis de [`.env.example`](.env.example).
3. Deploy. O resumo diário de tarefas roda às 07h (horário de Brasília) via `vercel.json`.
4. Acesse o app, clique em **Criar conta**, e depois cadastre sua equipe. Quando todos tiverem conta, defina `NEXT_PUBLIC_ALLOW_SIGNUP=false`.
5. Em **Configurações**, preencha dados da empresa, logotipo, padrões do orçamento (mão de obra por placa, material por kWp, comissão, imposto, lucro…) e os e-mails de alerta.

### Rodar localmente
```bash
cp .env.example .env.local   # preencha as variáveis
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes do motor de cálculo
```

## Estrutura

```
src/lib/pricing.ts            motor de cálculo (preço, geração, payback, TIR, financiamento) + testes
src/components/proposal/      editor do orçamento, checkout e proposta do cliente
src/app/(app)/                telas internas (painel, leads, propostas, tarefas, configurações)
src/app/p/[token]/            proposta pública
src/app/captura/              formulário público de leads
src/app/api/                  alertas por e-mail, rotas públicas e resumo diário
supabase/schema.sql           tabelas, segurança (RLS), funções públicas e tempo real
```

## Segurança
- Todas as tabelas têm Row Level Security: só usuários logados da equipe acessam os dados.
- A proposta pública é servida por uma função do banco que **remove custo do kit, mão de obra, comissão, imposto, lucro e anotações internas** antes de sair do servidor.
- A chave `service_role` fica apenas no servidor (resumo diário e lista de destinatários dos alertas públicos).
