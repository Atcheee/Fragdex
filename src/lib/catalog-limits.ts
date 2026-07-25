/**
 * Upper bounds on how many catalog rows any single request may load.
 *
 * The catalog is expected to keep growing, so every query that used to walk
 * the whole dataset is capped here instead. Rows are always taken in
 * popularity order, which is the order these features care about anyway.
 */

/** Candidates handed to the search ranker before it picks the top matches. */
export const SEARCH_CANDIDATE_LIMIT = 1_500;

/** Same-house and shared-note candidates considered for "You may also like". */
export const RELATED_CANDIDATE_LIMIT = 400;

/** Universe for collection recommendations and note-swap matching. */
export const RECOMMENDATION_CANDIDATE_LIMIT = 5_000;

/** Recognizable fragrances available to game modes. */
export const GAME_POOL_LIMIT = 25_000;

/** Scentle's daily answer pool. */
export const SCENTLE_POOL_LIMIT = 1_200;
