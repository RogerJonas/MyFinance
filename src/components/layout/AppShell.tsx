import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { Banknote, CreditCard, LogOut, PieChart as PieChartIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AppShellProps {
  sectionLabel?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const AppShell = ({ sectionLabel, title, subtitle, children }: AppShellProps) => {
  const { profile, currentCompany, companies, setCurrentCompanyId, logout } = useAuth();

  const displayName = profile?.full_name || profile?.id || "Usuário";
  const companyName = currentCompany?.name || "Empresa Principal";
  const companyInitials = companyName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex md:flex-col">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-2 shadow-[var(--shadow-glow)]" />
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Plataforma</p>
              <p className="text-sm font-semibold">Aurora Finance</p>
            </div>
          </div>

          <nav className="space-y-6 text-sm">
            <div>
              <p className="mb-2 px-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Visão geral
              </p>
              <ul className="space-y-1">
                <li>
                  <NavLink
                    to="/"
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-foreground"
                  >
                    <PieChartIcon className="h-4 w-4 text-primary group-hover:text-sidebar-primary-foreground" />
                    Dashboard consolidado
                  </NavLink>
                </li>
              </ul>
            </div>

            <div>
              <p className="mb-2 px-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Operações
              </p>
              <ul className="space-y-1">
                <li>
                  <NavLink
                    to="/lancamentos"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    activeClassName="bg-sidebar-accent text-sidebar-foreground"
                  >
                    <Banknote className="h-4 w-4" />
                    Lançamentos de caixa
                  </NavLink>
                </li>
                <li>
                  <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground">
                    <CreditCard className="h-4 w-4" />
                    Cartões de crédito
                  </button>
                </li>
              </ul>
            </div>

            <div className="mt-auto space-y-3 rounded-2xl bg-gradient-to-br from-primary/10 via-sidebar-accent to-accent/10 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">Saúde financeira</span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                Acompanhe em tempo real patrimônio, fluxo de caixa e metas em um único painel unificado.
              </p>
              <Button size="sm" variant="outline" className="h-8 w-full border-primary/40 bg-background/60 text-xs">
                Ver recomendações
              </Button>
            </div>
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col bg-gradient-to-b from-[hsl(var(--surface-soft))] to-[hsl(var(--surface-elevated))]">
          <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <div className="space-y-1">
                {sectionLabel && (
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    {sectionLabel}
                  </p>
                )}
                <h1 className="text-lg font-semibold leading-tight">{title}</h1>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-3 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs shadow-sm md:flex">
                  <div className="text-right leading-tight">
                    <p className="text-[0.7rem] text-muted-foreground">{displayName}</p>
                    <p className="font-medium">Empresa atual</p>
                  </div>
                  <div className="flex h-8 w-32 items-center justify-center">
                    <Select value={currentCompany?.id} onValueChange={setCurrentCompanyId}>
                      <SelectTrigger className="h-8 w-full rounded-full border-border/60 bg-background/60 text-xs">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {companyInitials}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="inline-flex h-9 items-center gap-2 rounded-full border-border/60 bg-background/60 text-xs"
                  onClick={logout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-8 pt-4">{children}</main>
        </div>
      </div>
    </div>
  );
};
