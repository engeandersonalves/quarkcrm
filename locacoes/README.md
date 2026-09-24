# 🏗️ Quark Locações — orçamentos, locações, estoque e financeiro

App para locação de andaimes e equipamentos. Funciona no celular e no computador (dá para instalar na tela inicial como app).

## Como funciona

| Tela | O que faz |
|---|---|
| **Orçamento** (tela inicial) | Escolhe os equipamentos com botões − / +, o período, o cliente e o endereço da obra. Mostra na hora os **4 planos lado a lado** (diária, semanal, quinzenal e mensal) com o preço por dia e quanto o cliente economiza. Opção **“Nº de dias”**: o sistema acha a combinação mais barata (ex.: 10 dias → 1 quinzena, não 1 semana + 3 diárias). Envia pelo **WhatsApp**, gera **PDF** ou já aprova. |
| **Locações** (CRM) | Quadro: **Orçamento → Aguardando entrega → Na obra → Finalizada**. Um botão avança cada etapa (Aprovar, Marcar entregue, Marcar recolhido). Alertas de “entregar hoje”, “vence em 2 dias”, “venceu há 3 dias”. Ficha com mapa, histórico, pagamentos, renovação, taxa de desmontagem de 25% e o **termo de aluguel** no modelo da empresa. |
| **Agenda** | Entregas e coletas: atrasadas, hoje, amanhã, próximos dias. **Rota de hoje** no Google Maps passando por todas as obras, e **“Enviar rota ao entregador”** no WhatsApp com endereço, referência, link do mapa e itens. |
| **Estoque** | Total, na obra, a entregar, em manutenção e disponível de cada item, **onde está cada peça** e quanto o estoque está rendendo por mês. O orçamento avisa quando falta peça. |
| **Financeiro** | Recebido **por dia** e **por mês**, despesas, resultado, **a receber** (com vencidos), receita por plano, recebimento parcial e cobrança pelo WhatsApp. Aprovar um orçamento lança a cobrança sozinho; renovar lança a da renovação. |
| **Clientes** | Criados automaticamente nos orçamentos. Histórico, total gasto e em aberto de cada um. |
| **Ajustes** | Dados da empresa, regra de preços, taxas, textos do termo e backup. |

### Endereço para o entregador
CEP preenche rua, bairro e cidade sozinho. Tem campo de **ponto de referência** e de **localização exata**: cole o link que o cliente manda pelo WhatsApp, ou toque em **GPS** estando na obra. Os botões **Maps** e **Waze** abrem a navegação direto.

### Regra de preços
Você informa o **preço mensal** de cada equipamento e o sistema calcula os outros (ajustável em Ajustes):

| Plano | % do mensal | Ex.: andaime R$ 12/mês | Por dia |
|---|---|---|---|
| Diária | 15% | R$ 1,80 | R$ 1,80 |
| Semanal | 45% | R$ 5,40 | R$ 0,77 |
| Quinzenal | 70% | R$ 8,40 | R$ 0,56 |
| Mensal | 100% | R$ 12,00 | R$ 0,40 |

Todos os preços podem ser editados item a item. Os preços do catálogo inicial vêm do termo de aluguel (andaime 1,5 m R$ 12/mês, plataforma 1,5 m R$ 30/mês, betoneira 400 L R$ 450/mês, entrega R$ 60). **As quantidades em estoque são exemplos — ajuste na tela Estoque.**

## Usar agora (modo demonstração)
```bash
cd locacoes
npm install
npm run dev        # http://localhost:3000
```
Sem configurar nada, os dados ficam salvos **só no navegador** — bom para testar. Para a equipe usar em vários aparelhos, ative a nuvem:

## Colocar no ar (≈ 10 minutos, plano gratuito)
1. **Supabase** — crie um projeto em [supabase.com](https://supabase.com). Em **SQL Editor → New query**, cole [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Em **Project Settings → API**, copie a *Project URL* e a chave *anon*.
2. **Vercel** — importe o repositório em [vercel.com/new](https://vercel.com/new) e, em **Root Directory**, escolha **`locacoes`**. Em *Environment Variables* cadastre as variáveis de [`.env.example`](.env.example). Clique em Deploy.
3. Abra o app, **Criar conta** para cada pessoa da equipe e depois defina `NEXT_PUBLIC_ALLOW_SIGNUP=false`.
4. Tinha dados no modo demonstração? Em **Ajustes → Baixar backup** no navegador antigo e **Importar backup** no app publicado.

## Estrutura
```
src/lib/pricing.ts        cálculo dos planos e da melhor combinação + testes (npm test)
src/lib/store.tsx         dados, fluxo da locação (aprovar, entregar, recolher, renovar)
src/lib/backend.ts        Supabase (nuvem) ou navegador (demonstração)
src/lib/mensagens.ts      textos do WhatsApp (orçamento, entregador, cobrança, vencimento)
src/components/orcamento.tsx   tela de orçamento rápido
src/app/                  telas (locacoes, agenda, estoque, financeiro, clientes, ajustes, documento)
supabase/schema.sql       tabelas, segurança (só a equipe logada) e tempo real
```
