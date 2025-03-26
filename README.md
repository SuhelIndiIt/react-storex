# react-storex

> This library provides a simple global state management solution with API integration, caching, and a custom React hook called useStore.It allows you to easily fetch, update, delete, and edit data while keeping your components in sync with a centralized store.

## Features

- 🚀 Global state management with React hook interface
- 🔄 Automatic API synchronization with retry logic
- ⚡ Optimistic UI updates for mutations
- 🗄️ Intelligent caching with TTL support
- 🔄 Exponential backoff for failed requests
- ✨ Built-in CRUD operations for common data patterns

## Installation

```bash
npm install react-storex
```

### Create a Store Instance

- Before using the hook, initialize the store in your application with an initial state.

```js
import { createStore } from "react-storex";

const initialState = {
  users: [],
  products: [],
};

export const store = createStore(initialState);
```

### Register API endpoints

- Register an API handler for a specific key in your store. This handler defines how data is fetched and sets a cache duration (in milliseconds):

```js
import { registerAPI } from "react-storex";

registerAPI(
  "items",
  async () => {
    const response = await fetch("/api/items");
    const data = await response.json();
    return data;
  },
  60000
);
// Cache duration: 60 seconds (optional) default is 60 seconds

// if you want to register multiple endpoints, you can do it like this:

const apiConfig = {
  products: (urlPath = "") => apiClient(`products${urlPath}`),

  addProduct: (productData) => apiClient("products", "POST", productData),
};

Object.entries(apiConfig).forEach(([key, handler]) => {
  registerAPI(key, handler, 60000);
});
```

### Use the useStore Hook in Your Component

- Use the custom hook to connect your component to the store. This hook supports fetching, mutations, deleting, and editing data.

```js
import React from "react";
import { useStore } from "react-storex";

const ItemsList = () => {
  const {
    state,
    isLoading,
    isError,
    executeMutation,
    deleteItem,
    editItem,
    refreshData,
  } = useStore({
    key: "items", // the key of the item in the store (required)
    method: "GET", // the method to use for the request (optional) e.g. 'GET', 'POST', 'PUT', 'DELETE'
    payload: null, // the payload to send with the request (optional) e.g. { name: 'John' }
    itemId: null, // the id of the item to delete or edit (optional) e.g. 1
    urlPath: "", // the path to the url (optional) e.g. /items/1
    keepCache: false, // whether to keep the cache of the item (optional) e.g. true, false
    idKey: id, // Identifier key in your data objects, we need this to edit and delete the items (required)
  });

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading items.</div>;

  const forceRefetch = () => {
    refreshData();
  };

  return (
    <div>
      {state.map((item) => (
        <div key={item.id}>
          <span>{item.name}</span>
          <button onClick={() => deleteItem(item.id)}>Delete</button>
          <button onClick={() => editItem(item.id, { name: "Updated Name" })}>
            Edit
          </button>
        </div>
      ))}

      <button onClick={() => forceRefetch()}>Force Refetch Data</button>
    </div>
  );
};

export default ItemsList;
```

### Triggering Mutations in Your Component

- Example usage of executeMutation for POST or PUT requests

```js
const { executeMutation } = useStore({ key: "items", method: "PUT" });
executeMutation({ id: 1, name: "New Item Name" });
```

### Local Data Manipulation

- Example usage of deleteItem and editItem

```js
// **Delete an Item Locally from the Store**
deleteItem(itemId);

// **Edit an Item Locally in the Store**
editItem(itemId, { name: "Updated Name" });
```

### Clear Cache

```js
import { clearCache } from "react-storex";

// **Clear Cache for a Specific Key**
clearCache(key);

// **Clear All Cache**
clearCache();
```

## Understanding Local Mutations

### The library provides utility functions to modify the store's data locally:

- executeMutation: For performing POST or PUT operations. This function handles the API call, applies optimistic updates, and manages error handling.
- deleteItem: Removes an item from the store state by its ID, this will not make api call to the server insted it will delete the item from local store.
- editItem: Updates an item in the store state locally by merging updated fields, this will not make api call to the server insted it will edit the item from local store.

### Retry Mechanism & Caching

- Retry Fetch: The retryFetch function automatically retries API calls with exponential backoff in case of errors.
- Caching: Data fetched from the API is cached for the duration specified during API registration. You can also manually clear the cache using the clearCache method on the store.

## License

MIT
