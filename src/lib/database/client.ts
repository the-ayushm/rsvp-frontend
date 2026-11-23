import { randomBytes, randomUUID } from 'node:crypto';
import { models } from './schema';
import type { ModelName, ModelDefinition, FieldDefinition, FindOptions, WriteOptions, UpsertOptions, Resolved, Input, SqlExecutor, SqlPool, TransactionOptions } from './types';

const record = (value: unknown): Input => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) throw new Error('Expected a database query object.');
  return value as Input;
};
export const quoteIdentifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const bindValue = (field: FieldDefinition, value: unknown) =>
  value instanceof Date ? value.toISOString() : field.type === 'json' && value !== null ? JSON.stringify(value) : value;
const tableName = (schema: string, model: ModelDefinition) => `${quoteIdentifier(schema)}.${quoteIdentifier(model.table)}`;
const fieldOf = (model: ModelDefinition, name: string) => {
  const field = model.fields[name];
  if (!field) throw new Error(`Unknown field ${model.table}.${name}`);
  return field;
};

class Parameters {
  values: unknown[] = [];
  alias = 0;
  add(value: unknown) { this.values.push(value); return `$${this.values.length}`; }
}

function scalarFilter(column: string, value: unknown, field: FieldDefinition, params: Parameters): string {
  if (value === null) return `${column} IS NULL`;
  if (typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value) || Array.isArray(value)) {
    return `${column} = ${params.add(bindValue(field, value))}`;
  }
  const filter = record(value), conditions: string[] = [];
  for (const [operator, operand] of Object.entries(filter)) {
    if (operand === undefined || operator === 'mode') continue;
    if (operator === 'equals') conditions.push(scalarFilter(column, operand, field, params));
    else if (operator === 'not') conditions.push(`NOT (${scalarFilter(column, operand, field, params)})`);
    else if (['lt', 'lte', 'gt', 'gte'].includes(operator)) {
      const comparison = { lt: '<', lte: '<=', gt: '>', gte: '>=' }[operator];
      conditions.push(`${column} ${comparison} ${params.add(bindValue(field, operand))}`);
    } else if (operator === 'in' || operator === 'notIn') {
      if (!Array.isArray(operand)) throw new Error(`${operator} requires an array.`);
      conditions.push(operand.length ? `${column} ${operator === 'in' ? 'IN' : 'NOT IN'} (${operand.map(v => params.add(bindValue(field, v))).join(', ')})` : operator === 'in' ? 'FALSE' : 'TRUE');
    } else if (['contains', 'startsWith', 'endsWith'].includes(operator)) {
      if (typeof operand !== 'string') throw new Error(`${operator} requires a string.`);
      const escaped = operand.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
      const pattern = `${operator !== 'startsWith' ? '%' : ''}${escaped}${operator !== 'endsWith' ? '%' : ''}`;
      conditions.push(`${column} ${filter.mode === 'insensitive' ? 'ILIKE' : 'LIKE'} ${params.add(pattern)}`);
    } else throw new Error(`Unsupported filter ${operator}.`);
  }
  return conditions.length ? conditions.map(c => `(${c})`).join(' AND ') : 'TRUE';
}

function whereSql(model: ModelDefinition, where: Input | undefined, params: Parameters, schema: string, alias = 't'): string {
  const clauses: string[] = [];
  for (const [name, value] of Object.entries(where ?? {})) {
    if (value === undefined) continue;
    if (['AND', 'OR', 'NOT'].includes(name)) {
      const items = Array.isArray(value) ? value : [value];
      const parts = items.map(v => whereSql(model, record(v), params, schema, alias));
      clauses.push(name === 'NOT' ? parts.map(p => `NOT (${p})`).join(' AND ') || 'TRUE'
        : parts.length ? parts.map(p => `(${p})`).join(name === 'OR' ? ' OR ' : ' AND ') : name === 'OR' ? 'FALSE' : 'TRUE');
    } else if (model.fields[name]) {
      clauses.push(scalarFilter(`${quoteIdentifier(alias)}.${quoteIdentifier(model.fields[name].column)}`, value, model.fields[name], params));
    } else if (model.relations[name]) {
      const relation = model.relations[name], target = models[relation.model], next = `r${++params.alias}`;
      const matches = relation.local.map((local, i) => `${quoteIdentifier(next)}.${quoteIdentifier(fieldOf(target, relation.foreign[i]).column)} = ${quoteIdentifier(alias)}.${quoteIdentifier(fieldOf(model, local).column)}`);
      const condition = record(value), keys = Object.keys(condition);
      const wrapper = keys.length === 1 && ['some', 'none', 'is', 'isNot', 'every'].includes(keys[0]) ? keys[0] : null;
      const nested = wrapper ? record(condition[wrapper]) : condition;
      const nestedSql = whereSql(target, nested, params, schema, next);
      const exists = `EXISTS (SELECT 1 FROM ${tableName(schema, target)} AS ${quoteIdentifier(next)} WHERE ${matches.join(' AND ')} AND ${wrapper === 'every' ? `NOT (${nestedSql})` : `(${nestedSql})`})`;
      clauses.push(['none', 'isNot', 'every'].includes(wrapper ?? '') ? `NOT (${exists})` : exists);
    } else {
      const composite = model.unique.find(fields => fields.length > 1 && fields.join('_') === name);
      if (!composite) throw new Error(`Unknown filter ${model.table}.${name}`);
      const compound = record(value);
      if (Object.keys(compound).some(k => !composite.includes(k)) || composite.some(k => compound[k] === undefined)) throw new Error(`Incomplete compound key ${name}.`);
      clauses.push(whereSql(model, compound, params, schema, alias));
    }
  }
  return clauses.length ? clauses.map(c => `(${c})`).join(' AND ') : 'TRUE';
}

function selection(model: ModelDefinition, options: FindOptions) {
  if (options.select && options.include) throw new Error('Use select or include, not both.');
  const requested = options.select ?? options.include ?? {};
  for (const [name, value] of Object.entries(requested)) {
    if (!value) continue;
    if (!model.fields[name] && !model.relations[name]) throw new Error(`Unknown selected field ${model.table}.${name}`);
  }
  const names = options.select ? Object.keys(options.select).filter(k => options.select![k] && model.fields[k]) : Object.keys(model.fields);
  for (const [name, value] of Object.entries(requested)) if (value && model.relations[name]) names.push(...model.relations[name].local);
  if (!names.length) names.push(model.primaryKey);
  return [...new Set(names)].map(name => `${quoteIdentifier(fieldOf(model, name).column)} AS ${quoteIdentifier(name)}`).join(', ');
}

function orderSql(model: ModelDefinition, options: FindOptions) {
  const items = Array.isArray(options.orderBy) ? options.orderBy : options.orderBy ? [options.orderBy] : [];
  return items.flatMap(item => Object.entries(item).map(([name, direction]) => {
    if (direction !== 'asc' && direction !== 'desc') throw new Error('Invalid sort direction.');
    return `${quoteIdentifier(fieldOf(model, name).column)} ${direction.toUpperCase()}`;
  })).join(', ');
}

function createData(model: ModelDefinition, input: Input): Input {
  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  for (const [name, field] of Object.entries(model.fields)) {
    if (data[name] === undefined && field.idDefault) data[name] = field.idDefault === 'uuid' ? randomUUID() : `c${randomBytes(12).toString('hex')}`;
    if (data[name] === undefined && field.updatedAt) data[name] = new Date();
  }
  for (const name of Object.keys(data)) fieldOf(model, name);
  return data;
}

function assignments(model: ModelDefinition, input: Input, params: Parameters, updating = true) {
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  if (updating) for (const [name, field] of Object.entries(model.fields)) if (field.updatedAt && data[name] === undefined) data[name] = new Date();
  return Object.entries(data).map(([name, value]) => {
    const field = fieldOf(model, name), column = quoteIdentifier(field.column);
    if (field.type !== 'json' && value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      const change = record(value), keys = Object.keys(change);
      if (keys.length !== 1 || !['set', 'increment', 'decrement', 'multiply', 'divide'].includes(keys[0])) throw new Error(`Unsupported update for ${name}.`);
      const op = keys[0], operand = change[op];
      if (op === 'set') return `${column} = ${params.add(bindValue(field, operand))}`;
      if (!['integer', 'float', 'decimal', 'bigint'].includes(field.type) || (typeof operand !== 'number' && typeof operand !== 'bigint')) throw new Error(`Invalid arithmetic update for ${name}.`);
      const symbol = { increment: '+', decrement: '-', multiply: '*', divide: '/' }[op];
      return `${column} = "t".${column} ${symbol} ${params.add(operand)}`;
    }
    return `${column} = ${params.add(bindValue(field, value))}`;
  });
}

export class Repository<K extends ModelName> {
  private model: ModelDefinition;
  constructor(private database: DatabaseClient, private name: K) { this.model = models[name]; }

  async findMany<A extends FindOptions>(options: A = {} as A, forUpdate = false): Promise<Resolved<K, A>[]> {
    for (const name of Object.keys(options)) if (!['where', 'select', 'include', 'orderBy', 'take', 'skip'].includes(name)) throw new Error(`Unsupported query option ${name}.`);
    const params = new Parameters(), columns = selection(this.model, options);
    let sql = `SELECT ${columns} FROM ${tableName(this.database.schema, this.model)} AS "t" WHERE ${whereSql(this.model, options.where, params, this.database.schema)}`;
    const order = orderSql(this.model, options);
    if (order) sql += ` ORDER BY ${order}`;
    for (const key of ['take', 'skip'] as const) if (options[key] !== undefined) {
      const value = options[key];
      if (!Number.isSafeInteger(value) || value! < 0) throw new Error(`${key} must be a non-negative integer.`);
      sql += ` ${key === 'take' ? 'LIMIT' : 'OFFSET'} ${params.add(value)}`;
    }
    if (forUpdate) sql += ' FOR UPDATE';
    const result = await this.database.execute(sql, params.values);
    return await this.hydrate(result.rows, options) as Resolved<K, A>[];
  }
  async findFirst<A extends FindOptions>(options: A): Promise<Resolved<K, A> | null> {
    const rows = await this.findMany({ ...options, take: 1 });
    return (rows[0] ?? null) as Resolved<K, A> | null;
  }
  findUnique<A extends FindOptions>(options: A) { this.requireWhere(options); return this.findFirst(options); }
  async findUniqueForUpdate<A extends FindOptions>(options: A): Promise<Resolved<K, A> | null> {
    this.requireWhere(options);
    return ((await this.findMany({ ...options, take: 1 }, true))[0] ?? null) as Resolved<K, A> | null;
  }

  async count(options: Pick<FindOptions, 'where'> = {}) {
    const params = new Parameters();
    const result = await this.database.execute(`SELECT COUNT(*) AS "count" FROM ${tableName(this.database.schema, this.model)} AS "t" WHERE ${whereSql(this.model, options.where, params, this.database.schema)}`, params.values);
    return Number(result.rows[0].count);
  }
  async create<A extends WriteOptions>(options: A): Promise<Resolved<K, A>> {
    selection(this.model, options);
    const params = new Parameters(), data = createData(this.model, options.data), names = Object.keys(data);
    const sql = `INSERT INTO ${tableName(this.database.schema, this.model)} ${names.length ? `(${names.map(n => quoteIdentifier(fieldOf(this.model, n).column)).join(', ')}) VALUES (${names.map(n => params.add(bindValue(this.model.fields[n], data[n]))).join(', ')})` : 'DEFAULT VALUES'} RETURNING ${selection(this.model, options)}`;
    const result = await this.database.execute(sql, params.values);
    return (await this.hydrate(result.rows, options))[0] as Resolved<K, A>;
  }
  async update<A extends WriteOptions>(options: A): Promise<Resolved<K, A>> {
    this.requireWhere(options);
    const params = new Parameters(), updates = assignments(this.model, options.data, params), columns = selection(this.model, options);
    if (!updates.length) {
      const row = await this.findFirst(this.readOptions(options));
      if (!row) throw new Error(`No ${this.model.table} record matched the update.`);
      return row as Resolved<K, A>;
    }
    const result = await this.database.execute(`UPDATE ${tableName(this.database.schema, this.model)} AS "t" SET ${updates.join(', ')} WHERE ${whereSql(this.model, options.where, params, this.database.schema)} RETURNING ${columns}`, params.values);
    if (result.rows.length !== 1) throw new Error(`Expected one ${this.model.table} record for update; got ${result.rows.length}.`);
    return (await this.hydrate(result.rows, options))[0] as Resolved<K, A>;
  }
  async updateMany(options: { where?: Input; data: Input }) {
    const params = new Parameters(), updates = assignments(this.model, options.data, params);
    if (!updates.length) return { count: 0 };
    const result = await this.database.execute(`UPDATE ${tableName(this.database.schema, this.model)} AS "t" SET ${updates.join(', ')} WHERE ${whereSql(this.model, options.where, params, this.database.schema)}`, params.values);
    return { count: result.rowCount ?? 0 };
  }
  async deleteMany(options: { where?: Input } = {}) {
    const params = new Parameters();
    const result = await this.database.execute(`DELETE FROM ${tableName(this.database.schema, this.model)} AS "t" WHERE ${whereSql(this.model, options.where, params, this.database.schema)}`, params.values);
    return { count: result.rowCount ?? 0 };
  }
  async upsert<A extends UpsertOptions>(options: A): Promise<Resolved<K, A>> {
    this.requireWhere(options);
    const where = options.where, keys = Object.keys(where);
    const compound = keys.length === 1 ? this.model.unique.find(group => group.length > 1 && group.join('_') === keys[0]) : undefined;
    const keyValues = compound ? record(where[keys[0]]) : where;
    const fields = this.model.unique.find(group => group.length === Object.keys(keyValues).length && group.every(f => keyValues[f] !== undefined && keyValues[f] !== null && (typeof keyValues[f] !== 'object')));
    if (!fields) throw new Error(`Upsert requires a complete unique key on ${this.model.table}.`);
    const data = createData(this.model, options.create);
    for (const field of fields) if (data[field] === undefined) data[field] = keyValues[field];
    for (const field of fields) if (data[field] !== keyValues[field]) throw new Error(`Upsert create data does not match its ${field} selector.`);
    const params = new Parameters(), names = Object.keys(data), updates = assignments(this.model, options.update, params);
    // Even an empty update returns the conflicting row atomically.
    if (!updates.length) { const col = quoteIdentifier(fieldOf(this.model, fields[0]).column); updates.push(`${col} = EXCLUDED.${col}`); }
    const sql = `INSERT INTO ${tableName(this.database.schema, this.model)} AS "t" (${names.map(n => quoteIdentifier(fieldOf(this.model, n).column)).join(', ')}) VALUES (${names.map(n => params.add(bindValue(fieldOf(this.model, n), data[n]))).join(', ')}) ON CONFLICT (${fields.map(n => quoteIdentifier(fieldOf(this.model, n).column)).join(', ')}) DO UPDATE SET ${updates.join(', ')} RETURNING ${selection(this.model, options)}`;
    const result = await this.database.execute(sql, params.values);
    return (await this.hydrate(result.rows, options))[0] as Resolved<K, A>;
  }

  private readOptions(options: FindOptions): FindOptions { return { where: options.where, select: options.select, include: options.include }; }
  private requireWhere(options: FindOptions) {
    if (!options.where || !Object.values(options.where).some(v => v !== undefined)) throw new Error('A record selector is required.');
    // Single-row writes must have an actual unique key, even with extra tenant filters.
    const keys = Object.keys(options.where);
    if (!this.model.unique.some(fields => fields.every(f => options.where![f] !== undefined && options.where![f] !== null && typeof options.where![f] !== 'object') || (fields.length > 1 && keys.includes(fields.join('_'))))) throw new Error(`A unique selector is required for ${this.model.table}.`);
  }
  private async hydrate(rows: Input[], options: FindOptions): Promise<Input[]> {
    const requested = options.select ?? options.include ?? {};
    for (const [name, requestedOptions] of Object.entries(requested)) {
      const relation = this.model.relations[name];
      if (!relation || !requestedOptions) continue;
      const query = requestedOptions === true ? {} : requestedOptions as FindOptions;
      const filters = rows.filter(row => relation.local.every(k => row[k] !== null && row[k] !== undefined)).map(row => Object.fromEntries(relation.foreign.map((k, i) => [k, row[relation.local[i]]])));
      if (!filters.length) { for (const row of rows) row[name] = relation.many ? [] : null; continue; }
      // Current includes are unpaginated. Batch loads avoid one query per parent.
      if (query.take !== undefined || query.skip !== undefined || query.select) {
        for (const row of rows) {
          if (relation.local.some(k => row[k] === null || row[k] === undefined)) { row[name] = relation.many ? [] : null; continue; }
          const keys = Object.fromEntries(relation.foreign.map((k, i) => [k, row[relation.local[i]]]));
          const children = await this.database.repository(relation.model as ModelName).findMany({ ...query, where: { AND: [keys, query.where ?? {}] } });
          row[name] = relation.many ? children : children[0] ?? null;
        }
      } else {
        const children = await this.database.repository(relation.model as ModelName).findMany({ ...query, where: { AND: [{ OR: filters }, query.where ?? {}] } }) as unknown as Input[];
        for (const row of rows) {
          const matches = children.filter(child => relation.local.every((k, i) => row[k] === child[relation.foreign[i]]));
          row[name] = relation.many ? matches : matches[0] ?? null;
        }
      }
    }
    return options.select ? rows.map(row => Object.fromEntries(Object.entries(options.select!).filter(([, requested]) => requested).map(([name]) => [name, row[name]]))) : rows;
  }
}

export type Database = DatabaseClient & { [K in ModelName]: Repository<K> };
export type TransactionClient = Database;

export class DatabaseClient {
  private closed = false;
  constructor(private executor: SqlExecutor, readonly schema = 'public', private pool?: SqlPool) {}
  repository<K extends ModelName>(name: K): Repository<K> { return (this as unknown as Database)[name] as Repository<K>; }
  execute(text: string, values: unknown[] = []) {
    if (this.closed) throw new Error('This database transaction has already ended.');
    return this.executor.query(text, values);
  }
  async sql<T = Input[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const text = strings.reduce((sql, part, i) => sql + (i ? `$${i}` : '') + part, '');
    return (await this.execute(text, values)).rows as T;
  }
  async transaction<T>(run: (tx: TransactionClient) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    if (!this.pool) throw new Error('Nested database transactions are not supported.');
    const levels = { ReadCommitted: 'READ COMMITTED', RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE' };
    const isolation = levels[options.isolationLevel ?? 'ReadCommitted'];
    if (!isolation) throw new Error('Invalid transaction isolation level.');
    const timeout = options.timeout ?? 10000;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error('Transaction timeout must be positive.');
    const client = await this.pool.connect(), tx = createDatabase(client, this.schema);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let releaseError: Error | undefined;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      await client.query("SELECT set_config('statement_timeout', $1, true), set_config('idle_in_transaction_session_timeout', $1, true)", [String(timeout)]);
      const value = await Promise.race([
        run(tx),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { tx.closed = true; reject(new Error('Database transaction timed out.')); }, timeout); }),
      ]);
      tx.closed = true;
      clearTimeout(timer);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      tx.closed = true;
      clearTimeout(timer);
      try { await client.query('ROLLBACK'); } catch (rollbackError) { releaseError = rollbackError as Error; }
      throw error;
    } finally {
      clearTimeout(timer);
      // A failed rollback destroys the connection instead of returning it to the pool.
      client.release(releaseError);
    }
  }
  async close() { if (this.pool) await this.pool.end(); this.closed = true; }
}

export function createDatabase(executor: SqlExecutor, schema = 'public', pool?: SqlPool): Database {
  const database = new DatabaseClient(executor, schema, pool) as Database;
  for (const name of Object.keys(models) as ModelName[]) Object.defineProperty(database, name, { value: new Repository(database, name) });
  return database;
}
