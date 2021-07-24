<div align="center">
  <img alt="houdini" height="200" src=".github/assets/houdini-v5.png" />

  <br />
  <br />

  <strong>
    The disappearing GraphQL client for Sapper and SvelteKit.
  </strong>
  <br />
  <br />
</div>

NOTE: Houdini is in the early phases of development. Please create an issue or start a discussion if you run into problems. For more information on what's coming for this project, you can visit the
[roadmap](https://github.com/AlecAivazis/houdini/projects/1).

If you are interested in helping out, the [contributing guide](./CONTRIBUTING.md) should provide some guidance. If you need something more
specific, feel free to reach out to @AlecAivazis on the Svelte discord. There's lots to do regardless of how deep you want to dive 🙂


## ✨&nbsp;&nbsp;Features

-   Composable and colocated data requirements for your components
-   Normalized cache with declarative updates
-   Generated types
-   Subscriptions
-   Support for Sapper and SvelteKit's public beta

At its core, houdini seeks to enable a high quality developer experience
without compromising bundle size. Like Svelte, houdini shifts what is
traditionally handled by a bloated runtime into a compile step that allows
for the generation of an incredibly lean GraphQL abstraction for your application.

## 📚&nbsp;&nbsp;Table of Contents

1. [Example](#example)
1. [Installation](#installation)
1. [Configuring Your Application](#configuring-your-application)
    1. [Sapper](#sapper)
    1. [SvelteKit](#sveltekit)
    1. [Svelte](#svelte)
1. [Config File](#config-file)
1. [Running the Compiler](#running-the-compiler)
1. [Fetching Data](#fetching-data)
    1. [Query variables and page data](#query-variables-and-page-data)
    1. [Loading State](#loading-state)
    1. [Refetching Data](#refetching-data)
    1. [What about load?](#what-about-load)
1. [Fragments](#fragments)
    1. [Fragment Arguments](#fragment-arguments)
1. [Mutations](#mutations)
    1. [Updating fields](#updating-fields)
    1. [Lists](#lists)
        1. [Insert](#inserting-a-record)
        1. [Remove](#removing-a-record)
        1. [Delete](#deleting-a-record)
        1. [Conditionals](#conditionals)
1. [Subscriptions](#subscriptions)
    1. [Configuring the WebSocket client](#configuring-the-websocket-client)
    1. [Using graphql-ws](#using-graphql-ws)
    1. [Using subscriptions-transport-ws](#using-subscriptions-transport-ws)
1. [Pagination](#%EF%B8%8Fpagination)
1. [Custom Scalars](#%EF%B8%8Fcustom-scalars)
1. [Authentication](#authentication)
1. [Notes, Constraints, and Conventions](#%EF%B8%8Fnotes-constraints-and-conventions)

## 🕹️&nbsp;&nbsp;Example

A demo can be found in the <a href='./example'>example directory</a>.

Please note that the examples in that directory and this readme showcase the typescript definitions
generated by the compiler. While it is highly recommended, Typescript is NOT required in order to use houdini.

## ⚡&nbsp;&nbsp;Installation

houdini is available on npm.

```sh
yarn add -D houdini houdini-preprocess
# or
npm install --save-dev houdini houdini-preprocess
```

## 🔧&nbsp;&nbsp;Configuring Your Application

Adding houdini to an existing project can easily be done with the provided command-line tool.
If you don't already have an existing app, visit [this link](https://kit.svelte.dev/docs)
for help setting one up. Once you have a project and want to add houdini, execute the following command:

```sh
npx houdini init
```

This will create a few necessary files, as well as pull down a json representation of
your API's schema. Next, generate your runtime:

```sh
npx houdini generate
```

and finally, add the preprocessor to your sapper setup:

```typescript
import houdini from 'houdini-preprocess'

// somewhere in your config file
{
    plugins: [
        svelte({
            preprocess: [houdini()],
        }),
    ]
}
```

### Sapper

You'll need to add the preprocessor to both your client and your server configuration. With that in place,
the only thing left to configure your Sapper application is to connect your client and server to the generate network layer:

```typescript
// in both src/client.js and src/server.js

import { setEnvironment } from '$houdini'
import env from './environment'

setEnvironment(env)
```

### SvelteKit

We need to define an alias so that your codebase can import the generated runtime. Add the following
values to `svelte.config.js`:

```typescript
{
    kit: {
        vite: {
            resolve: {
                alias: {
                    $houdini: path.resolve('.', '$houdini')
                }
            }
        }
    }
}
```

And finally, we need to configure our application to use the generated network layer. To do
this, add the following block of code to `src/routes/__layout.svelte`:

```typescript
<script context="module">
	import env from '../environment';
	import { setEnvironment } from '$houdini';

	setEnvironment(env);
</script>
```

You might need to generate your runtime in order to fix typescript errors.

## <img src="./.github/assets/cylon.gif" height="28px" />&nbsp;&nbsp;Running the Compiler

The compiler is responsible for a number of things, ranging from generating the actual runtime
to creating types for your documents. Running the compiler can be done with npx or via a script
in `package.json` and needs to be run every time a GraphQL document in your source code changes:

```sh
npx houdini generate
```

The generated runtime can be accessed by importing `$houdini` anywhere in your application.

If you have updated your schema on the server, you can pull down the most recent schema before generating your runtime by using `--pull-schema` or `-p`:
```sh
npx houdini generate --pull-schema
```

**Note**: If you are building your application with
[`adapter-static`](https://github.com/sveltejs/kit/tree/master/packages/adapter-static) (or any other adapter that turns
your application into a static site), you will need to set the `static` value in your config file to `true`.

### Svelte

If you are working on an application that isn't using SvelteKit or Sapper, you have to configure the
compiler and preprocessor to generate the correct logic by setting the `framework` field in your
config file to `"svelte"`.

Please keep in mind that returning the response from a query, you should not rely on `this.redirect` to handle the
redirect as it will update your browsers `location` attribute, causing a hard transition to that url. Instead, you should
use `this.error` to return an error and handle the redirect in a way that's appropriate for your application.

## 📄&nbsp;Config File

All configuration for your houdini application is defined in a single file that is imported by both the runtime and the
command-line tool. Because of this, you must make sure that any imports and logic are resolvable in both environments.
This means that if you rely on `process.env` or other node-specifics you will have to use a
[plugin](https://www.npmjs.com/package/vite-plugin-replace) to replace the expression with something that can run in the browser.

## 🚀&nbsp;&nbsp;Fetching Data

Grabbing data from your API is done with the `query` function:

```svelte
<script lang="ts">
    import { query, graphql, AllItems } from '$houdini'

    // load the items
    const { data } = query<AllItems>(graphql`
        query AllItems {
            items {
                id
                text
            }
        }
    `)
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
```

### Query variables and page data

At the moment, query variables are declared as a function in the module context of your component.
This function must be named after your query and in a sapper application, it takes the same arguments
that are passed to the `preload` function described in the [Sapper](https://sapper.svelte.dev/docs#Pages)
documentation. In a SvelteKit project, this function takes the same arguments passed to the `load` function
described in the [SvelteKit](https://kit.svelte.dev/docs#Loading) docs. Regardless of the framework, you can return
the value from `this.error` and `this.redirect` in order to change the behavior of the response. Here is a
modified example from the [demo](./example):

```svelte
// src/routes/[filter].svelte

<script lang="ts">
    import { query, graphql, AllItems } from '$houdini'

    // load the items
    const { data } = query<AllItems>(graphql`
        query AllItems($completed: Boolean) {
            items(completed: $completed) {
                id
                text
            }
        }
    `)
</script>

<script context="module" lang="ts">
    // This is the function for the AllItems query.
    // Query variable functions must be named <QueryName>Variables.
    export function AllItemsVariables(page): AllItems$input {
        // make sure we recognize the value
        if (!['active', 'completed'].includes(page.params.filter)) {
            return this.error(400, "filter must be one of 'active' or 'completed'")
        }

        return {
            completed: page.params.filter === 'completed',
        }
    }
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
```

### Loading State

The methods used for tracking the loading state of your queries changes depending
on the context of your component. For queries that live in routes (ie, in
`/src/routes/...`), the actual query happens in a `load` function as described
in [What about load?](#what-about-load). Because of this, the best way to track
if your query is loading is to use the
[navigating store](https://kit.svelte.dev/docs#modules-$app-stores) exported from `$app/stores`:

```svelte
// src/routes/index.svelte

<script>
    import { query } from '$houdini'
    import { navigating } from '$app/stores'

    const { data } = query(...)
</script>

{#if $navigating}
    loading...
{:else}
    data is loaded!
{/if}
```

However, since queries inside of non-route components (ie, ones that are not defined in `/src/routes/...`)
do not get hoisted to a `load` function, the recommended practice to is use the store returned from
the result of query:

```svelte
// src/components/MyComponent.svelte

<script>
    import { query } from '$houdini'

    const { data, loading } = query(...)
</script>

{#if $loading}
    loading...
{:else}
    data is loaded!
{/if}
```

### Refetching Data

Refetching data is done with the `refetch` function provided from the result of a query:

```svelte

<script lang="ts">
    import { query, graphql, AllItems } from '$houdini'

    // load the items
    const { refetch } = query<AllItems>(graphql`
        query AllItems($completed: Boolean) {
            items(completed: $completed) {
                id
                text
            }
        }
    `)

    let completed = true

    $: refetch({ completed })
</script>

<input type=checkbox bind:checked={completed}>
```

### What about `load`?

Don't worry - that's where the preprocessor comes in. One of its responsibilities is moving the actual
fetch into a `load`. You can think of the block at the top of this section as equivalent to:

```svelte
<script context="module">
    export async function load() {
            return {
                _data: await this.fetch({
                    text: `
                        query AllItems {
                            items {
                                id
                                text
                            }
                        }
                    `
                }),
            }
    }
</script>

<script>
    export let _data

    const data = readable(_data, ...)
</script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
```

## 🧩&nbsp;&nbsp;Fragments

Your components will want to make assumptions about which attributes are
available in your queries. To support this, Houdini uses GraphQL fragments embedded
within your component. Take, for example, a `UserAvatar` component that requires
the `profilePicture` field of a `User`:

```svelte
// components/UserAvatar.svelte

<script lang="ts">
    import { fragment, graphql, UserAvatar } from '$houdini'

    // the reference will get passed as a prop
    export let user: UserAvatar

    const data = fragment(graphql`
        fragment UserAvatar on User {
            profilePicture
        }
    `, user)
</script>

<img src={$data.profilePicture} />
```

This component can be rendered anywhere we want to query for a user, with a guarantee
that all necessary data has been asked for:

```svelte
// src/routes/users.svelte

<script>
    import { query, graphql, AllUsers } from '$houdini'
    import { UserAvatar } from 'components'

    const { data } = query<AllUsers>(graphql`
        query AllUsers {
            users {
                id
                ...UserAvatar
            }
        }
    `)
</script>

{#each $data.users as user}
    <UserAvatar user={user} />
{/each}
```

It's worth mentioning explicitly that a component can rely on multiple fragments
at the same time so long as the fragment names are unique and prop names are different.

### Fragment Arguments

In some situations it's necessary to configure the documents inside of a fragment. For example,
you might want to extend the `UserAvatar` component to allow for different sized profile pictures.
To support this, houdini provides two directives `@arguments` and `@with` which declare arguments
for a fragment and provide values, respectively.

Default values can be provided to fragment arguments with the `default` key:

```graphql
fragment UserAvatar on User @arguments(width: {type:"Int", default: 50}) {
    profilePicture(width: $width)
}
```

In order to mark an argument as required, pass the type with a `!` at the end.
If no value is provided, an error will be thrown when generating your runtime.

```graphql
fragment UserAvatar on User @arguments(width: {type:"Int!"}) {
    profilePicture(width: $width)
}
```

Providing values for fragments is done with the `@with` decorator:

```graphql
query AllUsers {
    users {
        ...UserAvatar @with(width: 100)
    }
}
```

## 📝&nbsp;&nbsp;Mutations

Mutations are defined in your component like the rest of the documents but
instead of triggering a network request when called, you get a function
which can be invoked to execute the mutation. Here's another modified example from
[the demo](./example):

```svelte
<script lang="ts">
    import { mutation, graphql, UncheckItem } from '$houdini'

    let itemID: string

    const uncheckItem = mutation<UncheckItem>(graphql`
        mutation UncheckItem($id: ID!) {
            uncheckItem(item: $id) {
                item {
                    id
                    completed
                }
            }
        }
    `)
</script>

<button on:click={() => uncheckItem({ id: itemID })}>
    Uncheck Item
</button>
```

Note: mutations usually do best when combined with at least one fragment grabbing
the information needed for the mutation (for an example of this pattern, see below.)

### Updating fields

When a mutation is responsible for updating fields of entities, houdini
should take care of the details for you as long as you request the updated data alongside the
record's id. Take for example, an `TodoItemRow` component:

```svelte
<script lang="ts">
    import { fragment, mutation, graphql, TodoItemRow } from '$houdini'

    export let item: TodoItemRow

    // the resulting store will stay up to date whenever `checkItem`
    // is triggered
    const data = fragment(
        graphql`
            fragment TodoItemRow on TodoItem {
                id
                text
                completed
            }
        `,
        item
    )

    const checkItem = mutation<CompleteItem>(graphql`
        mutation CompleteItem($id: ID!) {
            checkItem(item: $id) {
                item {
                    id
                    completed
                }
            }
        }
    `)
</script>

<li class:completed={$data.completed}>
    <input
        name={$data.text}
        class="toggle"
        type="checkbox"
        checked={$data.completed}
        on:click={handleClick}
    />
    <label for={$data.text}>{$data.text}</label>
    <button class="destroy" on:click={() => deleteItem({ id: $data.id })} />
</li>
```

### Lists

Adding and removing records from a list is done by mixing together a few different generated fragments
and directives. In order to tell the compiler which lists are targets for these operations, you have to
mark them with the `@list` directive and provide a unique name:

```graphql
query AllItems {
    items @list(name: "All_Items") {
        id
    }
}
```

It's recommended to name these lists with a different casing convention than the rest of your
application to distinguish the generated fragments from those in your codebase.

#### Inserting a record

With this field tagged, any mutation that returns an `Item` can be used to insert items in this list:

```graphql
mutation NewItem($input: AddItemInput!) {
    addItem(input: $input) {
        ...All_Items_insert
    }
}
```

#### Removing a record

Any mutation that returns an `Item` can also be used to remove an item from the list:

```graphql
mutation RemoveItem($input: RemoveItemInput!) {
    removeItem(input: $input) {
        ...All_Items_remove
    }
}
```

#### Deleting a record

Sometimes it can be tedious to remove a record from every single list that mentions it.
For these situations, Houdini provides a directive that can be used to mark a field in
the mutation response holding the ID of a record to delete from all lists.

```graphql
mutation DeleteItem($id: ID!) {
    deleteItem(id: $id) {
        itemID @Item_delete
    }
}
```

#### Conditionals

Sometimes you only want to add or remove a record from a list when an argument has a particular value.
For example, in a todo list you might only want to add the result to the list if there is no filter being
applied. To support this, houdini provides the `@when` and `@when_not` directives:

```graphql
mutation NewItem($input: AddItemInput!) {
    addItem(input: $input) {
        ...All_Items_insert @when_not(completed: true)
    }
}
```

## 🧾&nbsp;&nbsp;Subscriptions

Subscriptions in houdini are handled with the `subscription` function exported by your runtime. This function
takes a tagged document, and returns a store with the most recent value returned by the server. Keep in mind
that houdini will keep the cache (and any subscribing components) up to date as new data is encountered.

It's worth mentioning that you can use the same fragments described in the [mutation section](#mutations)
in order to update houdini's cache with the response from a subscription.

Here is an example of a simple subscription from the example application included in this repo:

```svelte
<script lang="ts">
    import {
        fragment,
        mutation,
        graphql,
        subscription,
        ItemEntry_item,
    } from '$houdini'

    // the reference we're passed from our parents
    export let item: ItemEntry_item

    // get the information we need about the item
    const data = fragment(/* ... */)

    // since we're just using subscriptions to stay up to date, we don't care about the return value
    subscription(
        graphql`
            subscription ItemUpdate($id: ID!) {
                itemUpdate(id: $id) {
                    item {
                        id
                        completed
                        text
                    }
                }
            }
        `,
        {
            id: $data.id,
        }
    )
</script>

<li class:completed={$data.completed}>
    <div class="view">
        <input
            name={$data.text}
            class="toggle"
            type="checkbox"
            checked={$data.completed}
            on:click={handleClick}
        />
        <label for={$data.text}>{$data.text}</label>
        <button class="destroy" on:click={() => deleteItem({ id: $data.id })} />
    </div>
</li>
```

### Configuring the WebSocket client

Houdini can work with any websocket client as long as you can provide an object that satisfies
the `SubscriptionHandler` interface as the second argument to the Environment's constructor. Keep in mind
that WebSocket connections only exist between the browser and your API, therefor you must remember to
pass `null` when configuring your environment on the rendering server.

#### Using `graphql-ws`

If your API supports the [`graphql-ws`](https://github.com/enisdenjo/graphql-ws) protocol, you can create a
client and pass it directly:

```typescript
// environment.ts

import { createClient } from 'graphql-ws'
import { browser } from '$app/env'

// in sapper, this would be something like `(process as any).browser`
let socketClient = browser
    ? new createClient({
            url: 'ws://api.url',
      })
    : null

export default new Environment(fetchQuery, socketClient)
```


#### Using `subscriptions-transport-ws`

If you are using the deprecated `subscriptions-transport-ws` library and associated protocol,
you will have to slightly modify the above block:


```typescript
// environment.ts

import { SubscriptionClient } from 'subscriptions-transport-ws'
import { browser } from '$app/env'

let socketClient: SubscriptionHandler | null = null
if (browser) {
    // instantiate the transport client
    const client = new SubscriptionClient('ws://api.url', {
        reconnect: true,
    })

    // wrap the client in something houdini can use
    socketClient = {
        subscribe(payload, handlers) {
            // send the request
            const { unsubscribe } = client.request(payload).subscribe(handlers)

            // return the function to unsubscribe
            return unsubscribe
        },
    }
}

export default new Environment(fetchQuery, socketClient)
```

## ♻️&nbsp;Pagination

It's often the case that you want to avoid querying an entire list from your API in order
to minimize the amount of data transfers over the network. To support this, GraphQL APIs will
"paginate" a field, allowing users to query a slice of the list. The strategy used to access
slices of a list fall into two categories. Offset-based pagination relies `offset` and `limit`
arguments and mimics the mechanisms provided by most database engines. Cursor-based pagination
is a bi-directional strategy that relies on `first`/`after` or `last`/`before` arguments and
is designed to handle modern pagination features such a infinite scrolling.

Regardless of the strategy used, houdini follows a simple pattern: wrap your document in a
"paginated" funnction (ie, `paginatedQuery` or `paginatedFragmnet`), mark the field with
`@paginate`, and provide the "page size" via the `first`, `last` or `limit` arguments to the field.
`paginatedQuery` and `paginatedFragment` behave identically: they return a `data` field containing
a svelte store with your full dataset as well as functions you can call to load the next or previous
page. For example, a simple field support offset-based pagination would look something like:

```javascript
const { loadNextPage, data } = paginatedQuery(graphql`
    query UserList {
        friends(limit: 10) @paginate {
            id
        }
    }
`)
```

and a field that supports backwards cursor-based pagination would look something like:

```javascript
const { loadPreviousPage, data } = paginatedQuery(graphql`
    query UserList {
        friends(last: 10) @paginate {
            edges {
                node {
                    id
                }
            }
        }
    }
`)
```

If you are paginating a field with a cursor-based strategy (forward or backwards), the current page
info can be looked up with the `pageInfo` store returned from the paginated function:

```svelte
<script>
    const { loadNextPage, data } = paginatedQuery(graphql`
        query UserList {
            friends(first: 10) @paginate {
                edges {
                    node {
                        id
                    }
                }
            }
        }
    `)
</script>

{#if $pageInfo.hasNextPage}
    <button onClick={() => loadNextPage()}> load more </button>
{/if}
```

### Paginated Fragments

`paginatedFragment` works very similarly to `paginatedQuery` except for a few extra things to keep
in mind. Consider the following:

```javascript
const { loadNextPage, data, pageInfo } = paginatedFragment(graphql`
    fragment UserWithFriends on User {
        friends(first: 10) @paginate {
            edges {
                node {
                    id
                }
            }
        }
    }
`)
```

In order to look up the next page for the user's friend. We need a way to query the specific user
that this fragment as been mixing into. In order to pull this off, houdini relies on the generic `Node`
interface and corresponding query:

```graphql
interface Node {
    id: ID!
}

type Query {
    node(id: ID!): Node
}
```

In short, this means that any paginated fragment must be of a type that implements the Node interface
(so it can be looked up in the api). You can read more information about the `Node` interface in
[this section](https://graphql.org/learn/global-object-identification/) of the graphql community website.
This is only a requirement for paginated fragments. If your application only uses paginated queries, 
you do not need to implement the node interface and resolver.

### Mutation Operations

A paginated field can be marked as a potential target for a mutation operation by passing
a `name` argument to the `@paginate` directive:

```javascript
const { loadNextPage, data, pageInfo } = paginatedFragment(graphql`
    fragment UserWithFriends on User {
        friends(first: 10) @paginate(name: "User_Friends") {
            edges {
                node {
                    id
                }
            }
        }
    }
`)
```

## ⚖️&nbsp;Custom Scalars

Configuring your runtime to handle custom scalars is done under the `scalars` key in your config:

```javascript
// houdini.config.js

export default {
	// ...

	scalars: {
		// the name of the scalar we are configuring
		DateTime: {
			// the corresponding typescript type
			type: 'Date',
			// turn the api's response into that type
			unmarshal(val) {
				return new Date(val)
			},
			// turn the value into something the API can use
			marshal(date) {
				return date.getTime()
			},
		},
	},
}
```

## 🔐&nbsp;&nbsp;Authentication

houdini defers to SvelteKit's sessions for authentication. Assuming that the session has been populated
somehow, you can access it through the second argument in the environment definition:

```typescript
//src/environment.ts

import { Environment } from '$houdini'

// this function can take a second argument that will contain the session
// data during a request or mutation
export default new Environment(async function ({ text, variables = {} }, session) {
    const result = await this.fetch('http://localhost:4000', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': session.token ? `Bearer ${session.token}` : null,
        },
        body: JSON.stringify({
            query: text,
            variables,
        }),
    })

    // parse the result as json
    return await result.json()
})
```

## ⚠️&nbsp;&nbsp;Notes, Constraints, and Conventions
- The compiler must be run every time the contents of a `graphql` tagged string changes
- Every GraphQL Document must have a name that is unique
- Variable functions must be named after their query
- Documents with a query must have only one operation in them
- Documents without an operation must have only one fragment in them
