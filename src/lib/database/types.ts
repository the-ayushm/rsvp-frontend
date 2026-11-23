import type { BaseRows, RelationRows } from './records';

export type ModelName = keyof BaseRows;
export interface FieldDefinition {
  column: string;
  type: 'integer' | 'float' | 'string' | 'boolean' | 'date' | 'json' | 'bigint' | 'decimal' | 'bytes' | 'enum';
  optional: boolean;
  updatedAt?: boolean;
  nowDefault?: boolean;
  idDefault?: 'uuid' | 'cuid';
}
export interface ModelDefinition {
  table: string;
  primaryKey: string;
  fields: Record<string, FieldDefinition>;
  unique: string[][];
  relations: Record<string, { model: string; local: string[]; foreign: string[]; many: boolean; optional: boolean }>;
}
export type Input = Record<string, unknown>;
export interface FindOptions {
  where?: Input;
  select?: Record<string, boolean | FindOptions>;
  include?: Record<string, boolean | FindOptions>;
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
  take?: number;
  skip?: number;
}
export interface WriteOptions extends FindOptions { data: Input }
export interface UpsertOptions extends FindOptions { where: Input; create: Input; update: Input }

type Related<K extends ModelName, P extends keyof RelationRows[K], A> =
  RelationRows[K][P] extends { model: infer M extends ModelName; many: infer Many; optional: infer Optional }
    ? Many extends true ? Resolved<M, A>[] : Optional extends true ? Resolved<M, A> | null : Resolved<M, A>
    : never;
type Relations<K extends ModelName, A> = {
  [P in keyof A & keyof RelationRows[K]]: Related<K, P, A[P]>;
};
export type Resolved<K extends ModelName, A> =
  A extends { select: infer S } ? Pick<BaseRows[K], keyof S & keyof BaseRows[K]> & Relations<K, S>
    : BaseRows[K] & (A extends { include: infer I } ? Relations<K, I> : object);

// The SQL executor is injected in tests; production supplies a pg Pool/client.
export interface SqlResult { rows: Record<string, unknown>[]; rowCount: number | null }
export interface SqlExecutor { query(text: string, values?: unknown[]): Promise<SqlResult> }
export interface SqlConnection extends SqlExecutor { release(error?: Error): void }
export interface SqlPool extends SqlExecutor { connect(): Promise<SqlConnection>; end(): Promise<void> }
export interface TransactionOptions {
  isolationLevel?: 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  timeout?: number;
}
