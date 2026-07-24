"""Circuit breaker protecting the Yahoo Finance dependency as a whole.

One shared breaker wraps every per-ticker fetch: a couple of genuinely bad
tickers (delisted, unknown) shouldn't trip it, but 3 *consecutive* failures
across different tickers is the signal that Yahoo itself is down or
rate-limiting us — at which point the right move is to stop hammering it
(fail fast, keep the stale-but-present quotes) and retry after a cooldown.

The old update-prices.mjs had only an all-or-nothing gate after the fact;
this trips mid-run and skips the remaining network calls entirely.
"""
import logging

import pybreaker

log = logging.getLogger("korch.circuit")


class LoggingListener(pybreaker.CircuitBreakerListener):
    def state_change(self, cb, old_state, new_state):
        log.warning("circuit '%s': %s -> %s", cb.name, old_state.name, new_state.name)

    def failure(self, cb, exc):
        log.info("circuit '%s': failure %d/%d (%s)", cb.name, cb.fail_counter, cb.fail_max, exc)


yahoo_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=60,
    name="yahoo-finance",
    listeners=[LoggingListener()],
)
