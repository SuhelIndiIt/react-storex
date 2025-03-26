import { useEffect, useState } from "react";

/**
 * Custom hook to fetch and manage store data with optional mutations
 * @param {string} key - The store key to fetch data for
 * @param {string} [method='GET'] - HTTP method for the request (GET, POST, PUT, DELETE)
 * @param {Object} [options] - Additional options for the request
 * @param {boolean} [options.skipInitialFetch=false] - Whether to skip the initial data fetch
 * @param {number} [options.cacheTime=5000] - Cache duration in milliseconds
 * @returns {Object} Object containing:
 *   - state: The current data state
 *   - isLoading: Loading state boolean
 *   - isError: Error state boolean
 *   - error: Error object if any
 *   - executeMutation: Function to trigger mutations (for POST/PUT/DELETE)
 */

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

/**
 * Custom hook for managing store state and API interactions
 * @param {Object} params - The parameters object
 * @param {string} params.key - The store key to fetch/update data
 * @param {string} [params.method="GET"] - The HTTP method to use (GET, POST, PUT)
 * @param {Object} [params.payload=null] - The data payload for POST/PUT requests
 * @param {string|number} [params.itemId=null] - ID of specific item to fetch/update
 * @returns {Object} Returns an object containing:
 *   - state: Current state data
 *   - isLoading: Boolean indicating if request is in progress
 *   - isError: Error object if request failed, null otherwise
 *   - executeMutation: Function to trigger POST/PUT requests with payload
 */

export const useStore = ({
  key,
  method = "GET",
  payload = null,
  itemId = null,
  urlPath = "",
  keepCache = true,
  idKey = "id", // new parameter
}) => {
  const [state, setState] = useState(() => {
    const data = store.getState()[key];
    return itemId
      ? data?.find((item) => String(item.id) === String(itemId)) || null
      : data;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(null);

  /**
   * Executes a mutation on the store
   * @param {Object} payload - The data payload for the mutation
   * @returns {Promise<Object | null>} The result of the mutation or null if failed
   */
  const executeMutation = async (payload) => {
    setIsLoading(true);
    setIsError(null);
    const previousState = state;

    try {
      const data = await store.fetchData(
        key,
        method,
        payload,
        urlPath,
        keepCache
      );
      if (data) {
        setState(
          itemId
            ? data.find((item) => String(item.id) === String(itemId)) || null
            : data
        );
      }
    } catch (error) {
      setState(previousState);
      setIsError(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches data from the store if needed
   * @param {string} key - The store key for the data
   * @param {string} [method='GET'] - HTTP method to use
   * @param {Object} [payload=null] - Data payload for mutations
   */
  useEffect(() => {
    const fetchDataIfNeeded = async () => {
      setIsLoading(true);
      setIsError(null);
      try {
        const data = await store.fetchData(
          key,
          method,
          payload,
          urlPath,
          keepCache
        );

        if (data) {
          setState(
            itemId
              ? data.find((item) => String(item.id) === String(itemId)) || null
              : data
          );
        }
      } catch (error) {
        setIsError(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (method === "GET") {
      fetchDataIfNeeded();
    }
  }, [key, method, itemId, urlPath]);

  /**
   * Subscribes to store updates and updates the component state
   * @param {string} key - The store key for the data
   * @param {string | number} itemId - ID of the item to update
   */
  useEffect(() => {
    const updateState = (newState) => {
      setState(
        itemId
          ? newState[key]?.find((item) => String(item.id) === String(itemId)) ||
              null
          : newState[key]
      );
    };

    const unsubscribe = store.subscribe(updateState);
    return () => unsubscribe();
  }, [key, itemId, urlPath]);

  // **New: Delete an Item Locally from the Store**
  /**
   * Deletes an item locally from the store
   * @param {string | number} deleteItemId - ID of the item to delete
   */

  const deleteItem = (deleteItemId) => {
    if (!deleteItemId) return;
    const updatedData =
      store
        .getState()
        [key]?.filter((item) => String(item[idKey]) !== String(deleteItemId)) ||
      [];
    store.setState({ [key]: updatedData });
  };

  // **New: Edit an Item Locally in the Store**
  /**
   * Edits an item locally in the store
   * @param {string | number} editItemId - ID of the item to edit
   * @param {Object} updatedFields - The updated fields for the item
   */
  const editItem = (editItemId, updatedFields) => {
    try {
      if (!store.state[key] || !Array.isArray(store.state[key])) {
        console.error(`No valid array found in store for key: ${key}`);
        return { status: false };
      }

      const updatedItems = store.state[key].map((item) =>
        String(item[idKey]) === String(editItemId)
          ? { ...item, ...updatedFields }
          : item
      );

      store.setState({ [key]: updatedItems });
      store.cache.set(key, updatedItems);

      return {
        status: true,
        message: "item edited successfully",
      };
    } catch (error) {
      return {
        status: false,
        message: "error in edit item " + error,
      };
    }
  };

  return {
    state,
    isLoading,
    isError,
    executeMutation,
    deleteItem,
    editItem,
  };
};

export default store;
