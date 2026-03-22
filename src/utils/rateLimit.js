const windows = new Map();

export const enforceRateLimit = (key, { limit, windowMs }) => {
  const now = Date.now();
  const active = (windows.get(key) || []).filter((timestamp) => now - timestamp < windowMs);

  if (active.length >= limit) {
    const retryAfterMs = windowMs - (now - active[0]);
    return {
      allowed: false,
      retryAfterMs,
    };
  }

  active.push(now);
  windows.set(key, active);

  return {
    allowed: true,
    retryAfterMs: 0,
  };
};

export const enforceCooldown = (key, cooldownMs) => {
  const now = Date.now();
  const last = windows.get(key)?.[0];

  if (last && now - last < cooldownMs) {
    return {
      allowed: false,
      retryAfterMs: cooldownMs - (now - last),
    };
  }

  windows.set(key, [now]);

  return {
    allowed: true,
    retryAfterMs: 0,
  };
};

export const clearRateLimit = (key) => {
  windows.delete(key);
};
