import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type Target = { table: 'Restaurant' | 'FoodItem'; id: string };

/**
 * Running average updated by ONE atomic SQL statement per change (Postgres locks the row for the statement),
 * so concurrent reviews cannot lose updates. A running average (rather than AVG over review rows) also keeps
 * the seeded demo ratings meaningful: new reviews blend into them instead of replacing them.
 * `table` comes from a closed union, never from user input.
 */
export async function ratingAdded(tx: Tx, t: Target, rating: number) {
  await tx.$executeRaw(Prisma.sql`
    UPDATE ${Prisma.raw(`"${t.table}"`)}
    SET "rating" = ROUND((("rating" * "ratingCount" + ${rating}::float8) / ("ratingCount" + 1))::numeric, 2)::float8,
        "ratingCount" = "ratingCount" + 1
    WHERE "id" = ${t.id}`);
}

export async function ratingChanged(tx: Tx, t: Target, oldRating: number, newRating: number) {
  await tx.$executeRaw(Prisma.sql`
    UPDATE ${Prisma.raw(`"${t.table}"`)}
    SET "rating" = CASE WHEN "ratingCount" = 0 THEN ${newRating}::float8
          ELSE ROUND((("rating" * "ratingCount" - ${oldRating}::float8 + ${newRating}::float8) / "ratingCount")::numeric, 2)::float8 END
    WHERE "id" = ${t.id}`);
}

export async function ratingRemoved(tx: Tx, t: Target, rating: number) {
  await tx.$executeRaw(Prisma.sql`
    UPDATE ${Prisma.raw(`"${t.table}"`)}
    SET "rating" = CASE WHEN "ratingCount" <= 1 THEN 0
          ELSE ROUND((("rating" * "ratingCount" - ${rating}::float8) / ("ratingCount" - 1))::numeric, 2)::float8 END,
        "ratingCount" = GREATEST("ratingCount" - 1, 0)
    WHERE "id" = ${t.id}`);
}
