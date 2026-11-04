/** Expects query already validated by paginationQuery (positive ints, limit <= 50). */
export function getPagination(query: { page?: unknown; limit?: unknown }) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 12;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
export const pageMeta = (total: number, page: number, limit: number) => ({
  total, page, limit, totalPages: Math.ceil(total / limit),
});
