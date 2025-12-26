-- Cria função para vincular automaticamente novos usuários à empresa via metadados do Auth
create or replace function public.handle_new_user_company_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role public.app_role;
begin
  -- Extrai company_id e role dos metadados do usuário criado pelo Auth
  v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'collaborator'::public.app_role);

  if v_company_id is not null then
    insert into public.company_users (company_id, user_id, role)
    values (v_company_id, new.id, v_role);
  end if;

  return new;
end;
$$;

-- Garante que o trigger exista e use a função acima
create trigger on_auth_user_created_company_link
  after insert on auth.users
  for each row execute procedure public.handle_new_user_company_link();