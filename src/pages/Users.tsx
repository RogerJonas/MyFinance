import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/layout/AppShell";

interface CompanyUserRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name?: string | null;
}

const companyUserSchema = z.object({
  user_id: z
    .string()
    .trim()
    .min(1, "ID do usuário é obrigatório")
    .max(255, "ID do usuário deve ter no máximo 255 caracteres"),
  role: z.enum(["admin", "collaborator", "accountant"], {
    errorMap: () => ({ message: "Selecione uma função válida" }),
  }),
});

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido")
    .max(255, "E-mail deve ter no máximo 255 caracteres"),
  role: z.enum(["admin", "collaborator", "accountant"], {
    errorMap: () => ({ message: "Selecione uma função válida" }),
  }),
});

type CompanyUserFormValues = z.infer<typeof companyUserSchema>;
type InviteFormValues = z.infer<typeof inviteSchema>;

const UsersPage = () => {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<CompanyUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyUserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  const form = useForm<CompanyUserFormValues>({
    resolver: zodResolver(companyUserSchema),
    defaultValues: {
      user_id: "",
      role: "collaborator",
    },
  });

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "collaborator",
    },
  });

  useEffect(() => {
    document.title = "Usuários | Aurora Finance";
  }, []);

  const load = async () => {
    if (!currentCompany) {
      setRows([]);
      return;
    }

    setLoading(true);
    const { data: companyUsers, error } = await supabase
      .from("company_users")
      .select("id, user_id, role, created_at")
      .eq("company_id", currentCompany.id);

    if (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
      setRows([]);
      setLoading(false);
      return;
    }

    if (!companyUsers || companyUsers.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const userIds = companyUsers.map((cu) => cu.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profilesById = new Map<string, string | null>();
    (profiles ?? []).forEach((p: any) => {
      profilesById.set(p.id as string, (p.full_name as string | null) ?? null);
    });

    const combined: CompanyUserRow[] = companyUsers.map((cu: any) => ({
      id: cu.id,
      user_id: cu.user_id,
      role: cu.role,
      created_at: cu.created_at,
      full_name: profilesById.get(cu.user_id) ?? null,
    }));

    setRows(combined);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [currentCompany]);

  const handleOpenNew = () => {
    setEditing(null);
    form.reset({ user_id: "", role: "collaborator" });
    setDialogOpen(true);
  };

  const handleEdit = (row: CompanyUserRow) => {
    setEditing(row);
    form.reset({ user_id: row.user_id, role: row.role as any });
    setDialogOpen(true);
  };

  const onSubmit = async (values: CompanyUserFormValues) => {
    if (!currentCompany) return;
    setSaving(true);

    if (editing) {
      const { error } = await supabase
        .from("company_users")
        .update({ role: values.role })
        .eq("id", editing.id);

      if (error) {
        toast({
          title: "Erro ao atualizar vínculo",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Vínculo atualizado" });
        await load();
        setDialogOpen(false);
        setEditing(null);
      }
    } else {
      const { error } = await supabase.from("company_users").insert({
        company_id: currentCompany.id,
        user_id: values.user_id.trim(),
        role: values.role,
      });

      if (error) {
        toast({
          title: "Erro ao criar vínculo",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Vínculo criado" });
        await load();
        setDialogOpen(false);
      }
    }

    setSaving(false);
  };

  const onInviteSubmit = async (values: InviteFormValues) => {
    if (!currentCompany) return;
    setInviting(true);

    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: values.email.trim().toLowerCase(),
          role: values.role,
          companyId: currentCompany.id,
          redirectUrl: window.location.origin,
        },
      });

      if (error) {
        toast({
          title: "Erro ao enviar convite",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Convite enviado",
          description: `Um e-mail foi enviado para ${values.email}`,
        });
        inviteForm.reset({ email: "", role: "collaborator" });
        setInviteDialogOpen(false);
      }
    } catch (err: any) {
      toast({
        title: "Erro ao enviar convite",
        description: err.message ?? "Tente novamente em instantes",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);

    const { error } = await supabase.from("company_users").delete().eq("id", deleteId);

    if (error) {
      toast({
        title: "Erro ao remover vínculo",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Vínculo removido" });
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
            <h1 className="text-lg font-semibold leading-tight">Usuários por empresa</h1>
          </div>
          {currentCompany && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleOpenNew} disabled={loading}>
                Novo vínculo (UUID)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  inviteForm.reset({ email: "", role: "collaborator" });
                  setInviteDialogOpen(true);
                }}
                disabled={loading}
              >
                Convidar por e-mail
              </Button>
            </div>
          )}
        </header>

        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-sm">Usuários vinculados à empresa atual</CardTitle>
          </CardHeader>
          <CardContent>
            {!currentCompany ? (
              <p className="text-sm text-muted-foreground">Selecione uma empresa para visualizar os usuários.</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Carregando usuários…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum usuário encontrado para esta empresa. Crie vínculos para conceder acesso.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail / ID</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.full_name || "Usuário"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground break-all">{row.user_id}</TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground">{row.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString("pt-BR")}
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
                          Remover
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
              <DialogTitle>{editing ? "Editar vínculo" : "Novo vínculo de usuário (UUID)"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID do usuário (UUID do Supabase Auth)</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" disabled={!!editing} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="collaborator">Colaborador</SelectItem>
                            <SelectItem value="accountant">Contador</SelectItem>
                          </SelectContent>
                        </Select>
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
                    {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar vínculo"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar usuário por e-mail</DialogTitle>
            </DialogHeader>
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail do usuário</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="collaborator">Colaborador</SelectItem>
                            <SelectItem value="accountant">Contador</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                    disabled={inviting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? "Enviando convite…" : "Enviar convite"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover vínculo</AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-sm text-muted-foreground">
              Esta ação não poderá ser desfeita. Tem certeza de que deseja remover o acesso deste usuário à empresa atual?
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
                {deleting ? "Removendo…" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default UsersPage;
