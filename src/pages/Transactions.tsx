import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout/AppShell";
import { Pencil, Copy, Trash2 } from "lucide-react";

const transactionLineSchema = z.object({
  account_id: z.string().uuid("Selecione uma conta válida"),
  side: z.enum(["debit", "credit"], { required_error: "Selecione débito ou crédito" }),
  cost_center_id: z
    .string()
    .uuid("Selecione um centro de custos válido")
    .optional()
    .or(z.literal(""))
    .or(z.literal("__none")),
  amount: z
    .string()
    .trim()
    .min(1, "Valor é obrigatório")
    .transform((val) => Number(val.replace(".", "").replace(",", ".")))
    .refine((val) => !Number.isNaN(val) && val > 0, { message: "Informe um valor numérico positivo" }),
});

const transactionSchema = z.object({
  cash_date: z.string().min(1, "Data de caixa é obrigatória"),
  competence_date: z.string().min(1, "Data de competência é obrigatória"),
  description: z
    .string()
    .trim()
    .min(1, "Descrição é obrigatória")
    .max(500, "Descrição deve ter no máximo 500 caracteres"),
  status: z.enum(["scheduled", "pending", "realized", "reconciled"], {
    errorMap: () => ({ message: "Selecione um status válido" }),
  }),
  lines: z
    .array(transactionLineSchema)
    .min(2, "Cada lançamento deve ter pelo menos duas linhas (débito e crédito)"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionHeaderRow {
  id: string;
  cash_date: string;
  competence_date: string;
  description: string | null;
  status: string;
}

interface SelectOption {
  id: string;
  label: string;
}

const TransactionsPage = () => {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();

  const [headers, setHeaders] = useState<TransactionHeaderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "duplicate">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SelectOption[]>([]);
  const [costCenters, setCostCenters] = useState<SelectOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    description: "",
    status: "all" as "all" | "scheduled" | "pending" | "realized" | "reconciled",
    dateFrom: "",
    dateTo: "",
    accountId: "__all",
    costCenterId: "__all",
    recurrenceType: "all" as "all" | "none" | "installment" | "fixed",
  });

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      cash_date: "",
      competence_date: "",
      description: "",
      status: "scheduled",
      lines: [
        { account_id: "", side: "debit", cost_center_id: "", amount: "0,00" as any },
        { account_id: "", side: "credit", cost_center_id: "", amount: "0,00" as any },
      ],
    } as any,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  useEffect(() => {
    document.title = "Lançamentos | Aurora Finance";
  }, []);

  const loadLookups = async () => {
    if (!currentCompany) {
      setAccounts([]);
      setCostCenters([]);
      return;
    }

    const [accountsRes, costCentersRes] = await Promise.all([
      supabase.from("accounts").select("id, code, name").eq("company_id", currentCompany.id).order("code"),
      supabase.from("cost_centers").select("id, code, name").eq("company_id", currentCompany.id).order("code"),
    ]);

    if (accountsRes.error) {
      toast({
        title: "Erro ao carregar plano de contas",
        description: accountsRes.error.message,
        variant: "destructive",
      });
    }
    if (costCentersRes.error) {
      toast({
        title: "Erro ao carregar centros de custos",
        description: costCentersRes.error.message,
        variant: "destructive",
      });
    }

    setAccounts(
      (accountsRes.data ?? []).map((a) => ({
        id: a.id,
        label: `${a.code ?? ""} ${a.name ?? ""}`.trim(),
      })),
    );
    setCostCenters(
      (costCentersRes.data ?? []).map((c) => ({
        id: c.id,
        label: `${c.code ?? ""} ${c.name ?? ""}`.trim(),
      })),
    );
  };

  const loadHeaders = async () => {
    if (!currentCompany) {
      setHeaders([]);
      return;
    }

    setLoading(true);

    const useEntryJoin = filters.accountId !== "__all" || filters.costCenterId !== "__all";

    const selectColumns =
      "id, cash_date, competence_date, description, status" +
      (useEntryJoin ? ", transaction_entries!inner(account_id, cost_center_id)" : "");

    let query = supabase
      .from("transactions")
      .select(selectColumns)
      .eq("company_id", currentCompany.id);

    if (filters.description.trim()) {
      query = query.ilike("description", `%${filters.description.trim()}%`);
    }

    if (filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.dateFrom) {
      query = query.gte("cash_date", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("cash_date", filters.dateTo);
    }

    if (filters.recurrenceType !== "all") {
      query = query.eq("recurrence_type", filters.recurrenceType);
    }

    if (filters.accountId !== "__all") {
      query = query.eq("transaction_entries.account_id", filters.accountId);
    }

    if (filters.costCenterId !== "__all") {
      query = query.eq("transaction_entries.cost_center_id", filters.costCenterId);
    }

    query = query.order("cash_date", { ascending: false }).limit(50);

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar lançamentos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setHeaders(((data ?? []) as unknown) as TransactionHeaderRow[]);
    }

    setLoading(false);
  };
  useEffect(() => {
    void loadHeaders();
    void loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const handleOpenNew = () => {
    setDialogMode("create");
    setEditingId(null);
    form.reset({
      cash_date: "",
      competence_date: "",
      description: "",
      status: "scheduled",
      lines: [
        { account_id: "", side: "debit", cost_center_id: "", amount: "0,00" as any },
        { account_id: "", side: "credit", cost_center_id: "", amount: "0,00" as any },
      ],
    } as any);
    setDialogOpen(true);
  };

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      description: "",
      status: "all",
      dateFrom: "",
      dateTo: "",
      accountId: "__all",
      costCenterId: "__all",
      recurrenceType: "all",
    });
    void loadHeaders();
  };

  const loadTransactionIntoForm = async (id: string, mode: "edit" | "duplicate") => {
    if (!currentCompany) return;

    const { data: header, error: headerError } = await supabase
      .from("transactions")
      .select("id, cash_date, competence_date, description, status")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();

    if (headerError || !header) {
      toast({
        title: "Erro ao carregar lançamento",
        description: headerError?.message ?? "Não foi possível carregar os dados do lançamento.",
        variant: "destructive",
      });
      return;
    }

    const { data: entries, error: entriesError } = await supabase
      .from("transaction_entries")
      .select("account_id, cost_center_id, amount")
      .eq("transaction_id", id)
      .eq("company_id", currentCompany.id);

    if (entriesError) {
      toast({
        title: "Erro ao carregar linhas do lançamento",
        description: entriesError.message,
        variant: "destructive",
      });
      return;
    }

    let lines: TransactionFormValues["lines"];

    if (!entries || entries.length === 0) {
      // Lançamentos antigos podem não ter linhas registradas em transaction_entries.
      // Neste caso, abrimos o formulário com duas linhas em branco para edição/duplicação.
      lines = [
        { account_id: "", side: "debit", cost_center_id: "", amount: "0,00" as any },
        { account_id: "", side: "credit", cost_center_id: "", amount: "0,00" as any },
      ];
    } else {
      lines = entries.map((line) => ({
        account_id: line.account_id,
        cost_center_id: line.cost_center_id ?? "",
        side: line.amount >= 0 ? "debit" : "credit",
        amount: Math.abs(line.amount).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) as any,
      }));
    }

    form.reset({
      cash_date: header.cash_date,
      competence_date: header.competence_date,
      description: header.description ?? "",
      status: header.status as any,
      lines,
    } as any);

    setDialogMode(mode);
    setEditingId(mode === "edit" ? id : null);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    void loadTransactionIntoForm(id, "edit");
  };

  const handleDuplicate = (id: string) => {
    void loadTransactionIntoForm(id, "duplicate");
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;

    const confirmed = window.confirm("Tem certeza que deseja excluir este lançamento?");
    if (!confirmed) return;

    const { error: deleteEntriesError } = await supabase
      .from("transaction_entries")
      .delete()
      .eq("transaction_id", id)
      .eq("company_id", currentCompany.id);

    if (deleteEntriesError) {
      toast({
        title: "Erro ao excluir linhas do lançamento",
        description: deleteEntriesError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: deleteHeaderError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (deleteHeaderError) {
      toast({
        title: "Erro ao excluir lançamento",
        description: deleteHeaderError.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Lançamento excluído com sucesso" });
    await loadHeaders();
  };

  const onSubmit = async (values: TransactionFormValues) => {
    if (!currentCompany || !user) return;

    const signedLines = values.lines.map((line) => ({
      account_id: line.account_id,
      cost_center_id: line.cost_center_id && line.cost_center_id.length > 0 ? line.cost_center_id : null,
      amount: line.side === "debit" ? line.amount : -line.amount,
    }));

    const total = signedLines.reduce((sum, line) => sum + line.amount, 0);

    if (total !== 0) {
      toast({
        title: "Lançamento inconsistente",
        description: "A soma de débitos e créditos deve ser igual a zero.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const totalDebits = signedLines.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);

      let transactionId = editingId;

      if (dialogMode === "edit" && editingId) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            cash_date: values.cash_date,
            competence_date: values.competence_date,
            status: values.status,
            description: values.description.trim(),
            amount: totalDebits,
            type: totalDebits >= 0 ? "income" : "expense",
          })
          .eq("id", editingId)
          .eq("company_id", currentCompany.id);

        if (updateError) {
          toast({
            title: "Erro ao atualizar lançamento",
            description: updateError.message,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        const { error: deleteEntriesError2 } = await supabase
          .from("transaction_entries")
          .delete()
          .eq("transaction_id", editingId)
          .eq("company_id", currentCompany.id);

        if (deleteEntriesError2) {
          toast({
            title: "Erro ao atualizar linhas do lançamento",
            description: deleteEntriesError2.message,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("transactions")
          .insert({
            company_id: currentCompany.id,
            user_id: user.id,
            type: totalDebits >= 0 ? "income" : "expense",
            amount: totalDebits,
            cash_date: values.cash_date,
            competence_date: values.competence_date,
            status: values.status,
            recurrence_type: "none",
            description: values.description.trim(),
          })
          .select("id")
          .single();

        if (error || !inserted) {
          toast({
            title: "Erro ao salvar lançamento",
            description: error?.message ?? "Não foi possível criar o lançamento",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        transactionId = inserted.id;
      }

      const { error: linesError } = await supabase.from("transaction_entries").insert(
        signedLines.map((line) => ({
          transaction_id: transactionId,
          company_id: currentCompany.id,
          account_id: line.account_id,
          cost_center_id: line.cost_center_id,
          amount: line.amount,
        })),
      );

      if (linesError) {
        toast({
          title: "Erro ao salvar linhas do lançamento",
          description: linesError.message,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      toast({
        title:
          dialogMode === "edit"
            ? "Lançamento atualizado com sucesso"
            : "Lançamento registrado com sucesso",
      });
      setDialogOpen(false);
      setEditingId(null);
      setDialogMode("create");
      await loadHeaders();
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppShell sectionLabel="Operações" title="Lançamentos em partidas dobradas">
      <main className="flex flex-1 flex-col gap-6 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Operações</p>
            <h1 className="text-lg font-semibold leading-tight">Lançamentos em partidas dobradas</h1>
          </div>
          {currentCompany && (
            <Button size="sm" onClick={handleOpenNew} disabled={loading}>
              Novo lançamento
            </Button>
          )}
        </header>

        <section className="mt-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Pesquisar lançamentos</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearFilters} disabled={loading}>
                    Limpar filtros
                  </Button>
                  <Button size="sm" onClick={() => void loadHeaders()} disabled={loading}>
                    Aplicar filtros
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                <Input
                  placeholder="Descrição contém..."
                  value={filters.description}
                  onChange={(e) => handleFilterChange("description", e.target.value)}
                />
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  placeholder="Data caixa de"
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  placeholder="Data caixa até"
                />
                <Select
                  value={filters.status}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="scheduled">Agendado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="realized">Realizado</SelectItem>
                    <SelectItem value="reconciled">Conciliado</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.accountId}
                  onValueChange={(value) => handleFilterChange("accountId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas as contas</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.costCenterId}
                  onValueChange={(value) => handleFilterChange("costCenterId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos centros de custos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos centros de custos</SelectItem>
                    {costCenters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.recurrenceType}
                  onValueChange={(value) => handleFilterChange("recurrenceType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Repetição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas repetições</SelectItem>
                    <SelectItem value="none">Sem repetição</SelectItem>
                    <SelectItem value="installment">Parcelado</SelectItem>
                    <SelectItem value="fixed">Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data caixa</TableHead>
                    <TableHead>Data competência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[160px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum lançamento encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    headers.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.cash_date}</TableCell>
                        <TableCell>{h.competence_date}</TableCell>
                        <TableCell>{h.description}</TableCell>
                        <TableCell>{h.status}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Editar lançamento"
                              onClick={() => handleEdit(h.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Duplicar lançamento"
                              onClick={() => handleDuplicate(h.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Excluir lançamento"
                              onClick={() => handleDelete(h.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "edit"
                  ? "Editar lançamento"
                  : dialogMode === "duplicate"
                    ? "Duplicar lançamento"
                    : "Novo lançamento"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="cash_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de caixa</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="competence_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de competência</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Agendado</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="realized">Realizado</SelectItem>
                              <SelectItem value="reconciled">Conciliado</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Descreva o lançamento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Linhas do lançamento</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append({ account_id: "", side: "debit", cost_center_id: "", amount: "0,00" as any })
                      }
                    >
                      Adicionar linha
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta</TableHead>
                        <TableHead>Centro de custos</TableHead>
                        <TableHead>Débito / Crédito</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="w-[200px]">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.account_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione a conta" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {accounts.map((a) => (
                                          <SelectItem key={a.id} value={a.id}>
                                            {a.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="w-[200px]">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.cost_center_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
                                      defaultValue={field.value || "__none"}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Sem centro de custos" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none">Sem centro de custos</SelectItem>
                                        {costCenters.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="w-[160px]">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.side`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="debit">Débito</SelectItem>
                                        <SelectItem value="credit">Crédito</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="w-[140px] text-right">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.amount` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      className="text-right"
                                      placeholder="0,00"
                                      inputMode="decimal"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="w-[40px] text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 2}
                            >
                              ✕
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar lançamento"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </AppShell>
  );
};

export default TransactionsPage;
