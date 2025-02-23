import { mapAllSettled } from './lib.ts'

async function fetchTodoTitle(url: string) {
	const response = await fetch(url, {
		headers: {
			'Accept': 'application/json',
		},
	})
	const todo = await response.json()
	return todo.title
}

async function main(): Promise<void> {
	const urls = []
	for (let i = 0; i < 200; i++) {
		urls.push(`https://jsonplaceholder.typicode.com/todos/${i}`)
	}

	// Using plain allSettled(map)
	console.time('Promise.allSettled')
	const results1 = await Promise.allSettled(urls.map(fetchTodoTitle))
	console.timeEnd('Promise.allSettled')
	console.log('------------')
	console.dir(results1)

	console.log('#'.repeat(100))

	// Using limited parallelism
	console.time('mapAllSettled')
	const results2 = await mapAllSettled(urls, fetchTodoTitle, 3)
	console.timeEnd('mapAllSettled')
	console.log('------------')
	console.dir(results2)
}

await main()
