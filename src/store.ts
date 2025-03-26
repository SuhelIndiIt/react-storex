const retryFetch = async <T>(
  fetchFunction: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let attempts = 0;
  while (attempts < retries) {
    try {
      return await fetchFunction();
    } catch (error) {
      attempts++;
      if (attempts === retries) throw error;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempts))
      ); // Exponential backoff
    }
  }
  // Unreachable, but needed to satisfy TS that a value is always returned
  throw new Error("Unexpected error in retryFetch");
};

interface APIHandler {
  fetchFunction: (arg?: any) => Promise<any>;
  cacheDuration: number;
}

type StoreState = Record<string, any>;

class Store {
  state: StoreState;
  listeners: Set<(state: StoreState) => void>;
  cache: Map<string, any>;
  apiHandlers: Record<string, APIHandler>;
  cacheExpiration: Map<string, number>;

  constructor(initialState: StoreState) {
    this.state = initialState;
    this.listeners = new Set();
    this.cache = new Map();
    this.apiHandlers = {};
    this.cacheExpiration = new Map();
  }

  /**
   * Retrieves the current state of the store
   * @returns The current state object
   */
  getState = (): StoreState => this.state;

  /**
   * Sets the state of the store
   * @param newState - The new state object
   */
  setState = (newState: StoreState): void => {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  };

  /**
   * clearCache method to clear the cache
   * @param key - The key to clear the cache for
   */
  clearCache = (key?: string): void => {
    if (key) {
      this.cache.delete(key);
      this.cacheExpiration.delete(key);
    } else {
      this.cache.clear();
      this.cacheExpiration.clear();
    }
  };

  /**
   * Subscribes a callback function to be notified when the state changes
   * @param callback - The callback function to be notified
   * @returns A function to unsubscribe from the state change notifications
   */
  subscribe = (callback: (state: StoreState) => void): (() => boolean) => {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  };

  /**
   * Notifies all listeners about the state change
   */
  notifyListeners = (): void => {
    this.listeners.forEach((callback) => callback(this.state));
  };

  /**
   * Registers an API handler for a specific key
   * @param key - The store key for the data
   * @param fetchFunction - The function to fetch data
   * @param cacheDuration - The cache duration in milliseconds (default is 60000)
   */
  registerAPI = (
    key: string,
    fetchFunction: (arg?: any) => Promise<any>,
    cacheDuration: number = 60000
  ): void => {
    if (typeof fetchFunction !== "function") {
      console.error(`Invalid fetch function for key: ${key}`);
      return;
    }
    this.apiHandlers[key] = { fetchFunction, cacheDuration };
  };

  /**
   * Fetches data from the API and caches it
   * @param key - The store key for the data
   * @param method - HTTP method to use ('GET', 'POST', 'PUT', 'DELETE')
   * @param payload - Data payload for mutations (default is null)
   * @param urlPath - URL path used for GET requests (optional)
   * @param keepCache - Whether to keep the cache (default is true)
   * @returns Fetched data or null if not found
   */
  fetchData = async (
    key: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    payload: any = null,
    urlPath?: string,
    keepCache: boolean = true
  ): Promise<any> => {
    const now = Date.now();

    if (method === "GET") {
      const cacheExpirationTime = this.cacheExpiration.get(key);
      if (
        this.cache.has(key) &&
        cacheExpirationTime !== undefined &&
        now - cacheExpirationTime <= (this.apiHandlers[key]?.cacheDuration || 0)
      ) {
        return this.cache.get(key);
      }
    }

    if (!this.apiHandlers[key]) {
      console.error(`No API registered for key: ${key}`);
      return null;
    }

    try {
      const { fetchFunction } = this.apiHandlers[key];
      let data: any;

      if (method === "POST" || method === "PUT" || method === "DELETE") {
        data = await retryFetch(() => fetchFunction(payload));
      } else {
        data = await retryFetch(() => fetchFunction(urlPath));
      }

      if (data) {
        if (keepCache) {
          this.cache.set(key, data);
          this.cacheExpiration.set(key, now);
        }
        this.setState({ [key]: data });
      }

      return data;
    } catch (error) {
      console.error("API call error:", error);
      return null;
    }
  };
}

const store = new Store({});

/**
 * Creates a new store instance with the given initial state
 * @param initialState - The initial state object
 * @returns The store instance
 */
export const createStore = (initialState: StoreState): Store => {
  store.state = initialState;
  return store;
};

/**
 * Registers an API handler for a specific key
 * @param key - The store key for the data
 * @param fetchFunction - The function to fetch data
 * @param cacheDuration - The cache duration in milliseconds (default is 60000)
 */
export const registerAPI = (
  key: string,
  fetchFunction: (arg?: any) => Promise<any>,
  cacheDuration: number = 60000
) => {
  store.registerAPI(key, fetchFunction, cacheDuration);
};

export const clearCache = (key?: string) => {
  store.clearCache(key);
};

export default store;
