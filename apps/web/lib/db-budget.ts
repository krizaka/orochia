/** What a role may open on a database: its own limit when it has one (> 0), else the server's `max_connections`. */
export const connectionLimit = (roleLimit: number, serverLimit: number): number => (roleLimit > 0 ? Math.min(roleLimit, serverLimit || roleLimit) : serverLimit);

export interface ConnectionBudget {
  /** This process's pool: its ceiling, the connections it holds, how many are idle, how many requests wait for one. */
  pool: { max: number; total: number; idle: number; waiting: number };
  /** Connections open on the database right now, from every client. */
  open: number;
  /** What the role may open. */
  limit: number;
}
