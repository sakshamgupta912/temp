import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class DataCacheService {
  private static instance: DataCacheService;
  private cache = new Map<string, CacheItem<any>>();

  static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  private generateKey(prefix: string, params: Record<string, any> = {}): string {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return paramString ? `${prefix}:${paramString}` : prefix;
  }

  async get<T>(
    key: string,
    params: Record<string, any> = {},
    fetchFn: () => Promise<T>,
    expiresIn: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    const fullKey = this.generateKey(key, params);
    const cached = this.cache.get(fullKey);
    
    // Check if we have valid cached data
    if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
      console.log(`Cache hit for ${fullKey}`);
      return cached.data;
    }

    console.log(`Cache miss for ${fullKey}, fetching fresh data`);
    
    try {
      // Fetch fresh data
      const data = await fetchFn();
      
      // Cache the result
      this.cache.set(fullKey, {
        data,
        timestamp: Date.now(),
        expiresIn
      });

      // Optionally persist to AsyncStorage for longer-term caching
      try {
        await AsyncStorage.setItem(`cache_${fullKey}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          expiresIn
        }));
      } catch (persistError) {
        console.warn('Failed to persist cache to AsyncStorage:', persistError);
      }

      return data;
    } catch (error) {
      // If fresh fetch fails, try to return expired cached data as fallback
      if (cached) {
        console.warn(`Fresh fetch failed for ${fullKey}, returning expired cached data`);
        return cached.data;
      }
      throw error;
    }
  }

  async invalidate(key: string, params: Record<string, any> = {}): Promise<void> {
    const fullKey = this.generateKey(key, params);
    console.log(`Invalidating cache for ${fullKey}`);
    
    this.cache.delete(fullKey);
    
    try {
      await AsyncStorage.removeItem(`cache_${fullKey}`);
    } catch (error) {
      console.warn('Failed to remove cached item from AsyncStorage:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    console.log(`Invalidating cache pattern: ${pattern}`);
    
    // Remove from memory cache
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      // Use a more flexible pattern matching approach
      if (this.matchesPattern(key, pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      console.log(`Deleted cache key: ${key}`);
    });
    console.log(`Invalidated ${keysToDelete.length} cache entries in memory`);

    // Remove from AsyncStorage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => {
        if (!key.startsWith('cache_')) return false;
        const cacheKey = key.slice(6); // Remove 'cache_' prefix
        return this.matchesPattern(cacheKey, pattern);
      });
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Invalidated ${keysToRemove.length} cache entries in AsyncStorage:`, keysToRemove);
      }
    } catch (error) {
      console.warn('Failed to remove cached items from AsyncStorage:', error);
    }
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Handle different pattern formats:
    // 1. "entries:bookId:abc123" should match pattern "entries:bookId:abc123"
    // 2. "books:userId:user123" should match pattern "books:userId:user123"
    // 3. Support partial matches for flexible invalidation
    
    if (key.includes(pattern)) {
      return true;
    }
    
    // Handle structured patterns like "entries:bookId:123" vs "entries"
    const keyParts = key.split(':');
    const patternParts = pattern.split(':');
    
    // If pattern has fewer parts, check if key starts with pattern
    if (patternParts.length <= keyParts.length) {
      for (let i = 0; i < patternParts.length; i++) {
        if (keyParts[i] !== patternParts[i]) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  }



  async warmCache(): Promise<void> {
    console.log('Warming cache from AsyncStorage');
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
      
      if (cacheKeys.length === 0) {
        return;
      }

      const items = await AsyncStorage.multiGet(cacheKeys);
      
      for (const [key, value] of items) {
        if (!value) continue;
        
        try {
          const cached: CacheItem<any> = JSON.parse(value);
          const cacheKey = key.replace('cache_', '');
          
          // Only restore if not expired
          if (Date.now() - cached.timestamp < cached.expiresIn) {
            this.cache.set(cacheKey, cached);
          } else {
            // Remove expired cache
            await AsyncStorage.removeItem(key);
          }
        } catch (parseError) {
          console.warn(`Failed to parse cached item ${key}:`, parseError);
          await AsyncStorage.removeItem(key);
        }
      }
      
      console.log(`Warmed ${this.cache.size} items from cache`);
    } catch (error) {
      console.warn('Failed to warm cache:', error);
    }
  }

  async clearAll(): Promise<void> {
    console.log('Clearing all cache');
    this.cache.clear();
    
    // Clear AsyncStorage cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`Cleared ${cacheKeys.length} cached items from AsyncStorage`);
      }
    } catch (error) {
      console.warn('Failed to clear AsyncStorage cache:', error);
      throw error;
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const dataCacheService = DataCacheService.getInstance();
export default dataCacheService;