-- Añade una explicación de los bonos y su distribución equitativa sin sobrescribir
-- el resto del aviso legal que pueda haberse editado desde la aplicación.
UPDATE public.site_content
SET content = jsonb_set(
  content,
  '{sections}',
  COALESCE(content->'sections', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id', 'premios',
      'title', 'Bases de los premios y asignación de los bonos',
      'paragraphs', jsonb_build_array(
        'El programa entrega bonos de compra de 30 € vinculados a una carrera y a un único comercio adherido. La entrega se realiza al retirar el dorsal conforme a las condiciones de la prueba. El sistema no selecciona participantes ganadores ni asigna previamente un código a un dorsal: los bonos emitidos pueden entregarse en cualquier orden.',
        'La asignación del comercio es equitativa, no aleatoria: al emitir cada bono, el sistema lo asigna al comercio activo de esa carrera que tenga menos bonos asignados hasta ese momento. Si varios están empatados, se aplica el orden alfabético del nombre. Mientras se mantenga el mismo conjunto de comercios activos, la diferencia entre las cantidades asignadas será como máximo de un bono. La asignación queda guardada en el bono y no depende de la persona ni del dorsal que lo recibe.',
        'Cada bono tiene un saldo inicial de 30 €, solo puede gastarse en el comercio asignado y admite varias compras durante el periodo de validez indicado en el propio bono. No se canjea por efectivo ni genera cambio.',
        'Este apartado explica el funcionamiento técnico del sistema. Los requisitos para participar, la forma de entrega, el número de bonos y las demás condiciones oficiales de la convocatoria corresponden a las bases aprobadas por la organización y deben consultarse en su publicación oficial; este resumen no las sustituye.'
      ),
      'links', jsonb_build_array(
        jsonb_build_object('label', 'Cómo funciona el bono', 'href', '/bono'),
        jsonb_build_object('label', 'Consultar dudas al programa', 'href', 'mailto:deportes@elhierro.es')
      )
    )
  ),
  true
)
WHERE content_key = 'legal.notice'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(content->'sections', '[]'::jsonb)) AS section_item(value)
    WHERE value->>'id' = 'premios'
  );

-- Corrige el texto anterior, que describía la asignación como aleatoria.
UPDATE public.site_content
SET content = jsonb_set(
  content,
  '{steps,1,body}',
  to_jsonb('Cada bono va ligado a un único comercio local. La asignación es equitativa y prioriza los negocios con menos bonos de esa carrera.'::text),
  true
)
WHERE content_key = 'coupon.page'
  AND content #>> '{steps,1,body}' = 'Cada bono va ligado a un único comercio local, elegido aleatoriamente para repartir el impacto económico.';
