-- Add account_type column to accounts for detailed nature classification
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS account_type text;

-- Allow transactions without a specific financial account in the header
ALTER TABLE public.transactions
ALTER COLUMN financial_account_id DROP NOT NULL;