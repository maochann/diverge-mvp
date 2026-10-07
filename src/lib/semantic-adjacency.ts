import type { FeedPost } from '@/types';

/**
 * Semantic adjacency (Priority 4) is a seam, not a feature, in V1. There is
 * no embedding provider or credential in this project, so nothing here
 * produces candidates; the flag stays off and no score is ever invented.
 *
 * When a provider exists (e.g. pgvector + an embedding model), implement
 * this interface and flip the flag. Rules that still apply then: similarity
 * is a supporting signal behind the explicit ones; nothing generated is
 * shown to people; no stance is inferred; no profile of a person is built.
 */
export const SEMANTIC_ADJACENCY_ENABLED = false;

export interface SemanticProvider {
  /** Posts semantically near `post`, excluding it. Visible-to-viewer only. */
  related(post: FeedPost, viewerId: string, limit: number): Promise<FeedPost[]>;
}

export const semanticProvider: SemanticProvider | null = null;
