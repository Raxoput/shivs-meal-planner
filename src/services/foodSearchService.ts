import { USDA_API_KEY } from '@/constants';
import { UsdaFoodItem, OpenFoodFactsItem, SearchResultItem } from '@/types';

export const searchUsdaFoods = async (query: string): Promise<UsdaFoodItem[]> => {
  if (USDA_API_KEY === 'YOUR_USDA_API_KEY' || !USDA_API_KEY) {
    throw new Error("USDA API Key is missing or invalid. Please add it to the code to search generic products.");
  }
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy&pageSize=10`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USDA API request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (data.foods && data.foods.length > 0) {
    return data.foods.map((food: any) => ({ ...food, source: 'USDA' })) as UsdaFoodItem[];
  }
  return [];
};

export const searchOpenFoodFacts = async (query: string, australiaOnly: boolean): Promise<OpenFoodFactsItem[]> => {
  let url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
  if (australiaOnly) {
    url += `&tagtype_0=countries&tag_contains_0=contains&tag_0=australia`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenFoodFacts API request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (data.products && data.products.length > 0) {
    return data.products.map((product: any) => ({ ...product, source: 'OpenFoodFacts' })) as OpenFoodFactsItem[];
  }
  return [];
};
