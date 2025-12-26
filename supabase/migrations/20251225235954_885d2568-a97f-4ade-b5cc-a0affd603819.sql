-- Create table for double-entry transaction lines
CREATE TABLE public.transaction_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reuse generic updated_at trigger function
CREATE TRIGGER set_transaction_entries_updated_at
BEFORE UPDATE ON public.transaction_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.transaction_entries ENABLE ROW LEVEL SECURITY;

-- Policy: company members manage transaction entries
CREATE POLICY "Company members manage transaction entries"
ON public.transaction_entries
AS RESTRICTIVE
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = transaction_entries.company_id
      AND cu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = transaction_entries.company_id
      AND cu.user_id = auth.uid()
  )
);

-- Validation function to enforce double-entry rules
CREATE OR REPLACE FUNCTION public.validate_transaction_entries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx_id uuid;
  v_sum numeric;
  v_count int;
BEGIN
  -- We need to validate all affected transactions in this statement
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_tx_id := NEW.transaction_id;
  ELSE
    v_tx_id := OLD.transaction_id;
  END IF;

  -- Aggregate over all lines for this transaction
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_sum, v_count
  FROM public.transaction_entries
  WHERE transaction_id = v_tx_id;

  -- Must have at least two lines (for débito/crédito)
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Cada lançamento deve ter pelo menos duas linhas (débito e crédito)';
  END IF;

  -- Sum of all lines must be zero (débitos e créditos se compensam)
  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'Soma dos valores das linhas do lançamento deve ser igual a zero';
  END IF;

  RETURN NULL;
END;
$$;

-- Constraint trigger to validate after each statement, deferrable to end of transaction
CREATE CONSTRAINT TRIGGER validate_transaction_entries_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_entries();