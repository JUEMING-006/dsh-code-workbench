/**
 * Shared terminal wire contract: the gateway endpoints and the stream event
 * vocabulary both halves name.
 */

/** URL prefix for terminal control (POST). */
export const TERMINAL_ROUTE_PATH = '/api/code-workbench/terminal'

/** URL suffix for the output stream (GET, SSE). */
export const TERMINAL_STREAM_PATH = '/api/code-workbench/terminal/stream'
