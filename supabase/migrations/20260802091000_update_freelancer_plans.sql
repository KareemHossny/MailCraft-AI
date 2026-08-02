UPDATE public.plans SET monthly_quota = 10,
  features_en = ARRAY['10 client messages / month','Basic proposal and follow-up workflows','Arabic & English','Grounded drafts']
WHERE slug = 'free';

UPDATE public.plans SET monthly_quota = 300,
  description_en = 'For freelancers who manage client communication every week',
  features_en = ARRAY['Saved client and project context','All proposal, follow-up, payment and update workflows','Snippets and exports','300 client messages / month']
WHERE slug = 'pro';

UPDATE public.plans SET monthly_quota = 1000,
  description_en = 'For small agencies and collaborative client teams',
  features_en = ARRAY['Everything in Solo','Agency-ready shared workflows','Client status and outcome tracking','1000 client messages / month']
WHERE slug = 'business';
