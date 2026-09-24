# 🏗️ Quark Locações — orçamentos, locações, estoque e financeiro

App para locação de andaimes e equipamentos. Funciona no celular e no computador (dá para instalar na tela inicial como app).

## Como funciona

| Tela | O que faz |
|---|---|
| **Orçamento** (tela inicial) | Escolhe os equipamentos com botões − / +, o período, o cliente e o endereço da obra. Mostra na hora os **4 planos lado a lado** (diária, semanal, quinzenal e mensal) com o preço por dia e quanto o cliente economiza. Opção **“Nº de dias”**: o sistema acha a combinação mais barata (ex.: 10 dias → 1 quinzena, não 1 semana + 3 diárias). Envia pelo **WhatsApp**, gera **PDF** ou já aprova. |
| **Locações** (CRM) | Quadro: **Orçamento → Aguardando entrega → Na obra → Finalizada**. Um botão avança cada etapa (Aprovar, Marcar entregue, Marcar recolhido). Alertas de “entregar hoje”, “vence em 2 dias”, “venceu há 3 dias”. Ficha com mapa, histórico, pagamentos, renovação, taxa de desmontagem de 25% e o **termo de locação** (1 página A4) com QR Code do PIX já com o valor, QR Code do mapa da obra, tabela com valor de reposição, cláusulas, conferência na entrega/coleta e 3 assinaturas. Botões para **desfazer etapa** (clicou errado) e **cancelar** depois de aprovado. |
| **Agenda** | Entregas e coletas: atrasadas, hoje, amanhã, próximos dias. **Rota de hoje** no Google Maps passando por todas as obras, e **“Enviar rota ao entregador”** no WhatsApp com endereço, referência, link do mapa e itens. |
| **Estoque** | Total, na obra, a entregar, em manutenção e disponível de cada item, **onde está cada peça** e quanto o estoque está rendendo por mês. O orçamento avisa quando falta peça. |
| **Financeiro** | Recebido **por dia** e **por mês**, despesas, resultado, **a receber** (com vencidos), receita por plano, recebimento parcial e cobrança pelo WhatsApp. Aprovar um orçamento lança a cobrança sozinho; renovar lança a da renovação. |
| **Clientes** | Criados automaticamente nos orçamentos. Histórico, total gasto e em aberto de cada um. |
| **Ajustes** | Dados da empresa e do PIX, regra de preços, taxas, cláusulas do termo, **equipe** (quem tem acesso) e backup. |

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
git clone https://github.com/engeandersonalves/quarklocacoes && cd quarklocacoes
npm install
npm run dev        # http://localhost:3000
```
Sem configurar nada, os dados ficam salvos **só no navegador** — bom para testar. Para a equipe usar em vários aparelhos, ative a nuvem:

## Salvar na nuvem (≈ 10 minutos, plano gratuito)

1. **Supabase** — crie um projeto em [supabase.com](https://supabase.com) (região *South America – São Paulo*). Em **SQL Editor → New query**, cole todo o [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run** (pode rodar de novo quando atualizar o app). Em **Authentication → Sign In / Providers → Email**, desligue *Confirm email* para a equipe entrar sem confirmar. Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL*.
2. **Ligar o app à nuvem** — escolha **um** dos jeitos:
   - **Pelo próprio app (mais fácil):** abra o site, vá em **Ajustes → Nuvem**, cole a *Project URL* e a chave pública (*anon* ou *publishable*, em **Project Settings → API**) e toque em **Testar e conectar**. O app testa e explica o que estiver errado (URL, chave ou tabelas faltando). Para os outros celulares, use o **QR Code / link** que aparece em Ajustes → Nuvem.
   - **Pela Vercel (vale para todos os aparelhos de uma vez):** em *Settings → Environment Variables* cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e faça **Redeploy**.
3. **Primeiro acesso** — crie a sua conta primeiro: a primeira pessoa a entrar vira administradora. Se havia dados do modo demonstração no aparelho, o app oferece **enviar para a nuvem** (sem duplicar clientes e equipamentos). Depois, em **Ajustes → Equipe**, libere o e-mail de cada funcionário — só e-mails liberados veem os dados.
4. **Fechar cadastros** — quando todos tiverem conta, no Supabase desative *Allow new users to sign up* (e, se quiser esconder o botão, `NEXT_PUBLIC_ALLOW_SIGNUP=false` na Vercel).

### Como o app salva
- Tudo aparece na hora na tela e vai para uma **fila de salvamento** guardada no aparelho. O indicador mostra **Tudo salvo**, **Salvando…** ou **Sem internet · N aguardando**.
- **Sem internet** (ex.: entregador na obra): o app abre com a última cópia do aparelho, deixa trabalhar normalmente e envia tudo sozinho quando a internet volta — mesmo que o app seja fechado nesse meio-tempo.
- Duas pessoas criando orçamento ao mesmo tempo com o mesmo número: o app pega o próximo número livre e avisa.
- Os outros aparelhos atualizam sozinhos (tempo real).

### PIX
Em **Ajustes**, confira a chave PIX, o titular e a cidade. O termo mostra um QR Code PIX com o valor da locação já preenchido, e o botão **Cobrar no WhatsApp** manda o “PIX copia e cola”. Chave de telefone deve ser escrita com +55 (ex.: `+5582988156223`).

> Os textos do termo são um modelo. Vale pedir a um advogado de confiança para revisar as cláusulas (Ajustes → Cláusulas do termo de locação).

## Estrutura
```
src/lib/pricing.ts        cálculo dos planos e da melhor combinação + testes (npm test)
src/lib/store.tsx         dados, fila de salvamento offline e fluxo da locação (aprovar, entregar, recolher, renovar)
src/lib/mesclar.ts        junta backup / dados do aparelho com a nuvem sem duplicar + testes
src/lib/backend.ts        Supabase (nuvem) ou navegador (demonstração), conexão pelo app ou pela Vercel
src/lib/mensagens.ts      textos do WhatsApp (orçamento, entregador, cobrança, vencimento)
src/lib/pix.ts            PIX copia e cola / QR Code (padrão BR Code do Banco Central) + testes
src/components/orcamento.tsx   tela de orçamento rápido
src/app/                  telas (locacoes, agenda, estoque, financeiro, clientes, ajustes, documento)
supabase/schema.sql       tabelas, segurança (só a equipe logada) e tempo real
```
