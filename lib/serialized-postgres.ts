import type { ParameterOrFragment, Row, RowList, Sql, TransactionSql } from "postgres";

/** The Supabase transaction pooler cannot safely handle postgres.js pipelining. */
export function serializePostgres(client: Sql) {
  let pending: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => PromiseLike<T>): Promise<T> {
    const result = pending.then(operation);
    // A failed query must not prevent later requests from reaching the database.
    pending = result.catch(() => undefined);
    return result;
  }

  function query<T extends readonly (object | undefined)[] = Row[]>(
    template: TemplateStringsArray,
    ...parameters: readonly ParameterOrFragment<never>[]
  ): Promise<RowList<T>> {
    return enqueue(() => client<T>(template, ...parameters));
  }

  return Object.assign(query, {
    // Keep the entire transaction exclusive, including BEGIN and COMMIT/ROLLBACK.
    // Await transaction queries sequentially inside the callback.
    begin<T>(operation: (transaction: TransactionSql) => Promise<T>) {
      return enqueue(() => client.begin(operation));
    },
  });
}
