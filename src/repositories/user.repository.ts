import { eq, sql } from 'drizzle-orm';
import { DrizzleDB } from '../db';
import { users, NewUser, User } from '../db/schema';

export type UserWithHash = Pick<User, 'id' | 'username' | 'passwordHash' | 'role' | 'isActive'>;

export class UserRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Partial<User> | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async findByUsername(username: string): Promise<UserWithHash | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        passwordHash: users.passwordHash,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user ?? null;
  }

  async create(input: NewUser): Promise<Partial<User>> {
    const [user] = await this.db
      .insert(users)
      .values(input)
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      });

    return user!;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLogin: sql`now()` })
      .where(eq(users.id, id));
  }

  async existsByUsername(username: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return !!row;
  }
}
