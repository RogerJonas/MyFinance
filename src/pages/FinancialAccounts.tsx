import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout/AppShell";

interface AccountRow {
  id: string;
  code: string;
  name: string;
  class: string;
  account_type: string | null;
  is_active: boolean;
}

const accountClassOptions = ["asset", "liability", "equity", "revenue", "expense"] as const;

const accountTypeOptions = [
  "Caixa",
  "Banco",
  "Contas a receber",
  "Contas a pagar",
  "Cartão de crédito",
  "Imobilizado",
  "Investimento",
  "Resultado",
] as const;

const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Código é obrigatório")
    .max(50, "Código deve ter no máximo 50 caracteres"),
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  class: z.enum(accountClassOptions, { errorMap: () => ({ message: "Selecione um grupo contábil válido" }) }),
  account_type: z
    .string()
    .trim()
    .min(1, "Tipo de conta é obrigatório")
    .max(100, "Tipo de conta deve ter no máximo 100 caracteres"),
  is_active: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

const FinancialAccountsPage = () => {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: "",
      name: "",
      class: "asset",
      account_type: "",
      is_active: true,
    },
  });

  useEffect(() => {
    document.title = "Plano de contas | Aurora Finance";
  }, []);

  const load = async () => {
    if (!currentCompany) {
      setRows([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("id, code, name, class, account_type, is_active")
      .eq("company_id", currentCompany.id)
      .order("code", { ascending: true });

    if (error) {
      toast({
        title: "Erro ao carregar contas financeiras",
        description: error.message,
        variant: "destructive",
      });
    }

    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [currentCompany]);

  const handleOpenNew = () => {
    setEditing(null);
    form.reset({ code: "", name: "", class: "asset", account_type: "", is_active: true });
    setDialogOpen(true);
  };

  const handleEdit = (row: AccountRow) => {
    setEditing(row);
    form.reset({
      code: row.code,
      name: row.name,
      class: row.class as any,
      account_type: row.account_type ?? "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: AccountFormValues) => {
    if (!currentCompany) return;
    setSaving(true);

    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      class: values.class,
      account_type: values.account_type.trim(),
      is_active: values.is_active ?? true,
      company_id: currentCompany.id,
    };

    const { error } = editing
      ? await supabase.from("accounts").update(payload).eq("id", editing.id)
      : await supabase.from("accounts").insert(payload);

    if (error) {
      toast({
        title: editing ? "Erro ao atualizar conta financeira" : "Erro ao criar conta financeira",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: editing ? "Conta financeira atualizada" : "Conta financeira criada",
      });
      setDialogOpen(false);
      setEditing(null);
      await load();
    }

    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const { error } = await supabase.from("accounts").delete().eq("id", deleteId);

    if (error) {
      toast({
        title: "Erro ao excluir conta financeira",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Conta financeira excluída" });
      await load();
    }

    setDeleting(false);
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Cadastros</p>
            <h1 className="text-lg font-semibold leading-tight">Plano de contas contábeis</h1>
          </div>
          {currentCompany && (
            <Button size="sm" onClick={handleOpenNew} disabled={loading}>
              Nova conta contábil
            </Button>
          )}
        </header>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-sm">Plano de contas da empresa atual</CardTitle>
          </CardHeader>
          <CardContent>
            {!currentCompany ? (
              <p className="text-sm text-muted-foreground">Selecione uma empresa para visualizar o plano de contas.</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Carregando contas contábeis…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conta contábil encontrada para esta empresa. Cadastre a primeira conta para começar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Grupo contábil</TableHead>
                    <TableHead>Tipo de conta</TableHead>
                    <TableHead className="text-center">Ativa</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground">{row.class}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.account_type}</TableCell>
                      <TableCell className="text-center text-xs">
                        {row.is_active ? "Sim" : "Não"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(row.id)}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar conta contábil" : "Nova conta contábil"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo contábil</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asset">Ativo</SelectItem>
                              <SelectItem value="liability">Passivo</SelectItem>
                              <SelectItem value="equity">Patrimônio líquido</SelectItem>
                              <SelectItem value="revenue">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="account_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de conta</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {accountTypeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border bg-background align-middle"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        </FormControl>
                        <FormLabel className="text-xs font-normal">Conta ativa</FormLabel>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar conta"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-sm text-muted-foreground">
              Esta ação não poderá ser desfeita. Tem certeza de que deseja excluir esta conta contábil?
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
                {deleting ? "Excluindo…" : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default FinancialAccountsPage;
