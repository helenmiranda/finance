# Poupemos — Painel Financeiro Familiar

## Visão do produto

Aplicação web para Helen e Ramon controlarem as finanças da família em um único espaço compartilhado. O sistema permitirá registrar e importar movimentações, acompanhar contas e cartões, organizar categorias, definir orçamentos e receber análises de um assistente de IA.

## Decisões confirmadas

- Público inicial: Helen e Ramon.
- Modalidade: finanças familiares, com espaço compartilhado e acesso individual.
- Moeda inicial: real brasileiro (BRL).
- Plataforma inicial: aplicação web responsiva.
- Nome do sistema: Poupemos.
- Usuários iniciais: Helen e Ramon.
- Frontend e backend web: Next.js com TypeScript.
- Direção visual: linguagem fintech inspirada no `DESIGN.md`, com verde-lima, tipografia expressiva, cantos amplos e superfícies glass.
- Banco, autenticação e arquivos: Supabase.
- Banco relacional: PostgreSQL.
- Haverá contas bancárias e cartões de crédito.
- Será possível cadastrar faturas e compras parceladas.
- Extratos e faturas poderão ser adicionados por arquivo.
- O sistema terá categorias editáveis, gráficos, orçamentos, metas e um assistente de IA.

## Escopo do MVP

1. Cadastro e autenticação de usuários.
2. Espaço financeiro familiar e convite de membros.
3. Cadastro de contas bancárias, dinheiro e cartões de crédito.
4. Registro manual de receitas, despesas e transferências.
5. Compras no cartão, parcelamentos, fechamento e vencimento de faturas.
6. Categorias e subcategorias personalizadas.
7. Importação de extratos e faturas em CSV, XLSX e OFX.
8. Revisão da importação e prevenção de duplicidades.
9. Regras automáticas de categorização.
10. Dashboard mensal com saldos, fluxo de caixa e gráficos por categoria.
11. Orçamentos mensais e metas de economia.
12. Assistente de IA para consultas e sugestões de redução de gastos.

## Modelo conceitual

```text
Usuário
  └── participa de um Espaço familiar
        ├── Membros e permissões
        ├── Contas financeiras
        ├── Cartões de crédito
        │     ├── Compras
        │     └── Faturas
        ├── Transações
        ├── Categorias
        ├── Regras de categorização
        ├── Orçamentos
        ├── Metas
        └── Análises da IA
```

Todas as entidades financeiras pertencem a um espaço familiar (`household_id`). O acesso será protegido com Row Level Security (RLS) no Supabase.

## Regras financeiras importantes

- Valores monetários serão armazenados em centavos inteiros, evitando erros de ponto flutuante.
- Transferências terão lançamentos vinculados de saída e entrada.
- Uma compra no cartão pertence à competência da fatura, mas o pagamento da fatura afeta o caixa na data em que ocorrer.
- Compras parceladas preservarão a compra original e gerarão parcelas vinculadas.
- Importações terão uma chave de deduplicação e sempre passarão por revisão antes da confirmação.
- A IA poderá sugerir ações, mas mudanças financeiras exigirão confirmação do usuário.

## Segurança e privacidade

- RLS habilitado em todas as tabelas com dados familiares.
- Chaves administrativas nunca serão expostas no navegador.
- Extratos e faturas ficarão em bucket privado.
- Arquivos serão acessados por links temporários.
- Dados enviados à IA serão minimizados e mascarados quando possível.
- O sistema oferecerá exportação e exclusão dos dados, considerando a LGPD.

## Plano de implementação

### Fase 1 — Fundação

- [x] Definir público, objetivo e stack inicial.
- [x] Confirmar suporte a família, cartões e faturas.
- [x] Criar documentação inicial do projeto.
- [x] Criar aplicação Next.js e layout base.
- [x] Criar projeto Supabase e configurar variáveis de ambiente.
- [x] Definir a migration inicial e políticas RLS.
- [x] Implementar autenticação e criação do espaço familiar.

### Fase 2 — Lançamentos

- [x] Implementar contas financeiras.
- [x] Implementar categorias e subcategorias.
- [x] Implementar receitas, despesas e transferências.
- [x] Adicionar busca, filtros e edição em massa.

### Fase 3 — Cartões

- [x] Cadastrar cartões, limites, fechamento e vencimento.
- [x] Registrar compras à vista e parceladas.
- [x] Gerar e acompanhar faturas.
- [x] Registrar pagamento de fatura sem duplicar despesas.

### Fase 4 — Importações

- [x] Criar upload privado de arquivos.
- [x] Interpretar CSV, XLSX e OFX.
- [x] Criar tela inicial de pré-visualização.
- [x] Detectar duplicidades e aplicar regras de categorização.
- [x] Confirmar importação em lote.

### Fase 5 — Planejamento e análises

- [x] Criar dashboard e gráficos.
- [x] Criar orçamentos por categoria.
- [x] Criar metas e projeções.
- [x] Detectar assinaturas e gastos recorrentes.

### Fase 6 — Assistente de IA

- [x] Permitir perguntas sobre os dados financeiros.
- [x] Gerar resumos semanais e mensais.
- [x] Identificar desvios, excessos e oportunidades de economia.
- [x] Criar simulações e planos de redução de gastos.
- [ ] Registrar recomendações aceitas ou descartadas.

## Próximas decisões

- Escolher se membros terão os mesmos poderes ou papéis de administrador e membro.
- Definir os primeiros bancos e modelos de fatura usados pela família.
- Decidir se o saldo inicial de uma conta será lançado manualmente ou calculado desde o primeiro extrato.

## Registro de progresso

### 2026-07-19

- Produto definido como painel financeiro familiar para Helen e Ramon.
- Supabase escolhido para PostgreSQL, autenticação e armazenamento privado.
- Cartões de crédito, compras parceladas e importação de faturas incluídos no planejamento.
- Escopo inicial, regras financeiras, segurança e fases documentados.
- Aplicação Next.js criada com uma primeira versão responsiva do dashboard.
- Cliente Supabase preparado para receber as credenciais do projeto.
- Dependências instaladas e build de produção validado com Node 22.
- Credenciais retiradas do arquivo público de exemplo e protegidas em `.env.local`.
- Migration inicial criada com família, convites, contas, cartões configuráveis, faturas, categorias, transações, parcelamentos, orçamentos e RLS.
- Dashboard atualizado com a identidade visual do Poupemos e efeito glass responsivo.
- Fluxos de cadastro, login, confirmação de e-mail, logout, sessão protegida e onboarding familiar implementados.
- Cadastro e listagem de contas e cartões conectados ao Supabase, com validação no servidor.
- Categorias, subcategorias, receitas, despesas e compras simples no cartão conectadas ao Supabase.
- Transferências atômicas, compras parceladas e geração automática de faturas implementadas em uma segunda migration.
- Callback de autenticação configurado para usar a URL pública do Vercel em vez da origem local.
- Dashboard simplificado, com dados reais, menos elementos decorativos e hierarquia visual mais calma.
- Pagamento integral de faturas implementado como saída de caixa, sem duplicar a despesa original.
- Upload privado, leitura de CSV/OFX e pré-visualização de extratos adicionados ao fluxo de importação.
- Edição de linhas, categorias, itens ignorados, deduplicação e confirmação atômica adicionadas às importações.
- Regras personalizadas de categorização automática aplicadas durante novos uploads.
- Orçamentos mensais por categoria com progresso, saldo disponível e alertas de limite.
- Metas financeiras compartilhadas com prazo, progresso e histórico de aportes.
- Projeção financeira de seis meses com médias históricas, faturas pendentes e ritmo necessário para metas.
- Detecção de gastos recorrentes com cadência, impacto mensal/anual e indicador de confiança.
- Assistente com IA conectado à Responses API, contexto financeiro minimizado e conversas persistentes.
- Gestão do espaço familiar com inclusão imediata ou entrada automática após cadastro pelo e-mail convidado.
- Busca e filtros de transações, além de recategorização segura de até 100 lançamentos por vez.
- Importação de planilhas XLSX pela primeira aba, com detecção automática de data, descrição e valor.
- Resumo mensal automático no assistente com comparação histórica, maior categoria de gasto e alertas de orçamento.
- Visão semanal adicionada ao resumo automático, com comparação direta à semana anterior.
- Simulador de economia mensal criado com plano proporcional baseado na média das principais categorias dos últimos três meses.
- Fundação da integração Meu Pluggy adicionada com autenticação no servidor e vínculo seguro dos Item IDs existentes por membro da família.
- Sincronização inicial de contas bancárias, cartões, saldos e limites do Meu Pluggy adicionada com mapeamento contra duplicidades.
- Aplicação preparada como PWA instalável, com manifesto, ícones, modo standalone e tela offline sem cache de dados financeiros.
- Importação idempotente de até doze meses de transações Pluggy adicionada para contas e cartões, preservando itens pendentes.
- Sincronização e consolidação patrimonial de investimentos Pluggy adicionadas, incluindo renda fixa, fundos, renda variável, ETFs, previdência e COE.
- Até três atualizações bancárias por dia: primeira abertura pela manhã e à tarde, mais rotina garantida às 22h pelo Supabase Cron, todas com trava idempotente.
- Webhooks Pluggy protegidos e idempotentes importam automaticamente contas, cartões, transações e investimentos quando uma atualização bancária termina.
- Transações Pluggy recebem categorias pelas regras familiares e pelo enriquecimento da Pluggy, com fila de revisão e aprendizado por descrição.
- Reconciliação incremental da Pluggy mantém lançamentos criados, alterados e removidos alinhados ao banco sem apagar o histórico familiar.
- Central de sincronização mostra estado, horários, uso diário, falhas e último evento de cada conexão bancária.
- Alertas familiares idempotentes avisam em 70%, 90%, 100% e quando o ritmo mensal projeta estouro do orçamento, com leitura individual por membro.
- Detecção de anomalias compara cada despesa relevante à média de 90 dias da categoria e alerta sem repetir a mesma transação.
- Web Push opcional entrega alertas importantes no PWA com conteúdo discreto, consentimento por dispositivo e rastreamento idempotente.

### Configuração do Supabase Cron

Depois de aplicar a migration `202607190016_supabase_pluggy_cron.sql`, cadastre no **Supabase > Vault**:

- `poupemos_app_url`: URL pública do Poupemos, sem caminho (ex.: `https://seu-app.vercel.app`).
- `poupemos_cron_secret`: o mesmo valor de `CRON_SECRET` configurado no ambiente de produção da Vercel.

O job `poupemos-pluggy-night-refresh` roda diariamente às `01:00 UTC` (22h em Brasília) e chama o endpoint protegido `/api/cron/pluggy-refresh`. O histórico pode ser acompanhado em **Supabase > Integrations > Cron > Jobs**.
