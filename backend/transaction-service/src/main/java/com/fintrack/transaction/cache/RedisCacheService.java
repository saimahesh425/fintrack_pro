package com.fintrack.transaction.cache;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@Profile("!test")   // ❗ Disabled in tests
public class RedisCacheService implements com.fintrack.transaction.cache.CacheService {

    private final RedisTemplate<String, String> redis;

    @Override
    public String get(String key) {
        return redis.opsForValue().get(key);
    }

    @Override
    public void set(String key, String value, Duration ttl) {
        redis.opsForValue().set(key, value, ttl);
    }
}