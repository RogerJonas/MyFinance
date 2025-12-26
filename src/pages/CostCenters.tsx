import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout/AppShell";

interface CostCenterRow {
  id: string;
  code: string;
  name: string;
}

const costCenterSchema = z.object({
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
});

type CostCenterFormValues = z.infer<typeof costCenterSchema>;

const CostCentersPage = () => {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<CostCenterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CostCenterRow | null>(null);

  const form = useForm<CostCenterFormValues>({
    resolver: zodResolver(costCenterSchema),
    defaultValues: { code: "", name: "" },
  });

  useEffect(() => {
    document.title = "Centros de custos | Aurora Finance";
  }, []);

  const load = async () => {
    if (!currentCompany) {
      setRows([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("cost_centers")
      .select("id, code, name")
      .eq("company_id", currentCompany.id)
      .order("code", { ascending: true });

    if (error) {
      toast({
        title: "Erro ao carregar centros de custos",
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
    form.reset({ code: "", name: "" });
    setDialogOpen(true);
  };

  const handleEdit = (row: CostCenterRow) => {
    setEditing(row);
    form.reset({ code: row.code, name: row.name });
    setDialogOpen(true);
  };

  const onSubmit = async (values: CostCenterFormValues) => {
    if (!currentCompany) return;
    setSaving(true);

    const payload = {
      code: values.code.trim(),
      name: values.name.trim(),
      company_id: currentCompany.id,
    };

    const { error } = editing
      ? await supabase.from("cost_centers").update(payload).eq("id", editing.id)
      : await supabase.from("cost_centers").insert(payload);

    if (error) {
      toast({
        title: editing ? "Erro ao atualizar centro de custos" : "Erro ao criar centro de custos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: editing ? "Centro de custos atualizado" : "Centro de custos criado",
      });
      setDialogOpen(false);
      setEditing(null);
      form.reset({ code: "", name: "" });
      await load();
    }

    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("cost_centers").delete().eq("id", deleteId);

    if (error) {
      toast({
        title: "Erro ao excluir centro de custos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Centro de custos excluído" });
      await load();
    }

    setDeleting(false);
    setDeleteId(null);
  };

  return (
    <AppShell sectionLabel="Cadastros" title="Centros de custos">
      <main className="flex flex-1 flex-col gap-6 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Cadastros</p>
            <h1 className="text-lg font-semibold leading-tight">Centros de custos</h1>
          </div>
          {currentCompany && (
            <Button size="sm" variant="default" onClick={handleOpenNew} disabled={loading}>
              Novo centro de custos
            </Button>
          )}
        </header>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-sm">Estrutura de centros de custos da empresa atual</CardTitle>
          </CardHeader>
          <CardContent>
            {!currentCompany ? (
              <p className="text-sm text-muted-foreground">Selecione uma empresa para visualizar os centros de custos.</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Carregando centros de custos…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum centro de custos encontrado para esta empresa. Cadastre o primeiro centro de custos para começar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
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
              <DialogTitle>{editing ? "Editar centro de custos" : "Novo centro de custos"}</DialogTitle>
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar centro de custos"}
                  </Button>
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
              Esta ação não poderá ser desfeita. Tem certeza de que deseja excluir este centro de custos?
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
    </AppShell>
  );
};

export default CostCentersPage;
