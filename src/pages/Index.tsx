import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Banknote, CreditCard, LogOut, PieChart as PieChartIcon, Sparkles, Target, TrendingUp, Users, Building2, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

const equityData = [
  { name: "Ativo", value: 297240.33 },
  { name: "Passivo", value: 159384.97 },
];

const revenueByCategory = [
  { name: "Salário", value: 19770.24 },
  { name: "Outras receitas", value: 3178.75 },
  { name: "Receitas não correntes", value: 2256.31 },
  { name: "Operações comerciais", value: 287.5 },
];

const expensesByCategory = [
  { name: "Essenciais", value: 9484.27 },
  { name: "Estilo de vida", value: 1949.52 },
  { name: "Necessidades financeiras", value: 1713.25 },
  { name: "Não classificado", value: 226.71 },
];

const cashflowData = [
  { date: "01 dez", total: 12000, min: -2000 },
  { date: "05 dez", total: 15800, min: -2000 },
  { date: "10 dez", total: 14900, min: -2000 },
  { date: "15 dez", total: 9200, min: -4000 },
  { date: "20 dez", total: 16750, min: -4000 },
  { date: "25 dez", total: 18350, min: -4000 },
  { date: "30 dez", total: 19750, min: -4000 },
];

const recentTransactions = [
  {
    date: "23/12/2025",
    description: "Aluguel Escritório",
    account: "1.2. PJ Conta Corrente - Banco Santander",
    costCenter: "Comercial",
    type: "Despesa",
    status: "Pendente",
    value: -3200.0,
  },
  {
    date: "23/12/2025",
    description: "Recebimento Cliente Alpha",
    account: "1.2. PJ Conta Corrente - Banco Santander",
    costCenter: "Receitas Operacionais",
    type: "Receita",
    status: "Conciliado",
    value: 14280.55,
  },
  {
    date: "24/12/2025",
    description: "Cartão Corporativo",
    account: "Cartão Visa PJ",
    costCenter: "Despesas Administrativas",
    type: "Despesa",
    status: "Agendado",
    value: -1890.9,
  },
  {
    date: "25/12/2025",
    description: "Investimento Renda Fixa",
    account: "1.1. Aplicações Financeiras",
    costCenter: "Tesouraria",
    type: "Despesa",
    status: "Realizado",
    value: -5000.0,
  },
];

const creditCardSummary = [
  {
    name: "Visa PJ Principal",
    limit: 30000,
    used: 18450.9,
    closingDay: 25,
    dueDay: 5,
  },
  {
    name: "Master PF Pessoal",
    limit: 12000,
    used: 4860.31,
    closingDay: 15,
    dueDay: 28,
  },
];

const donutColors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--warning))"];

const Index = () => {
  return (
    <AppShell
      sectionLabel="Visão geral consolidada"
      title="Dashboard financeiro multiempresa"
    >
      <section aria-label="Indicadores de topo" className="grid gap-4 md:grid-cols-4">
        <Card className="relative overflow-hidden border-border/60 bg-card/80 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]">
          <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-primary/25" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Patrimônio líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-positive">R$ 137.855,36</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">+12,4% vs. último trimestre</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Resultado do mês</CardTitle>
            <PieChartIcon className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-success">R$ 25.492,80</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">Regime de competência</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Contas a pagar (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-negative">R$ 13.373,75</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">Inclui cartões de crédito</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Metas atingidas</CardTitle>
            <Target className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">74%</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-primary to-accent" />
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">Metas por centro de custo</p>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Visão gráfica" className="grid gap-4 lg:grid-cols-3">
        ...
      </section>

      <section aria-label="Fluxo de caixa e lançamentos" className="grid gap-4 lg:grid-cols-3">
        ...
      </section>

      <section aria-label="Últimos lançamentos" className="grid gap-4 lg:grid-cols-3">
        ...
      </section>
    </AppShell>
  );
};

export default Index;
