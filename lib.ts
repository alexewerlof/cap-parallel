interface PromiseFulfilledResult<T> {
	status: 'fulfilled'
	value: T
}

interface PromiseRejectedResult {
	status: 'rejected'
	reason: unknown
}

type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult

type AsyncMapFn<T, R> = (
	value: T,
	index: number,
	array: T[],
) => Promise<R>

/**
 * Runs an async map function for one value and returns a settled promise
 * @param mapFn the async map function to be applied to each item
 * @param value current item to be processed
 * @param index index of the current item in the array
 * @param array a reference to the array being processed
 * @returns an object in the same format as Promise.allSettled()
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
 */
async function runMapFn<T, R>(
	mapFn: AsyncMapFn<T, R>,
	value: T,
	index: number,
	array: T[],
): Promise<PromiseSettledResult<R>> {
	try {
		return {
			status: 'fulfilled',
			value: await mapFn(value, index, array),
		}
	} catch (reason) {
		return {
			status: 'rejected',
			reason,
		}
	}
}

/**
 * Worker function that processes items from the shared queue (generator) and applies the async map function
 * The worker dies when there are no more items to process.
 * @param id id of the worker. This is used for logging purposes
 * @param gen a reference to the generator which will be treated as a shared queue
 * @param mapFn the async map function
 * @param result array to put the result in
 */
async function worker<T, R>(
	id: number,
	gen: Generator<[T, number, T[]]>,
	mapFn: AsyncMapFn<T, R>,
	result: PromiseSettledResult<R>[],
): Promise<void> {
	console.time(`Worker ${id}`)
	let processed = 0
	const start = Date.now()
	for (const [currentValue, index, array] of gen) {
		console.time(`Worker ${id} --- index ${index} item ${currentValue}`)
		result[index] = await runMapFn(mapFn, currentValue, index, array)
		processed++
		console.timeEnd(`Worker ${id} --- index ${index} item ${currentValue}`)
	}
	console.log(
		`Worker ${id} processed ${processed} items in a total of ${
			Date.now() - start
		}ms`,
	)
}

/**
 * This generator function will yield each item from the array along with its index and the array itself.
 * This simple generator returns the parameters that are passed to the map function.
 * The trick is to pass this function to the workers which treat it like a shared queue to pick items from.
 * @param array array of items to be processed
 */
function* mapParams<T>(array: T[]): Generator<[T, number, T[]]> {
	for (let index = 0; index < array.length; index++) {
		const currentValue = array[index]
		yield [currentValue, index, array]
	}
}

/**
 * Same as Promise.allSettled() but with limited parallelism
 * @param arr array of items to be processed
 * @param mapFn the map function to be applied to each item
 * @param concurrentLimit the maximum number of parallel workers
 * @returns settled promises in the same format as Promise.allSettled()
 */
export async function mapAllSettled<T, R>(
	arr: T[],
	mapFn: AsyncMapFn<T, R>,
	concurrentLimit: number = arr.length,
): Promise<PromiseSettledResult<R>[]> {
	const result: PromiseSettledResult<R>[] = []

	if (arr.length === 0) {
		return result
	}

	const gen = mapParams(arr)

	concurrentLimit = Math.min(concurrentLimit, arr.length)

	const workers = new Array(concurrentLimit)
	for (let i = 0; i < concurrentLimit; i++) {
		workers.push(worker(i, gen, mapFn, result))
	}

	console.log(`Initialized ${concurrentLimit} workers`)

	await Promise.all(workers)

	return result
}

export type { PromiseSettledResult }
