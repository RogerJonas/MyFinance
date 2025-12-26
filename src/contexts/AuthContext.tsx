import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ProfileSummary {
  id: string;
  full_name: string | null;
}

interface CompanySummary {
  id: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: ProfileSummary | null;
  currentCompany: CompanySummary | null;
  companies: CompanySummary[];
  initializing: boolean;
  setCurrentCompanyId: (companyId: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [currentCompany, setCurrentCompany] = useState<CompanySummary | null>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      })
      .finally(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCurrentCompany(null);
      setCompanies([]);
      return;
    }

    setInitializing(true);

    // Evitar chamadas Supabase diretamente dentro do callback de onAuthStateChange
    setTimeout(() => {
      const init = async () => {
        // Perfil
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingProfile) {
          const defaultName = user.email ? user.email.split("@")[0] : "Usuário";
          const { data: newProfile } = await supabase
            .from("profiles")
            .insert({ id: user.id, full_name: defaultName })
            .select("id, full_name")
            .maybeSingle();
          if (newProfile) {
            setProfile({ id: newProfile.id, full_name: newProfile.full_name });
          }
        } else {
          setProfile({ id: existingProfile.id, full_name: existingProfile.full_name });
        }

        // Empresas do usuário
        const { data: existingLinks } = await supabase
          .from("company_users")
          .select("company_id, companies(name, id)")
          .eq("user_id", user.id);

        if (existingLinks && existingLinks.length > 0) {
          const mappedCompanies: CompanySummary[] = existingLinks.map((link: any) => {
            const company = link.companies ?? { id: link.company_id, name: "Empresa" };
            return { id: company.id, name: company.name };
          });

          setCompanies(mappedCompanies);

          setCurrentCompany((prev) => {
            if (prev) {
              const stillExists = mappedCompanies.find((c) => c.id === prev.id);
              if (stillExists) return prev;
            }
            return mappedCompanies[0] ?? null;
          });
        } else {
          const { data: newCompany } = await supabase
            .from("companies")
            .insert({ name: "Empresa Principal", default_regime: "cash" })
            .select("id, name")
            .maybeSingle();

          if (newCompany) {
            await supabase.from("company_users").insert({
              company_id: newCompany.id,
              user_id: user.id,
              role: "admin",
            });
            const summary = { id: newCompany.id, name: newCompany.name };
            setCompanies([summary]);
            setCurrentCompany(summary);
          }
        }

        setInitializing(false);
      };

      init().catch(() => {
        setInitializing(false);
      });
    }, 0);
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const setCurrentCompanyId = (companyId: string) => {
    setCurrentCompany((prev) => {
      if (prev?.id === companyId) return prev;
      const found = companies.find((c) => c.id === companyId) ?? null;
      return found;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, profile, currentCompany, companies, initializing, setCurrentCompanyId, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
