package com.fintrack.transaction.cache;

import java.time.Duration;

public interface CacheService {

    String get(String key);

    void set(String key, String value, Duration ttl);
}