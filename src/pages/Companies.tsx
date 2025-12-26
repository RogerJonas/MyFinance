import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout/AppShell";

interface CompanyRow {
  id: string;
  name: string;
}

const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
});

type CompanyFormValues = z.infer<typeof companySchema>;

const CompaniesPage = () => {
  const { companies, currentCompany, user } = useAuth();
  const { toast } = useToast();
  const [localCompanies, setLocalCompanies] = useState<CompanyRow[]>(companies);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    document.title = "Empresas | Aurora Finance";
  }, []);

  useEffect(() => {
    setLocalCompanies(companies);
  }, [companies]);

  const handleOpenNew = () => {
    setEditing(null);
    form.reset({ name: "" });
    setDialogOpen(true);
  };

  const handleEdit = (company: CompanyRow) => {
    setEditing(company);
    form.reset({ name: company.name });
    setDialogOpen(true);
  };

const onSubmit = async (values: CompanyFormValues) => {
  setSaving(true);

  const payload = { name: values.name.trim() };

  const { data, error } = editing
    ? await supabase
        .from("companies")
        .update(payload)
        .eq("id", editing.id)
        .select("id, name")
    : await supabase.from("companies").insert(payload).select("id, name");

  if (error) {
    toast({
      title: editing ? "Erro ao atualizar empresa" : "Erro ao criar empresa",
      description: error.message,
      variant: "destructive",
    });
  } else {
    const updated = data as CompanyRow[];

    if (!editing && updated && updated[0] && user) {
      const { error: linkError } = await supabase.from("company_users").insert({
        company_id: updated[0].id,
        user_id: user.id,
        role: "admin",
      });

      if (linkError) {
        toast({
          title: "Empresa criada, mas falha ao vincular usuário",
          description: linkError.message,
          variant: "destructive",
        });
      }
    }

    if (editing) {
      setLocalCompanies((prev) => prev.map((c) => (c.id === editing.id ? updated[0] : c)));
    } else if (updated && updated[0]) {
      setLocalCompanies((prev) => [...prev, updated[0]]);
    }

    toast({ title: editing ? "Empresa atualizada" : "Empresa criada" });
    setDialogOpen(false);
    setEditing(null);
    form.reset({ name: "" });
  }

  setSaving(false);
};

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const { error } = await supabase.from("companies").delete().eq("id", deleteId);

    if (error) {
      toast({
        title: "Erro ao excluir empresa",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLocalCompanies((prev) => prev.filter((c) => c.id !== deleteId));
      toast({ title: "Empresa excluída" });
    }

    setDeleting(false);
    setDeleteId(null);
  };

  return (
    <AppShell sectionLabel="Cadastros" title="Empresas do usuário">
      <main className="flex flex-1 flex-col gap-6 pb-8 pt-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Cadastros</p>
            <h1 className="text-lg font-semibold leading-tight">Empresas do usuário</h1>
          </div>
          <Button size="sm" onClick={handleOpenNew}>
            Nova empresa
          </Button>
        </header>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-sm">Empresas às quais você tem acesso</CardTitle>
          </CardHeader>
          <CardContent>
            {localCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma empresa vinculada ao seu usuário. A primeira empresa é criada automaticamente no seu primeiro acesso.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {currentCompany?.id === company.id ? "Empresa atual" : "Disponível"}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(company.id)}
                          disabled={currentCompany?.id === company.id}
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

        {/* dialogs keep same structure */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da empresa</FormLabel>
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
                    {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar empresa"}
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
              Esta ação não poderá ser desfeita. Tem certeza de que deseja excluir esta empresa?
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

export default CompaniesPage;
