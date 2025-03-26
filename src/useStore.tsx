import React, { useEffect, useState } from "react";

import store from "./store";

interface UseStoreParams {
  key: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  payload?: any;
  itemId?: string | number | null;
  urlPath?: string;
  keepCache?: boolean;
  idKey?: string;
}

interface UseStoreReturn {
  state: any;
  isLoading: boolean;
  isError: any;
  executeMutation: (payload: any) => Promise<any>;
  deleteItem: (deleteItemId: string | number) => void;
  editItem: (
    editItemId: string | number,
    updatedFields: any
  ) => { status: boolean; message: string };
  refreshData: () => Promise<void>;
}

const useStore = ({
  key,
  method = "GET",
  payload = null,
  itemId = null,
  urlPath = "",
  keepCache = true,
  idKey = "id",
}: UseStoreParams): UseStoreReturn => {
  const [state, setState] = useState<any>(() => {
    const data = store.getState()[key];
    return itemId
      ? data?.find((item: any) => String(item[idKey]) === String(itemId)) ||
          null
      : data;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<any>(null);

  /**
   * Executes a mutation on the store.
   * @param payload - The data payload for the mutation.
   * @returns The result of the mutation or null if failed.
   */
  const executeMutation = async (mutationPayload: any): Promise<any> => {
    setIsLoading(true);
    setIsError(null);
    const previousState = state;

    try {
      const data = await store.fetchData(
        key,
        method,
        mutationPayload,
        urlPath,
        keepCache
      );
      if (data) {
        setState(
          itemId
            ? data.find(
                (item: any) => String(item[idKey]) === String(itemId)
              ) || null
            : data
        );
      }
      return data;
    } catch (error) {
      setState(previousState);
      setIsError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refreshes the data by clearing the cache and fetching new data.
   */
  const refreshData = async () => {
    // Optionally clear the cache to ensure fresh data is fetched
    store.clearCache(key);
    setIsLoading(true);
    setIsError(null);
    try {
      const data = await store.fetchData(
        key,
        method,
        payload,
        urlPath,
        false // Do not keep cache during refresh, so fresh data is fetched
      );
      if (data) {
        setState(
          itemId
            ? data.find(
                (item: any) => String(item[idKey]) === String(itemId)
              ) || null
            : data
        );
      }
    } catch (error) {
      setIsError(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches data from the store if needed.
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
              ? data.find(
                  (item: any) => String(item[idKey]) === String(itemId)
                ) || null
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, method, itemId, urlPath]);

  /**
   * Subscribes to store updates and updates the component state.
   */
  useEffect(() => {
    const updateState = (newState: any) => {
      setState(
        itemId
          ? newState[key]?.find(
              (item: any) => String(item[idKey]) === String(itemId)
            ) || null
          : newState[key]
      );
    };

    const unsubscribe = store.subscribe(updateState);
    return () => unsubscribe();
  }, [key, itemId, urlPath, idKey]);

  /**
   * Deletes an item locally from the store.
   * @param deleteItemId - ID of the item to delete.
   */
  const deleteItem = (deleteItemId: string | number): void => {
    if (!deleteItemId) return;
    const currentData = store.getState()[key];
    const updatedData =
      (Array.isArray(currentData)
        ? currentData.filter(
            (item: any) => String(item[idKey]) !== String(deleteItemId)
          )
        : []) || [];
    store.setState({ [key]: updatedData });
  };

  /**
   * Edits an item locally in the store.
   * @param editItemId - ID of the item to edit.
   * @param updatedFields - The updated fields for the item.
   * @returns An object containing the status and message.
   */
  const editItem = (
    editItemId: string | number,
    updatedFields: any
  ): { status: boolean; message: string } => {
    try {
      if (!store.state[key] || !Array.isArray(store.state[key])) {
        console.error(`No valid array found in store for key: ${key}`);
        return {
          status: false,
          message: `No valid array found for key: ${key}`,
        };
      }

      const updatedItems = store.state[key].map((item: any) =>
        String(item[idKey]) === String(editItemId)
          ? { ...item, ...updatedFields }
          : item
      );

      store.setState({ [key]: updatedItems });
      store.cache.set(key, updatedItems);

      return {
        status: true,
        message: "Item edited successfully",
      };
    } catch (error: any) {
      return {
        status: false,
        message: "Error editing item: " + error,
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
    refreshData,
  };
};

export default useStore;
