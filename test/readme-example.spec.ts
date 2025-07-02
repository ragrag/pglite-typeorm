import { DataSource, type DataSourceOptions } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGliteDriver } from '../src/pglite-driver.js';

describe('README Example Usage', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
        // This is the exact pattern from the README
        const dataSourceOptions: DataSourceOptions = {
            type: 'postgres',
            synchronize: false,
            driver: PGliteDriver(),
        };

        dataSource = new DataSource(dataSourceOptions);
        await dataSource.initialize();
    });

    afterEach(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it('should work exactly as shown in README', async () => {
        // Test that the dataSource works as expected
        expect(dataSource.isInitialized).toBe(true);

        // Test basic query functionality
        const result = await dataSource.query('SELECT 1 as test');
        expect(result).toEqual([{ test: 1 }]);

        // Test table creation and data manipulation
        await dataSource.query(`
            CREATE TABLE example_table (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                value INTEGER DEFAULT 0
            )
        `);

        // Insert data
        await dataSource.query('INSERT INTO example_table (name, value) VALUES ($1, $2)', ['Test Name', 42]);

        // Query data
        const rows = await dataSource.query('SELECT * FROM example_table');
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Test Name');
        expect(rows[0].value).toBe(42);
    });

    it('should handle the driver export correctly', () => {
        // Test that PGliteDriver is properly exported
        expect(PGliteDriver()).toBeDefined();
        expect(PGliteDriver().Pool).toBeDefined();
        expect(PGliteDriver().Client).toBeDefined();
    });

    it('should work with different DataSource configurations', async () => {
        // Test with different options
        const dataSource2 = new DataSource({
            type: 'postgres',
            driver: PGliteDriver(),
            synchronize: false,
            logging: false,
        });

        await dataSource2.initialize();
        expect(dataSource2.isInitialized).toBe(true);

        // Test basic functionality
        const result = await dataSource2.query('SELECT 2 as test');
        expect(result).toEqual([{ test: 2 }]);

        await dataSource2.destroy();
    });

    it('should handle multiple DataSource instances', async () => {
        // Create multiple data sources
        const dataSource1 = new DataSource({
            type: 'postgres',
            driver: PGliteDriver(),
            synchronize: false,
        });

        const dataSource2 = new DataSource({
            type: 'postgres',
            driver: PGliteDriver(),
            synchronize: false,
        });

        await dataSource1.initialize();
        await dataSource2.initialize();

        expect(dataSource1.isInitialized).toBe(true);
        expect(dataSource2.isInitialized).toBe(true);

        // Test that they work independently
        await dataSource1.query('CREATE TABLE ds1_table (id SERIAL, name VARCHAR(255))');
        await dataSource2.query('CREATE TABLE ds2_table (id SERIAL, name VARCHAR(255))');

        await dataSource1.query('INSERT INTO ds1_table (name) VALUES ($1)', ['DS1']);
        await dataSource2.query('INSERT INTO ds2_table (name) VALUES ($1)', ['DS2']);

        const result1 = await dataSource1.query('SELECT * FROM ds1_table');
        const result2 = await dataSource2.query('SELECT * FROM ds2_table');

        expect(result1).toHaveLength(1);
        expect(result1[0].name).toBe('DS1');
        expect(result2).toHaveLength(1);
        expect(result2[0].name).toBe('DS2');

        await dataSource1.destroy();
        await dataSource2.destroy();
    });

    it('should handle connection errors gracefully', async () => {
        // Test that the driver handles errors properly
        await expect(dataSource.query('SELECT * FROM non_existent_table')).rejects.toThrow();
    });

    it('should support all basic SQL operations', async () => {
        // Test CREATE
        await dataSource.query(`
            CREATE TABLE operations_test (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                status BOOLEAN DEFAULT false
            )
        `);

        // Test INSERT
        await dataSource.query('INSERT INTO operations_test (name, status) VALUES ($1, $2)', ['Test Item', true]);

        // Test SELECT
        const selectResult = await dataSource.query('SELECT * FROM operations_test');
        expect(selectResult).toHaveLength(1);
        expect(selectResult[0].name).toBe('Test Item');
        expect(selectResult[0].status).toBe(true);

        // Test UPDATE
        await dataSource.query('UPDATE operations_test SET name = $1 WHERE id = $2', ['Updated Item', selectResult[0].id]);

        const updateResult = await dataSource.query('SELECT * FROM operations_test');
        expect(updateResult[0].name).toBe('Updated Item');

        // Test DELETE
        await dataSource.query('DELETE FROM operations_test WHERE id = $1', [selectResult[0].id]);

        const deleteResult = await dataSource.query('SELECT * FROM operations_test');
        expect(deleteResult).toHaveLength(0);
    });
});
