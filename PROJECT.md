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
- [x] Criar categorias padrão para espaços existentes e novos cadastros.
- [x] Implementar receitas, despesas e transferências.
- [x] Adicionar busca, filtros e edição em massa.

### Fase 3 — Cartões

- [x] Cadastrar cartões, limites, fechamento e vencimento.
- [x] Registrar compras à vista e parceladas.
- [x] Gerar e acompanhar faturas.
- [x] Registrar pagamento de fatura sem duplicar despesas.
- [x] Identificar visualmente os cartões pelas instituições financeiras.
- [x] Editar, ativar e desativar cartões sem perder o histórico.
- [x] Exibir fatura atual e utilização do limite diretamente no cartão.

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
- Saldo disponível usa o saldo atual da Pluggy para contas conectadas e saldo inicial mais movimentações apenas para contas manuais, evitando dupla contagem.
- Apelidos persistentes identificam contas e cartões sem serem sobrescritos pela Pluggy, e o dashboard separa movimentações recentes de conta e cartão.

### 2026-07-20

- Revisão visual geral reduziu títulos, sombras, volumes e espaçamentos excessivos, preservando a identidade verde-lima e glass do Poupemos.
- Lista de transações passou a separar descrição, categoria e origem em linhas e espaçamentos próprios, evitando informações visualmente coladas.
- Experiência mobile refeita com cabeçalho compacto e fixo, navegação completa dentro de um menu e maior prioridade para o conteúdo financeiro.
- Filtros de transações passaram a ser recolhíveis no mobile, com indicação de filtros ativos e campos organizados em duas colunas quando houver espaço.
- Controles de categorização em lote também se tornaram recolhíveis, e o checkbox de aprendizado de descrições voltou ao tamanho correto.
- Cadastro de cartão foi movido para um modal responsivo, evitando que o formulário esconda os cartões já cadastrados.
- Modal de cartão usa apresentação central no desktop e painel inferior no mobile, com ações persistentes e fechamento pelo fundo ou botão dedicado.
- Nome do espaço familiar no menu deixou de usar o texto fixo `Helen & Ramon` e agora é carregado do tenant autenticado.
- Contexto de autenticação e espaço familiar passou a ser reutilizado durante a mesma renderização, evitando consultas duplicadas.
- Cartões passaram a receber identidade visual automática por instituição, incluindo Nubank, Inter, Itaú, Santander, Bradesco, C6, Banco do Brasil, Caixa, Mercado Pago, PicPay, Neon, XP, BTG, PagBank, Will Bank, Sicredi e Sicoob.
- Cor cadastrada continua sendo usada como alternativa quando a instituição do cartão não é reconhecida.
- Cartões foram organizados em duas colunas no desktop e uma coluna no mobile.
- Cada cartão passou a exibir fatura atual ou valor utilizado, percentual de utilização, barra de progresso, limite disponível, fechamento e vencimento.
- Gestão completa do cartão adicionada em modal para editar nome, apelido, emissor, titular, final, limite, datas, conta de pagamento e cor alternativa.
- Cartões podem ser ativados e desativados sem exclusão; cartões inativos preservam transações e faturas, mas deixam de aparecer em novos lançamentos.
- Sincronização da Pluggy foi ajustada para não reativar cartões que foram desativados dentro do Poupemos.
- Alterações de limite e ativação permanecem locais ao Poupemos; a integração Open Finance usada pelo projeto apenas consulta e importa informações autorizadas.
- Validação do Item ID da Pluggy foi movida do atributo HTML incompatível para uma validação controlada pelo aplicativo, com mensagem clara sobre o formato esperado.
- Leitura das respostas da rota de vínculo Pluggy ficou mais resiliente quando o servidor não retornar JSON.
- Service worker atualizado para a versão 3 e deixou de armazenar bundles do Next.js, evitando que o PWA continue executando JavaScript antigo após um deploy.
- Registro do PWA agora solicita atualização do service worker sem reutilizar o cache HTTP, mantendo os próximos deploys sincronizados.
- Todas as entregas da manhã foram validadas com lint e build de produção antes do envio ao GitHub.
- Categorias padrão de despesas e receitas preparadas para todos os espaços familiares, com preenchimento idempotente e criação automática nos próximos onboardings.

Commits principais desta etapa: `eae4974`, `3972e68`, `523cb64`, `0955a55`, `40fd7a9`, `75573db` e `345857c`.

### Configuração do Supabase Cron

Depois de aplicar a migration `202607190016_supabase_pluggy_cron.sql`, cadastre no **Supabase > Vault**:

- `poupemos_app_url`: URL pública do Poupemos, sem caminho (ex.: `https://seu-app.vercel.app`).
- `poupemos_cron_secret`: o mesmo valor de `CRON_SECRET` configurado no ambiente de produção da Vercel.

O job `poupemos-pluggy-night-refresh` roda diariamente às `01:00 UTC` (22h em Brasília) e chama o endpoint protegido `/api/cron/pluggy-refresh`. O histórico pode ser acompanhado em **Supabase > Integrations > Cron > Jobs**.
