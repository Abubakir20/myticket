import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import {
  EVENT_CACHE_PATTERN,
  EVENT_CACHE_TTL,
} from '../../common/helper/redis-keys';

@Injectable()
export class EventCacheService {
  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown) {
    await this.redis.client.set(
      key,
      JSON.stringify(value),
      'EX',
      EVENT_CACHE_TTL,
    );
  }

  async clear() {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(
        cursor,
        'MATCH',
        EVENT_CACHE_PATTERN,
        'COUNT',
        100,
      );
      if (keys.length) {
        await this.redis.client.del(...keys);
      }
      cursor = next;
    } while (cursor !== '0');
  }
}
