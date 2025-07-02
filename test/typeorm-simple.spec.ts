import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGliteDriver } from '../src/pglite-driver.js';

describe('TypeORM Simple Integration with PGliteDriver', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
        dataSource = new DataSource({
            type: 'postgres',
            driver: PGliteDriver(),
            synchronize: false,
            logging: false,
        });

        await dataSource.initialize();
    });

    afterEach(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    describe('Basic Functionality', () => {
        it('should initialize DataSource successfully', () => {
            expect(dataSource.isInitialized).toBe(true);
        });

        it('should execute raw SQL queries', async () => {
            const result = await dataSource.query('SELECT 1 as test_value');
            expect(result).toEqual([{ test_value: 1 }]);
        });

        it('should create and query tables', async () => {
            // Create table
            await dataSource.query(`
                CREATE TABLE test_users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Insert data
            await dataSource.query('INSERT INTO test_users (name, email) VALUES ($1, $2)', ['John Doe', 'john@example.com']);

            // Query data
            const users = await dataSource.query('SELECT * FROM test_users');
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('John Doe');
            expect(users[0].email).toBe('john@example.com');
        });

        it('should handle transactions', async () => {
            // Create table
            await dataSource.query(`
                CREATE TABLE test_transactions (
                    id SERIAL PRIMARY KEY,
                    value VARCHAR(255) NOT NULL
                )
            `);

            // Test successful transaction
            await dataSource.transaction(async manager => {
                await manager.query('INSERT INTO test_transactions (value) VALUES ($1)', ['transaction_value']);
            });

            // Verify data was committed
            const result = await dataSource.query('SELECT * FROM test_transactions');
            expect(result).toHaveLength(1);
            expect(result[0].value).toBe('transaction_value');

            // Test rollback on error
            try {
                await dataSource.transaction(async manager => {
                    await manager.query('INSERT INTO test_transactions (value) VALUES ($1)', ['rollback_value']);
                    throw new Error('Simulated error');
                });
            } catch (error) {
                expect(error.message).toBe('Simulated error');
            }

            // Verify rollback occurred
            const finalResult = await dataSource.query('SELECT * FROM test_transactions');
            expect(finalResult).toHaveLength(1); // Only the first transaction should persist
        });

        it('should handle parameterized queries', async () => {
            await dataSource.query(`
                CREATE TABLE test_params (
                    id SERIAL PRIMARY KEY,
                    text_val TEXT,
                    int_val INTEGER,
                    bool_val BOOLEAN,
                    null_val TEXT
                )
            `);

            await dataSource.query('INSERT INTO test_params (text_val, int_val, bool_val, null_val) VALUES ($1, $2, $3, $4)', ['test string', 42, true, null]);

            const result = await dataSource.query('SELECT * FROM test_params');
            expect(result).toHaveLength(1);
            expect(result[0].text_val).toBe('test string');
            expect(result[0].int_val).toBe(42);
            expect(result[0].bool_val).toBe(true);
            expect(result[0].null_val).toBeNull();
        });

        it('should handle multiple statements', async () => {
            const multiQuery = `
                CREATE TABLE multi_test (id SERIAL, name VARCHAR(255));
                INSERT INTO multi_test (name) VALUES ('test1');
                INSERT INTO multi_test (name) VALUES ('test2');
            `;

            await dataSource.query(multiQuery);
            const result = await dataSource.query('SELECT * FROM multi_test ORDER BY id');
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('test1');
            expect(result[1].name).toBe('test2');
        });

        it('should handle boolean serialization', async () => {
            await dataSource.query(`
                CREATE TABLE bool_test (
                    id SERIAL PRIMARY KEY,
                    bool_col BOOLEAN
                )
            `);

            // Test various boolean inputs
            await dataSource.query('INSERT INTO bool_test (bool_col) VALUES ($1), ($2), ($3), ($4), ($5), ($6)', [true, false, 'true', 'false', 1, 0]);

            const result = await dataSource.query('SELECT * FROM bool_test ORDER BY id');
            expect(result).toHaveLength(6);
            expect(result[0].bool_col).toBe(true);
            expect(result[1].bool_col).toBe(false);
            expect(result[2].bool_col).toBe(true);
            expect(result[3].bool_col).toBe(false);
            expect(result[4].bool_col).toBe(true);
            expect(result[5].bool_col).toBe(false);
        });

        it('should handle special characters and unicode', async () => {
            await dataSource.query(`
                CREATE TABLE unicode_test (
                    id SERIAL PRIMARY KEY,
                    text_val TEXT
                )
            `);

            const testText = 'Special chars: éñçüöä 中文 русский 🚀';
            await dataSource.query('INSERT INTO unicode_test (text_val) VALUES ($1)', [testText]);

            const result = await dataSource.query('SELECT * FROM unicode_test');
            expect(result).toHaveLength(1);
            expect(result[0].text_val).toBe(testText);
        });

        it('should handle query errors gracefully', async () => {
            await expect(dataSource.query('SELECT * FROM non_existent_table')).rejects.toThrow();
        });

        it('should handle connection cleanup', async () => {
            expect(dataSource.isInitialized).toBe(true);
            await dataSource.destroy();
            expect(dataSource.isInitialized).toBe(false);
        });
    });

    describe('Driver Options', () => {
        it('should work with PGlite options', async () => {
            const dataSourceWithOptions = new DataSource({
                type: 'postgres',
                driver: PGliteDriver({
                    extensions: {},
                }),
                synchronize: false,
                logging: false,
            });

            await dataSourceWithOptions.initialize();
            expect(dataSourceWithOptions.isInitialized).toBe(true);

            const result = await dataSourceWithOptions.query('SELECT 1 as test');
            expect(result).toEqual([{ test: 1 }]);

            await dataSourceWithOptions.destroy();
        });
    });
});
