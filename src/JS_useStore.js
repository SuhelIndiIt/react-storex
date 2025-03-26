import { useEffect, useState } from "react";

import store from "./store";

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

const useStore = ({
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
      ? data?.find((item) => String(item[idKey]) === String(itemId)) || null
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
            ? data.find((item) => String(item[idKey]) === String(itemId)) ||
                null
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
              ? data.find((item) => String(item[idKey]) === String(itemId)) ||
                  null
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
          ? newState[key]?.find(
              (item) => String(item[idKey]) === String(itemId)
            ) || null
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

export default useStore;
