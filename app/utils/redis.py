import os
import redis.asyncio as redis

def get_redis_client():
    """Returns a configured Redis client instance."""
    host = os.environ.get('REDIS_HOST') or 'localhost'
    port_str = os.environ.get('REDIS_PORT')
    db_str = os.environ.get('REDIS_DB')

    port = int(port_str) if port_str else 6379
    db = int(db_str) if db_str else 0

    return redis.Redis(host=host, port=port, db=db)
