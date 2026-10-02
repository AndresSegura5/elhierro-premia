DO $$
DECLARE
  notice text := 'Algunas imágenes de carácter ilustrativo publicadas en el sitio pueden haber sido generadas, adaptadas o editadas con herramientas de inteligencia artificial. Estas imágenes se utilizan como apoyo visual y no deben interpretarse como una reproducción exacta de establecimientos, productos, servicios o personas reales.';
BEGIN
  UPDATE public.site_content
  SET
    content = jsonb_set(
      jsonb_set(
        content,
        '{sections}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN section ->> 'id' = 'contenidos'
                AND NOT (section -> 'paragraphs' @> jsonb_build_array(notice))
              THEN jsonb_set(
                section,
                '{paragraphs}',
                jsonb_insert(section -> 'paragraphs', '{1}', to_jsonb(notice), false)
              )
              ELSE section
            END
            ORDER BY position
          )
          FROM jsonb_array_elements(content -> 'sections') WITH ORDINALITY AS entries(section, position)
        )
      ),
      '{updatedAt}',
      to_jsonb('2026-10-02'::text)
    ),
    updated_at = now()
  WHERE content_key = 'legal.notice';
END $$;
