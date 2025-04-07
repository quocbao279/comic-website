const cache = {};

function set(key, value, ttl = 300000) {
  cache[key] = { value, expiry: Date.now() + ttl };
}

function get(key) {
  const entry = cache[key];
  if (!entry || Date.now() > entry.expiry) {
    delete cache[key];
    return null;
  }
  return entry.value;
}

function clear(key) {
  delete cache[key];
}

module.exports = { set, get, clear };
