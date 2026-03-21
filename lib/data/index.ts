// Barrel re-export for backward compatibility
// IMPORTANT: Pages should import from specific submodules (e.g. @/lib/data/species)
// to keep serverless function bundles small. This file exists only as a convenience.
export { getAllSpeciesSlugs, getSpecies, getAllSpecies } from "./species";
export { getTaxonomyTree, getAllTaxonomyTrees } from "./taxonomy";
export { getAvailableGroups, getGroupInfo } from "./groups";
export { getCommonality } from "./commonality";
export { getBrowseIndex } from "./browse";
export { getSearchIndex } from "./search";
export { getSeasonalGuide, getMonthlyGuide } from "./seasonal";
export { getNatureAreas, getSpeciesIndex } from "./map";
export { getContextualArticles, getContextualArticle, getArticlesForSpecies } from "./articles";
