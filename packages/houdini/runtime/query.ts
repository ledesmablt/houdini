// externals
import { Readable, writable, readable } from 'svelte/store'
import { onDestroy, onMount } from 'svelte'
import type { Config } from 'houdini-common'
// locals
import { Operation, GraphQLTagResult, SubscriptionSpec, QueryArtifact } from './types'
import cache from './cache'
import { setVariables } from './context'
import { executeQuery, RequestPayload } from './network'
import { marshalInputs, unmarshalSelection } from './scalars'

// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession, goTo } from './adapter.mjs'

export function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('query() must be passed a query document')
	}

	// we might get re-exported values nested under default

	// @ts-ignore: typing esm/cjs interop is hard
	const artifact: QueryArtifact = document.artifact.default || document.artifact
	// @ts-ignore: typing esm/cjs interop is hard
	const config: Config = document.config.default || document.config

	// a query is never 'loading'
	const loading = writable(false)

	// this payload has already been marshaled
	let variables = document.variables

	// embed the variables in the components context
	setVariables(() => variables)

	// dry the reference to the initial value
	const initialValue = document.initialValue?.data

	// define the store we will hold the data
	const store = writable(unmarshalSelection(config, artifact.selection, initialValue))

	// pull out the writer for internal use
	let subscriptionSpec: SubscriptionSpec | null = {
		rootType: artifact.rootType,
		selection: artifact.selection,
		variables: () => variables,
		set: store.set,
	}

	// when the component mounts
	onMount(() => {
		// if we were given data on mount
		if (initialValue) {
			// update the cache with the data that we just ran into
			cache.write({
				selection: artifact.selection,
				data: initialValue,
				variables,
			})

			// stay up to date
			if (subscriptionSpec) {
				cache.subscribe(subscriptionSpec, variables)
			}
		}
	})

	// the function used to clean up the store
	onDestroy(() => {
		subscriptionSpec = null
		cache.unsubscribe(
			{
				rootType: artifact.rootType,
				selection: artifact.selection,
				set: store.set,
				variables: () => variables,
			},
			variables
		)
	})

	const sessionStore = getSession()

	function writeData(newData: RequestPayload<_Query['result']>, newVariables: _Query['input']) {
		// write the data we received
		cache.write({
			selection: artifact.selection,
			data: newData.data,
			variables: newVariables,
		})

		// if the variables changed we need to unsubscribe from the old fields and
		// listen to the new ones
		if (subscriptionSpec && JSON.stringify(variables) !== JSON.stringify(newVariables)) {
			cache.unsubscribe(subscriptionSpec, variables)
			cache.subscribe(subscriptionSpec, newVariables)
		}

		// update the local store
		store.set(unmarshalSelection(config, artifact.selection, newData.data))

		// save the new variables
		variables = newVariables || {}
	}

	return {
		// the store should be read-only from the caller's perspective
		data: { subscribe: store.subscribe },
		// the refetch function can be used to refetch queries possibly with new variables/arguments
		async refetch(newVariables?: _Query['input']) {
			try {
				// Use the initial/previous variables
				let variableBag = variables

				// If new variables are set spread the new variables over the previous ones.
				if (newVariables) {
					variableBag = { ...variableBag, ...newVariables }
				}

				// Execute the query
				const result = await executeQuery(artifact, variableBag, sessionStore)

				// Write the data to the cache
				writeData(result, variableBag)
			} catch (error) {
				throw error
			}
		},
		// used primarily by the preprocessor to keep local state in sync with
		// the data given by preload
		writeData,
		loading: { subscribe: loading.subscribe },
		error: readable(null, () => {}),
	}
}

// we need to wrap the response from a query in something that we can
// use as a proxy to the query for refetches, writing to the cache, etc
export type QueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	writeData: (data: RequestPayload<_Data>, variables: _Input) => void
	refetch: (newVariables?: _Input) => Promise<void>
	loading: Readable<boolean>
	error: Readable<Error | null>
}

// we need something to dress up the result of `query` to be used for a route.
export const routeQuery = <_Data, _Input>(
	queryResult: QueryResponse<_Data, _Input>
	// the query handler doesn't need any extra treatment for a route
): QueryResponse<_Data, _Input> => queryResult

// component queries are implemented as wrappers over the normal query that fire the
// appropriate network request and then write the result to the underlying store
export const componentQuery = <_Data, _Input>({
	config,
	artifact,
	queryHandler,
	variableFunction,
	getProps,
}: {
	config: Config
	artifact: QueryArtifact
	queryHandler: QueryResponse<_Data, _Input>
	variableFunction: ((...args: any[]) => _Input) | null
	getProps: () => any
}): QueryResponse<_Data, _Input> => {
	// pull out the function we'll use to update the store after we've fired it
	const { writeData } = queryHandler

	// we need our own store to track loading state (the handler's isn't meaningful)
	const loading = writable(true)
	// a store to track the error state
	const error = writable<Error | null>(null)

	// compute the variables for the request
	let variables: _Input
	let variableError: ErrorWithCode | null = null

	// the function invoked by `this.error` inside of the variable function
	const setVariableError = (code: number, msg: string) => {
		// create an error
		variableError = new Error(msg) as ErrorWithCode
		variableError.code = code
		// return no variables to assign
		return null
	}

	// the context to invoke the variable function with
	const variableContext = {
		redirect: goTo,
		error: setVariableError,
	}

	$: {
		// clear any previous variable error
		variableError = null
		// compute the new variables
		variables = marshalInputs({
			artifact,
			config,
			input: variableFunction?.call(variableContext, { props: getProps() }) || {},
		}) as _Input
	}

	// a component should fire the query and then write the result to the store
	$: {
		// if there was an error while computing variables
		if (variableError) {
			error.set(variableError)
		}
		// there was no error while computing the variables
		else {
			// set the loading state
			loading.set(true)

			// fire the query
			executeQuery<_Data>(artifact, variables || {}, getSession())
				.then((result) => {
					// update the store with the new result
					writeData(result, variables)
				})
				.catch((err) => {
					error.set(err.message ? err : new Error(err))
				})
				.finally(() => {
					loading.set(false)
				})
		}
	}

	// return the handler to the user
	return {
		...queryHandler,
		loading: { subscribe: loading.subscribe },
		error: { subscribe: error.subscribe },
	}
}

type ErrorWithCode = Error & { code: number }
