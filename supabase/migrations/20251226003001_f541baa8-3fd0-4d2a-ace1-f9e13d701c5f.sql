ALTER TABLE public.transaction_entries
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id);