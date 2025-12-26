-- Allow admins and company members to manage companies
CREATE POLICY "Company members manage companies"
ON public.companies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = companies.id AND cu.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = companies.id AND cu.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins to manage company_users links
CREATE POLICY "Admins manage company_users"
ON public.company_users
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
