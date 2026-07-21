import { readFile } from 'node:fs/promises'

const dataUrl = new URL('../public/data/raid.json', import.meta.url)
const raidData = JSON.parse(await readFile(dataUrl, 'utf8'))

for (const method of raidData.methods) {
  const recipes = new Map(method.craftSteps.map((step) => [step.output, step]))
  const calculatedTotals = {}

  function expand(resourceId, amount) {
    const recipe = recipes.get(resourceId)

    if (!recipe) {
      calculatedTotals[resourceId] = (calculatedTotals[resourceId] ?? 0) + amount
      return
    }

    const multiplier = amount / recipe.amount

    for (const [ingredientId, ingredientAmount] of Object.entries(recipe.ingredients)) {
      expand(ingredientId, ingredientAmount * multiplier)
    }
  }

  expand('result', method.yield ?? 1)

  const sortEntries = (resources) =>
    Object.fromEntries(Object.entries(resources).sort(([firstId], [secondId]) => firstId.localeCompare(secondId)))
  const expected = JSON.stringify(sortEntries(method.totalResources))
  const actual = JSON.stringify(sortEntries(calculatedTotals))

  if (actual !== expected) {
    throw new Error(`${method.id}: итоговые ресурсы не совпадают. Ожидалось ${expected}, получено ${actual}`)
  }
}

console.log(`Проверено рецептов: ${raidData.methods.length}`)
