import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const authSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail deve ter no máximo 255 caracteres" }),
  password: z
    .string()
    .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
    .max(128, { message: "Senha deve ter no máximo 128 caracteres" }),
});

const invitePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
      .max(128, { message: "Senha deve ter no máximo 128 caracteres" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  const handleChange = (field: "email" | "password", value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  useEffect(() => {
    const isInvite = searchParams.get("invite") === "1";

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && isInvite) {
        setIsInviteFlow(true);
      } else if (session && !isInvite) {
        navigate("/", { replace: true });
      }
    };

    void init();
  }, [navigate, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    if (isInviteFlow) {
      const parsed = invitePasswordSchema.safeParse({
        password: formState.password,
        confirmPassword,
      });

      if (!parsed.success) {
        const fieldErrors: { password?: string; confirmPassword?: string } = {};
        parsed.error.issues.forEach((issue) => {
          const path = issue.path[0];
          if (path === "password" || path === "confirmPassword") {
            fieldErrors[path] = issue.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({
          password: parsed.data.password,
        });

        if (error) {
          toast({
            title: "Não foi possível definir a senha",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Senha definida com sucesso",
          description: "Agora você já pode acessar o painel.",
        });
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
      return;
    }

    const parsed = authSchema.safeParse(formState);
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path === "email" || path === "password") {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          toast({
            title: "Não foi possível criar sua conta",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Cadastro realizado",
          description:
            "Verifique seu e-mail para confirmar a conta. Depois, faça login para acessar o dashboard.",
        });
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Bem-vindo de volta!", description: "Redirecionando para o dashboard..." });
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-[var(--shadow-soft)]">
        <CardHeader className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Aurora Finance
          </p>
          <CardTitle className="text-lg">
            {isInviteFlow
              ? "Definir sua senha"
              : mode === "login"
                ? "Entrar na sua conta"
                : "Criar uma nova conta"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {isInviteFlow
              ? "Crie uma senha segura para concluir seu acesso ao painel financeiro."
              : "Use seu e-mail e uma senha forte para acessar o painel financeiro."}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isInviteFlow && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={formState.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="bg-background/40"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={isInviteFlow ? "new-password" : mode === "login" ? "current-password" : "new-password"}
                value={formState.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="bg-background/40"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {isInviteFlow && (
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="confirm-password"
                >
                  Confirmar senha
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  className="bg-background/40"
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading
                ? "Processando..."
                : isInviteFlow
                  ? "Definir senha e entrar"
                  : mode === "login"
                    ? "Entrar"
                    : "Criar conta"}
            </Button>
          </form>

          {!isInviteFlow && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <button
                  type="button"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                  onClick={() => setMode("signup")}
                >
                  Não tem conta? Criar uma agora
                </button>
              ) : (
                <button
                  type="button"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                  onClick={() => setMode("login")}
                >
                  Já tem conta? Fazer login
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
