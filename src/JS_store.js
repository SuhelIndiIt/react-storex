import { useEffect, useState } from "react";

const retryFetch = async (fetchFunction, retries = 3, delay = 1000) => {
  let attempts = 0;
  while (attempts < retries) {
    try {
      return await fetchFunction();
    } catch (error) {
      attempts++;
      if (attempts === retries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempts))
      ); // Exponential backoff
    }
  }
};

class Store {
  constructor(initialState) {
    this.state = initialState;
    this.listeners = new Set();
    this.cache = new Map();
    this.apiHandlers = {};
    this.cacheExpiration = new Map();
  }

  /**
   * Retrieves the current state of the store
   * @returns {Object} The current state object
   */
  getState = () => this.state;

  /**
   * Sets the state of the store
   * @param {Object} newState - The new state object
   */
  setState = (newState) => {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  };

  /**
   * clearCache method to clear the cache
   * @param {string} key - The key to clear the cache for
   */
  clearCache = (key) => {
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
   * @param {Function} callback - The callback function to be notified
   * @returns {Function} A function to unsubscribe from the state change notifications
   */
  subscribe = (callback) => {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  };

  /**
   * Notifies all listeners about the state change
   * @param {Object} newState - The new state object
   */
  notifyListeners = () => {
    this.listeners.forEach((callback) => callback(this.state));
  };

  /**
   * Registers an API handler for a specific key
   * @param {string} key - The store key for the data
   * @param {Function} fetchFunction - The function to fetch data
   * @param {number} [cacheDuration=60000] - The cache duration in milliseconds
   */

  registerAPI = (key, fetchFunction, cacheDuration = 60000) => {
    if (typeof fetchFunction !== "function") {
      console.error(`Invalid fetch function for key: ${key}`);
      return;
    }
    this.apiHandlers[key] = { fetchFunction, cacheDuration };
  };

  /**
   * Fetches data from the API and caches it
   * @param {string} key - The store key for the data
   * @param {'GET' | 'POST' | 'PUT'} [method='GET'] - HTTP method to use
   * @param {Object} [payload=null] - Data payload for mutations
   * @returns {Promise<Object | null>} Fetched data or null if not found
   */

  fetchData = async (
    key,
    method = "GET",
    payload = null,
    urlPath,
    keepCache = true
  ) => {
    const now = Date.now();

    if (method === "GET") {
      const cacheExpirationTime = this.cacheExpiration.get(key);
      if (
        this.cache.has(key) &&
        cacheExpirationTime &&
        now - cacheExpirationTime <= this.apiHandlers[key]?.cacheDuration
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
      let data;

      if (method === "POST" || method === "PUT") {
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
 * @param {Object} initialState - The initial state object
 * @returns {Store} The new store instance
 */
export const createStore = (initialState) => {
  store.state = initialState;
  return store;
};

export default store;
