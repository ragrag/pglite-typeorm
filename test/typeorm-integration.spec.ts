import { DataSource, EntitySchema } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGliteDriver } from '../src/pglite-driver.js';

// Test entities using EntitySchema instead of decorators
const UserSchema = new EntitySchema({
    name: 'User',
    tableName: 'users',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        name: {
            type: 'varchar',
            length: 255,
        },
        email: {
            type: 'varchar',
            length: 255,
            unique: true,
        },
        isActive: {
            type: 'boolean',
            default: true,
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true,
        },
    },
    relations: {
        // @ts-expect-error: valid schema
        posts: {
            type: 'one-to-many',
            target: 'Post',
            inverseSide: 'author',
        },
    },
});

const PostSchema = new EntitySchema({
    name: 'Post',
    tableName: 'posts',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        title: {
            type: 'varchar',
            length: 255,
        },
        content: {
            type: 'text',
        },
        isPublished: {
            type: 'boolean',
            default: false,
        },
        authorId: {
            type: 'int',
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true,
        },
    },
    relations: {
        // @ts-expect-error: valid schema
        author: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'authorId' },
            inverseSide: 'posts',
        },
    },
});

const CategorySchema = new EntitySchema({
    name: 'Category',
    tableName: 'categories',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        name: {
            type: 'varchar',
            length: 255,
        },
        description: {
            type: 'text',
            nullable: true,
        },
    },
});

describe('TypeORM Integration with PGliteDriver', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
        dataSource = new DataSource({
            type: 'postgres',
            driver: PGliteDriver(),
            entities: [UserSchema, PostSchema, CategorySchema],
            synchronize: true,
            logging: false,
        });

        await dataSource.initialize();
    });

    afterEach(async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    describe('Basic CRUD Operations', () => {
        it('should create and find a user', async () => {
            const userRepository = dataSource.getRepository('User');

            // Create user
            const user = userRepository.create({
                name: 'John Doe',
                email: 'john@example.com',
                isActive: true,
            });

            const savedUser = await userRepository.save(user);
            expect(savedUser.id).toBeDefined();
            expect(savedUser.name).toBe('John Doe');
            expect(savedUser.email).toBe('john@example.com');
            expect(savedUser.isActive).toBe(true);
            expect(savedUser.createdAt).toBeInstanceOf(Date);
            expect(savedUser.updatedAt).toBeInstanceOf(Date);

            // Find user
            const foundUser = await userRepository.findOne({ where: { id: savedUser.id } });
            expect(foundUser).toBeDefined();
            expect(foundUser?.name).toBe('John Doe');
        });

        it('should update a user', async () => {
            const userRepository = dataSource.getRepository('User');

            // Create user
            const user = await userRepository.save(
                userRepository.create({
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                }),
            );

            // Update user
            user.name = 'Jane Smith';
            const updatedUser = await userRepository.save(user);

            expect(updatedUser.name).toBe('Jane Smith');
            expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(user.createdAt.getTime());

            // Verify update in database
            const foundUser = await userRepository.findOne({ where: { id: user.id } });
            expect(foundUser?.name).toBe('Jane Smith');
        });

        it('should delete a user', async () => {
            const userRepository = dataSource.getRepository('User');

            // Create user
            const user = await userRepository.save(
                userRepository.create({
                    name: 'Delete Me',
                    email: 'delete@example.com',
                }),
            );

            // Delete user
            await userRepository.remove(user);

            // Verify deletion
            const foundUser = await userRepository.findOne({ where: { id: user.id } });
            expect(foundUser).toBeNull();
        });

        it('should find users with conditions', async () => {
            const userRepository = dataSource.getRepository('User');

            // Create multiple users
            await userRepository.save([
                userRepository.create({ name: 'User 1', email: 'user1@example.com', isActive: true }),
                userRepository.create({ name: 'User 2', email: 'user2@example.com', isActive: false }),
                userRepository.create({ name: 'User 3', email: 'user3@example.com', isActive: true }),
            ]);

            // Find active users
            const activeUsers = await userRepository.find({ where: { isActive: true } });
            expect(activeUsers).toHaveLength(2);

            // Find by email
            const userByEmail = await userRepository.findOne({ where: { email: 'user2@example.com' } });
            expect(userByEmail).toBeDefined();
            expect(userByEmail?.isActive).toBe(false);
        });
    });

    describe('Relationships', () => {
        it('should handle one-to-many relationship', async () => {
            const userRepository = dataSource.getRepository('User');
            const postRepository = dataSource.getRepository('Post');

            // Create user
            const user = await userRepository.save(
                userRepository.create({
                    name: 'Author',
                    email: 'author@example.com',
                }),
            );

            // Create posts for user
            const posts = await postRepository.save([
                postRepository.create({
                    title: 'First Post',
                    content: 'This is the first post content',
                    authorId: user.id,
                    isPublished: true,
                }),
                postRepository.create({
                    title: 'Second Post',
                    content: 'This is the second post content',
                    authorId: user.id,
                    isPublished: false,
                }),
            ]);

            // Find user with posts
            const userWithPosts = await userRepository.findOne({
                where: { id: user.id },
                relations: ['posts'],
            });

            expect(userWithPosts).toBeDefined();
            expect(userWithPosts?.posts).toHaveLength(2);
            expect(userWithPosts?.posts[0].title).toBe('First Post');
            expect(userWithPosts?.posts[1].title).toBe('Second Post');

            // Find post with author
            const postWithAuthor = await postRepository.findOne({
                where: { id: posts[0].id },
                relations: ['author'],
            });

            expect(postWithAuthor).toBeDefined();
            expect(postWithAuthor?.author.name).toBe('Author');
        });
    });

    describe('Query Builder', () => {
        it('should use query builder for complex queries', async () => {
            const userRepository = dataSource.getRepository('User');
            const postRepository = dataSource.getRepository('Post');

            // Create test data
            const user1 = await userRepository.save(userRepository.create({ name: 'User 1', email: 'user1@example.com', isActive: true }));
            const user2 = await userRepository.save(userRepository.create({ name: 'User 2', email: 'user2@example.com', isActive: true }));

            await postRepository.save([
                postRepository.create({
                    title: 'Post 1',
                    content: 'Content 1',
                    authorId: user1.id,
                    isPublished: true,
                }),
                postRepository.create({
                    title: 'Post 2',
                    content: 'Content 2',
                    authorId: user1.id,
                    isPublished: false,
                }),
                postRepository.create({
                    title: 'Post 3',
                    content: 'Content 3',
                    authorId: user2.id,
                    isPublished: true,
                }),
            ]);

            // Complex query with joins and conditions
            const result = await userRepository
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.posts', 'post')
                .where('user.isActive = :isActive', { isActive: true })
                .andWhere('post.isPublished = :isPublished', { isPublished: true })
                .orderBy('user.name', 'ASC')
                .getMany();

            expect(result).toHaveLength(2);
            expect(result[0]?.name).toBe('User 1');
            expect(result[0]?.posts).toHaveLength(1);
            expect(result[1]?.name).toBe('User 2');
            expect(result[1]?.posts).toHaveLength(1);
        });

        it('should handle aggregations', async () => {
            const userRepository = dataSource.getRepository('User');
            const postRepository = dataSource.getRepository('Post');

            // Create test data
            const user = await userRepository.save(userRepository.create({ name: 'Aggregate User', email: 'aggregate@example.com' }));

            await postRepository.save([
                postRepository.create({
                    title: 'Post 1',
                    content: 'Content 1',
                    authorId: user.id,
                    isPublished: true,
                }),
                postRepository.create({
                    title: 'Post 2',
                    content: 'Content 2',
                    authorId: user.id,
                    isPublished: true,
                }),
                postRepository.create({
                    title: 'Post 3',
                    content: 'Content 3',
                    authorId: user.id,
                    isPublished: false,
                }),
            ]);

            // Count published posts per user
            const result = await userRepository
                .createQueryBuilder('user')
                .leftJoin('user.posts', 'post')
                .select('user.name', 'userName')
                .addSelect('COUNT(post.id)', 'totalPosts')
                .addSelect('COUNT(CASE WHEN post.isPublished = true THEN 1 END)', 'publishedPosts')
                .groupBy('user.id')
                .getRawMany();

            expect(result).toHaveLength(1);
            expect(result[0].userName).toBe('Aggregate User');
            expect(Number.parseInt(result[0].totalPosts)).toBe(3);
            expect(Number.parseInt(result[0].publishedPosts)).toBe(2);
        });
    });

    describe('Transactions', () => {
        it('should handle transactions correctly', async () => {
            const userRepository = dataSource.getRepository('User');
            const postRepository = dataSource.getRepository('Post');

            await dataSource.transaction(async manager => {
                // Create user
                const user = await manager.save('User', {
                    id: 1,
                    name: 'Transaction User',
                    email: 'transaction@example.com',
                });

                // Create post
                const post = await manager.save('Post', {
                    title: 'Transaction Post',
                    content: 'Transaction content',
                    authorId: user.id,
                    isPublished: true,
                });

                // Verify data within transaction
                const userWithPosts = await manager.findOne('User', {
                    where: { id: user.id },
                    relations: ['posts'],
                });

                expect(userWithPosts).toBeDefined();
                // @ts-expect-error: valid schema
                expect(userWithPosts?.posts).toHaveLength(1);
            });

            // Verify data persists after transaction
            const user = await userRepository.findOne({
                where: { email: 'transaction@example.com' },
                relations: ['posts'],
            });

            expect(user).toBeDefined();
            expect(user?.posts).toHaveLength(1);
        });

        it('should rollback transaction on error', async () => {
            const userRepository = dataSource.getRepository('User');

            // Try to create user with invalid data (should fail)
            try {
                await dataSource.transaction(async manager => {
                    await manager.save('User', {
                        name: 'Rollback User',
                        email: 'rollback@example.com',
                    });

                    // This should cause an error and rollback
                    throw new Error('Simulated error');
                });
            } catch (error) {
                expect(error.message).toBe('Simulated error');
            }

            // Verify user was not created (rolled back)
            const user = await userRepository.findOne({
                where: { email: 'rollback@example.com' },
            });

            expect(user).toBeNull();
        });
    });

    describe('Data Types', () => {
        it('should handle different data types correctly', async () => {
            const categoryRepository = dataSource.getRepository('Category');

            const category = await categoryRepository.save(
                categoryRepository.create({
                    name: 'Test Category',
                    description: 'This is a test description with special characters: éñç',
                }),
            );

            const foundCategory = await categoryRepository.findOne({
                where: { id: category.id },
            });

            expect(foundCategory).toBeDefined();
            expect(foundCategory?.name).toBe('Test Category');
            expect(foundCategory?.description).toBe('This is a test description with special characters: éñç');
        });

        it('should handle null values', async () => {
            const categoryRepository = dataSource.getRepository('Category');

            const category = await categoryRepository.save(
                categoryRepository.create({
                    name: 'Null Category',
                    description: null,
                }),
            );

            const foundCategory = await categoryRepository.findOne({
                where: { id: category.id },
            });

            expect(foundCategory).toBeDefined();
            expect(foundCategory?.description).toBeNull();
        });
    });
});
