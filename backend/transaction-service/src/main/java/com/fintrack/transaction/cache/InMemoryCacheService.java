package com.fintrack.transaction.cache;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Profile("test")   // ❗ Used only in tests
public class InMemoryCacheService implements CacheService {

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @Override
    public String get(String key) {
        return cache.get(key);
    }

    @Override
    public void set(String key, String value, Duration ttl) {
        cache.put(key, value); // TTL ignored for tests
    }
}