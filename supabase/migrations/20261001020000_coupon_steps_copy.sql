-- Actualiza los dos primeros pasos sin sustituir el resto de la página.
UPDATE public.site_content
SET content = jsonb_set(
  jsonb_set(
    content,
    '{steps,0,body}',
    to_jsonb('Al retirar el dorsal de tu carrera recibes un bono de 30 € de esa prueba y válido en un comercio concreto de la isla.'::text)
  ),
  '{steps,1,body}',
  to_jsonb('Cada bono va ligado a un único comercio local, elegido aleatoriamente para repartir el impacto económico.'::text)
)
WHERE content_key = 'coupon.page';
