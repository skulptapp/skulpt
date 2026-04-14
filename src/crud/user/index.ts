import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { user, UserInsert, UserSelect } from '@/db/schema';
import { nanoid } from '@/helpers/nanoid';
import { reportError } from '@/services/error-reporting';
import { queueSyncOperation } from '../sync';

export const getCurrentUser = async (): Promise<UserSelect | null> => {
    const result = await db.select().from(user).limit(1);
    return result.length > 0 ? result[0] : null;
};

export const createUser = async (data: Omit<UserInsert, 'id'>): Promise<UserSelect> => {
    const newUser: UserInsert = {
        id: nanoid(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    try {
        await db.insert(user).values(newUser);

        const createdUser = await db.select().from(user).where(eq(user.id, newUser.id)).limit(1);

        if (createdUser.length === 0) {
            throw new Error('Failed to retrieve created user');
        }

        await queueSyncOperation({
            tableName: 'user',
            recordId: newUser.id,
            operation: 'create',
            timestamp: createdUser[0].updatedAt,
            data: createdUser[0],
        });

        return createdUser[0];
    } catch (error) {
        reportError(error, 'Failed to create user:');
        throw error;
    }
};

export const updateUser = async (id: string, updates: Partial<UserSelect>): Promise<UserSelect> => {
    const updatedData = {
        ...updates,
        updatedAt: new Date(),
    };

    try {
        await db.update(user).set(updatedData).where(eq(user.id, id));

        const updatedUser = await db.select().from(user).where(eq(user.id, id)).limit(1);

        if (updatedUser.length === 0) {
            throw new Error('User not found after update');
        }

        await queueSyncOperation({
            tableName: 'user',
            recordId: id,
            operation: 'update',
            timestamp: updatedUser[0].updatedAt,
            data: {
                ...updatedData,
                updatedAt: updatedUser[0].updatedAt,
            },
        });

        return updatedUser[0];
    } catch (error) {
        reportError(error, 'Failed to update user:');
        throw error;
    }
};

export const createOrUpdateCurrentUser = async (
    data: Omit<UserInsert, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<UserSelect> => {
    try {
        const exists = await getCurrentUser();

        if (exists) {
            return await updateUser(exists.id, data);
        } else {
            return await createUser(data);
        }
    } catch (error) {
        reportError(error, 'Failed to create or update current user:');
        throw error;
    }
};
