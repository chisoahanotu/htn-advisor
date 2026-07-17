-- "Sells new for ~$X" comparison shown on listing pages so buyers can see
-- the deal. retail_url links to the product page for the new equivalent.
alter table items add column retail_price numeric,
                 add column retail_url text;
