# Painel Financeiro Familiar

Aplicação para controle compartilhado de contas, cartões, transações, orçamentos e metas familiares.

O planejamento e o andamento do produto estão em [PROJECT.md](./PROJECT.md).

## Qualidade

O projeto usa Vitest para validar cálculos financeiros, categorização e garantias estruturais de isolamento dos dados.

```bash
npm test
npm run lint
npm run build
```

O workflow `Quality` executa essas verificações automaticamente em pushes para `main` e pull requests usando Node.js 22.
