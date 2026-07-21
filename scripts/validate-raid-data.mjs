import { access, readFile, readdir } from 'node:fs/promises'
import { basename } from 'node:path'

const dataUrl = new URL('../public/data/raid.json', import.meta.url)
const targetsDataUrl = new URL('../public/data/raid-targets.json', import.meta.url)
const targetsDirectoryUrl = new URL('../public/media/raid/targets/', import.meta.url)
const raidData = JSON.parse(await readFile(dataUrl, 'utf8'))
const targetsData = JSON.parse(await readFile(targetsDataUrl, 'utf8'))

for (const method of raidData.methods) {
  if (method.craftable === false) {
    if (method.craftSteps.length || Object.keys(method.totalResources).length || !method.note) {
      throw new Error(`${method.id}: для некрафтового способа нужны пустые рецепты и пояснение`)
    }

    continue
  }

  const recipes = new Map(method.craftSteps.map((step) => [step.output, step]))
  const calculatedTotals = {}

  for (const step of method.craftSteps) {
    if (step.output !== 'result' && !raidData.resources[step.output]) {
      throw new Error(`${method.id}: неизвестный результат шага ${step.output}`)
    }

    for (const resourceId of Object.keys(step.ingredients)) {
      if (!raidData.resources[resourceId]) {
        throw new Error(`${method.id}: неизвестный ресурс ${resourceId}`)
      }
    }
  }

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
    throw new Error(
      `${method.id}: итоговые ресурсы не совпадают. Ожидалось ${expected}, получено ${actual}`,
    )
  }
}

const methodIds = new Set(raidData.methods.map((method) => method.id))
const requiredMethodIds = raidData.methods
  .filter((method) => method.requiredForAllTargets)
  .map((method) => method.id)
const targetIds = new Set()
const referencedImages = new Set()

for (const target of targetsData.targets) {
  if (targetIds.has(target.id)) {
    throw new Error(`Повторяющийся ID цели: ${target.id}`)
  }

  targetIds.add(target.id)

  const costs = targetsData.costProfiles[target.costProfile]

  if (!costs) {
    throw new Error(`${target.id}: профиль стоимости ${target.costProfile} не найден`)
  }

  for (const methodId of requiredMethodIds) {
    if (!Number.isInteger(costs[methodId]) || costs[methodId] <= 0) {
      throw new Error(`${target.id}: некорректная стоимость для метода ${methodId}`)
    }
  }

  for (const [methodId, amount] of Object.entries(costs)) {
    if (!methodIds.has(methodId)) {
      throw new Error(`${target.id}: неизвестный способ рейда ${methodId}`)
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`${target.id}: некорректная стоимость для метода ${methodId}`)
    }
  }

  const publicAssetPath = target.imageUrl.replace(/^\.\//, '')
  const assetUrl = new URL(`../public/${publicAssetPath}`, import.meta.url)
  await access(assetUrl)

  const imageName = basename(publicAssetPath)

  if (referencedImages.has(imageName)) {
    throw new Error(`Изображение ${imageName} назначено нескольким целям`)
  }

  referencedImages.add(imageName)
}

const targetImageFiles = (await readdir(targetsDirectoryUrl, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== '.gitkeep')
  .map((entry) => entry.name)

const unreferencedImages = targetImageFiles.filter((fileName) => !referencedImages.has(fileName))

if (unreferencedImages.length > 0) {
  throw new Error(`Изображения без цели: ${unreferencedImages.join(', ')}`)
}

const craftableMethods = raidData.methods.filter((method) => method.craftable !== false).length

console.log(
  `Проверено способов: ${raidData.methods.length}; рецептов: ${craftableMethods}; целей: ${targetsData.targets.length}`,
)
