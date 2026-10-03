# Plan de pruebas — El Hierro Premia Deportistas

Estado: **BORRADOR PARA VALIDAR. No se ha ejecutado nada de este plan.**
Fecha de redacción: 3 de octubre de 2026.
No contiene contraseñas, tokens ni cadenas de conexión (el repositorio de GitHub es público).

---

## 0. Cómo se ejecutará este plan

### 0.1 Objetivo

Comprobar, antes de entregar la web, que:

1. Los bonos solo se pueden gastar cuando toca (vigencia **00:01 del primer día a 23:59 del último**, hora de Canarias).
2. Nadie puede gastar más saldo del que tiene un bono, ni dos veces la misma compra, ni en un comercio que no es el suyo.
3. Los datos personales y de gestión solo los ve quien debe verlos.
4. La web se ve y funciona bien en móvil y escritorio, y cumple unos mínimos de accesibilidad.
5. Despliegue, base de datos y migraciones están en el estado esperado.

### 0.2 Entorno

- Se ejecuta contra el **Supabase real** (proyecto `elhierro-premia`), con el permiso expreso del propietario: la web aún no está entregada y los datos se borrarán después.
- El servidor local (`npm run dev`) escribe en esa misma base. Las pruebas visuales se hacen en el navegador integrado sobre `http://localhost:3000`.
- Las pruebas de la web publicada (`https://elhierro-premia.vercel.app/`) son **solo de lectura**, salvo que se indique lo contrario.

### 0.3 Reglas de seguridad de la ejecución

| Regla | Detalle |
| --- | --- |
| Instantánea previa | Antes de cada bloque que escribe: contar filas de `coupons`, `redemptions`, `races`, `businesses`, `users`, `sessions`, `audit_events`, `site_content`. |
| Carreras de prueba | Solo **Bimbache** y **Meridiano** (hoy sin bonos). **Bestial no se toca** (400 bonos, 28 € gastados, 2 canjes). |
| Etiquetado | Todo lo creado lleva el prefijo `ZZ-PRUEBA` (comercios, cuentas, textos) para poder localizarlo y borrarlo. Los bonos se identifican por su código guardado en una lista. |
| Restauración | Al terminar cada bloque se restaura la configuración original de la carrera (cantidad, fecha de inicio, vigencia, fecha de carrera) y se borran **solo** las filas creadas. |
| Verificación final | Instantánea posterior idéntica a la previa. Si no coincide, se detiene todo y se informa. |
| Datos sensibles | No se imprimen contraseñas ni claves en consola ni en el informe. Las cuentas de prueba usan contraseñas generadas y se eliminan al final. |
| Copias | Antes de cualquier migración o cambio de esquema: copia JSON en `.data/` (carpeta ignorada por Git). |
| Parada | Si una prueba falla de forma inesperada, se detiene el bloque, se limpia y se informa antes de seguir. |

### 0.4 Códigos de método y riesgo

**Método**

| Código | Significado |
| --- | --- |
| U | Prueba unitaria (`node --test`), sin red ni base de datos. |
| S | Inspección de solo lectura (consulta SQL, lectura de código, de cabeceras o del HTML). |
| D | Script contra Supabase usando el código real de la aplicación. Escribe y limpia. |
| H | Arnés de concurrencia: script de Node que inicia sesión real con N cuentas y lanza N peticiones a la vez con una barrera de salida. |
| T | Red simulada en el navegador: se intercepta `fetch` para cortar, retrasar, perder respuestas o devolver HTML/errores, y se disparan los eventos `offline`/`online` sobre la cola real de IndexedDB. |
| A | Petición HTTP directa a la API del servidor local. |
| N | Navegador integrado (yo lo manejo y compruebo con capturas, DOM y medidas). Para el tiempo real se usan **dos pestañas**: una actúa y otra observa, midiendo el tiempo hasta que el cambio aparece. |
| M | Manual: requiere un dispositivo real o una persona (cámara, Safari, lector de pantalla, etc.). |

**Riesgo**

| Código | Significado |
| --- | --- |
| L | Solo lectura. |
| E | Escribe datos de prueba con limpieza automática. |
| C | Necesita una cuenta o un dato que debes darme tú (ver sección 17). |

### 0.5 Orden de ejecución

Las prioridades son la base de datos (**bloque A**), la concurrencia y pérdida de cobertura (**bloque B**) y la actualización en tiempo real (**bloque C**). Ninguna otra prueba que escriba se ejecuta antes que el bloque A.

1. **Fase 1 — Estático y unitario:** sección 15 y pruebas U de la sección 1. Sin riesgo.
2. **Fase 2 — Base de datos, solo lectura (bloque A):** A.1, A.8 (BD-G05 a G07), A.9 (lectura) y A.10 en estado inicial. Sin riesgo. Deja la línea base de la instantánea.
3. **Fase 3 — Base de datos, restricciones y escrituras con limpieza (bloque A):** A.4 (restricciones, dentro de transacciones que se revierten), A.3 acción por acción, A.5 (concurrencia de base de datos) y A.10 tras cada bloque.
4. **Fase 4 — Lógica de negocio sobre la base:** secciones 1 (parte D), 2 y 3.
5. **Fase 5 — Validaciones concurrentes (bloque B.2 a B.5 y B.11):** requiere los 15 comercios de prueba (decisiones 4 y 21). Se repite A.10 tras cada ejecución.
6. **Fase 6 — Pérdida de cobertura (bloque B.6 a B.10):** primero con red simulada en el navegador (T); después, lo que solo pueda hacer una persona con un móvil (M).
7. **Fase 7 — Tiempo real (bloque C):** hoy no existe, así que se ejecuta primero una **pasada de línea base** (todas las pruebas deben fallar y se documenta la brecha) y, cuando se implemente (decisión 31), la pasada completa de aceptación.
8. **Fase 8 — API con cuentas de prueba:** secciones 4 y 5.
9. **Fase 9 — Navegador:** secciones 6, 7, 8 y 11 en todos los tamaños.
10. **Fase 10 — Fallos de infraestructura y mantenimiento (bloque A):** A.6 y A.7. Son las más agresivas; se hacen al final y, preferiblemente, sobre una copia (ver decisión 13).
11. **Fase 11 — Carga y resistencia:** sección 14 y C.9, con tope bajo.
12. **Fase 12 — Informe:** sección 16.

### 0.6 Plantilla de resultado de cada prueba

`ID | Resultado: OK / FALLA / NO PROBADO | Evidencia (salida, captura, medida) | Notas`

---

## A. BLOQUE PRIORITARIO — Todas las acciones contra la base de datos

Este bloque es el más importante del plan y se ejecuta primero (después de la fase estática). Cubre **cada** operación que el código lanza contra Supabase: lecturas, escrituras, bloqueos, funciones SQL, scripts y migraciones. Se ha elaborado leyendo el código (`lib/store.ts`, `lib/auth.ts`, `lib/request-limit.ts`, `lib/postgres.ts`, `lib/serialized-postgres.ts`, scripts y migraciones) y consultando en solo lectura el esquema real (restricciones, índices, funciones, permisos).

### A.0 Método estándar para cada escritura

Cada acción que escribe se prueba con estas diez comprobaciones. Las que no aplican se marcan como "n/a" en el informe, no se omiten.

| N.º | Comprobación | Cómo |
| --- | --- | --- |
| 1 | **Efecto exacto** | Instantánea completa de las tablas implicadas antes y después. Solo cambian las filas y columnas previstas; nada más (ni otras filas, ni columnas como `updated_at` sin motivo). |
| 2 | **Entradas inválidas** | Vacío, `null`, longitud máxima y +1, Unicode (tildes, emoji, escritura derecha-izquierda), byte nulo `\u0000`, HTML, comillas, `'; DROP TABLE…`, números extremos, tipos equivocados. |
| 3 | **Permisos** | Visitante, comercio propio, comercio ajeno, administrador, superusuario: quién puede y quién no. |
| 4 | **Atomicidad** | Inyectar un fallo tras cada sentencia de la transacción (el arnés envuelve el cliente `tx` y lanza error en la sentencia N). Resultado esperado: **nada** queda a medias. |
| 5 | **Concurrencia** | La misma acción 2, 5 y 50 veces a la vez, y combinada con las acciones que comparten bloqueos (ver A.5). |
| 6 | **Idempotencia / reintento** | Repetir la acción tras un corte; la segunda vez no duplica ni corrompe. |
| 7 | **Trazabilidad** | La acción deja el rastro previsto en `audit_events` o `login_events`. Si debería dejarlo y no lo deja, se anota como hallazgo. |
| 8 | **Efectos secundarios** | Sesiones cerradas, cuentas bloqueadas o archivadas, contadores, estados derivados. |
| 9 | **Errores controlados** | Si la base rechaza algo (restricción, bloqueo, tiempo), el usuario ve un mensaje claro y **nunca** nombres de restricciones, SQL ni trazas. |
| 10 | **Limpieza y comparación** | La base vuelve a la instantánea inicial (salvo lo que la prueba deba conservar). |

### A.1 Inventario de lecturas (consultas SELECT)

Se prueban para: **permisos** (quién puede invocarlas), **filtros** (excluir borrados/archivados/inactivos), **contenido** (no devolver columnas de más), **vacío**, **volumen** (1.200 bonos), **orden estable** y **rendimiento** (uso de índice).

| ID | Función | Qué lee | Prueba específica | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| BD-L01 | `listRaces` | `races` | Devuelve las 3 carreras con `race_date`; valores por defecto del código solo cuando falte el dato | D | L |
| BD-L02 | `listBusinesses` | `businesses` | Solo comercios **activos**; orden estable | D | L |
| BD-L03 | `listAllBusinesses` / `listManagedBusinesses` | `businesses`, `users` | Incluye inactivos; solo accesible para administradores | D | L |
| BD-L04 | `getBusinessRecord` / `isBusinessActive` | `businesses` | Id inexistente, nulo e indefinido no rompen | D | L |
| BD-L05 | `listBusinessCategories`, `listCouponRules`, `getSiteContent` | catálogos | Vacío y claves inexistentes caen a los valores por defecto del código | D | L |
| BD-L06 | `getRace` | `races` | Id inexistente → `undefined` | D | L |
| BD-L07 | `listRaceCoupons` | `coupons` | **Excluye** `deleted_at` no nulo; orden por creación y código | D | E |
| BD-L08 | `getCouponDetails` | `coupons`, `races`, `redemptions` | Excluye borrados; normaliza mayúsculas/minúsculas; código con espacios | D | E |
| BD-L09 | `listAllCouponAudit` | `coupons`, `businesses`, `users` | Incluye borrados (es la auditoría) y quién los borró | D | E |
| BD-L10 | `listAllRedemptionAudit` / `listRaceRedemptions` | `redemptions` | Una carrera no ve canjes de otra; excluye canjes de bonos borrados donde corresponda | D | E |
| BD-L11 | `listBusinessRedemptions` | `redemptions` | Un comercio solo ve los suyos | D | E |
| BD-L12 | `listLoginAudit`, `listMerchantAccountAudit`, `listAuditEvents` | `login_events`, `users`, `audit_events` | Orden cronológico; sin contraseñas ni hashes en el resultado | D | E |
| BD-L13 | `getGeocodingCache` | `geocoding_cache` | Acierto, fallo y clave con caracteres especiales | D | L |
| BD-L14 | `makeBusinessId` | `businesses` | Genera id único; con nombres repetidos añade sufijo; con símbolos, vacío y muy largo | D | E |
| BD-L15 | `adminExists`, `listAdminAccounts`, `listMerchantAccounts` | `users` | `listAdminAccounts` **no** lista al superusuario; no devuelve `password_hash` | D | L |
| BD-L16 | `getSession` | `sessions`, `users` | Ignora sesiones caducadas y comercios archivados; un administrador archivado no existe como caso | D | E |
| BD-L17 | `signInDetailed` (lectura previa) | `users` | Búsqueda por usuario y por correo sin distinguir mayúsculas; comercio archivado excluido; no filtra si la cuenta existe | D | C |
| BD-L18 | Rendimiento de lecturas | todas | Plan de ejecución (`EXPLAIN`) de las consultas con filtro por `race_id`, `business_id`, `code`, `deleted_at`; sin recorridos completos con 1.200 bonos | S/D | L |

### A.2 Inventario de escrituras

| ID | Acción (origen) | Operación | Tablas | Bloqueo / transacción | Quién puede ejecutarla |
| --- | --- | --- | --- | --- | --- |
| W-01 | `updateBusinessRecord` (`store.ts:184`) | UPDATE | `businesses` | Sentencia única | Administrador |
| W-02 | `saveGeocodingCache` (`store.ts:201`) | UPSERT | `geocoding_cache` | Sentencia única, `ON CONFLICT DO UPDATE` | Administrador (geocodificación) |
| W-03 | `saveRaceConfiguration` (`store.ts:344`) | SELECT bloqueo + UPDATE | `races` (lee `coupons`) | Transacción, `FOR UPDATE` en la carrera | Administrador |
| W-04 | `issueMissingCoupons` (`store.ts:356`) | INSERT masivo | `coupons` (lee `races`, `businesses`) | Transacción, `FOR UPDATE` en la carrera, `ON CONFLICT DO NOTHING` con hasta 8 reintentos | Administrador |
| W-05 | `deleteRaceCoupons` (`store.ts:401`) | UPDATE (borrado lógico) + INSERT | `coupons`, `audit_events` | Transacción, `FOR UPDATE` en la carrera | Superusuario |
| W-06 | `redeemCoupon` (`store.ts:423`) | UPDATE + INSERT | `coupons`, `redemptions` (lee `businesses`) | Transacción, `FOR UPDATE OF c` en el bono, `FOR SHARE` en el comercio | Comercio dueño del bono |
| W-07 | `createFirstAdmin` (`auth.ts:94`) | INSERT | `users` | Transacción, `FOR UPDATE` sobre administradores | Solo si no existe ninguno |
| W-08 | Fallo de inicio de sesión (`auth.ts:125`) | UPDATE | `users` (`failed_attempts`, `locked_until`) | Sentencia única | Cualquiera (efecto automático) |
| W-09 | Inicio de sesión correcto (`auth.ts:138`) | UPDATE + INSERT + DELETE | `users`, `sessions`, `login_events` | Transacción | Cualquiera con credenciales |
| W-10 | `signOut` (`auth.ts:195`) | UPDATE + DELETE | `login_events`, `sessions` | Dos sentencias **sin** transacción | Usuario con sesión |
| W-11 | `createAdminAccount` (`auth.ts:233`) | INSERT | `users` | Sentencia única | Superusuario |
| W-12 | `resetAdminPassword` (`auth.ts:248`) | UPDATE + DELETE | `users`, `sessions` | Transacción, `FOR UPDATE` en el destino | Superusuario |
| W-13 | `completeAdminPasswordSetup` (`auth.ts:265`) | UPDATE + DELETE | `users`, `sessions` | Transacción | Administrador con cambio pendiente |
| W-14 | `changeAdminPassword` (`auth.ts:280`) | UPDATE + DELETE | `users`, `sessions` | Transacción | Administrador |
| W-15 | `syncMerchantUsername` (`auth.ts:308`) | UPDATE + DELETE | `users`, `sessions` | Transacción | Administrador (al renombrar comercio) |
| W-16 | `createBusinessWithMerchant` (`auth.ts:324`) | INSERT ×2 | `businesses`, `users` | Transacción | Administrador |
| W-17 | `deleteBusinessAndAccess` (`auth.ts:337`) | DELETE + UPDATE ×2 + INSERT | `sessions`, `users`, `businesses`, `audit_events` | Transacción, `FOR UPDATE` en el comercio | Administrador |
| W-18 | `restoreBusinessWithAccess` (`auth.ts:359`) | UPDATE ×2 / INSERT | `businesses`, `users` | Transacción, `FOR UPDATE` | Administrador |
| W-19 | `provisionMerchant` (`auth.ts:383`) | UPDATE / INSERT + DELETE | `users`, `sessions` | Transacción, `FOR UPDATE` | Administrador |
| W-20 | `consume_request_limit` (función SQL) | UPSERT | `request_limits` | Función `SECURITY DEFINER`, valida ámbito, máximo (1–1000) y ventana (1–3600 s) | Servidor (rol de servicio) |
| W-21 | `consume_coupon_lookup` (función SQL) | UPSERT | `public_lookup_limits` | Función `SECURITY DEFINER` | **Sin uso en el código actual** (herencia) |
| W-22 | Importador `import-local-data-to-supabase.mjs` | INSERT masivo | varias | Script manual con confirmación para producción | Solo a mano |
| W-23 | Migraciones SQL (`supabase/migrations`) | DDL + datos | varias | Manual / CLI | Solo a mano |

### A.3 Pruebas por acción de escritura

En todas se aplican además las diez comprobaciones de A.0. Aquí se listan las **pruebas específicas** de cada acción.

#### W-01 Editar comercio

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W01-01 | Editar nombre, teléfono, dirección, horario y descripción | Cambian solo esas columnas de ese comercio; `updated_at` avanza | D | E |
| BD-W01-02 | Categoría inexistente | Error controlado (clave foránea), sin cambios | D | E |
| BD-W01-03 | Municipio no permitido ("Madrid", "Frontera" sin "La") | Error controlado (restricción), sin cambios | D | E |
| BD-W01-04 | Latitud/longitud fuera de la isla (rango 27,59–27,86 / −18,26 a −17,82) | Error controlado, sin cambios | D | E |
| BD-W01-05 | Campos vacíos, solo espacios, 10 KB y 1 MB | Validación o rechazo, sin error 500 | D | E |
| BD-W01-06 | `\u0000`, emoji, escritura derecha-izquierda, HTML y SQL en texto | Se guarda como texto o se rechaza con claridad | D | E |
| BD-W01-07 | Id inexistente | Mensaje claro (hoy puede ser un UPDATE de 0 filas silencioso: comprobar) | D | E |
| BD-W01-08 | Dos ediciones simultáneas del mismo comercio | Gana la última completa; no se mezclan columnas de las dos | D | E |
| BD-W01-09 | Editar mientras se emiten bonos de una carrera | Sin bloqueos ni errores | D | E |
| BD-W01-10 | Intentar cambiar `active` o `id` por esta vía | No permitido | D | E |
| BD-W01-11 | Comercio con bonos emitidos: cambiar nombre | Bonos y canjes siguen vinculados (clave `ON UPDATE CASCADE` no afecta) | D | E |
| BD-W01-12 | Permisos: visitante y comercio | Rechazado | A | C |

#### W-02 Caché de geocodificación

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W02-01 | Guardar clave nueva | Fila creada | D | E |
| BD-W02-02 | Guardar la misma clave con otro valor | Se actualiza `lat`, `lng` y `updated_at` | D | E |
| BD-W02-03 | Dos guardados simultáneos de la misma clave | Una fila, sin error | D | E |
| BD-W02-04 | Coordenadas fuera de la isla | Rechazo controlado; la geocodificación del formulario no se rompe | D | E |
| BD-W02-05 | Clave muy larga o con caracteres raros | Se guarda o se rechaza con claridad | D | E |
| BD-W02-06 | Caché obsoleta | Definir si caduca; hoy no tiene fecha de caducidad | S | L |

#### W-03 Guardar configuración de carrera

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W03-01 | Guardar valores válidos | Cambian exactamente cantidad, fecha de carrera, inicio y vigencia | D | E |
| BD-W03-02 | Guardar los mismos valores | Sin cambios (idempotente) | D | E |
| BD-W03-03 | Saltarse la validación de la app y escribir cantidad 0 o 10.001 directamente | La base lo rechaza (restricción) | D | E |
| BD-W03-04 | Idem con vigencia 0 o 366 | La base lo rechaza | D | E |
| BD-W03-05 | Cantidad menor que los bonos emitidos | Rechazo con mensaje claro | D | E |
| BD-W03-06 | Carrera inexistente | "Carrera no reconocida." | D | E |
| BD-W03-07 | Guardar mientras otro proceso emite bonos | Se serializan por el bloqueo; sin cantidad incoherente | D | E |
| BD-W03-08 | Guardar mientras otro proceso canjea | Canje y guardado consistentes (el canje usa las fechas ya confirmadas) | D | E |
| BD-W03-09 | Cambiar el inicio con bonos ya parcialmente gastados | Estados recalculados; ningún dato perdido | D | E |
| BD-W03-10 | Dejar rastro | **Hoy no se registra en `audit_events`**: decidir si debe registrarse quién cambió fechas y vigencia | S | L |
| BD-W03-11 | Permisos | Solo administradores | A | C |
| BD-W03-12 | Columna `race_date` presente en la base | Sí (migración aplicada) | S | L |

#### W-04 Emitir bonos

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W04-01 | Emitir 5, 600 y 1.200 | Exactamente la cantidad prevista | D | E |
| BD-W04-02 | **Atomicidad**: fallo inyectado en el bono 3 de 5 | Ningún bono queda creado (rollback total) | D | E |
| BD-W04-03 | Fallo inyectado en el último bono | Ningún bono queda creado | D | E |
| BD-W04-04 | Cierre brusco de la conexión a mitad del lote | Ningún bono parcial | D | E |
| BD-W04-05 | Dos emisiones simultáneas | Una espera a la otra; total final = cantidad, sin duplicados | D | E |
| BD-W04-06 | Emisión + guardado de configuración a la vez | Se serializan correctamente | D | E |
| BD-W04-07 | Emisión + borrado de bonos a la vez | Resultado coherente (o todo borrado o todo emitido) | D | E |
| BD-W04-08 | Emisión + alta/baja de comercios a la vez | Todo bono apunta a un comercio activo en el momento de emitirse | D | E |
| BD-W04-09 | Duración de la transacción con 1.200 bonos | Dentro de `statement_timeout` (2 min) y sin mantener bloqueos demasiado tiempo | D | E |
| BD-W04-10 | Tamaño del lote en un solo `INSERT` por bono (1.200 viajes a la base) | Medir latencia total; proponer inserción por bloques si es lenta | D | E |
| BD-W04-11 | `ON CONFLICT (code) DO NOTHING`: forzar colisión | Se reintenta con código nuevo; tras 8 intentos, error claro | D | E |
| BD-W04-12 | Formato de código y restricción de la base | Todos cumplen `coupons_code_check` | D | E |
| BD-W04-13 | Solo comercios activos reciben bonos | Verificado | D | E |
| BD-W04-14 | Equilibrio entre comercios | Diferencia máxima entre comercios ≤ 1 | D | E |
| BD-W04-15 | Permisos | Visitante y comercio rechazados | A | C |

#### W-05 Borrar bonos de una carrera (borrado lógico)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W05-01 | Borrar una carrera con bonos | Todos con `deleted_at` y `deleted_by`; nada se elimina físicamente | D | E |
| BD-W05-02 | Rastro en `audit_events` | Una fila con acción `delete_coupons` y los recuentos correctos | D | E |
| BD-W05-03 | Los canjes de esos bonos | Permanecen en la base; se comprueba qué listados los siguen mostrando | D | E |
| BD-W05-04 | **SOSPECHA DE FALLO — canjear un bono borrado** | `redeemCoupon` consulta el bono **sin filtrar `deleted_at`** (en Postgres y en SQLite). Probar: borrar la carrera y canjear uno de sus códigos. Esperado: rechazo "Bono no encontrado". Si se permite el canje, es un fallo a corregir | D/A | E |
| BD-W05-05 | Consultar un bono borrado desde la web | "No encontrado" (la consulta pública sí filtra) | D/N | E |
| BD-W05-06 | Reemitir tras borrar | Los nuevos bonos no se confunden con los borrados; los contadores ignoran los borrados | D | E |
| BD-W05-07 | Borrar dos veces seguidas | La segunda da "todavía no tiene bonos emitidos" | D | E |
| BD-W05-08 | Atomicidad: fallo tras el UPDATE y antes de la auditoría | Ni borrado ni auditoría (rollback conjunto) | D | E |
| BD-W05-09 | Borrar mientras se canjea (concurrencia) | O gana el canje (y queda registrado) o gana el borrado (y el canje falla), sin estado intermedio | D | E |
| BD-W05-10 | Borrar mientras se emite | Se serializan por el bloqueo de la carrera | D | E |
| BD-W05-11 | Exportaciones y estadísticas | No cuentan bonos borrados salvo en la auditoría | A/N | C |
| BD-W05-12 | Permisos | Solo superusuario | A | C |
| BD-W05-13 | Recuperación | No existe función de restaurar bonos borrados: definir si hace falta | S | L |

#### W-06 Canjear (ya detallado en la sección 3; aquí, solo el ángulo de base de datos)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W06-01 | Orden de bloqueos: bono (`FOR UPDATE OF c`) y luego comercio (`FOR SHARE`) | Sin posibilidad de interbloqueo con borrado/archivo de comercio (que bloquea comercio y luego usuarios) | D | E |
| BD-W06-02 | Canje + archivar el comercio a la vez | O se completa antes del archivo o falla con "no está activo" | D | E |
| BD-W06-03 | Atomicidad: fallo tras `UPDATE coupons` y antes de `INSERT redemptions` | El saldo no cambia | D | E |
| BD-W06-04 | Clave de idempotencia repetida **en bonos distintos** a la vez | Uno gana; el otro recibe error controlado (el índice único `(business_id, idempotency_key)` lo impide). Comprobar que el mensaje no es el genérico 503 | D | E |
| BD-W06-05 | La restricción `used_cents <= amount_cents` como última defensa | Un `UPDATE` directo que la viole es rechazado | D | E |
| BD-W06-06 | Reloj: `created_at` se escribe con la hora de la aplicación (`now`), no la de la base | Medir desfase; decidir si usar `now()` de la base | D | E |
| BD-W06-07 | Mismo importe y misma hora en dos canjes | Ambos se registran con ids distintos | D | E |
| BD-W06-08 | Volumen: 5.000 canjes en un bono de prueba imposible (máx. 30 € / 0,01 €) | Máximo 3.000 movimientos por bono; comprobar rendimiento del historial | D | E |
| BD-W06-09 | Canje con comercio inexistente | Error controlado | D | E |
| BD-W06-10 | Canje de bono de otra carrera cuya configuración cambia durante la transacción | Usa las fechas bloqueadas o confirmadas | D | E |

#### W-07 Crear el primer administrador

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W07-01 | Crear con base sin administradores (copia local) | Se crea como superusuario | D | C |
| BD-W07-02 | Crear teniendo ya uno | Rechazo; no se crea otro | D | E |
| BD-W07-03 | Dos peticiones simultáneas de creación | Solo se crea uno (bloqueo `FOR UPDATE` sobre administradores) | D | C |
| BD-W07-04 | Contraseña < 12 o > 200 caracteres | Rechazo | D | C |
| BD-W07-05 | Usuario duplicado en mayúsculas/minúsculas | Rechazo (índice único en minúsculas) | D | C |
| BD-W07-06 | `/admin/setup` accesible solo cuando no hay administradores | Redirige si ya hay uno | N | L |

#### W-08 / W-09 / W-10 Inicio y cierre de sesión

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W08-01 | 4 contraseñas incorrectas seguidas | `failed_attempts` = 4, sin bloqueo | D | C |
| BD-W08-02 | 5.ª contraseña incorrecta | Cuenta bloqueada 15 minutos (`locked_until`), contador a 0 | D | C |
| BD-W08-03 | Contraseña correcta estando bloqueada | Sigue bloqueada ("locked") | D | C |
| BD-W08-04 | Pasados los 15 minutos | Entra y se reinicia el contador | D | C |
| BD-W08-05 | Un acierto entre fallos | Reinicia `failed_attempts` | D | C |
| BD-W08-06 | 20 fallos simultáneos sobre la misma cuenta | El contador no se desborda ni salta valores; el bloqueo se aplica una sola vez | D | C |
| BD-W08-07 | Fallos sobre usuario inexistente | Sin escritura en la base | D | C |
| BD-W08-08 | Un atacante puede bloquear a un usuario legítimo (denegación de servicio por bloqueo) | Documentar el riesgo; el límite por IP lo mitiga solo parcialmente | S | L |
| BD-W09-01 | Inicio correcto | Crea sesión (12 h), reinicia contador, registra `login_events` | D | C |
| BD-W09-02 | Inicio con cookie anterior | Cierra la sesión anterior (borra `sessions` y marca `signed_out_at`) | D | C |
| BD-W09-03 | Atomicidad: fallo tras crear sesión y antes del evento | Ni sesión ni evento | D | C |
| BD-W09-04 | Dos inicios simultáneos del mismo usuario | Dos sesiones válidas sin colisión de `token_hash` | D | C |
| BD-W09-05 | Token de sesión | Solo se guarda su hash; el token en claro no está en la base | S | L |
| BD-W09-06 | Colisión de hash de sesión | Imposible en la práctica; comprobar que la clave primaria la rechazaría | D | C |
| BD-W10-01 | Cerrar sesión | Elimina la sesión y marca `signed_out_at` | D | C |
| BD-W10-02 | Cierre con el token ya inexistente | Sin error | D | C |
| BD-W10-03 | **Sin transacción**: fallo entre las dos sentencias | Puede quedar la sesión borrada pero el evento sin cerrar, o al revés; evaluar y proponer transacción | D | C |
| BD-W10-04 | Cierre simultáneo desde dos pestañas | Sin error | D | C |

#### W-11 a W-14 Cuentas de administrador y contraseñas

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W11-01 | Alta con nombre/apellidos/correo válidos | Cuenta creada con cambio de contraseña obligatorio | D | C |
| BD-W11-02 | Nombre < 2 o > 80, apellidos < 2 o > 100, correo > 254 o sin formato | Rechazo con mensaje específico | D | C |
| BD-W11-03 | Correo repetido (mayúsculas distintas) | Rechazo con mensaje genérico sin filtrar el índice | D | C |
| BD-W11-04 | Dos altas simultáneas con el mismo correo | Una gana; la otra recibe error controlado | D | C |
| BD-W11-05 | La contraseña temporal | Aparece una sola vez al crear y no se guarda en claro | S | C |
| BD-W12-01 | Restablecer contraseña de un administrador | Hash nuevo, cambio obligatorio, contador a 0, **todas sus sesiones borradas** | D | C |
| BD-W12-02 | Restablecer la propia | Rechazado | D | C |
| BD-W12-03 | Restablecer al superusuario | Rechazado | D | C |
| BD-W12-04 | Restablecer a un comercio por esta vía | Rechazado (solo `role = admin`) | D | C |
| BD-W12-05 | Atomicidad: fallo tras UPDATE y antes de borrar sesiones | Ni contraseña nueva ni sesiones borradas | D | C |
| BD-W12-06 | Restablecimiento mientras el destino inicia sesión | Sin sesión viva con la clave antigua después | D | C |
| BD-W13-01 | Completar cambio de contraseña obligatorio | Hash nuevo, `must_change_password = false`, **otras sesiones borradas** (la actual se conserva) | D | C |
| BD-W13-02 | Usuario sin cambio pendiente | Rechazado | D | C |
| BD-W14-01 | Cambiar contraseña con la actual correcta | Cambia y cierra las demás sesiones | D | C |
| BD-W14-02 | Con la actual incorrecta | Rechazado; no cuenta mal el límite de cuenta | D | C |
| BD-W14-03 | Nueva contraseña igual a la actual | Definir comportamiento | D | C |

#### W-15 a W-19 Comercios y sus cuentas

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W16-01 | Crear comercio + cuenta | Ambos o ninguno (transacción) | D | E |
| BD-W16-02 | Fallo tras crear el comercio y antes de la cuenta | No queda comercio huérfano | D | E |
| BD-W16-03 | Nombre repetido o con símbolos | Id y usuario únicos | D | E |
| BD-W16-04 | Dos altas simultáneas con el mismo nombre | Una gana o ambas con ids distintos; sin error 500 | D | E |
| BD-W16-05 | Restricción "un comercio, una cuenta" (`users.business_id` único) | No se puede crear una segunda cuenta | D | E |
| BD-W16-06 | Restricción de rol (`users_business_role_check`) | Un administrador con comercio o un comercio sin comercio es imposible | D | E |
| BD-W15-01 | Renombrar comercio | El usuario se actualiza y **se cierran sus sesiones** | D | E |
| BD-W15-02 | Nombre que genera un usuario ya existente | Sufijo único, sin colisión | D | E |
| BD-W17-01 | Eliminar comercio | Sesiones borradas, cuenta archivada (`archived_at`, `archived_by`), comercio `active = false`, auditoría creada | D | E |
| BD-W17-02 | Eliminar comercio con bonos asignados | Los bonos y canjes se conservan (las claves foráneas impiden el borrado físico) | D | E |
| BD-W17-03 | Eliminar dos veces | Idempotente o error claro | D | E |
| BD-W17-04 | Atomicidad: fallo a mitad | Todo o nada | D | E |
| BD-W17-05 | Eliminar mientras ese comercio canjea | Canje completo antes o rechazado después; sin estado mixto | D | E |
| BD-W17-06 | Bonos asignados a un comercio eliminado | Definir qué pasa con ellos (no se reasignan hoy): ¿se pueden gastar en otro sitio? | S | L |
| BD-W18-01 | Restaurar comercio | `active = true`, cuenta restaurada con **credenciales nuevas**, sin sesiones antiguas | D | E |
| BD-W18-02 | Restaurar uno no eliminado | Rechazo o idempotente | D | E |
| BD-W18-03 | Restaurar dos veces a la vez | Una sola cuenta, sin duplicados | D | E |
| BD-W19-01 | Generar credenciales nuevas del comercio | Cambia usuario y hash, borra sesiones, reinicia bloqueo | D | E |
| BD-W19-02 | Sobre un comercio sin cuenta | La crea | D | E |
| BD-W19-03 | Dos peticiones simultáneas | Credenciales finales consistentes (la última prevalece) | D | E |

#### W-20 / W-21 Límites de frecuencia (funciones SQL)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-W20-01 | Hasta el máximo permitido | `allowed = true` | D | E |
| BD-W20-02 | Una por encima | `allowed = false` con `retry_after_seconds` > 0 | D | E |
| BD-W20-03 | Tras agotarse la ventana | Vuelve a permitir y reinicia contador | D | E |
| BD-W20-04 | Ámbito no permitido, máximo 0 o 1.001, ventana 0 o 3.601, identificador no hexadecimal de 64 | Excepción "Invalid rate limit parameters" | D | E |
| BD-W20-05 | 100 llamadas simultáneas con la misma clave | Contador exacto, sin pérdidas | D | E |
| BD-W20-06 | Ámbitos independientes (`login-ip`, `login-account`, `coupon-public`, `coupon-user`, `redeem-user`) | No se pisan | D | E |
| BD-W20-07 | Rol anónimo y autenticado | **Sin permiso de ejecución** (comprobado en lectura; repetir llamando por la API REST de Supabase) | S/A | L |
| BD-W20-08 | Identificadores = HMAC con clave del servidor | No se pueden calcular desde fuera | S | L |
| BD-W20-09 | Crecimiento de la tabla | Hoy no hay purga: 6 de 17 filas tienen más de un día | S | L |
| BD-W21-01 | `consume_coupon_lookup` y `public_lookup_limits` no se usan en el código | Confirmar y decidir si se eliminan (superficie innecesaria) | S | L |

### A.4 Pruebas directas contra la base (saltándose la aplicación)

Verifican que la **propia base** defiende los datos aunque la aplicación falle. Se hacen en una transacción que se revierte (`BEGIN … ROLLBACK`) o con filas de prueba.

| ID | Intento | Resultado esperado | Riesgo |
| --- | --- | --- | --- |
| BD-K01 | Insertar un bono con código mal formado | Rechazado (`coupons_code_check`) | E |
| BD-K02 | Insertar un bono con código que usa 0, 1, I, L u O | Rechazado | E |
| BD-K03 | Insertar un bono con prefijo distinto de BES/BIM/MER | Rechazado | E |
| BD-K04 | Insertar un bono con `amount_cents` 0 o negativo | Rechazado | E |
| BD-K05 | Actualizar `used_cents` por encima de `amount_cents` o por debajo de 0 | Rechazado | E |
| BD-K06 | Insertar un bono con carrera o comercio inexistentes | Rechazado (clave foránea) | E |
| BD-K07 | Insertar un bono con un código repetido | Rechazado (clave primaria) | E |
| BD-K08 | Insertar un canje con importe 0 o negativo | Rechazado | E |
| BD-K09 | Insertar un canje con `balance_after_cents` negativo | Rechazado | E |
| BD-K10 | Insertar un canje con bono o comercio inexistentes | Rechazado | E |
| BD-K11 | Insertar dos canjes con el mismo `(business_id, idempotency_key)` | Rechazado (índice único) | E |
| BD-K12 | Insertar dos canjes con `idempotency_key` nula | Permitido (índice parcial) | E |
| BD-K13 | Clave de idempotencia con formato no `uuid` | Rechazado por el tipo | E |
| BD-K14 | Comercio con municipio fuera de la lista | Rechazado | E |
| BD-K15 | Comercio con latitud o longitud fuera de rango | Rechazado | E |
| BD-K16 | Comercio con categoría inexistente | Rechazado | E |
| BD-K17 | Renombrar una categoría | Se propaga a los comercios (`ON UPDATE CASCADE`) | E |
| BD-K18 | Borrar una categoría con comercios | Rechazado (`RESTRICT`) | E |
| BD-K19 | Carrera con cantidad 0 o 10.001, vigencia 0 o 366, color mal formado | Rechazado | E |
| BD-K20 | Borrar una carrera con bonos | Rechazado | E |
| BD-K21 | Borrar un comercio con bonos, canjes o cuenta | Rechazado | E |
| BD-K22 | Borrar un bono con canjes | Rechazado | E |
| BD-K23 | Usuario "comercio" sin `business_id`, o "administrador" con `business_id` | Rechazado (`users_business_role_check`) | E |
| BD-K24 | Dos cuentas para el mismo comercio | Rechazado (`users_business_id_key`) | E |
| BD-K25 | Usuario duplicado distinguiendo solo mayúsculas | Rechazado (índice en minúsculas) | E |
| BD-K26 | Correo duplicado distinguiendo solo mayúsculas | Rechazado; dos correos nulos permitidos | E |
| BD-K27 | Rol distinto de `admin`/`merchant` | Rechazado | E |
| BD-K28 | `failed_attempts` negativo | Rechazado | E |
| BD-K29 | Borrar un usuario con sesiones | Sesiones borradas en cascada | E |
| BD-K30 | Borrar un usuario con `login_events`/`audit_events`/bonos borrados por él | Referencias a `NULL` (conserva el historial) | E |
| BD-K31 | `login_events.session_token_hash` duplicado | Rechazado | E |
| BD-K32 | `geocoding_cache` con coordenadas fuera de la isla | Rechazado | E |
| BD-K33 | Contador de límites negativo | Rechazado | E |
| BD-K34 | Columnas obligatorias nulas en cada tabla (`NOT NULL`) | Rechazado | E |
| BD-K35 | Texto de longitud extrema en columnas `text` | Aceptado o rechazado de forma predecible (no hay límites de longitud en la base) | E |
| BD-K36 | Ausencia de disparadores | La integridad `used_cents = suma(canjes)` **no** está protegida por la base, solo por el código | S |

### A.5 Concurrencia y bloqueos entre instancias

La aplicación se ejecutará en varias instancias a la vez (Vercel). Cada instancia usa **una** conexión, pero entre instancias sí compiten.

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-X01 | Dos clientes distintos (dos conexiones reales) canjean el mismo bono con la misma clave | Un cobro | D | E |
| BD-X02 | 30 conexiones canjeando bonos distintos | Todas terminan; sin errores de conexiones | D | E |
| BD-X03 | Mapa de bloqueos: carrera (`FOR UPDATE`), bono (`FOR UPDATE OF c`), comercio (`FOR SHARE`/`FOR UPDATE`), usuarios | Orden consistente; detectar posibles interbloqueos (comercio→usuarios frente a bono→comercio) | S/D | E |
| BD-X04 | Forzar un interbloqueo | Postgres cancela una transacción y la app devuelve error controlado y reintentable | D | E |
| BD-X05 | Transacción larga bloqueando la carrera (emisión de 1.200) mientras entran canjes de otra carrera | Los canjes no se ven afectados | D | E |
| BD-X06 | Canje durante una emisión de la **misma** carrera | El canje no espera a la emisión (bloqueos sobre filas distintas) | D | E |
| BD-X07 | Esperas de bloqueo | No hay `lock_timeout` configurado: medir cuánto espera un canje bloqueado y decidir un tope | D | E |
| BD-X08 | `idle_in_transaction_session_timeout` = 0 | Una instancia caída con transacción abierta mantiene bloqueos: probar y proponer un tope | D | E |
| BD-X09 | Cola interna (`serializePostgres`): una consulta lenta retrasa todas las demás de esa instancia | Medir el efecto con una consulta de 5 s | D | E |
| BD-X10 | Cola interna: una consulta que falla no bloquea las siguientes | Cubierto por tests; repetir con la base real | U/D | L |
| BD-X11 | Aislamiento por defecto (READ COMMITTED) | Confirmar que los `SELECT … FOR UPDATE` protegen las lecturas-escrituras críticas (saldo, emisión) | D | E |
| BD-X12 | Lectura no repetible en `issueMissingCoupons`: alta de comercio entre la lectura de comercios y los inserts | Documentar el efecto (reparto ligeramente distinto, nunca datos corruptos) | D | E |
| BD-X13 | Conexiones: 60 máximas en la base, una por instancia | Simular 80 instancias y ver qué ocurre; confirmar que se usa el *pooler* en modo transacción | D | E |
| BD-X14 | Carga mixta durante 60 s (lecturas, canjes, inicios de sesión) | Sin errores 5xx, sin bloqueos prolongados | D | E |

### A.6 Fallos de infraestructura

| ID | Escenario | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-F01 | Base inalcanzable al arrancar (URL errónea, DNS caído) | La web muestra error controlado; sin detalles internos; se recupera sola al volver la base | D/N | E |
| BD-F02 | Contraseña de la base incorrecta | Error controlado, sin filtrar la cadena de conexión | D | E |
| BD-F03 | Conexión cortada a mitad de una transacción (`pg_terminate_backend`) | Rollback, error 503 reintentable, saldo intacto | D | E |
| BD-F04 | Consulta más lenta que `connect_timeout` (10 s) / `statement_timeout` (2 min) | Error controlado, sin colgar la página | D | E |
| BD-F05 | Reinicio del *pooler* durante tráfico | El cliente se reconecta; no se pierde ni duplica ningún canje | D | E |
| BD-F06 | Certificado SSL no válido | Conexión rechazada (`ssl: require`) | D | E |
| BD-F07 | Disco lleno / cuota excedida (simulado con error de escritura) | Error controlado; lecturas siguen | S | L |
| BD-F08 | Base en modo solo lectura | Las escrituras fallan con mensaje claro; las lecturas funcionan | D | E |
| BD-F09 | Errores no previstos en el canje | El API responde 503 con el mensaje "Puedes reintentarla con seguridad" y el reintento con la misma clave **no duplica** | D/A | E |
| BD-F10 | Cola de compras pendientes del escáner tras caída de la base | Se reenvían al volver, sin duplicar | N | C |
| BD-F11 | Qué ve el usuario en cada página pública si la base falla | Mensaje controlado, no pantalla en blanco | N | E |
| BD-F12 | Registro de errores | Se registran en el servidor sin secretos ni datos personales | S | L |

### A.7 Mantenimiento y ciclo de vida de los datos

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-M01 | **Sesiones caducadas sin purgar**: hoy 7 de 7 filas están caducadas | Definir y probar una purga (al iniciar sesión o programada) | S/D | E |
| BD-M02 | Tablas de límites sin purga (`request_limits`: 6 de 17 filas con más de un día; `public_lookup_limits` heredada) | Purga o caducidad; probar con 100.000 filas | S/D | E |
| BD-M03 | Crecimiento de `login_events` y `audit_events` | Estimar volumen anual y definir retención | S | L |
| BD-M04 | Datos personales: correos de administradores, nombres de comercios, direcciones IP (si se guardan) | Qué se guarda, durante cuánto y cómo se borra (RGPD) | S | L |
| BD-M05 | Copias de seguridad | Existen, con qué frecuencia y retención | S | L |
| BD-M06 | **Restauración**: restaurar una copia en un proyecto/rama temporal y comprobar que la web arranca | La copia es válida | M | C |
| BD-M07 | Guion de borrado total de datos de prueba antes de la entrega (bonos, canjes, sesiones, eventos, límites), conservando configuración y comercios reales | Guion probado en una copia | D | C |
| BD-M08 | Reinicio de contadores y secuencias (`redemptions.id`, `audit_events.id`) tras el borrado | Definir si se reinician | S | L |
| BD-M09 | Importador `import-local-data-to-supabase.mjs`: ejecutarlo **sin** las variables de confirmación | Se niega a escribir en producción | D | E |
| BD-M10 | Importador: ejecutarlo contra una base vacía de pruebas | Importa sin duplicar; repetirlo no duplica | D | C |
| BD-M11 | Estadísticas y bloat (`VACUUM`, tamaño de tablas) | Sin crecimiento anómalo | S | L |
| BD-M12 | Zona horaria de los datos: `date` (carreras) frente a `timestamptz` (eventos) | Sin desfases en cambios de hora | D | L |

### A.8 Migraciones como acciones contra la base

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-G01 | Aplicar **todas** las migraciones en orden sobre una base vacía | Termina sin errores y el esquema final coincide con el de Supabase | D | C |
| BD-G02 | Aplicarlas por segunda vez | Idempotentes (no fallan ni duplican datos) | D | C |
| BD-G03 | Aplicarlas sin las dos migraciones legales | La web funciona igual (textos desde el código) | D | C |
| BD-G04 | Aplicarlas **con** las dos legales | Comprobar si el aviso legal de la base tapa el del código y en qué orden quedan las secciones | D | C |
| BD-G05 | Diferencias de esquema ("deriva") entre la carpeta de migraciones y la base real | Ninguna salvo las omitidas a propósito | S | L |
| BD-G06 | Columnas y tablas que el código usa frente a las que existen (extraer del código todas las columnas referenciadas) | Todas existen | S | L |
| BD-G07 | Historial de migraciones registrado en Supabase | 9 registradas; las 2 omitidas documentadas | S | L |
| BD-G08 | `supabase db push` con el estado actual | Informa de las dos legales sin aplicar; confirmar que no las aplica sin `--include-all` | M | C |
| BD-G09 | Plan de vuelta atrás de cada migración | Existe un guion inverso o copia previa | S | L |
| BD-G10 | Tiempo de bloqueo de cada migración con 400 y con 10.000 bonos | Sin bloqueos largos | D | C |
| BD-G11 | Migración `add_race_dates` sobre filas existentes | Rellena fechas sin tocar las ya existentes | D | E |
| BD-G12 | Disparador de seguridad `ensure_rls`: crear una tabla de prueba | Se activa RLS automáticamente | D | E |

### A.9 Seguridad de la base de datos

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| BD-S01 | RLS activado en las 14 tablas y **sin políticas** | Cierto (comprobado en lectura): el acceso por la API REST pública queda cerrado | S | L |
| BD-S02 | Llamar a la API REST de Supabase con la clave pública sobre cada tabla (`select`, `insert`, `update`, `delete`) | Todas rechazadas | A | L |
| BD-S03 | Llamar a las funciones RPC `consume_request_limit` y `consume_coupon_lookup` con la clave pública | Rechazadas (comprobado: `anon` sin permiso de ejecución) | A | L |
| BD-S04 | Funciones `SECURITY DEFINER` con `search_path` vacío | Correcto; revisar que no se pueda forzar nombres | S | L |
| BD-S05 | Rol usado por la aplicación | Es el rol de servicio del *pooler* con privilegios amplios: valorar un rol propio con permisos mínimos (solo las tablas y funciones necesarias) | S | L |
| BD-S06 | Inyección SQL: lanzar cargas conocidas (`' OR 1=1 --`, `;SELECT pg_sleep(10)`, `%00`, comillas dobles, Unicode) por **cada** parámetro de cada función de las secciones A.1–A.3 | Ninguna tiene efecto; todo viaja parametrizado | D/A | E |
| BD-S07 | Búsqueda en el código de `sql.unsafe`, concatenaciones de texto en consultas y plantillas sin parametrizar | Ninguna | S | L |
| BD-S08 | Contraseñas: solo hashes `scrypt` con sal; ningún texto en claro en la base ni en los registros | Cierto | S | L |
| BD-S09 | Tokens de sesión y claves de límites: solo hashes | Cierto | S | L |
| BD-S10 | Rotación de la contraseña de la base | Procedimiento documentado: cambiar en Supabase, Vercel (Production y Preview) y `.data/` local | M | C |
| BD-S11 | Registros del servidor y `pg_stat_statements` | No guardan contraseñas ni datos personales | S | L |
| BD-S12 | Preview y Production comparten la misma base | Confirmar; definir si debe separarse para que una rama de pruebas no escriba en datos reales | S | L |
| BD-S13 | Exposición de `.data/` | Ignorado por Git y no servible por la web | S/A | L |
| BD-S14 | Datos de personas en la base | Correos de administradores y nombres: confirmar base legal y plazo de conservación | S | L |

### A.10 Auditoría de integridad (se ejecuta tras cada bloque de escritura y al final)

Consultas de solo lectura. Todas deben devolver **cero filas** salvo que se indique.

| ID | Comprobación | Consulta (descripción) |
| --- | --- | --- |
| BD-I01 | Saldo coherente | Bonos donde `used_cents` ≠ suma de `amount_cents` de sus canjes |
| BD-I02 | Rango de saldo | Bonos con `used_cents` < 0 o > `amount_cents` |
| BD-I03 | Saldo posterior coherente | Para cada bono, canjes ordenados: `balance_after` = `amount` − acumulado de canjes |
| BD-I04 | Canjes huérfanos | Canjes sin bono o sin comercio |
| BD-I05 | Bonos huérfanos | Bonos sin carrera o sin comercio |
| BD-I06 | Códigos duplicados o inválidos | Códigos repetidos (ignorando mayúsculas) o fuera del patrón |
| BD-I07 | Comercio del canje | Canjes cuyo `business_id` ≠ el del bono |
| BD-I08 | Canjes en bonos eliminados | Canjes posteriores a `deleted_at` del bono (debe ser cero tras corregir BD-W05-04) |
| BD-I09 | Canjes fuera de vigencia | Canjes cuya fecha (hora de Canarias) cae fuera de 00:01 del inicio a 23:59 del último día de su carrera |
| BD-I10 | Claves de idempotencia repetidas | Duplicados por `(business_id, idempotency_key)` |
| BD-I11 | Cuentas incoherentes | Comercios activos sin cuenta, cuentas de comercio archivadas con comercio activo, comercio inactivo con cuenta activa |
| BD-I12 | Sesiones huérfanas | Sesiones de usuarios inexistentes o de comercios archivados |
| BD-I13 | Sesiones caducadas | Recuento (informativo; hoy 7) |
| BD-I14 | Bloqueos antiguos | Usuarios con `locked_until` pasado y `failed_attempts` > 0 |
| BD-I15 | Superusuario único | Exactamente uno |
| BD-I16 | Eventos de acceso | `login_events` sin cierre con sesión ya borrada |
| BD-I17 | Auditoría | Cada borrado de bonos y cada baja de comercio tiene su `audit_events` |
| BD-I18 | Reparto | Por carrera, diferencia entre el comercio con más y con menos bonos ≤ 1 |
| BD-I19 | Recuentos | Bonos por carrera ≤ `coupon_quantity` |
| BD-I20 | Fechas de carrera | Todas las carreras con `race_date` no nulo |

---

## B. BLOQUE PRIORITARIO — Validaciones concurrentes y pérdida de cobertura

Este bloque responde a dos preguntas de negocio: **qué pasa si 10 comercios validan bonos casi en el mismo segundo** y **qué pasa si un móvil se queda sin cobertura** en mitad de una compra. Se ha elaborado leyendo el comportamiento real del código (`app/api/bonos/[code]/route.ts`, `lib/store.ts`, `components/Scanner.tsx`, `lib/redemption-outbox.ts`, `lib/request-limit.ts`).

### B.0 Cómo funciona hoy (base de las pruebas)

**Reglas del servidor**
- Cada bono pertenece a **un único comercio**. Diez comercios que validan a la vez canjean **bonos distintos**; solo hay disputa real cuando varios actores tocan **el mismo bono** (varios móviles del mismo comercio, o un cliente que enseña el mismo bono en varios sitios).
- Cada canje es una transacción que bloquea la fila del bono (`FOR UPDATE`), comprueba comercio, vigencia y saldo, descuenta el saldo y registra el movimiento. Dos canjes del mismo bono se ejecutan uno detrás de otro.
- La validez (vigencia 00:01–23:59) se evalúa con la **hora del servidor en el momento de recibir la petición**, no con la hora en que el cliente pagó.
- Cada compra lleva una clave de idempotencia (UUID) y la base impide repetirla para el mismo comercio.
- Límites: 120 canjes por minuto por cuenta de comercio; 60 consultas por minuto por cuenta.
- Cada instancia del servidor usa **una** conexión a la base con una cola interna.

**Reglas del móvil del comercio (escáner)**
- Primero **guarda la compra en el móvil** (IndexedDB) y después la envía. Si no hay red, la deja pendiente.
- Si la petición falla, o el servidor responde 429 o 5xx, la compra queda pendiente y se reintenta con espera creciente (2 s, 4 s… hasta 60 s; con 429 respeta `Retry-After`).
- Si el servidor responde 400 o 404 (por ejemplo "caducado" o "supera el saldo"), la compra se **elimina de la cola** y se muestra un aviso.
- Con 401/403 la compra se conserva hasta iniciar sesión de nuevo.
- Para **consultar** un bono sí hace falta conexión: sin red no se puede cargar un bono nuevo.
- El saldo que se muestra descuenta las compras pendientes del propio móvil.
- No hay *service worker* ni sincronización en segundo plano: la cola se envía cuando la página está abierta y vuelve el evento `online`, o al reabrirla.

### B.1 Método de ejecución

| Elemento | Detalle |
| --- | --- |
| Comercios de prueba | 15 comercios `ZZ-PRUEBA-01…15` con su cuenta; se emiten 600 bonos en Bimbache (repartidos entre todos los comercios activos) y se usan solo los de los comercios de prueba. |
| Arnés de concurrencia (H) | Script de Node que inicia sesión real con N cuentas y lanza N peticiones con una barrera de salida (todas arrancan en ±50 ms). Registra estado, tiempo y respuesta de cada una. |
| Varias instancias | Tres procesos de Next en puertos distintos contra la misma base, para simular instancias independientes (y, cuando exista despliegue, contra Vercel). |
| Red simulada (T) | En el navegador se intercepta `fetch` para **cortar, retrasar, devolver HTML, devolver 502/503/504, perder solo la respuesta o no responder nunca**, y se disparan los eventos `offline`/`online`. La cola es la IndexedDB real. |
| Dispositivo real (M) | Modo avión, túnel, 2G, cambio de wifi a datos y bloqueo de pantalla en un móvil de verdad. Lo hace una persona. |
| Verificación | Tras cada ejecución se auditan los invariantes de A.10 (saldos, duplicados, huérfanos) y se compara cada saldo con la suma de los importes aceptados. |

**Criterios de éxito generales:** cero pérdidas de actualización, cero cobros duplicados, ningún saldo negativo ni por encima de 30 €, ninguna compra aceptada sin movimiento registrado, ningún error 5xx sin causa, y tiempos de respuesta dentro de los umbrales de cada prueba.

### B.2 Varios comercios validando a la vez (bonos distintos)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| CV-01 | 10 comercios canjean 1 € cada uno, arrancando en el mismo instante | 10 canjes correctos, 10 movimientos, 10 saldos exactos; tiempo p95 < 2 s | H | E |
| CV-02 | 10 comercios × 10 canjes cada uno (100 en unos 2 s) | 100 correctos; suma por bono exacta | H | E |
| CV-03 | 15 comercios a la vez | Igual que CV-01 | H | E |
| CV-04 | 50 peticiones simultáneas (más comercios simulados reutilizando cuentas) | Sin 5xx; p95 < 5 s | H | E |
| CV-05 | 100 peticiones simultáneas | Las que superen límites reciben 429, ninguna se pierde ni se duplica | H | E |
| CV-06 | Ráfaga sostenida: 10 comercios, un canje cada 2 s, durante 5 minutos (unos 1.500 canjes) | Latencia estable, sin fuga de conexiones ni de memoria | H | E |
| CV-07 | Dos canjes con exactamente la misma marca de tiempo (misma milésima) | Ids distintos y orden estable en el historial | H | E |
| CV-08 | Orden de las marcas de tiempo frente al orden real de confirmación (la hora se toma en la aplicación, no en la base) | Por bono el saldo posterior es siempre coherente; documentar si dos instancias pueden mostrar un orden distinto | H | E |
| CV-09 | Historial de cada comercio tras la ráfaga | Solo sus movimientos, ordenados, sin faltas | H | E |
| CV-10 | Totales del panel de administración tras la ráfaga | Igual a la suma de movimientos | H/N | E |
| CV-11 | Exportaciones (administrador y comercio) tras la ráfaga | Coinciden con la base | H | E |
| CV-12 | 200 consultas públicas de bonos mientras 10 comercios canjean | Sin bloqueos; las consultas ven el saldo anterior o el posterior, nunca uno intermedio | H | E |
| CV-13 | Los 10 comercios inician sesión a la vez | Todos entran; la comprobación de contraseña (scrypt) no satura la instancia | H | E |
| CV-14 | Arranque en frío: primera petición tras inactividad, 10 simultáneas | Todas responden sin error de conexión | H | E |
| CV-15 | Canjes de 10 comercios mientras el administrador consulta paneles y exporta | Sin bloqueos cruzados | H | E |
| CV-16 | Canjes mientras se emiten bonos de **otra** carrera | Sin esperas | H | E |
| CV-17 | Canjes mientras se guarda la configuración de **otra** carrera | Sin esperas | H | E |

### B.3 Varios actores sobre el mismo bono

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| CV-20 | 10 comercios distintos intentan canjear el **mismo** bono a la vez | Solo puede el dueño; los otros 9 reciben "pertenece a otro comercio" y no se descuenta nada | H | E |
| CV-21 | El dueño con 3 móviles (3 sesiones de la misma cuenta) pide 12 € cada uno sobre un bono de 30 € | Exactamente 2 correctos (24 €); el tercero "supera el saldo"; saldo final 6 € | H | E |
| CV-22 | 2 móviles piden 15 € a la vez | Ambos correctos; saldo 0; un tercer intento de 0,01 € "no tiene saldo" | H | E |
| CV-23 | 2 móviles piden el mismo importe en el mismo segundo con claves distintas | Ambos se registran (son compras distintas). **Riesgo de doble cobro involuntario entre dispositivos**: anotar y decidir (sección 17) | H | E |
| CV-24 | Doble pulsación del botón en el mismo móvil | Un solo cobro (protección de envío en curso) | N/T | E |
| CV-25 | Dos pestañas del mismo móvil con el mismo bono y el mismo importe | Cada pestaña genera su propia clave: se registran dos compras; documentar | N/T | E |
| CV-26 | Bono con 0,01 € de saldo y 10 intentos simultáneos de 0,01 € | Solo uno | H | E |
| CV-27 | Bono de 30 € y 30 móviles pidiendo 1 € a la vez | Exactamente 30 correctos; saldo 0 | H | E |
| CV-28 | Consulta y canje simultáneos del mismo bono | La consulta devuelve el saldo previo o el posterior | H | E |
| CV-29 | Canje a la vez que el administrador borra los bonos de la carrera | Gana el canje (queda registrado) o gana el borrado (el canje falla); **ver sospecha BD-W05-04** | H | E |
| CV-30 | Canje a la vez que se desactiva o elimina el comercio | Completo antes o rechazado "no está activo" | H | E |
| CV-31 | Canje a la vez que se restablecen las credenciales del comercio o se cierra su sesión | La petición en vuelo se resuelve de forma coherente; la siguiente exige sesión | H | E |
| CV-32 | Canje a la vez que se cambian las fechas de vigencia de la carrera | Se aplican las fechas confirmadas; sin estados mezclados | H | E |
| CV-33 | Mismo bono, mismo importe, misma clave desde 5 móviles a la vez (reenvío simultáneo de la misma compra) | Un solo cobro; el resto recibe la confirmación de ese cobro | H | E |
| CV-34 | La misma clave sobre **dos bonos distintos** a la vez | Uno gana; el otro recibe error controlado (ver BD-W06-04) | H | E |

### B.4 Límites, reintentos y avalancha de peticiones

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| CV-40 | Un comercio vuelve a tener red con 150 compras pendientes | El servidor admite 120 por minuto; el resto recibe 429 con `Retry-After`; no se pierde ni se duplica ninguna | T/H | E |
| CV-41 | Tiempo total para vaciar 150 compras pendientes | Medido; aceptable para un cierre de caja | T/H | E |
| CV-42 | 10 comercios recuperan la red a la vez con 30 pendientes cada uno (avalancha) | La base y el servidor aguantan; todo se registra una vez | T/H | E |
| CV-43 | Reintentos sin aleatoriedad (2, 4, 8… 60 s): los 10 móviles reintentan al unísono tras un fallo común | Medir los picos; proponer variación aleatoria (*jitter*) si se concentran | T/H | E |
| CV-44 | Límite de consultas (60/min) con un escáner muy usado (cada compra = 1 consulta + 1 canje) | No bloquea una operativa normal de caja | H | E |
| CV-45 | Cookie caducada en mitad de la jornada: la consulta cae al límite público por IP (10 cada 15 min) | Mensaje claro; comprobar si varios comercios tras la misma IP móvil se bloquean entre sí | H | E |
| CV-46 | Respuesta 429 en una compra recién hecha | Queda pendiente y se reenvía sola | T | E |
| CV-47 | Canjes durante el cambio de ventana del límite (justo al cumplirse el minuto) | Contador exacto sin saltos | H | E |

### B.5 Infraestructura al ejecutar en paralelo

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| CV-50 | Tres instancias de Next contra la misma base, 10 comercios repartidos entre ellas | Mismos resultados que CV-01 | H | E |
| CV-51 | Cola interna de una instancia: 10 peticiones llegan a la misma instancia | Se encolan; medir la latencia acumulada de la décima (cada canje ocupa la conexión) | H | E |
| CV-52 | Una consulta lenta (5 s) en la cola retrasa los canjes de esa instancia | Medir y documentar | H | E |
| CV-53 | Error del *pooler* por exceso de clientes | 503 reintentable; el móvil lo deja pendiente | H/T | E |
| CV-54 | Tiempo máximo de la función del servidor con bloqueo largo | La petición termina con error controlado; el móvil reintenta con la misma clave sin duplicar | H/T | E |
| CV-55 | Desfase de reloj entre instancias (±5 s) alrededor de las 00:01 y las 23:59 | Documentar qué ocurre con canjes simultáneos en el límite | H | E |
| CV-56 | Latencia real desde Canarias a la región de Dublín en 4G y 3G | RTT típico; efecto sobre el tiempo de confirmación | M | L |
| CV-57 | Despliegue real en Vercel con 10 comercios (cuando exista) | Mismos resultados que CV-01 | H | C |

### B.6 Pérdida de cobertura en cada punto del flujo

Cada prueba verifica: **qué ve la persona**, **qué queda guardado**, **qué hace el servidor** y **qué pasa al volver la red**.

| ID | Momento en que se pierde la señal | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| OF-01 | Antes de escanear o escribir el código | La consulta falla con un mensaje claro; no se puede cargar un bono nuevo (limitación actual: decidir si debe permitirse algo) | T/M | C |
| OF-02 | Con el bono ya cargado y antes de escribir el importe | Al confirmar queda como compra pendiente; el saldo en pantalla descuenta lo pendiente | T | C |
| OF-03 | Mientras se envía y la petición no llega al servidor | La compra queda pendiente y se reintenta con espera creciente | T | C |
| OF-04 | **El servidor confirma la compra pero la respuesta se pierde** | El móvil reintenta con la misma clave; el servidor no duplica; el saldo final es correcto y la pantalla acaba mostrando éxito | T | C |
| OF-05 | La petición nunca recibe respuesta (sin cortar la conexión) | Hoy no hay límite de espera: comprobar cuánto tiempo queda la pantalla ocupada; al recargar la compra pendiente se reenvía con la misma clave sin duplicar | T | C |
| OF-06 | Wifi sin internet (portal cautivo): `navigator.onLine` es verdadero y llega HTML con estado 200 | Se muestra un mensaje comprensible (no un error técnico de JSON); la compra queda en cola y se reintenta. **Posible fallo:** hoy el error de análisis no es de red y puede no programar el reintento | T | C |
| OF-07 | El servidor o el proxy responde 502, 503 o 504 con página HTML | Compra pendiente y reintento con espera creciente | T | C |
| OF-08 | Respuesta 429 | Espera el `Retry-After` indicado (máximo 5 min) | T | C |
| OF-09 | La sesión caduca (12 h) mientras el móvil está sin red | Al volver la red responde 401: la compra se conserva; mensaje claro; tras iniciar sesión se envía | T | C |
| OF-10 | Conexión que se corta y vuelve cada 3 segundos durante el envío | Una sola compra registrada; sin pendientes sobrantes | T | C |
| OF-11 | Cambio de wifi a datos móviles (cambia la IP) en mitad de la petición | Una sola compra; sin error | M | C |
| OF-12 | Túnel o sótano: 5, 30 y 120 minutos sin señal | Las compras pendientes se mantienen y se envían al volver | T/M | C |
| OF-13 | Modo avión activado y desactivado | Evento `online` dispara la sincronización | T/M | C |
| OF-14 | Se pierde la señal justo al confirmar la **segunda** compra de una serie de 3 | Las compras se envían en orden y cada saldo es coherente | T | C |

### B.7 Qué ocurre al sincronizar compras hechas sin cobertura

| ID | Situación al volver la red | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| OF-20 | **La compra se hizo dentro de la vigencia pero se sincroniza después de caducar** (por ejemplo, 23:55 sin red, sincroniza a las 00:10) | Hoy el servidor la valida con su hora actual y la rechaza como "caducado": la compra se elimina de la cola y el comercio pierde la venta. Reproducir, medir y decidir (sección 17) | T | C |
| OF-21 | Compra hecha el último día y sincronizada tras las 23:59 | Idem | T | C |
| OF-22 | Compra hecha antes de las 00:01 del primer día (no vigente) y sincronizada después | Se acepta o se rechaza según la regla elegida | T | C |
| OF-23 | Otro móvil del mismo comercio gastó el saldo mientras este estaba sin red | La compra pendiente se rechaza por "supera el saldo" y se elimina de la cola | T | C |
| OF-24 | Dos compras pendientes del mismo bono que juntas superan el saldo | La primera (por orden de creación) se acepta; la segunda se rechaza | T | C |
| OF-25 | El comercio fue desactivado o eliminado mientras el móvil estaba sin red | Se rechaza con "no está activo" y se informa | T | C |
| OF-26 | El administrador borró los bonos de la carrera mientras tanto | Se rechaza (o, si se confirma BD-W05-04, se acepta indebidamente) | T | C |
| OF-27 | El administrador cambió las fechas de la carrera mientras tanto | Se aplican las fechas vigentes al sincronizar | T | C |
| OF-28 | La primera compra de la cola recibe 500 de forma continua | Las siguientes quedan bloqueadas tras ella (el envío se detiene en el primer fallo); medir y valorar | T | C |
| OF-29 | **Entrada que nunca se resuelve**: el servidor devuelve un código no previsto por el móvil (409, 405, 413, 415) | Hoy el móvil se detiene en esa compra, no la elimina y no programa reintento, bloqueando todas las siguientes. Reproducir y proponer solución | T | C |
| OF-30 | Respuesta 400 o 404 al sincronizar | Se elimina la compra y se muestra un aviso. Comprobar que el aviso **no se pierde** si llegan más mensajes después | T | C |
| OF-31 | Hora del movimiento en el historial | El servidor registra la hora de la **sincronización**, no la de la compra: una compra de las 14:00 puede figurar a las 18:00. Comprobar historial, exportaciones y cierre de caja | T | C |
| OF-32 | Compra rechazada al sincronizar: ¿queda constancia permanente en el móvil o en el servidor? | Hoy solo hay un aviso temporal; si la persona no lo ve, la venta queda sin registrar y sin rastro | T | C |
| OF-33 | Reenvío de la misma clave después de que ya se registró | Devuelve el estado actual del bono sin duplicar y se elimina de la cola | T | C |
| OF-34 | Reenvío 24 horas o varios días después con la misma clave | Sigue sin duplicar (la clave no caduca en la base) | D | E |
| OF-35 | Reenvío tras desplegarse una versión nueva de la web | La cola de la versión anterior se lee y se envía | T | C |

### B.8 Persistencia local de las compras pendientes

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| OF-40 | Cerrar la pestaña con compras pendientes y reabrir | Siguen ahí y se envían | T | C |
| OF-41 | Cerrar el navegador y reiniciar el móvil | Siguen ahí | M | C |
| OF-42 | **Navegación privada o sin permiso de almacenamiento**: IndexedDB no disponible | Hoy la compra se guarda **antes** de enviarse: si falla el guardado, el flujo se corta con "no permite guardar compras pendientes" incluso con red. Comprobar y decidir si debe permitirse el cobro en línea sin cola | T/M | C |
| OF-43 | Almacenamiento lleno | Mensaje claro; la compra no se pierde en silencio | T | C |
| OF-44 | El usuario borra los datos del sitio, o el sistema los borra (Safari de iPhone tras 7 días sin uso) | Se pierden las pendientes: documentar y valorar un libro de caja local exportable | M | C |
| OF-45 | Cerrar sesión con compras pendientes | Se conservan y no se envían con otra cuenta | T | C |
| OF-46 | Dos comercios distintos usando el mismo móvil | Cada cola se separa por comercio | T | C |
| OF-47 | Dos pestañas del mismo comercio abiertas con pendientes | Ambas sincronizan; no se duplica nada | T | C |
| OF-48 | 200 compras pendientes | La interfaz sigue fluida; se envían en orden | T | C |
| OF-49 | Reloj del móvil adelantado o atrasado | Solo afecta al orden local de la cola | T | C |
| OF-50 | Cola creada con una versión anterior del esquema de IndexedDB | Compatible | T | C |
| OF-51 | Pantalla bloqueada o app en segundo plano 10 minutos con pendientes | Los temporizadores pueden quedar en pausa: comprobar cuándo se sincroniza al volver | M | C |
| OF-52 | La red vuelve con la app **cerrada** | No se envía hasta reabrir (no hay sincronización en segundo plano): medir el efecto sobre un cierre de caja | M | C |

### B.9 Lo que ve y entiende la persona en caja

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| OF-60 | Aviso al quedar sin red | Indica claramente que la compra **no está confirmada** por el servidor y que el saldo no está garantizado. El texto actual dice que "se guardó en este móvil" pero no avisa del riesgo | N/M | C |
| OF-61 | Estado de conexión siempre visible (en línea / sin conexión) | Visible en todas las pantallas del comercio | N | C |
| OF-62 | Contador de compras pendientes | Visible, legible y anunciado a lectores de pantalla | N | C |
| OF-63 | Botón "Reintentar envío" | Solo con red; funciona; se desactiva mientras envía | N | C |
| OF-64 | Mensajes al sincronizar con éxito, parcialmente y con rechazos | Distinguibles y persistentes | N | C |
| OF-65 | El saldo mostrado descuenta lo pendiente y no deja superar el saldo local | Correcto | N | C |
| OF-66 | Comprobante para el cliente de una compra hecha sin red | Definir si existe y qué muestra | N | C |
| OF-67 | Lectura en pantalla pequeña (320 px) y con luz solar | Los avisos son legibles | N/M | C |
| OF-68 | Sin cámara y sin red | El campo manual sigue disponible para el bono ya cargado | T | C |
| OF-69 | Guion de contingencia para el comercio (qué hacer si no hay cobertura) | Texto breve en el área del comercio | S | L |

### B.10 Condiciones de red adversas

| ID | Perfil de red | Qué se mide | Método | Riesgo |
| --- | --- | --- | --- | --- |
| OF-70 | 3G lento (400 kbps, 400 ms) | Tiempo hasta confirmar; sin duplicados | T/M | C |
| OF-71 | 2G (50 kbps, 800 ms) | Idem; el escáner sigue usable | T/M | C |
| OF-72 | Pérdida de paquetes del 10 % y del 30 % | Compras pendientes y reintentos; cero duplicados | T/M | C |
| OF-73 | Latencia de 3 s con picos de 10 s | Pantalla coherente; sin doble envío por impaciencia | T | C |
| OF-74 | Red intermitente (3 s sí, 3 s no) durante 5 minutos | Sin duplicados ni pérdidas | T | C |
| OF-75 | Eventos `online`/`offline` repetidos en ráfaga | Una sola sincronización a la vez | T | C |
| OF-76 | Consumo de datos de los reintentos | Cantidad razonable por hora | T | L |
| OF-77 | Batería: temporizadores y reintentos en segundo plano | Sin consumo excesivo | M | L |
| OF-78 | Compra de varios comercios al mismo tiempo en una zona sin cobertura que recupera la señal a la vez | Ver CV-42 y CV-43 | T/H | E |

### B.11 Varias personas de la misma tienda validando a la vez

Hoy cada comercio tiene **una sola cuenta** (una cuenta por comercio, impuesto por la base de datos). Varias personas de la tienda comparten usuario y contraseña y trabajan desde móviles distintos.

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| ST-01 | Dos móviles inician sesión con la misma cuenta a la vez | Las dos sesiones son válidas; la segunda no expulsa a la primera | H/N | C |
| ST-02 | Una persona cierra sesión | La sesión de la otra persona sigue activa | N | C |
| ST-03 | El administrador restablece las credenciales o renombra el comercio | **Las dos** sesiones se cierran y ambas personas deben entrar de nuevo | H | C |
| ST-04 | Ambas escanean el mismo bono; una cobra y la otra no ha recargado | La segunda ve el saldo nuevo **sin recargar** (requisito de tiempo real, bloque C); si confirma con el saldo antiguo, el servidor rechaza lo que exceda | N/H | C |
| ST-05 | A cobra 20 € y B cobra 20 € de un bono de 30 € a la vez | Uno gana; el otro recibe "supera el saldo disponible" y debe poder ver el saldo restante para reconducir la compra | H | C |
| ST-06 | **Bloqueo de cuenta compartido:** una persona falla 5 veces la contraseña | La cuenta se bloquea 15 minutos para **las dos** personas en plena jornada. Medir el impacto y decidir (sección 17) | H | C |
| ST-07 | Límite de 10 intentos de acceso cada 15 minutos por cuenta | Es compartido por todos los empleados | H | C |
| ST-08 | Límite de 120 canjes por minuto por cuenta | Es compartido; con dos cajas, comprobar que ninguna operación normal lo alcanza | H | C |
| ST-09 | **Trazabilidad:** ¿quién cobró cada movimiento? | Hoy el movimiento no identifica a la persona ni al dispositivo, solo al comercio. Comprobar historial, exportación y auditoría; decidir si hace falta cuenta por empleado o "nombre del cajero" | S/N | C |
| ST-10 | Las compras pendientes sin cobertura son locales de cada móvil | El otro móvil no las ve; su saldo en pantalla no las descuenta. Medir el riesgo de sobregasto | T | C |
| ST-11 | Cierre de caja con dos móviles | Los totales del comercio suman los movimientos de ambos | N | C |
| ST-12 | Una persona cobra mientras la otra consulta el historial | El historial de la segunda se actualiza solo (bloque C) | N | C |
| ST-13 | El administrador desactiva el comercio mientras ambos trabajan | Los dos móviles pasan a "comercio no activo" sin recargar (bloque C) | N | C |
| ST-14 | 10 comercios × 2 móviles (20 sesiones) cobrando a la vez | Ver CV-01 a CV-05; sin interferencias entre comercios | H | E |
| ST-15 | Mismo bono, mismo importe, dos móviles de la misma tienda, ventana de 2 segundos | Se registran ambos o se avisa de posible duplicado (decisión 28) | H | C |

---

## C. BLOQUE PRIORITARIO — Actualización en tiempo real (requisito)

> **Requisito del propietario:** los registros nuevos deben aparecer **automáticamente en todas las secciones de la web, sin tener que refrescar**. Un administrador debe ver en directo lo que está pasando.

### C.0 Estado actual (hallazgo)

Se ha revisado el código: **hoy no existe ningún mecanismo de actualización en vivo**.

- No hay sondeo periódico, `WebSocket`, `EventSource`, suscripción de Supabase ni librería de datos con revalidación.
- Las páginas son dinámicas (`force-dynamic`): se generan **cada vez que se carga la página**; después quedan congeladas.
- `revalidatePath` (en las acciones del administrador) solo invalida la caché del **servidor**; no empuja nada a los navegadores que ya tienen la página abierta.
- Lo único parecido: el escáner llama a `router.refresh()` **tras un cobro propio** (y al vaciar su cola). No se entera de lo que hagan otros.
- Consecuencia: **todas las pruebas de este bloque fallarían hoy**. Sirven para fijar el criterio de aceptación y para validar la implementación cuando se haga (ver C.10 y la decisión 31).

### C.1 Criterios de aceptación ("tiempo real")

| N.º | Criterio |
| --- | --- |
| 1 | **Latencia:** desde que el servidor confirma un cambio hasta que aparece en una pantalla ya abierta: p50 ≤ 2 s y p95 ≤ 5 s con red normal. |
| 2 | **Sin intervención:** no hay botón de recargar ni hace falta pulsar F5. |
| 3 | **Sin perder el contexto:** la actualización no borra lo que la persona está haciendo (texto escrito, filtros, orden, página de la tabla, posición de scroll, foco, selección, formulario a medias, diálogo abierto). |
| 4 | **Sin parpadeo ni saltos:** las filas nuevas entran sin que el contenido se desplace bajo el cursor. |
| 5 | **Coherencia:** contadores, tablas y detalles de una misma pantalla muestran siempre un estado consistente (nunca "400 emitidos" en una cifra y 399 filas en la tabla). |
| 6 | **Recuperación:** tras perder la conexión, suspender el móvil o dejar la pestaña en segundo plano, la pantalla se pone al día sola al volver, **sin perder eventos**. |
| 7 | **Seguridad:** cada pantalla solo recibe lo que esa persona puede ver (un comercio solo lo suyo; un visitante nada privado). |
| 8 | **Coste razonable:** no satura la base de datos, las funciones del servidor ni los datos móviles. |
| 9 | **Degradación:** si el canal en vivo falla, la pantalla lo indica y sigue funcionando (por ejemplo, con sondeo lento). |
| 10 | **Indicador:** un indicador discreto de "En directo" / "Reconectando…" (decisión 33). |

### C.2 Canjes y movimientos aparecen solos

Se prueba con **dos pestañas del navegador**: una realiza la acción y otra, ya abierta en la pantalla indicada, la observa. Se mide el tiempo entre la confirmación y la aparición.

| ID | Evento | Pantalla abierta que debe actualizarse sola | Qué debe cambiar | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| RT-01 | Un comercio cobra un bono | Panel de administración → Carreras | Nueva fila en movimientos, saldo y estado del bono, contadores (gastado, con saldo, canjeados) | N | C |
| RT-02 | Idem | Supervisión → canjes | Nuevo movimiento arriba, sin recargar | N | C |
| RT-03 | Idem | Panel de administración (inicio) | Resumen y totales | N | C |
| RT-04 | Idem | Página pública `/bono/[código]` de ese bono abierta por el cliente | Saldo, "gastado", estado y nueva fila en "Gastos registrados" | N | E |
| RT-05 | Idem | Área del comercio (escáner) **en otro móvil de la misma tienda** | Historial de movimientos y, si tiene cargado ese bono, su saldo | N | C |
| RT-06 | Idem | Área del comercio **del propio móvil** | Historial y saldo (ya lo hace con `router.refresh`; comprobar que no recarga toda la página) | N | C |
| RT-07 | El bono se agota | `/bono/[código]` y administración | Cambia a "Canjeado" sin recargar | N | E |
| RT-08 | Se rechaza un canje (caducado, sin saldo) | Administración / supervisión | No aparece como movimiento; si se decide auditar rechazos, aparece en su lista | N | C |
| RT-09 | 10 comercios cobran en el mismo segundo | Administración | Aparecen los 10 movimientos, sin duplicados ni orden roto, y los contadores suman 10 | N/H | E |
| RT-10 | Ráfaga de 100 canjes en 10 segundos | Administración | La pantalla se mantiene fluida y termina con el total exacto; sin bloquear la interfaz | N/H | E |
| RT-11 | Canje confirmado desde una compra pendiente al volver la red | Administración | El movimiento entra cuando se sincroniza | N/T | C |
| RT-12 | Exportación del administrador tras varios eventos en directo | Coincide con lo que se veía en pantalla | N | C |

### C.3 Emisión, borrado y configuración de bonos

| ID | Evento | Pantalla abierta que debe actualizarse sola | Qué debe cambiar | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| RT-20 | Otro administrador emite bonos | Administración → Carreras | Contador "emitidos / previstos" y tabla de bonos | N | C |
| RT-21 | Otro administrador borra los bonos de una carrera | Administración → Carreras, supervisión | Tabla vacía, contadores a cero, entrada en la auditoría | N | C |
| RT-22 | Borrado de bonos | `/bono/[código]` abierta por un cliente | Pasa a "Bono no encontrado" | N | E |
| RT-23 | Otro administrador cambia fechas, vigencia o cantidad | Administración → Carreras | Resumen, "Vencimiento · 23:59" y contadores por estado | N | C |
| RT-24 | Cambio de fechas de carrera | Portada y `/bono` (tarjetas de carreras) | Fechas nuevas | N | L |
| RT-25 | Cambio de fechas de vigencia | `/bono/[código]` abierta | Fechas de inicio y caducidad y etiqueta de estado | N | E |
| RT-26 | Cambio de vigencia | Área del comercio con un bono cargado | El estado del bono cambia (por ejemplo, de disponible a caducado) y el botón de cobrar se desactiva | N | C |
| RT-27 | Dos administradores editando carreras a la vez | Ambas pantallas | Cada una ve el cambio de la otra; si hay un formulario sin guardar, se avisa antes de sobrescribir | N | C |
| RT-28 | Impresión en curso mientras llegan eventos | Pantalla de impresión | El documento no cambia a mitad | N | C |
| RT-29 | Imprimir o exportar con datos en vivo | Resultado | Foto fija coherente del momento | N | C |

### C.4 Comercios, cuentas y accesos

| ID | Evento | Pantalla abierta que debe actualizarse sola | Qué debe cambiar | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| RT-30 | Alta de comercio | Administración → Comercios | Nueva tarjeta / fila | N | C |
| RT-31 | Alta de comercio | Portada y `/comercios` (lista, contadores, mapa) | Aparece el comercio y su punto en el mapa | N | L |
| RT-32 | Edición de un comercio (nombre, horario, teléfono, categoría) | Portada, `/comercios`, ficha del mapa abierta | Datos nuevos sin cerrar la ficha | N | L |
| RT-33 | Desactivar o eliminar un comercio | Portada y `/comercios` | Desaparece de la lista y del mapa | N | L |
| RT-34 | Desactivar o eliminar un comercio | Su propio móvil con sesión abierta | Aviso inmediato de "comercio no activo" y cierre de sesión ordenado | N | C |
| RT-35 | Restaurar un comercio | Administración, portada y `/comercios` | Reaparece | N | C |
| RT-36 | Alta o restablecimiento de un administrador | Administración → Administradores | Lista actualizada | N | C |
| RT-37 | Restablecimiento de la contraseña de un administrador conectado | Su sesión | Se cierra y se le pide entrar de nuevo | N | C |
| RT-38 | Inicio y cierre de sesión de usuarios | Supervisión → Accesos | Nueva fila de acceso y, al cerrar, la hora de salida | N | C |
| RT-39 | Cambio de categorías o de textos editables | Páginas públicas que los muestran | Texto nuevo | N | L |

### C.5 Cambios producidos por el paso del tiempo

Estos cambios no los provoca nadie: ocurren solos y la pantalla abierta debe reflejarlos sin recargar.

| ID | Momento | Pantalla abierta | Qué debe cambiar | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| RT-40 | Las 00:01 del primer día de vigencia | `/bono/[código]`, área del comercio y administración | "Aún no vigente" pasa a "Disponible" | N | E |
| RT-41 | Las 00:00 del día siguiente al último | Idem | "Disponible" o "Parcial" pasan a "Caducado"; el botón de cobrar se desactiva | N | E |
| RT-42 | Pantalla abierta toda la noche (cambio de día y cambio de hora) | Cualquier pantalla con estados | Estados correctos al amanecer | N/M | E |
| RT-43 | Sesión de 12 horas que caduca con la pantalla abierta | Administración y comercio | Aviso y salida ordenada, no un error al pulsar | N | C |
| RT-44 | Clima: nueva medición | Mapa de la portada y de `/comercios` | Temperaturas actualizadas (hoy se refrescan cada 15 minutos en el servidor, pero la pantalla abierta no las pide de nuevo) | N | L |
| RT-45 | Reloj del dispositivo adelantado o atrasado | Cualquier pantalla | Manda la hora del servidor | N | L |

### C.6 Comportamiento de la interfaz durante las actualizaciones

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| RT-50 | Tabla con filtro de búsqueda escrito y llega una fila nueva | Se conserva el filtro; la fila aparece solo si cumple el filtro | N | C |
| RT-51 | Tabla ordenada por una columna | Se conserva el orden; la fila nueva se coloca donde corresponde | N | C |
| RT-52 | Tabla en la página 3 de 10 | Se mantiene la página; los contadores y el número de páginas se actualizan | N | C |
| RT-53 | Llega una fila nueva con el usuario leyendo la fila 20 | El contenido no se desplaza ni salta | N | C |
| RT-54 | Formulario a medias (importe escrito en el escáner, texto de un comercio) | No se borra ni pierde el foco | N | C |
| RT-55 | Diálogo abierto (confirmar borrado, visor de QR, selector de fecha) | No se cierra por una actualización | N | C |
| RT-56 | Ficha del mapa abierta y llega una actualización | No se cierra; su flecha sigue en el punto | N | L |
| RT-57 | Menú móvil abierto | No se cierra | N | L |
| RT-58 | Ráfagas de eventos (50 en 2 segundos) | Se agrupan; la pantalla se redibuja una sola vez por lote, sin tirones | N | C |
| RT-59 | Un lector de pantalla | Los cambios se anuncian de forma moderada (no cada fila), con región `aria-live` educada | M | L |
| RT-5A | Preferencia de movimiento reducido | Sin animaciones llamativas al entrar filas | N | L |
| RT-5B | Una fila nueva se destaca brevemente | Visible pero discreto, accesible por contraste | N | L |
| RT-5C | Cambios hechos por la propia persona | No se duplican al llegar también por el canal en vivo | N | C |
| RT-5D | Evento que llega antes que la respuesta de la acción propia | Resultado final único y correcto | N/T | C |

### C.7 Conexión, pestañas y recuperación

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| RT-60 | Se corta la red 30 s con la pantalla abierta y vuelve | Indicador "Reconectando…" y, al volver, se pone al día **con todo lo ocurrido durante el corte** | N/T | C |
| RT-61 | Corte de 10 minutos | Igual, sin perder eventos ni duplicarlos | N/T | C |
| RT-62 | Pestaña en segundo plano 30 minutos | Al volver, se actualiza de inmediato | N | C |
| RT-63 | Móvil bloqueado 10 minutos | Al desbloquear, se actualiza de inmediato | M | C |
| RT-64 | Portátil suspendido toda la noche | Al despertar, se actualiza (y la sesión se comprueba) | M | C |
| RT-65 | Varias pestañas del mismo usuario | Todas se actualizan; no se multiplica el consumo | N | C |
| RT-66 | El canal en vivo falla (servidor o servicio caído) | Aviso discreto y degradación a actualización periódica lenta; sin errores en pantalla | T | C |
| RT-67 | El servidor se reinicia o se despliega una versión nueva con pantallas abiertas | Las pantallas se reconectan solas y siguen coherentes con la versión nueva | T/M | C |
| RT-68 | Evento perdido durante una desconexión | Se detecta (por versión o marca de tiempo) y se pide la información que falta | T | C |
| RT-69 | Eventos que llegan desordenados | La pantalla muestra el orden correcto | T | C |
| RT-6A | Red lenta (3G, 2G) | Sigue funcionando; el consumo de datos es bajo | T/M | C |
| RT-6B | Red de la tienda con *proxy* o cortafuegos que bloquea conexiones largas | Degradación a sondeo, no pantalla muerta | T | C |

### C.8 Seguridad de los datos en directo

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| RT-70 | Un comercio solo recibe sus propios movimientos y su estado | Nunca los de otro comercio | A/N | C |
| RT-71 | Un visitante no autenticado no recibe movimientos, cuentas, accesos ni auditoría | Solo datos públicos | A | C |
| RT-72 | Intentar suscribirse a un canal de administración sin sesión de administrador | Rechazado | A | C |
| RT-73 | Un comercio intenta suscribirse al canal de otro comercio o de administración | Rechazado | A | C |
| RT-74 | Los eventos no incluyen datos sensibles (hashes, tokens, correos, contraseñas) | Verificado en el contenido de cada evento | A | C |
| RT-75 | Cierre de sesión o expulsión del usuario | El canal en vivo se corta y deja de recibir | A/N | C |
| RT-76 | Un cliente en `/bono/[código]` solo recibe cambios de **su** bono | No recibe cambios de otros bonos (evita enumerar códigos) | A | C |
| RT-77 | Suscripción masiva abusiva desde una sola IP | Limitada | A | E |
| RT-78 | Revisar que el mecanismo elegido no obligue a abrir políticas de lectura sobre las tablas (hoy cerradas) | Las tablas siguen cerradas al acceso público | S | L |

### C.9 Carga y coste del tiempo real

| ID | Prueba | Umbral orientativo | Método | Riesgo |
| --- | --- | --- | --- | --- |
| RT-80 | 5 administradores con pantallas abiertas y 10 comercios cobrando durante 10 minutos | Latencia dentro del criterio 1; sin errores | H/N | E |
| RT-81 | 200 pantallas públicas de clientes abiertas (`/bono/[código]`) | El coste en base de datos y funciones es asumible | H | E |
| RT-82 | 1.000 pantallas públicas (portada) abiertas | Idem, o actualización más lenta para el público (decisión 32) | H | E |
| RT-83 | Número de conexiones y consultas por segundo a la base | Sin acercarse a las 60 conexiones ni al límite de ejecución del servidor | H | E |
| RT-84 | Tiempo máximo de ejecución de las funciones (si se usan conexiones largas) | Reconexión automática antes de que se corten | H | E |
| RT-85 | Consumo de datos del móvil: una hora con la pantalla abierta | Menos de unos pocos MB | M | L |
| RT-86 | Consumo de batería y CPU del navegador | Sin picos | M | L |
| RT-87 | Sin eventos durante 1 hora | El canal se mantiene vivo sin gastar de más | N | L |
| RT-88 | Coste mensual estimado del servicio elegido | Dentro del plan contratado | S | L |

### C.10 Opciones para implementar el tiempo real (para decidir; no se hace nada hasta que lo valides)

| Opción | Cómo funciona | Ventajas | Inconvenientes |
| --- | --- | --- | --- |
| **1. Sondeo ligero con recarga de datos** | Cada pantalla pregunta cada 2–5 s a un punto de acceso muy barato ("¿hay algo nuevo en mi ámbito?") y, si lo hay, recarga solo sus datos | Sencillo, funciona detrás de cualquier *proxy*, sin servicios nuevos | Latencia de 2–5 s; coste proporcional al número de pantallas; para el público masivo hay que espaciarlo |
| **2. Eventos enviados por el servidor (SSE)** | Una conexión HTTP larga por pantalla; el servidor avisa al instante | Latencia baja; sin servicios nuevos | Las funciones de Vercel tienen duración máxima: hay que reconectar; cada pantalla ocupa una función; puede costar más |
| **3. Supabase Realtime con *Broadcast*** | Tras cada cambio, el servidor publica un aviso ligero ("cambió X") en un canal; las pantallas lo reciben y piden los datos autorizados por la API | Tiempo real auténtico; no mantiene funciones abiertas; **no exige abrir las tablas** (se mantiene el cierre actual de RLS) | Servicio y librería nuevos; hay que cuidar la autorización de cada canal |
| **4. Supabase Realtime con *Postgres Changes*** | Las pantallas se suscriben a los cambios de las tablas | Menos código de servidor | Exige políticas de lectura sobre las tablas y autenticación de Supabase: **choca con el diseño actual** (acceso solo desde el servidor); no recomendado |

**Recomendación:** combinar la opción **3** (aviso por canal, con canales separados por ámbito: administración, un comercio, un bono) y la **1** como respaldo lento si el canal falla. El aviso nunca lleva datos sensibles: indica qué cambió, y la pantalla vuelve a pedir la información por la API ya protegida con la sesión. Para el público (clientes con su bono abierto) bastaría un aviso por bono o un sondeo cada 15–30 s.

---

## 1. Vigencia y caducidad de los bonos

**Regla bajo prueba:** el bono es válido desde las **00:01:00** del día de inicio hasta las **23:59:59** del último día (inicio + días de vigencia), hora de Canarias, con cambio de hora de verano/invierno.

### 1.1 Estados básicos

| ID | Prueba | Entrada / pasos | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| V-01 | Caduca ayer | Carrera con inicio hace 8 días y 7 de vigencia | Estado `expired`, mensaje "Este bono ha caducado.", saldo y movimientos sin cambios | D | E |
| V-02 | Caducó hace una semana | Inicio hace 15 días, 7 de vigencia | Igual que V-01 | D | E |
| V-03 | Último día de vigencia (hoy) | Inicio hace 7 días, 7 de vigencia, ahora entre 00:01 y 23:59 | Estado `available`, canje permitido | D | E |
| V-04 | Empieza mañana | Inicio mañana | Estado `not-started`, "Este bono aún no está vigente.", sin escritura | D | E |
| V-05 | Empieza dentro de un año | Inicio a 365 días | Igual que V-04 | D | E |
| V-06 | Empieza hoy | Inicio hoy, ahora pasadas las 00:01 | `available` y canje permitido | D | E |
| V-07 | Bono ya canjeado del todo y caducado | Saldo 0 y fecha pasada | Estado `redeemed` (prevalece sobre caducado) | U/D | E |
| V-08 | Bono parcial y caducado | Gastados 12,50 €, fecha pasada | Estado `expired`; no se puede gastar el resto | U/D | E |
| V-09 | Bono parcial vigente | Gastados 12,50 €, vigente | Estado `partial` | U/D | E |
| V-10 | Bono parcial que aún no empieza | Gastados > 0 con inicio futuro (caso de cambio de fechas posterior) | `not-started` | U | L |

### 1.2 Límites exactos de hora

| ID | Instante (hora de Canarias) | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| V-20 | 23:59:59 del día anterior al inicio | `not-started` | U/D | L |
| V-21 | 00:00:00 del día de inicio | `not-started` | U/D | L |
| V-22 | 00:00:59 del día de inicio | `not-started` | U/D | L |
| V-23 | 00:01:00 del día de inicio | `available` | U/D | L |
| V-24 | 00:01:01 del día de inicio | `available` | U | L |
| V-25 | 12:00 del día de inicio | `available` | U | L |
| V-26 | 23:58:00 del último día | `available` | U | L |
| V-27 | 23:59:00 del último día | `available` | U/D | L |
| V-28 | 23:59:59 del último día | `available` | U/D | L |
| V-29 | 00:00:00 del día siguiente al último | `expired` | U/D | L |
| V-30 | 00:00:01 del día siguiente al último | `expired` | U | L |

### 1.3 Zona horaria y cambios de hora

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| V-40 | Verano (UTC+1): límites de V-20 a V-30 | Idénticos | U/D | L |
| V-41 | Invierno (UTC+0): límites de V-20 a V-30 | Idénticos | U/D | L |
| V-42 | Inicio el día del cambio a invierno (25-oct-2026, 02:00 pasa a 01:00) | 00:00:30 `not-started`; 00:01 `available` | U | L |
| V-43 | Fin en el día del cambio a invierno | Se respeta 23:59:59 local, no UTC | U | L |
| V-44 | Inicio el día del cambio a verano (28-mar-2027, 01:00 pasa a 02:00) | Límites correctos | U | L |
| V-45 | Vigencia que cruza el cambio de hora (inicio 20-oct, 14 días) | Último día = 3-nov, no se desplaza | U | L |
| V-46 | Servidor en otra zona (`TZ=Asia/Tokyo`, `TZ=America/Los_Angeles`, `TZ=UTC`) | Resultados idénticos a V-20…V-30 | U | L |
| V-47 | Instante UTC cuyo día difiere del día en Canarias (23:30 UTC del 30-jun) | Se usa el día de Canarias | U | L |
| V-48 | Cambio de año (inicio 28-dic, 7 días) | Último día = 4-ene del año siguiente | U | L |
| V-49 | Año bisiesto (inicio 25-feb-2028, 7 días) | Último día = 3-mar-2028 (pasa por el 29-feb) | U | L |
| V-50 | Fin de mes (inicio 28-feb-2027, 7 días) | Último día = 7-mar-2027 | U | L |
| V-51 | Reloj del navegador del usuario adelantado/atrasado | No influye: manda la hora del servidor | N/A | L |
| V-52 | Reloj del dispositivo del comercio mal puesto al canjear | El servidor usa su propia hora | A | E |

### 1.4 Duración de la vigencia

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| V-60 | Vigencia = 1 día | Válido inicio y día siguiente; expira el tercer día | U | L |
| V-61 | Vigencia = 7 días (valor actual) | Aclarar si "7 días" debe incluir 8 días naturales (ver sección 17, punto 2) | U | L |
| V-62 | Vigencia = 365 días | Fecha de caducidad correcta | U | L |
| V-63 | Vigencia = 0, 366, -1, 1,5, "abc", vacío | Rechazo con "La vigencia debe estar entre 1 y 365 días." | D | E |
| V-64 | Fecha de inicio inválida ("2026-02-30", "2026-13-01", "31/12/2026", vacío) | Rechazo con "Indica una fecha de inicio válida." | D | E |
| V-65 | Fecha de carrera inválida | Rechazo con mensaje de fecha | D | E |
| V-66 | Fecha de carrera anterior al inicio del bono | Decidir si se permite (ver sección 17) | D | E |
| V-67 | Cambiar fechas de la carrera con bonos ya emitidos | Todos los bonos de esa carrera cambian de estado de forma coherente | D | E |
| V-68 | Cantidad menor que los bonos ya emitidos | Rechazo con "Ya hay N bonos emitidos…" | D | E |
| V-69 | Cantidad = 0, negativa, decimal, > 10.000 | Rechazo | D | E |

### 1.5 Dónde se muestra la vigencia

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| V-70 | Página `/bono/[código]` de un bono caducado | Etiqueta "Caducado", fechas y nota "Válido desde las 00:01… hasta las 23:59…" | N | E |
| V-71 | Página de un bono no iniciado | Etiqueta "Aún no vigente" | N | E |
| V-72 | Página de un bono parcial / disponible / canjeado | Etiqueta correcta en cada caso | N | E |
| V-73 | Panel de carreras: "Inicio del bono · 00:01" y "Vencimiento · 23:59" | Horas visibles y fechas correctas | N | C |
| V-74 | Contadores del panel de carreras (disponibles, parciales, canjeados, caducados, no vigentes) | Coinciden con el recuento real en base de datos | D/N | E |
| V-75 | Bono impreso (anverso/reverso) | Muestra fechas de inicio y caducidad correctas | N | E |
| V-76 | Exportaciones CSV del admin | Estado y fechas correctas | A | C |
| V-77 | Textos de la web que hablan de vigencia (pasos del bono, normas) | No contradicen la regla 00:01–23:59 | S | L |
| V-78 | Mensaje en el escáner del comercio al intentar canjear caducado / no vigente | Se muestra el mensaje exacto y no se pierde el estado de la pantalla | N | C |

---

## 2. Emisión de lotes de bonos

| ID | Prueba | Entrada / pasos | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- | --- |
| E-01 | Emitir un lote pequeño | Cantidad 5 en Bimbache | Se crean exactamente 5 bonos | D | E |
| E-02 | Formato de código | Todos los códigos generados | Cumplen `EH-BIM-` + 12 caracteres válidos (sin 0, 1, I, L, O) | D | E |
| E-03 | Prefijo por carrera | Bestial `BES`, Bimbache `BIM`, Meridiano `MER` | Coincide | D | E |
| E-04 | Importe inicial | Todos los bonos | 3.000 céntimos | D | E |
| E-05 | Unicidad | Lote de 600 | Sin códigos repetidos | D | E |
| E-06 | Reparto equitativo | Lote con 5 comercios activos | Diferencia máxima entre comercios ≤ 1 | D | E |
| E-07 | Reparto con lotes sucesivos | Emitir 5, luego subir cantidad a 12 y emitir | El reparto global sigue equilibrado | D | E |
| E-08 | Comercios inactivos | Desactivar uno | No recibe bonos nuevos | D | E |
| E-09 | Comercio archivado/eliminado | Comercio eliminado antes de emitir | No recibe bonos | D | E |
| E-10 | Sin comercios activos | Todos inactivos | Error "No hay comercios a los que asignar los bonos." | D | E |
| E-11 | Emitir dos veces seguidas | Segunda llamada | Genera 0 y no duplica | D | E |
| E-12 | Emisión concurrente | Dos llamadas simultáneas | Total final = cantidad prevista, sin duplicados ni bloqueo | D | E |
| E-13 | Cantidad prevista mayor que la emitida | Subir cantidad y emitir | Solo se emiten los que faltan | D | E |
| E-14 | Carrera no reconocida | `issueMissingCoupons("xyz")` | Error "Carrera no reconocida." | D | E |
| E-15 | Lote grande | Bimbache a 600 (cantidad real) | Termina en tiempo razonable, sin error; luego limpieza | D | E |
| E-16 | Lote máximo | 1.200 (Meridiano) | Igual que E-15 | D | E |
| E-17 | Colisión de código simulada | Forzar un código ya existente | Reintenta (hasta 8 veces) y no falla; si agota, error claro | D | E |
| E-18 | Borrado de bonos de una carrera (borrado lógico) | `deleteRaceCoupons` en carrera de prueba | Marca `deleted_at`, deja traza en `audit_events` | D | E |
| E-19 | Re-emisión tras borrar | Emitir otra vez | Se crean bonos nuevos; los borrados no cuentan | D | E |
| E-20 | Bono borrado | Consultarlo / canjearlo | "Bono no encontrado." | D/A | E |
| E-21 | Borrado sin bonos | Carrera sin bonos emitidos | Error "Esta carrera todavía no tiene bonos emitidos." | D | E |
| E-22 | Confirmación de borrado en el panel | Pulsar el botón sin confirmar | No borra | N | C |
| E-23 | Permisos | Un comercio o un visitante intentando emitir/borrar | Rechazado | A | C |
| E-24 | Solo superusuario puede borrar | Admin normal intentando borrar | Rechazado (según reglas de `requireSuperAdmin`) | A | C |
| E-25 | Orden y paginación del listado de bonos de una carrera | Tabla del panel | Orden estable, buscar por código/comercio/estado | N | C |

---

## 3. Canje de bonos (gasto de saldo)

Todas las pruebas D usan la función real `redeemCoupon` sobre Supabase con bonos de prueba.

### 3.1 Casos válidos

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| C-01 | Canjear 1 € de un bono de 30 € | Saldo 29 €, un movimiento | D | E |
| C-02 | Varios gastos hasta agotar | Saldo exacto tras cada uno; el último deja 0 y estado `redeemed` | D | E |
| C-03 | Agotar saldo exacto de una vez (30 €) | Estado `redeemed` | D | E |
| C-04 | Importe mínimo (0,01 €) | Se registra 1 céntimo | D | E |
| C-05 | Importe con coma ("12,50") | 1.250 céntimos | U/D | E |
| C-06 | Importe con punto ("12.5") | 1.250 céntimos | U/D | E |
| C-07 | Importe con espacios (" 5 ") | Aceptado tras recortar | U | L |
| C-08 | Código en minúsculas | Se normaliza a mayúsculas | D/A | E |
| C-09 | Código pegado como URL completa (`https://…/bono/EH-…`) | Se extrae el código | U | L |
| C-10 | Saldo posterior en cada movimiento | `balance_after` coherente con la suma | D | E |

### 3.2 Importes inválidos

| ID | Entrada | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| C-20 | 0 | "Introduce un importe mayor que cero." | D/A | E |
| C-21 | Negativo (-5) | Rechazo | U/A | E |
| C-22 | Tres decimales (12,345) | Rechazo en la API ("importe válido, con hasta dos decimales") | U/A | E |
| C-23 | Texto ("abc"), vacío, solo coma | Rechazo | U/A | E |
| C-24 | Notación científica ("1e3") | Rechazo | U/A | E |
| C-25 | Importe enorme (999999999999) | Rechazo sin desbordar | U/A | E |
| C-26 | Mayor que el saldo (30,01 € en bono de 30 €) | "El importe supera el saldo disponible." | D | E |
| C-27 | Importe como número en el JSON (no como texto) | Rechazo | A | E |
| C-28 | Importes con caracteres raros (emoji, saltos de línea) | Rechazo | A | E |

### 3.3 Reglas de negocio

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| C-30 | Comercio equivocado | "Este bono pertenece a otro comercio." y no se descuenta | D | E |
| C-31 | Comercio inactivo | "El comercio no está activo." | D | E |
| C-32 | Comercio archivado/eliminado con sesión aún abierta | Canje rechazado | D/A | E |
| C-33 | Bono inexistente | "Bono no encontrado." | D | E |
| C-34 | Bono caducado / no iniciado | Ver sección 1 | D | E |
| C-35 | Bono sin saldo | "Este bono ya no tiene saldo." | D | E |
| C-36 | Código con formato inválido en la API | 404 sin consultar la base | A | L |
| C-37 | Bono marcado como borrado | No canjeable. **Sospecha de fallo:** el código de canje no filtra `deleted_at` (ver BD-W05-04) | D | E |

### 3.4 Idempotencia y concurrencia

> Las pruebas de varios comercios y varios móviles validando a la vez están ampliadas en el **bloque B (CV-xx)**.

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| C-40 | Misma clave y mismos datos, dos veces | Un solo cobro | D/A | E |
| C-41 | Misma clave y datos distintos | "La operación ya se utilizó con otros datos." | D/A | E |
| C-42 | Clave distinta, mismo importe, seguidas | Dos cobros distintos (comportamiento esperado) | D | E |
| C-43 | Clave con formato inválido | 400 "Falta un identificador válido…" | A | E |
| C-44 | Sin cabecera `Idempotency-Key` | 400 | A | E |
| C-45 | 15 canjes de 2,50 € simultáneos sobre un bono de 30 € | Exactamente 12 correctos, saldo 0, 12 movimientos | D | E |
| C-46 | 50 canjes simultáneos de 1 € sobre un bono de 30 € | Exactamente 30 correctos | D | E |
| C-47 | Canjes simultáneos sobre bonos distintos | Todos correctos, sin bloqueos cruzados | D | E |
| C-48 | Dos comercios intentando el mismo bono a la vez | Solo gana el dueño | D | E |
| C-49 | Reintento tras corte de red (misma clave) | No duplica | D | E |
| C-50 | Cierre brusco de la conexión a mitad de transacción | No queda saldo descontado sin movimiento (transaccional) | D | E |

### 3.5 Invariantes de datos (tras cualquier prueba de escritura)

| ID | Invariante | Método | Riesgo |
| --- | --- | --- | --- |
| C-60 | Para cada bono: `used_cents` = suma de sus movimientos | D/S | L |
| C-61 | Para cada bono: `0 <= used_cents <= amount_cents` | S | L |
| C-62 | Para cada movimiento: `balance_after_cents` coherente con el orden cronológico | S | L |
| C-63 | No existen movimientos con bono inexistente | S | L |
| C-64 | No hay códigos duplicados | S | L |
| C-65 | Todos los códigos cumplen el formato permitido (`coupons_code_check`) | S | L |

---

## 4. API `/api/bonos/[código]`

### 4.1 Consulta (GET)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| A-01 | Bono existente, sin sesión | 200 con datos del bono; `Cache-Control: no-store` | A | E |
| A-02 | Código con formato inválido | 404 "Bono no encontrado." | A | L |
| A-03 | Código válido pero inexistente | 404, mismo mensaje que A-02 (no distinguir) | A | L |
| A-04 | Contenido de la respuesta pública | No incluye datos internos (ids de usuarios, contraseñas, claves) | A | E |
| A-05 | Límite público: 10 consultas en 15 minutos por IP | La 11.ª da 429 con `Retry-After` | A | E |
| A-06 | El límite no se salta cambiando mayúsculas/minúsculas del código | Mismo cubo | A | E |
| A-07 | El límite no se salta con cabeceras `X-Forwarded-For` falsas | En local se ignoran; en Vercel manda la IP real | A/S | L |
| A-08 | Límite autenticado: 60 por minuto | La 61.ª da 429 | A | C |
| A-09 | Comercio consultando un bono de otro comercio | 409 con el mensaje; revisar si el nombre del otro comercio debe mostrarse | A | C |
| A-10 | Tras agotar el límite, esperar `Retry-After` y reintentar | Vuelve a funcionar | A | E |
| A-11 | Códigos con caracteres especiales (`%00`, `../`, comillas, Unicode) | 404 sin error 500 | A | L |
| A-12 | Código muy largo (10 KB) | 404 o 414, nunca error de servidor | A | L |

### 4.2 Canje (POST)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| A-20 | Sin sesión | 401 | A | L |
| A-21 | Con sesión de administrador | 403 | A | C |
| A-22 | Cuenta de comercio sin comercio asignado | 403 | A | C |
| A-23 | Petición de otro origen (`Origin` ajeno, `Sec-Fetch-Site: cross-site`) | 403 | A | C |
| A-24 | Sin cabecera `Origin` | 403 | A | C |
| A-25 | `Content-Type` distinto de JSON | 400 | A | C |
| A-26 | Cuerpo mayor de 1 KB | 400 | A | C |
| A-27 | JSON inválido, `null`, array, texto | 400 | A | C |
| A-28 | Límite de 120 canjes por minuto | El 121.º da 429 con `Retry-After` | A | C |
| A-29 | Mensajes de rechazo conocidos | Estado 400 y texto exacto de cada uno | A | E |
| A-30 | Error interno no previsto | 503 con mensaje genérico, sin detalles internos | A/D | E |
| A-31 | Respuesta de éxito | Devuelve el bono actualizado con el nuevo saldo | A | E |
| A-32 | Método no permitido (PUT/DELETE) | 405 | A | L |
| A-33 | Dos pestañas del mismo comercio canjeando a la vez | Sin doble cobro | A | C |

---

## 5. Autenticación, sesiones y permisos

### 5.1 Acceso

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| S-01 | Login de administrador correcto | Entra y se crea sesión (12 h) | N | C |
| S-02 | Login de comercio correcto | Entra al portal del comercio | N | C |
| S-03 | Contraseña incorrecta | Mensaje genérico, sin revelar si el usuario existe | N | C |
| S-04 | Usuario inexistente | Mismo mensaje y tiempo parecido al de S-03 | A | C |
| S-05 | Mayúsculas en el usuario / correo | Se normaliza | A | C |
| S-06 | Administrador entrando por correo | Permitido | A | C |
| S-07 | Credencial de comercio usada en el login de administrador y viceversa | Rechazo | A | C |
| S-08 | Usuario > 254 caracteres o contraseña > 200 | Rechazo sin error de servidor | A | C |
| S-09 | Comercio archivado | No puede entrar | A | C |
| S-10 | Comercio desactivado | "No disponible" | A | C |
| S-11 | Límite por IP: 20 intentos en 15 min | El 21.º se bloquea | A | E |
| S-12 | Límite por cuenta: 10 intentos en 15 min | El 11.º se bloquea | A | E |
| S-13 | Tras un bloqueo, un login correcto sigue bloqueado hasta que pase la ventana | Comportamiento documentado | A | E |
| S-14 | Registro de accesos | Cada login genera fila en `login_events` | S | E |

### 5.2 Sesión

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| S-20 | Cookie `bonos_session` | `HttpOnly`, `SameSite`, `Secure` en producción, sin datos legibles | A/S | C |
| S-21 | Cerrar sesión | El token deja de valer en el servidor | A | C |
| S-22 | Reutilizar la cookie anterior tras cerrar sesión | Rechazada | A | C |
| S-23 | Sesión caducada (12 h) | Se pide login | D | E |
| S-24 | Cookie manipulada / inventada | Sin acceso, sin error 500 | A | L |
| S-25 | Dos sesiones simultáneas del mismo usuario | Comportamiento definido (conviven o se expulsa) | A | C |
| S-26 | Cerrar sesión con operaciones pendientes en el escáner | No se pierden (ver sección 7) | N | C |

### 5.3 Contraseñas y cuentas

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| S-30 | Configuración inicial `/admin/setup` con administrador ya existente | Redirige o rechaza | N | L |
| S-31 | Primer administrador: contraseña < 12 o > 200 caracteres | Rechazo con mensaje | D | E |
| S-32 | Alta de administrador | Se genera clave temporal y obliga a cambiarla | N | C |
| S-33 | Primer acceso: forzar cambio de contraseña | No se puede navegar a otras páginas hasta cambiarla | N | C |
| S-34 | Cambio de contraseña con la actual incorrecta | Rechazo | A | C |
| S-35 | Restablecer contraseña de otro administrador | Solo quien tiene permiso; deja traza de auditoría | N | C |
| S-36 | Superusuario protegido | No se puede restablecer ni eliminar por otro administrador | A | C |
| S-37 | Las contraseñas se guardan con hash (scrypt) y nunca en claro | Revisión de la tabla `users` | S | L |
| S-38 | Las respuestas y logs no contienen contraseñas | Revisión de respuestas y registros | S | C |

### 5.4 Permisos por ruta

| ID | Ruta | Visitante | Comercio | Administrador | Método | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| S-40 | `/admin` y subpáginas | Redirige a login | Rechazo | Acceso | A/N | C |
| S-41 | `/admin/export` | Rechazo | Rechazo | Acceso | A | C |
| S-42 | `/admin/carreras/impresion` | Rechazo | Rechazo | Acceso con token válido | A | C |
| S-43 | `/api/admin/bonos-pdf` | 401/403 | 403 | Acceso | A | C |
| S-44 | `/api/admin/geocode-business` | 401/403 | 403 | Acceso | A | C |
| S-45 | `/comercio` y `/comercio/movimientos/export` | Redirige a login | Acceso (solo lo suyo) | Según reglas | A | C |
| S-46 | Rutas públicas (`/`, `/bono`, `/comercios`, legales, `/api/weather`) | Acceso | Acceso | Acceso | A | L |
| S-47 | Un comercio no ve movimientos ni bonos de otro | Comprobar exportaciones y tablas | — | — | A | C |

---

## 6. Panel de administración

### 6.1 Carreras

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| P-01 | Selector de carrera | Cambia de carrera y conserva la URL | N | C |
| P-02 | Guardar configuración válida | Se guarda y se muestra confirmación | N | C |
| P-03 | Guardar con campos inválidos | Mensajes claros, sin perder lo escrito | N | C |
| P-04 | Selector de fecha (DatePicker) | Teclado, mes anterior/siguiente, fechas inválidas | N | C |
| P-05 | Botón "Emitir bonos" | Emite los que faltan y muestra el total | N | C |
| P-06 | Botón de borrado con confirmación | Pide confirmar y deja auditoría | N | C |
| P-07 | Resumen (cantidad, fechas, vigencia) | Coincide con la configuración | N | C |
| P-08 | Tabla de bonos: orden, búsqueda, paginación | Funciona con 5, 400 y 1.200 filas | N | C |
| P-09 | Impresión: modo anverso y modo reverso | Genera el documento y respeta A4 | N | C |
| P-10 | Token de impresión caducado (> 5 min) | Rechazado | A | C |
| P-11 | Token de otra carrera o de otro modo | Rechazado | A | C |
| P-12 | Token manipulado | Rechazado | A | C |
| P-13 | PDF de bonos | Se genera sin error; el contenido coincide con los códigos | A | C |
| P-14 | Impresión de muchos bonos (400) | No se bloquea el navegador ni el servidor | N | C |
| P-15 | Contador "con saldo vigente" | Coincide con la base de datos | D/N | E |

### 6.2 Comercios

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| P-20 | Alta de comercio `ZZ-PRUEBA` | Se crea y se genera su cuenta | N/D | E |
| P-21 | Campos obligatorios vacíos | Validación | N | C |
| P-22 | Nombre duplicado | Se resuelve de forma coherente (id y usuario únicos) | D | E |
| P-23 | Nombre con tildes, eñes y caracteres especiales | Se genera un identificador válido | D | E |
| P-24 | Editar datos (dirección, horario, teléfono, categoría, municipio) | Se refleja en la web pública | N | C |
| P-25 | Cambiar el nombre | Actualiza también el usuario del comercio | D | E |
| P-26 | Geocodificar dirección válida de El Hierro | Devuelve coordenadas dentro de la isla | A | C |
| P-27 | Dirección fuera de la isla o inexistente | Mensaje claro, no se guarda un punto erróneo | A | C |
| P-28 | Servicio de geocodificación caído o con límite | Mensaje de error, sin romper el formulario | A | C |
| P-29 | Caché de geocodificación | La segunda consulta no sale al servicio externo | S | L |
| P-30 | Desactivar comercio | Deja de recibir bonos y no puede canjear | D/N | E |
| P-31 | Eliminar comercio | Se archiva el acceso; los bonos ya emitidos se tratan según regla | D | E |
| P-32 | Restaurar comercio | Recupera acceso | D | E |
| P-33 | Reiniciar contraseña del comercio | Genera nueva clave y obliga a cambiarla | N | C |
| P-34 | Subida o ruta de foto | Rechaza rutas externas o con `..` | A | C |
| P-35 | Categorías | Solo las permitidas; el filtro público usa las mismas | N | C |

### 6.3 Administradores y supervisión

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| P-40 | Lista de administradores | Muestra solo lo necesario | N | C |
| P-41 | Alta con correo inválido o repetido | Rechazo | N | C |
| P-42 | Supervisión: bonos, canjes, accesos, cuentas, eventos de auditoría | Datos coherentes con la base | N | C |
| P-43 | Tablas interactivas: orden, búsqueda, paginación, página vacía | Sin errores | N | C |
| P-44 | Todas las acciones sensibles dejan rastro en `audit_events` | Comprobar borrados, reinicios y altas | S | E |

### 6.4 Exportaciones

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| P-50 | CSV de administración | Cabeceras correctas, codificación UTF-8 con tildes | A | C |
| P-51 | Inyección en CSV (celdas que empiezan por `=`, `+`, `-`, `@`) | Se neutralizan | D/A | E |
| P-52 | Comas, comillas y saltos de línea en los datos | Escapados correctamente | D/A | E |
| P-53 | CSV de movimientos del comercio | Solo contiene los suyos | A | C |
| P-54 | Exportar sin datos | Fichero válido solo con cabeceras | A | C |

---

## 7. Portal del comercio y escáner

> El comportamiento sin cobertura, la cola de compras pendientes y los reintentos se prueban en profundidad en el **bloque B (OF-xx)**. Aquí solo quedan las comprobaciones funcionales del escáner.

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| M-01 | Entrada manual de un código | Muestra el bono, el saldo y el aviso de estado | N | C |
| M-02 | Escaneo QR con cámara (permiso concedido) | Lee el QR y abre el bono | M | C |
| M-03 | Permiso de cámara denegado | Mensaje claro y alternativa manual | M | C |
| M-04 | Dispositivo sin cámara | Mensaje claro | N | C |
| M-05 | QR que no es de un bono | Mensaje "no es un bono" sin errores | M | C |
| M-06 | QR de un bono de otro comercio | Mensaje "pertenece a otro comercio" | N | C |
| M-07 | Bono caducado / no vigente / agotado | Mensaje exacto de cada caso | N | C |
| M-08 | Cobro correcto | Confirmación, nuevo saldo y registro en el historial | N | C |
| M-09 | Pulsar dos veces "Confirmar" | Un solo cobro | N | C |
| M-10 | Sin conexión al confirmar | La compra se guarda como pendiente (IndexedDB) y se avisa | N | C |
| M-11 | Volver la conexión | Se sincroniza sola y desaparece de pendientes | N | C |
| M-12 | Servidor responde 429 | Espera según `Retry-After` y reintenta | A/N | C |
| M-13 | Servidor responde error de negocio (caducado, sin saldo) con la compra en cola | Se descarta o se avisa, no se reintenta sin fin | N | C |
| M-14 | Reintento con retroceso progresivo (2 s hasta 60 s) | Sin tormenta de peticiones | N | C |
| M-15 | Cerrar la pestaña con compras pendientes y reabrir | Siguen pendientes y se envían | N | C |
| M-16 | Cerrar sesión con pendientes | No se pierden ni se envían con otra cuenta | N | C |
| M-17 | Mismo dispositivo con dos comercios distintos | Las compras pendientes no se mezclan | N | C |
| M-18 | Historial de movimientos del comercio | Orden, búsqueda y totales correctos | N | C |
| M-19 | Importe con teclado móvil (coma decimal) | Se interpreta bien | M | C |
| M-20 | Pantallas pequeñas (320 px) y horizontales | Sin elementos cortados | N | C |
| M-21 | Cámara y visión del QR en poca luz | Mensaje o ayuda razonable | M | C |

---

## 8. Páginas públicas

### 8.1 Portada

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| H-01 | Carga sin errores de consola ni de red | Sin errores 4xx/5xx salvo los esperados | N | L |
| H-02 | Bono del hero: texto, QR y enlace a `/bono` | El QR apunta a la URL correcta del entorno | N | L |
| H-03 | Animación de las tijeras | Se ve fluida; con "reducir movimiento" se detiene | N/M | L |
| H-04 | Carrusel de fondo | Alterna las 3 fotos, sin saltos | N | L |
| H-05 | Tarjetas de carreras con fechas correctas | 24-oct, 14-nov, 30-ene | N | L |
| H-06 | Sección "Comercios locales": frase, buscador, categorías | Coincide con el texto aprobado | N | L |
| H-07 | Buscador: por nombre, categoría, municipio, producto | Resultados coherentes; "sin resultados" claro | N | L |
| H-08 | Desplegable de resultados sobre el pie de página | No lo tapa el footer | N | L |
| H-09 | Buscador con texto especial (`<script>`, comillas, `%`, emojis) | Se muestra como texto, sin errores | N | L |
| H-10 | Pulsar un resultado | Abre la ficha y centra el mapa | N | L |
| H-11 | Mapa: puntos, zoom, arrastre, caja del tiempo | Caja con 3 municipios, sin tapar la isla | N | L |
| H-12 | Ficha del mapa: flecha a la altura del punto en los 5 comercios | Medido | N | L |
| H-13 | Ficha del mapa: enlace "cómo llegar" | Abre Google Maps con el comercio correcto | N | L |
| H-14 | Header fijo al hacer scroll | Visible y sin tapar contenido | N | L |
| H-15 | Pie de página: enlaces y textos legales | Todos funcionan | N | L |

### 8.2 `/bono`

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| B-01 | Pasos explicativos | Textos aprobados, sin frases antiguas | N | L |
| B-02 | Buscador con código válido | Lleva a `/bono/[código]` | N | E |
| B-03 | Código en minúsculas, con espacios o guiones raros | Se normaliza | N/U | L |
| B-04 | URL completa pegada en el campo | Se extrae el código | U | L |
| B-05 | Código con formato incorrecto | Mensaje claro | N | L |
| B-06 | Código válido pero inexistente | Mensaje "no encontrado" | N | L |
| B-07 | Campo vacío | Validación del navegador | N | L |
| B-08 | Botón de escanear QR | Abre el visor; cierra con Esc y con el botón | N/M | L |
| B-09 | Tarjetas "Tu carrera, tu bono" | Textos y logos correctos | N | L |
| B-10 | Título de página en una y dos líneas | Barras naranjas finas y centradas | N | L |
| B-11 | Espacio entre las tarjetas de pasos y "Buscador de bono" | ≥ 40 px en móvil | N | L |

### 8.3 `/bono/[código]`

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| B-20 | Bono disponible | Saldo 30 €, gastado 0, etiqueta y nota de vigencia | N | E |
| B-21 | Bono parcial | Saldo y gastado correctos, historial visible | N | E |
| B-22 | Bono agotado | Etiqueta "Canjeado" | N | E |
| B-23 | Bono caducado y no iniciado | Etiquetas de la sección 1 | N | E |
| B-24 | Bono de cada carrera (BES, BIM, MER) | Diseño de anverso/reverso correcto | N | E |
| B-25 | Botón de ver reverso (giro) | Alterna anverso y reverso, accesible con teclado | N | E |
| B-26 | Enlace "cómo llegar" al comercio asignado | Correcto | N | E |
| B-27 | Historial de gastos | Orden, fechas en hora de Canarias, importes | N | E |
| B-28 | Bono con muchos movimientos (50) | Paginación o scroll correcto | D/N | E |
| B-29 | Código inexistente / inválido | Página 404 o mensaje coherente | N | L |
| B-30 | Límite de consultas públicas (10 / 15 min) | Mensaje amable al superarlo | N | E |
| B-31 | Imprimir la página del bono | Estilos de impresión correctos | N | E |

### 8.4 `/comercios` (directorio)

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| H-30 | Filtro por categoría | Lista y mapa se actualizan a la vez | N | L |
| H-31 | Filtro por municipio | Idem | N | L |
| H-32 | Combinar búsqueda, categoría y municipio | Resultado consistente | N | L |
| H-33 | Lista agrupada por municipio con siluetas y contadores | Contadores correctos | N | L |
| H-34 | Seleccionar un comercio en la lista | Resalta el punto y abre la ficha | N | L |
| H-35 | Pasar el ratón sobre un comercio | Resalta su punto | N | L |
| H-36 | Mapa en pantalla completa | Se abre y se cierra con botón y Esc | N | L |
| H-37 | Caja del tiempo en tema oscuro (borde naranja) | Visible y legible | N | L |
| H-38 | Texto de las tarjetas de comercio | Nombre 17 px, datos 15 px, sin recortes | N | L |
| H-39 | Estado sin comercios o sin resultados | Mensaje claro | N | L |

### 8.5 Páginas legales y errores

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| L-01 | Aviso legal, privacidad, cookies y accesibilidad cargan | 200 y contenido completo | A/N | L |
| L-02 | Índice "En esta página" y navegación entre legales | Enlaces internos correctos | N | L |
| L-03 | Aviso legal incluye la sección de bases de los premios | Presente y en su sitio | N | L |
| L-04 | Contenido legal procede del código (no hay filas `legal.*` en la base) | Consistente | S | L |
| L-05 | Ruta inexistente | Página 404 con navegación | N | L |
| L-06 | Error del servidor | Página de error sin detalles internos | N | L |
| L-07 | Textos legales coinciden con lo que hace la web (cookies reales, datos recogidos) | Revisión punto por punto | S | L |

---

## 9. Seguridad

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| X-01 | Cabeceras de seguridad (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` o CSP, HSTS en producción) | Presentes y razonables | S | L |
| X-02 | XSS almacenado: nombre, descripción, dirección y horario de un comercio con `<img onerror>` y `<script>` | Se muestran como texto en web, mapa y exportaciones | D/N | E |
| X-03 | XSS en campos de búsqueda y en parámetros de URL | Sin ejecución | N | L |
| X-04 | Inyección SQL en código de bono, búsquedas, filtros y formularios | Sin efecto (consultas parametrizadas) | A | L |
| X-05 | Enumeración de códigos | La respuesta no distingue "no existe" de "formato inválido"; el límite frena la fuerza bruta | A | E |
| X-06 | Espacio de códigos | Estimar probabilidad de acertar un código válido por intento | S | L |
| X-07 | CSRF en acciones de servidor y en el canje | Origen ajeno rechazado | A | C |
| X-08 | Redirecciones abiertas (`?next=`, `?redirect=`) | No redirigen a dominios externos | A | L |
| X-09 | Fuga de secretos en el repositorio y en el cliente | Búsqueda de claves, tokens y cadenas de conexión en Git y en el JavaScript publicado | S | L |
| X-10 | Variables `NEXT_PUBLIC_*` | Solo la URL pública | S | L |
| X-11 | Mensajes de error | Nunca incluyen trazas, SQL ni rutas | A | L |
| X-12 | Datos personales en respuestas públicas | Ninguno (correos, teléfonos de personas, ids) | A | E |
| X-13 | Teléfono y horario de comercios | Son datos del negocio; confirmar que está permitido publicarlos | S | L |
| X-14 | Cuerpos enormes (1 MB, 100 MB) | Rechazo temprano sin consumir memoria | A | L |
| X-15 | Peticiones con métodos y cabeceras raras (`TRACE`, `Host` falso) | Sin comportamiento inesperado | A | L |
| X-16 | Acceso directo a archivos de `.data`, `.env`, `supabase/migrations` por URL | 404 | A | L |
| X-17 | Acceso a la base desde el exterior con la clave pública | Las tablas no son legibles por roles anónimos (revisar políticas RLS y permisos) | S | L |
| X-18 | Aislamiento entre Preview y Production | Confirmar si comparten base de datos y qué implica | S | L |
| X-19 | Copias de seguridad de Supabase | Comprobar que existen y cuál es su frecuencia | S | L |
| X-20 | Dependencias con vulnerabilidades conocidas (`npm audit`) | Sin críticas ni altas sin justificar | S | L |
| X-21 | Registro de auditoría de acciones críticas | Presente y no manipulable desde la web | S | L |
| X-22 | HMAC de límites (`COUPON_LOOKUP_HMAC_KEY`) | Distinta en Preview y Production | S | L |

---

## 10. Base de datos y migraciones

> El detalle exhaustivo de todas las acciones contra la base está en el **bloque A** (al principio del documento). Esta sección se limita a comprobaciones generales que complementan ese bloque.

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| DBG-01 | Historial de migraciones frente a la carpeta `supabase/migrations` | Aplicadas y registradas: las 9 acordadas; las 2 legales, omitidas a propósito y anotadas | S | L |
| DBG-02 | Columnas esperadas por el código en todas las tablas | Sin columnas que falten (ej. `race_date`) | S | L |
| DBG-03 | Restricciones (`coupons_code_check`, claves foráneas, unicidad) | Presentes | S | L |
| DBG-04 | Índices en columnas de búsqueda frecuente (`coupons.code`, `race_id`, `business_id`, `redemptions.code`) | Presentes | S | L |
| DBG-05 | Políticas RLS y permisos de roles | Alineados con `private_database_access` | S | L |
| DBG-06 | Limpieza de tablas de límites (`request_limits`, `public_lookup_limits`) | No crecen sin control | S | L |
| DBG-07 | Limpieza de sesiones caducadas | No se acumulan | S | L |
| DBG-08 | Idempotencia de las migraciones (volver a ejecutarlas no rompe nada) | Solo en copia local o base de pruebas | D | C |
| DBG-09 | Datos semilla: carreras, categorías, normas, contenido del sitio | Coinciden con `lib/data.ts` | S | L |
| DBG-10 | Contenido editable en `site_content` frente a los valores por defecto del código | Sin textos antiguos tapando los nuevos | S | L |
| DBG-11 | Conexión: SSL, un cliente por instancia, sin consultas preparadas | Conforme a `lib/postgres.ts` | S | L |
| DBG-12 | Reconexión tras corte | La web se recupera sola | D | E |
| DBG-13 | Zona horaria de las columnas de fecha (`date` frente a `timestamptz`) | Sin desfases | S | L |
| DBG-14 | Reinicio de datos para la entrega: guion de borrado de datos de prueba (bonos, canjes, sesiones, eventos) conservando configuración | Guion revisado y probado en copia | D | C |

---

## 11. Visual, responsive y accesibilidad

### 11.1 Tamaños de pantalla

Se revisa cada página pública (portada, `/bono`, `/bono/[código]`, `/comercios`, 4 legales, login) en: **320, 360, 375, 414, 768, 1024, 1280, 1440 y 1920 px**.

| ID | Comprobación en cada tamaño | Método | Riesgo |
| --- | --- | --- | --- |
| R-01 | Sin desplazamiento horizontal de la página | N | L |
| R-02 | Header fijo; menú móvil abre a pantalla completa y cierra | N | L |
| R-03 | Texto mínimo: nada por debajo de 12 px en la interfaz | N | L |
| R-04 | Títulos con barras naranjas: una y dos líneas | N | L |
| R-05 | Tarjeta del bono del hero: sin recortes, QR legible, tijeras sobre la línea | N | L |
| R-06 | Mapas: tamaño razonable, caja del tiempo sin tapar la isla | N | L |
| R-07 | Tarjetas de carreras y de comercios sin solapes | N | L |
| R-08 | Formularios: campos y botones de ≥ 44 px de alto | N | L |
| R-09 | Orientación horizontal en móvil | N | L |
| R-10 | Zoom del navegador al 200 % | N | L |
| R-11 | Tamaño de letra grande del sistema | M | L |

### 11.2 Accesibilidad

| ID | Prueba | Método | Riesgo |
| --- | --- | --- | --- |
| AC-01 | Navegación solo con teclado: orden lógico y foco visible en todos los controles | N | L |
| AC-02 | Menú móvil, desplegable del buscador, mapa, selector de fecha y diálogos: se pueden usar y cerrar con teclado | N | L |
| AC-03 | Nombres accesibles de botones con solo icono (escáner, cerrar, limpiar búsqueda) | N | L |
| AC-04 | Imágenes con texto alternativo adecuado; decorativas ocultas al lector | N | L |
| AC-05 | Contraste de texto ≥ 4,5:1 (y 3:1 en texto grande) en tema claro y oscuro, incluida la caja del tiempo y el bono | N | L |
| AC-06 | Estados que dependen solo del color (etiquetas de bono) llevan también texto | N | L |
| AC-07 | Encabezados en orden lógico (un solo `h1` por página) | N | L |
| AC-08 | Formularios con etiqueta asociada y errores anunciados | N | L |
| AC-09 | `prefers-reduced-motion` desactiva animaciones (tijeras, carrusel, giro del bono) | N | L |
| AC-10 | `lang="es"` y títulos de página descriptivos | N | L |
| AC-11 | Lector de pantalla (NVDA o VoiceOver) en el flujo "consultar un bono" | M | L |
| AC-12 | Declaración de accesibilidad coherente con el estado real | S | L |

### 11.3 Navegadores y dispositivos

| ID | Prueba | Método | Riesgo |
| --- | --- | --- | --- |
| BR-01 | Chrome/Chromium reciente | N | L |
| BR-02 | Firefox reciente | M | L |
| BR-03 | Safari de iPhone (cámara, `position: sticky/fixed`, máscaras CSS del ticket, `backdrop-filter`) | M | L |
| BR-04 | Chrome de Android (cámara, IndexedDB, teclado numérico) | M | L |
| BR-05 | Navegador integrado de redes sociales (Instagram) al abrir un enlace de QR | M | L |
| BR-06 | Modo oscuro del sistema | N | L |
| BR-07 | Impresión de bonos en papel real (A4) y lectura del QR impreso con un móvil | M | E |

### 11.4 Vista y contenido

| ID | Prueba | Método | Riesgo |
| --- | --- | --- | --- |
| VI-01 | Ortografía, tildes y tono de todos los textos visibles | S | L |
| VI-02 | Fechas y euros con formato español (`03 de octubre de 2026`, `30,00 €`) | N | L |
| VI-03 | Coherencia de nombres (Bestial Race, Bimbache Trail, Maratón del Meridiano) | S | L |
| VI-04 | Logos e imágenes sin deformar ni pixelar | N | L |
| VI-05 | Favicon, título y descripción de cada página | S | L |
| VI-06 | Vista previa al compartir enlaces (Open Graph) | S | L |
| VI-07 | Aviso de imágenes creadas con IA visible donde corresponde | N | L |

---

## 12. Clima y servicios externos

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| CL-01 | `/api/weather?municipality=` Valverde, Frontera, El Pinar | 200 con temperatura y código de tiempo | A | L |
| CL-02 | Municipio desconocido o vacío | 400/404, sin error de servidor | A | L |
| CL-03 | Parámetro con caracteres raros o inyección | Rechazo | A | L |
| CL-04 | Servicio de clima caído (simulado) | La caja del tiempo no aparece y el mapa sigue funcionando | N | L |
| CL-05 | Una de las tres consultas falla | La caja muestra solo las que llegaron | N | L |
| CL-06 | Caché de respuestas | No se llama al servicio externo en cada visita | S | L |
| CL-07 | Temperatura redondeada y unidades correctas | `22°C` | N | L |
| CL-08 | Icono según código de tiempo (despejado, nubes, lluvia, tormenta, niebla) | Correcto | U/N | L |
| CL-09 | Widget de clima (si se usa) y accesibilidad de la caja | Lista con nombre accesible | N | L |
| CL-10 | Mapa: teselas y estilo cargan; atribución visible | Presente | N | L |
| CL-11 | Mapa sin conexión a las teselas | Se ve el contorno y los puntos | N | L |
| CL-12 | Política de uso del servicio de geocodificación (User-Agent propio, límite de ritmo) | Cumple | S | L |

---

## 13. Código, compilación y despliegue

### 13.1 Calidad del código

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| Q-01 | `npx tsc --noEmit` | Sin errores | S | L |
| Q-02 | `npm run test:unit` | Todos pasan (35 al redactar) | U | L |
| Q-03 | `npm run lint` | Sin errores | S | L |
| Q-04 | `npm run build` | Compila y lista las rutas esperadas | S | L |
| Q-05 | Prueba de ausencia de `!important` en el CSS | Pasa | U | L |
| Q-06 | CSS sin reglas muertas (clases no usadas) | Informe vacío | S | L |
| Q-07 | Pruebas de que los textos de vigencia coinciden con la regla | Pasan | U | L |
| Q-08 | Cobertura: qué módulos críticos no tienen tests (canje, autenticación, límites, impresión) | Informe y propuesta | S | L |
| Q-09 | Rutas del `build` frente a las rutas de este plan | No falta ninguna | S | L |
| Q-10 | Advertencias de la consola del navegador (React, hidratación) | Ninguna | N | L |

### 13.2 Despliegue

| ID | Prueba | Resultado esperado | Método | Riesgo |
| --- | --- | --- | --- | --- |
| DP-01 | `git push origin main` desencadena el despliegue de Vercel | Despliegue "Ready" | S | L |
| DP-02 | La URL pública sirve el último commit | Coincide el hash o el cambio visible | S | L |
| DP-03 | Variables de entorno de Production presentes (`DATABASE_URL`, `COUPON_LOOKUP_HMAC_KEY`, `NEXT_PUBLIC_APP_URL`) | Presentes | S | L |
| DP-04 | `NEXT_PUBLIC_APP_URL` correcta en los QR de los bonos | Apunta al dominio final | S | L |
| DP-05 | Región de funciones `dub1` y latencia a Supabase (Irlanda) | Latencia razonable | S | L |
| DP-06 | Recorrido de humo en producción (solo lectura): portada, `/bono`, `/comercios`, legales, `/api/weather` | 200 | A | L |
| DP-07 | Cabeceras de caché de páginas dinámicas | `no-store` donde corresponde | S | L |
| DP-08 | Reversión: procedimiento para volver al despliegue anterior | Documentado | S | L |
| DP-09 | Dominio definitivo, HTTPS y redirecciones | Configurados | M | C |
| DP-10 | Rama predeterminada de GitHub apunta a `migration/supabase` | Decidir si debe ser `main` | S | L |

---

## 14. Rendimiento y resistencia

Estas pruebas se hacen al final y con topes bajos para no afectar a la base.

| ID | Prueba | Umbral orientativo | Método | Riesgo |
| --- | --- | --- | --- | --- |
| F-01 | Tiempo de carga de la portada en móvil con red 4G simulada | LCP < 2,5 s | N | L |
| F-02 | Lighthouse (rendimiento, accesibilidad, buenas prácticas, SEO) en portada, `/bono` y `/comercios` | ≥ 90 en accesibilidad y buenas prácticas | N | L |
| F-03 | Peso de la página y de imágenes | Imágenes optimizadas, sin archivos > 500 KB innecesarios | N | L |
| F-04 | Tiempo de consulta de un bono | < 500 ms en servidor | A | L |
| F-05 | Emisión de 1.200 bonos | Termina sin tiempo de espera agotado | D | E |
| F-06 | 200 consultas públicas repartidas (respetando el límite) | Sin errores 5xx | A | E |
| F-07 | 50 canjes simultáneos en bonos distintos | Todos correctos, < 5 s | D | E |
| F-08 | 100 inicios de sesión erróneos | El límite protege sin saturar | A | E |
| F-09 | Panel de carreras con 1.200 bonos | Carga y filtra con fluidez | N | C |
| F-10 | PDF/impresión de 1.200 bonos | No agota memoria ni tiempo | A | C |
| F-11 | Mapa con 5 y con 200 comercios | Fluido en móvil | N | L |
| F-12 | Consumo de conexiones a la base (`max: 1` por instancia con el pooler) | Sin errores de conexiones agotadas | D | E |
| F-13 | Recuperación tras errores 429 y 503 | La interfaz no se bloquea | N | E |

---

## 15. Fase 1 — Comprobación estática inicial (sin riesgo)

Se ejecuta primero y antes de tocar nada:

1. `git status` y revisión de lo no confirmado.
2. `npx tsc --noEmit`, `npm run test:unit`, `npm run lint`, `npm run build` (Q-01 a Q-04).
3. Informe de CSS muerto (Q-06).
4. Búsqueda de secretos en Git y en el JavaScript de `.next` (X-09).
5. Instantánea de solo lectura de la base: recuentos, historial de migraciones, columnas y políticas (DBG-01 a DBG-05).
6. Recorrido de humo de solo lectura de la web pública (DP-06).

---

## 16. Cierre y entrega del informe

Al terminar cada fase se generará:

1. Tabla con todas las pruebas: ID, resultado (OK / FALLA / NO PROBADO) y evidencia.
2. Lista de fallos ordenada por gravedad (bloqueante, alta, media, baja) con pasos para reproducirlos.
3. Estado final de la base de datos frente a la instantánea inicial.
4. Lista de cambios de código propuestos (o aplicados, si se indica) para cada fallo.
5. Lista de pruebas no realizables sin intervención humana (tipo M) con instrucciones para hacerlas.
6. Convertir en tests permanentes (en el repositorio) las pruebas U y D que merezca la pena conservar.

---

## 17. Puntos que necesito que valides antes de ejecutar

| N.º | Decisión | Por qué importa |
| --- | --- | --- |
| 1 | **¿Autorizas escribir en el Supabase real con el procedimiento de la sección 0.3?** (solo Bimbache y Meridiano, datos `ZZ-PRUEBA`, limpieza y comprobación final) | Es el único modo de probar el canje real. Bestial no se toca. |
| 2 | **Significado de "vigencia 7 días".** Hoy el último día es *inicio + 7 días*, es decir, **8 días naturales** (inicio 28-sep → caduca 5-oct). ¿Es lo que quieres, o debe ser 7 días en total (hasta el 4-oct)? | Cambia la fecha de caducidad de todos los bonos. |
| 3 | **Fin de vigencia a las 23:59:59 o a las 23:59:00.** Hoy el minuto 23:59 entero es válido. | Define el último segundo útil. |
| 4 | **Cuentas de prueba.** Para las secciones 4 (parte autenticada), 5, 6 y 7 necesito poder crear un administrador y un comercio de prueba (`ZZ-PRUEBA`), o que me facilites unos existentes. | Sin cuentas no se pueden probar permisos ni el escáner. |
| 5 | **Comercio ajeno (A-09).** Al consultar un bono de otro comercio, el escáner muestra el **nombre del otro comercio**. ¿Es aceptable o se debe ocultar? | Posible fuga de información comercial. |
| 6 | **Límite público de consultas (10 cada 15 minutos por IP).** En un evento con wifi compartida podría bloquear a muchos asistentes. ¿Lo mantenemos, lo subimos o lo medimos por otro criterio? | Riesgo de que se bloquee a usuarios legítimos. |
| 7 | **Pruebas con dispositivos reales (tipo M).** ¿Puedes probar tú Safari de iPhone y la cámara en un móvil, o lo dejamos fuera del alcance? | No puedo ejercitar cámara ni Safari desde aquí. |
| 8 | **Producción.** ¿Autorizas pruebas de **solo lectura** sobre `https://elhierro-premia.vercel.app/`? | Sirve para confirmar el despliegue. |
| 9 | **Carga (sección 14).** ¿Aceptas los topes indicados, o prefieres omitirla hasta tener una base de pruebas separada? | Evita saturar la base compartida. |
| 10 | **Migraciones legales sin aplicar.** ¿Las dejamos fuera (textos desde el código) o prefieres moverlos a la base? | Afecta a quién edita los textos legales. |
| 11 | **Fecha de carrera frente a inicio del bono (V-66).** ¿Debe poder empezar el bono antes, el mismo día o después de la carrera? | Define las validaciones del formulario. |
| 12 | **Qué hacer con los fallos.** ¿Los corrijo según los vaya encontrando, o te paso primero el informe? | Controla cuántos cambios entran sin revisión. |
| 13 | **Pruebas agresivas de base de datos (A.5, A.6, A.7).** Incluyen provocar interbloqueos, cortar conexiones con `pg_terminate_backend`, forzar esperas de bloqueo y simular 80 instancias. ¿Las hago sobre el Supabase real (afectan unos segundos a quien lo use, hoy solo tú) o prefieres crear antes una **copia o rama temporal** del proyecto y hacerlas ahí? | Es lo único del plan que podría molestar a otros usuarios de la base. Recomiendo la copia para A.5–A.7 y la base real para el resto. |
| 14 | **Sospecha de fallo BD-W05-04 (canje de bono borrado).** Si se confirma, ¿lo corrijo en cuanto lo detecte? Es un cambio pequeño y seguro en `redeemCoupon` (filtrar `deleted_at`). | Evita que se gasten bonos que el administrador ya eliminó. |
| 15 | **Mantenimiento de datos.** Hoy no se purgan las sesiones caducadas (7 de 7), las tablas de límites ni los eventos. ¿Quieres que proponga e implemente una purga automática, y qué plazo de conservación aplicamos a accesos y auditoría (RGPD)? | Sin purga, las tablas crecen indefinidamente. |
| 16 | **Tabla y función heredadas** (`public_lookup_limits`, `consume_coupon_lookup`): no se usan. ¿Las eliminamos con una migración? | Reduce la superficie de ataque y la confusión. |
| 17 | **Rol de la aplicación en la base.** Hoy usa el rol del *pooler* con privilegios amplios. ¿Creamos un rol con permisos mínimos? | Limita el daño si se filtra la cadena de conexión. |
| 18 | **Trazabilidad.** Hoy no se audita el cambio de fechas/vigencia de una carrera ni las altas de administradores. ¿Quieres que se registren en `audit_events`? | Permite saber quién cambió una fecha que afecta a todos los bonos. |
| 19 | **Cierre de sesión sin transacción (W-10).** Si falla entre las dos sentencias puede quedar un evento de acceso sin cerrar. ¿Lo envolvemos en una transacción? | Coherencia del registro de accesos. |
| 20 | **Fecha de los canjes.** Hoy `created_at` del canje usa la hora de la aplicación, no la de la base (BD-W06-06). ¿Pasamos a `now()` de la base? | Evita desfases si un servidor tiene el reloj mal. |
| 21 | **Comercios de prueba para la concurrencia.** Necesito crear 15 comercios `ZZ-PRUEBA-01…15` con su cuenta (se eliminan al terminar) y emitir 600 bonos en Bimbache. ¿Lo autorizas? | Sin ellos solo se puede probar una cuenta, no la concurrencia real entre comercios. |
| 22 | **Compras hechas sin cobertura y validez (OF-20).** Hoy se valida con la hora a la que **llega** la petición. Una compra hecha dentro de la vigencia (por ejemplo, 23:55) pero sincronizada después de caducar (00:10) se rechaza y se descarta de la cola. ¿Cuál es la regla deseada? Opciones: (a) mantenerlo; (b) validar con la hora de la compra, que el móvil envía, con una tolerancia máxima (por ejemplo, 24 horas); (c) no permitir compras sin conexión. | Es el riesgo económico más claro del modo sin cobertura: el comercio entrega el producto y no cobra. |
| 23 | **¿Se permite cobrar sin conexión?** Hoy sí, pero solo con un bono ya cargado en pantalla, y sin garantía de saldo (otro móvil del mismo comercio pudo gastarlo). ¿Mantener, limitar (por ejemplo, importe máximo sin conexión) o exigir conexión siempre? | Equilibrio entre no parar la caja y no aceptar compras que luego se rechazan. |
| 24 | **Registro de compras rechazadas al sincronizar (OF-30 y OF-32).** Hoy solo hay un aviso temporal y la compra desaparece de la cola. ¿Añadimos una lista persistente de "compras no registradas" en el área del comercio (y avisos al administrador)? | Evita ventas sin cobrar que nadie ve. |
| 25 | **Mejoras del escáner (OF-05, OF-06, OF-29, OF-43).** Propuestas: límite de espera de la petición (por ejemplo, 15 s), aleatoriedad en los reintentos para no sincronizar a 10 móviles a la vez, tratar cualquier respuesta inesperada como reintentable o descartable en lugar de bloquear la cola, y mensaje comprensible ante una respuesta HTML de portal cautivo. ¿Las aplico si las pruebas confirman el problema? | Son cambios pequeños que evitan colas atascadas. |
| 26 | **Navegación privada (OF-42).** Hoy, sin IndexedDB, el cobro no se puede ni intentar. ¿Permitimos cobrar en línea sin cola cuando no se pueda guardar, avisando del riesgo? | Un comercio con el navegador en modo privado no podría cobrar. |
| 27 | **Sincronización en segundo plano (OF-52).** Sin *service worker*, la cola solo se envía con la web abierta. ¿Quieres añadir sincronización en segundo plano (no funciona igual en iPhone)? | Evita que las compras de un día queden sin enviar hasta que alguien abra la web. |
| 28 | **Doble cobro involuntario entre dispositivos (CV-23, CV-25).** Dos móviles del mismo comercio pueden registrar el mismo importe del mismo bono casi a la vez, porque cada uno usa su propia clave. ¿Añadimos un aviso o un bloqueo de unos segundos para el mismo bono e importe? | Evita cobros duplicados por error en cajas distintas. |
| 29 | **Hora del movimiento (OF-31).** El historial muestra la hora de sincronización. ¿Registramos también la hora real de la compra enviada por el móvil (como dato informativo, con tope de desfase)? | Cierre de caja y reclamaciones fiables. |
| 30 | **Pruebas con móvil real (tipo M del bloque B).** Modo avión, túnel, 2G, cambio de wifi a datos y bloqueo de pantalla. ¿Puedes hacerlas tú siguiendo mi guion, con tu móvil y una cuenta de prueba? | No puedo ejercitar radio móvil real desde aquí; la simulación cubre la lógica, no el hardware. |
| 31 | **Tiempo real: ¿lo implemento y con qué enfoque?** El plan recoge el requisito (bloque C) y las 4 opciones de C.10. Recomiendo avisos por canal con Supabase Realtime *Broadcast* más sondeo lento de respaldo. ¿Lo implemento cuando valides el plan, o prefieres otro enfoque? | Hoy **no existe** ninguna actualización en vivo; es el requisito que más cambia el comportamiento de la web. |
| 32 | **Alcance y frecuencia por tipo de pantalla.** Administración y comercios: objetivo ≤ 2 s. ¿El público (clientes con su bono abierto, portada, directorio) también en vivo, o cada 15–30 s? | Coste y escalado: el público puede ser mucho más numeroso. |
| 33 | **Indicador de estado.** ¿Mostramos un pequeño "En directo / Reconectando" en administración y en el área del comercio? | Permite saber si se está viendo la información al día. |
| 34 | **Cambio remoto con un formulario sin guardar.** Por ejemplo, otro administrador cambia las fechas mientras tú editas. ¿Avisamos y no tocamos lo escrito (recomendado) o sobrescribimos? | Evita perder trabajo o guardar sobre datos desactualizados. |
| 35 | **Cuenta compartida frente a una cuenta por empleado.** Hoy cada comercio tiene una cuenta única: un bloqueo por contraseña errónea (5 fallos, 15 minutos) afecta a todas las personas de la tienda, y los movimientos no dicen quién cobró. ¿Cambiamos a cuentas por empleado (o un PIN / nombre del cajero)? | Trazabilidad y continuidad de la caja (ST-06, ST-09). |
| 36 | **Nuevos servicios.** ¿Aceptas usar Supabase Realtime (ya forma parte del plan de Supabase, con cuotas) o prefieres no añadir servicios y resolverlo con sondeo? | Depende de coste y de cuántas pantallas simultáneas haya. |
| 37 | **Volumen esperado el día del evento.** ¿Cuántas pantallas abiertas a la vez estimas (administradores, comercios y clientes)? | Dimensiona las pruebas RT-80 a RT-83 y la elección de enfoque. |

---

## Resumen de cobertura

Recuento real de pruebas numeradas en este documento.

| Bloque | Pruebas |
| --- | --- |
| **A. Acciones contra la base de datos (prioritario)** | **276** |
| **B. Validaciones concurrentes, varias personas por tienda y pérdida de cobertura (prioritario)** | **125** |
| **C. Actualización en tiempo real (prioritario, requisito aún no implementado)** | **82** |
| 1. Vigencia y caducidad | 53 |
| 2. Emisión de lotes | 25 |
| 3. Canje | 44 |
| 4. API | 26 |
| 5. Autenticación y permisos | 38 |
| 6. Panel de administración | 41 |
| 7. Portal del comercio y escáner | 21 |
| 8. Páginas públicas y legales | 55 |
| 9. Seguridad | 22 |
| 10. Base de datos y migraciones (comprobaciones generales) | 14 |
| 11. Visual, responsive y accesibilidad | 37 |
| 12. Clima y servicios externos | 12 |
| 13. Código, compilación y despliegue | 20 |
| 14. Rendimiento y resistencia | 13 |
| **Total** | **904** |

Desglose del bloque B: 17 de varios comercios a la vez (CV-01 a CV-17), 15 sobre el mismo bono (CV-20 a CV-34), 8 de límites y avalancha de reintentos (CV-40 a CV-47), 8 de infraestructura en paralelo (CV-50 a CV-57), 14 de pérdida de cobertura en cada punto del flujo (OF-01 a OF-14), 16 de sincronización posterior (OF-20 a OF-35), 13 de persistencia local (OF-40 a OF-52), 10 de experiencia en caja (OF-60 a OF-69) 9 de redes adversas (OF-70 a OF-78) y 15 de varias personas de la misma tienda (ST-01 a ST-15).

Desglose del bloque C: 12 de canjes y movimientos (RT-01 a RT-12), 10 de emisión, borrado y configuración (RT-20 a RT-29), 10 de comercios, cuentas y accesos (RT-30 a RT-39), 6 de cambios por el paso del tiempo (RT-40 a RT-45), 14 de comportamiento de la interfaz (RT-50 a RT-5D), 12 de conexión y recuperación (RT-60 a RT-6B), 9 de seguridad de los datos en directo (RT-70 a RT-78) y 9 de carga y coste (RT-80 a RT-88).

Desglose del bloque A: 18 lecturas (BD-L), 138 pruebas específicas por escritura (BD-W), 36 restricciones directas (BD-K), 14 de concurrencia y bloqueos (BD-X), 12 de fallos de infraestructura (BD-F), 12 de mantenimiento (BD-M), 12 de migraciones (BD-G), 14 de seguridad (BD-S) y 20 auditorías de integridad (BD-I).
