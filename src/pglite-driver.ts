import EventEmitter from 'node:events';
import { PGlite, type PGliteOptions, type Results, types } from '@electric-sql/pglite';

const noop = () => {};

type QueryCallback = (error: unknown, results: Results<unknown> | null) => void;

type FieldDef = {
    name: string;
    dataTypeID: number;
};

type QueryResultBase = {
    command?: string;
    rowCount: number | null;
    fields: FieldDef[];
};

type QueryResultRow = {
    [column: string]: any;
};

type QueryResult<R extends QueryResultRow = any> = QueryResultBase & {
    rows: R[];
};

export interface PGlitePool {
    connect: (callback: (error: unknown, client: PGlitePool | null, done: (...args: unknown[]) => void) => void) => void;
    query: (sqlQuery: string, params?: any[], callback?: QueryCallback) => Promise<QueryResult>;
    end: (cb: (error: unknown | null) => void) => void;
}

const getPool = (pgliteOptions?: PGliteOptions) =>
    class extends EventEmitter implements PGlitePool {
        private connection: PGlite | null = null;

        public async connect(callback: (error: unknown, client: this | null, done: (...args: unknown[]) => void) => void) {
            if (this.connection) {
                callback(null, this, noop);
                return;
            }

            try {
                this.connection = await PGlite.create({
                    ...pgliteOptions,
                    serializers: {
                        [types.BOOL]: val => {
                            if (val === 'true') return 'TRUE';
                            if (val === true) return 'TRUE';
                            if (val === 'false') return 'FALSE';
                            if (val === false) return 'FALSE';
                            if (val === 1) return 'TRUE';
                            if (val === 0) return 'FALSE';
                            return val;
                        },
                        ...pgliteOptions?.serializers,
                    },
                });
                callback(null, this, noop);
            } catch (error) {
                callback(error, null, noop);
            }
        }

        public async query(sqlQuery: string, cb?: QueryCallback): Promise<QueryResult>;
        public async query(sqlQuery: string, params?: any[], callback?: QueryCallback): Promise<QueryResult>;
        public async query(sqlQuery: string, paramsOrCb?: any[] | QueryCallback, cb?: QueryCallback): Promise<QueryResult> {
            if (!this.connection) {
                throw new Error('expected connection to be initialized, did you call DataSource.initialize()?');
            }

            let queryCb = cb;
            let queryParams = paramsOrCb;

            if (typeof paramsOrCb === 'function') {
                queryCb = paramsOrCb;
                queryParams = undefined;
            }

            // esm-only in cjs context
            const { parseQuerySync } = await import('@pg-nano/pg-parser');
            const parsedSqlQuery = parseQuerySync(sqlQuery);

            // for multiple statement queries with no params, use pglite.exec, since this api accepts running multiple sql statements but doesn't support params
            if (parsedSqlQuery.stmts.length > 1)
                try {
                    const results = await this.connection.exec(sqlQuery);
                    const res = results[0];
                    cb?.(null, res as unknown as Results<unknown>);
                    return { rows: res?.rows ?? [], fields: res?.fields ?? [], rowCount: res?.affectedRows ?? null };
                } catch (error) {
                    cb?.(error, null);
                    throw error;
                }

            try {
                const results = await this.connection.query(sqlQuery, queryParams as any[]);
                let command: string | undefined;
                if (parsedSqlQuery?.stmts?.[0]?.stmt?.UpdateStmt) {
                    command = 'UPDATE';
                } else if (parsedSqlQuery?.stmts?.[0]?.stmt?.DeleteStmt) {
                    command = 'DELETE';
                } else if (parsedSqlQuery?.stmts?.[0]?.stmt?.InsertStmt) {
                    command = 'INSERT';
                } else if (parsedSqlQuery?.stmts?.[0]?.stmt?.SelectStmt) {
                    command = 'SELECT';
                }

                queryCb?.(null, results);
                return { rows: results?.rows ?? [], fields: results?.fields ?? [], rowCount: results?.affectedRows ?? null, command };
            } catch (error) {
                queryCb?.(error, null);
                throw error;
            }
        }

        public end(cb: (error: unknown | null) => void) {
            this.connection
                ?.close()
                .then(() => {
                    this.connection = null;
                    cb(null);
                })
                .catch(error => cb(error));
        }
    };

export const PGliteDriver = (pgliteOptions?: PGliteOptions): { Pool: PGlitePool; Client: PGlitePool } => {
    const pgPool = getPool(pgliteOptions) as unknown as PGlitePool;
    return {
        Pool: pgPool,
        Client: pgPool,
    };
};
