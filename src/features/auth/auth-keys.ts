/**
 * Auth query-key owner. Lives apart from the auth surfaces so both the provider and the query
 * hooks can share it without a circular import; no other module builds `['auth', …]` by hand.
 */
export const authKeys = {
  all: ['auth'] as const,
  currentUser: ['auth', 'me'] as const,
};
