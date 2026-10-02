UPDATE public.site_content
SET content = jsonb_set(
  content,
  '{steps,0,body}',
  to_jsonb(replace(
    content #>> '{steps,0,body}',
    ' Los bonos se entregan sin asignarlos previamente a un dorsal.',
    ''
  ))
)
WHERE content_key = 'coupon.page'
  AND (content #>> '{steps,0,body}') LIKE '% Los bonos se entregan sin asignarlos previamente a un dorsal.';

UPDATE public.site_content
SET content = jsonb_set(
  content,
  '{steps,1,body}',
  to_jsonb(replace(
    content #>> '{steps,1,body}',
    ' La asignación es equitativa y prioriza los negocios con menos bonos de esa carrera.',
    ''
  ))
)
WHERE content_key = 'coupon.page'
  AND (content #>> '{steps,1,body}') LIKE '% La asignación es equitativa y prioriza los negocios con menos bonos de esa carrera.';
